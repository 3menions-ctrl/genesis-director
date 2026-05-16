-- Typed application error telemetry sink.
CREATE TABLE IF NOT EXISTS public.error_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  category text NOT NULL CHECK (category IN ('auth','validation','network','pipeline','billing','permission','unknown')),
  severity text NOT NULL CHECK (severity IN ('debug','info','warning','error','fatal')),
  code text NOT NULL,
  user_message text,
  technical_message text,
  stack text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  page_url text,
  user_agent text,
  session_id text,
  app_version text,
  retryable boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_error_reports_user_id      ON public.error_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_error_reports_occurred_at  ON public.error_reports(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_reports_category     ON public.error_reports(category);
CREATE INDEX IF NOT EXISTS idx_error_reports_severity     ON public.error_reports(severity);

ALTER TABLE public.error_reports ENABLE ROW LEVEL SECURITY;

-- Authenticated users can insert their own error reports. user_id may be NULL
-- for pre-auth failures, in which case anyone can insert (still rate-limited
-- at the gateway). The CHECK ensures the row is bound to the JWT subject when set.
DROP POLICY IF EXISTS "users insert own error reports" ON public.error_reports;
CREATE POLICY "users insert own error reports"
  ON public.error_reports
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- Admins can read all reports for triage.
DROP POLICY IF EXISTS "admins read error reports" ON public.error_reports;
CREATE POLICY "admins read error reports"
  ON public.error_reports
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Service role has implicit access; no UPDATE/DELETE policies → append-only.
-- Explicitly block UPDATE/DELETE for non-service-role just in case.
REVOKE UPDATE, DELETE ON public.error_reports FROM authenticated, anon;