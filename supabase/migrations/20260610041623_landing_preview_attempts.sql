-- Landing-page Inline Sandbox — attempt log.
--
-- Tracks public, unauthenticated preview generations from the landing page
-- so we can rate-limit per IP and per platform without holding the cost in
-- application memory. RLS denies all SELECT/UPDATE/DELETE; only the
-- service-role landing-preview edge function inserts here.

CREATE TABLE IF NOT EXISTS public.landing_preview_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_ip text NOT NULL,
  prompt text NOT NULL,
  status text NOT NULL DEFAULT 'ok',
  prediction_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lpa_ip_day
  ON public.landing_preview_attempts (client_ip, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lpa_created
  ON public.landing_preview_attempts (created_at DESC);

ALTER TABLE public.landing_preview_attempts ENABLE ROW LEVEL SECURITY;

-- No public SELECT/UPDATE/DELETE — only the service role (the edge function)
-- can read/write this table.
DROP POLICY IF EXISTS "lpa_no_access" ON public.landing_preview_attempts;
CREATE POLICY "lpa_no_access" ON public.landing_preview_attempts
  FOR SELECT USING (false);

COMMENT ON TABLE public.landing_preview_attempts IS
  'One row per landing-page Inline Sandbox preview attempt. Used by the landing-preview edge function for rate-limiting; never exposed to clients.';
