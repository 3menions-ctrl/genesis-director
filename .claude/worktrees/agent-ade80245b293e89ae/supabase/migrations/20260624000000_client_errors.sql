-- client_errors — capture every uncaught render error and every
-- `surfaceError` / `RootErrorBoundary` report from the SPA. Distinct from
-- `error_reports` (typed AppError telemetry) so production triage can pull a
-- focused stream without category/severity noise.
--
-- INSERT policy is intentionally permissive: clients in a crashed state may be
-- pre-auth, post-logout, or unable to refresh their JWT. The trade-off is
-- visibility into the worst failures.

CREATE TABLE IF NOT EXISTS public.client_errors (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  surface      text NOT NULL,
  action       text NOT NULL,
  message      text NOT NULL,
  stack        text,
  user_agent   text,
  page_url     text,
  extra        jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.client_errors IS 'Browser-side error reports from RootErrorBoundary and surfaceError. INSERT is open to anon — clients may report while signed out or mid-crash.';
COMMENT ON COLUMN public.client_errors.surface IS 'Logical UI surface, e.g. editor.save, library.add, comments.post';
COMMENT ON COLUMN public.client_errors.action  IS 'Specific action attempted, e.g. persist-project, render';

CREATE INDEX IF NOT EXISTS client_errors_created_at_idx ON public.client_errors (created_at DESC);
CREATE INDEX IF NOT EXISTS client_errors_surface_idx    ON public.client_errors (surface, created_at DESC);
CREATE INDEX IF NOT EXISTS client_errors_user_idx       ON public.client_errors (user_id, created_at DESC) WHERE user_id IS NOT NULL;

ALTER TABLE public.client_errors ENABLE ROW LEVEL SECURITY;

-- Anyone may INSERT a report. The edge function (`report-client-error`)
-- runs with the anon key and writes the row. We never expose this table to the
-- PostgREST client directly for INSERT — but the policy below ensures even if
-- a future code path used the JS client, the row would still land.
DROP POLICY IF EXISTS "Anyone can insert client errors" ON public.client_errors;
CREATE POLICY "Anyone can insert client errors"
ON public.client_errors
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Only admins may read.
DROP POLICY IF EXISTS "Admins can read client errors" ON public.client_errors;
CREATE POLICY "Admins can read client errors"
ON public.client_errors
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Admins may delete (for triage / GDPR scrub).
DROP POLICY IF EXISTS "Admins can delete client errors" ON public.client_errors;
CREATE POLICY "Admins can delete client errors"
ON public.client_errors
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));
