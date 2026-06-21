-- ════════════════════════════════════════════════════════════════════════
-- render_failures — structured telemetry for every stitcher failure.
--
-- Previously the only signal a render had failed in production was a
-- console.error in the edge-function log + the user's "my render is
-- broken" message in support. Triaging meant tailing logs, guessing
-- what input shape caused the crash, and shipping a fix blind.
--
-- This table captures: the project, the failure classification (one
-- of a small enum so the admin dashboard can histogram), the message,
-- the stitcher version that ran, and a JSONB snapshot of the input
-- shape (clip count, aspect, format, has-grade, has-effects, ...).
--
-- RLS:
--   • service_role inserts (the edge function uses its service-role
--     client to write).
--   • admins read all (powers the /admin/observability dashboard).
--   • everyone else: no access. Failures may leak project metadata
--     so we don't expose them to the owning user.
-- ════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Table
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.render_failures (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  /** The project being rendered when the failure occurred. Nullable
   *  for clip-mode renders (sessionId-namespaced) that don't have a
   *  project row. */
  project_id               uuid REFERENCES public.movie_projects(id) ON DELETE CASCADE,
  /** The user who initiated the render, for support follow-ups.
   *  Nullable because some callers (system pipelines, watchdog
   *  re-runs) aren't a user. */
  user_id                  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  /** Short classifier — histogram bucket on the dashboard.
   *  Keep the enum tight; a new failure mode adds a new value. */
  classification           text NOT NULL
                           CHECK (classification IN (
                             'input_invalid',     -- missing fields, bad clip list
                             'auth_revalidate',   -- token expired between submit + run
                             'replicate_submit',  -- POST /predictions failed
                             'replicate_failed',  -- pred.status = failed/canceled
                             'replicate_timeout', -- 4-minute poll deadline hit
                             'byte_check_fail',   -- output too small / not MP4
                             'persistence_fail',  -- upload to storage failed
                             'sign_url_fail',     -- signed URL creation failed
                             'unknown'            -- caught fall-through
                           )),
  /** The full error message — bounded for safety, indexed for search. */
  message                  text NOT NULL CHECK (length(message) <= 2000),
  /** Short hash identifying the stitcher build that ran. Lets us
   *  attribute a regression to a specific deploy. */
  stitcher_version         text,
  /** Shape of the request — clip count, aspect, format, flags. JSONB so
   *  new diagnostic fields don't require migrations. */
  input_shape              jsonb NOT NULL DEFAULT '{}'::jsonb,
  /** Whether the failure happened on a cached/idempotent re-request
   *  (forceRestitch=true) — useful for detecting retry-storm patterns. */
  is_retry                 boolean NOT NULL DEFAULT false,
  /** When the failure was recorded. */
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_render_failures_created
  ON public.render_failures(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_render_failures_project
  ON public.render_failures(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_render_failures_classification
  ON public.render_failures(classification, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. RLS
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.render_failures ENABLE ROW LEVEL SECURITY;

-- Admins read every failure.
DROP POLICY IF EXISTS "RenderFailures: admins read all" ON public.render_failures;
CREATE POLICY "RenderFailures: admins read all" ON public.render_failures
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- service_role gets full access via PostgREST's bypass — no explicit
-- policy needed for it. We do NOT grant insert to authenticated users
-- so a compromised client can't pollute the failure stream.

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Admin RPCs — fast aggregates for the dashboard
-- ─────────────────────────────────────────────────────────────────────────

-- Failure histogram by classification over a configurable window.
CREATE OR REPLACE FUNCTION public.render_failures_histogram(window_hours int DEFAULT 24)
RETURNS TABLE (classification text, n bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT classification, count(*)::bigint AS n
  FROM public.render_failures
  WHERE created_at > now() - make_interval(hours => window_hours)
  GROUP BY classification
  ORDER BY n DESC;
$$;

REVOKE ALL ON FUNCTION public.render_failures_histogram(int) FROM public;
GRANT EXECUTE ON FUNCTION public.render_failures_histogram(int) TO authenticated;
COMMENT ON FUNCTION public.render_failures_histogram IS
  'Returns failure counts grouped by classification over the last N hours.';

-- Success-rate gauge: failures vs. (successes from movie_projects.video_url
-- updates) over a window. Honest about its sampling boundaries — this is
-- an approximation, not a precise count of every render attempt.
CREATE OR REPLACE FUNCTION public.render_success_snapshot(window_hours int DEFAULT 24)
RETURNS TABLE (
  failures             bigint,
  projects_updated     bigint,
  success_rate_pct     numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH
    f AS (
      SELECT count(*)::bigint AS n
      FROM public.render_failures
      WHERE created_at > now() - make_interval(hours => window_hours)
    ),
    s AS (
      SELECT count(*)::bigint AS n
      FROM public.movie_projects
      WHERE video_url IS NOT NULL
        AND updated_at > now() - make_interval(hours => window_hours)
    )
  SELECT
    f.n AS failures,
    s.n AS projects_updated,
    CASE
      WHEN (f.n + s.n) = 0 THEN NULL
      ELSE round(100.0 * s.n / (f.n + s.n), 1)
    END AS success_rate_pct
  FROM f, s;
$$;

REVOKE ALL ON FUNCTION public.render_success_snapshot(int) FROM public;
GRANT EXECUTE ON FUNCTION public.render_success_snapshot(int) TO authenticated;
COMMENT ON FUNCTION public.render_success_snapshot IS
  'Approximate render success rate over the last N hours.';
