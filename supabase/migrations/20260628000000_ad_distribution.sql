-- =========================================================
-- Ad Distribution — connect social channels + publish/schedule
-- ads to them. Phase 3 of the advertising program.
--
--   channel_connections        — one row per (org, provider). Non-secret.
--   channel_connection_secrets — OAuth tokens, SERVICE-ROLE ONLY (no
--                                authenticated RLS policy → members can never
--                                read tokens via the anon key).
--   distribution_jobs          — a publish/schedule job per (production, channel).
--
-- All app access is brokered by the distribution-manage edge function (service
-- role), so the frontend never queries these tables directly. RLS still scopes
-- member reads as defense-in-depth.
-- =========================================================

-- ── channel_connections ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.channel_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('meta','tiktok','youtube','linkedin')),
  status text NOT NULL DEFAULT 'disconnected'
    CHECK (status IN ('disconnected','pending','connected','error','pending_credentials')),
  account_label text,
  account_external_id text,
  scopes text,
  -- OAuth CSRF state for an in-flight authorize → callback handshake.
  oauth_state text,
  last_error text,
  connected_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  connected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_channel_connections_org ON public.channel_connections(organization_id);
CREATE INDEX IF NOT EXISTS idx_channel_connections_state ON public.channel_connections(oauth_state) WHERE oauth_state IS NOT NULL;

ALTER TABLE public.channel_connections ENABLE ROW LEVEL SECURITY;

-- NO authenticated SELECT policy on purpose. This row carries `oauth_state` —
-- the single CSRF defense for the unauthenticated OAuth callback — and RLS is
-- row-level, not column-level, so any member-readable SELECT would leak state
-- and enable OAuth connection-injection. The frontend reads connections only
-- through the distribution-manage edge function (service role), which projects
-- a safe, secret-free column list. So members never need direct table reads.
DROP POLICY IF EXISTS "channel_connections_select_member" ON public.channel_connections;

DROP POLICY IF EXISTS "channel_connections_service_all" ON public.channel_connections;
CREATE POLICY "channel_connections_service_all" ON public.channel_connections
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER update_channel_connections_updated_at
  BEFORE UPDATE ON public.channel_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── channel_connection_secrets — tokens, service role only ───
CREATE TABLE IF NOT EXISTS public.channel_connection_secrets (
  connection_id uuid PRIMARY KEY REFERENCES public.channel_connections(id) ON DELETE CASCADE,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.channel_connection_secrets ENABLE ROW LEVEL SECURITY;

-- NO authenticated policy on purpose — only the service role (edge functions)
-- can ever read or write OAuth tokens.
DROP POLICY IF EXISTS "channel_connection_secrets_service_all" ON public.channel_connection_secrets;
CREATE POLICY "channel_connection_secrets_service_all" ON public.channel_connection_secrets
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER update_channel_connection_secrets_updated_at
  BEFORE UPDATE ON public.channel_connection_secrets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── distribution_jobs ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.distribution_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- Soft reference to a production; no FK so this stays decoupled from the
  -- projects table's exact shape.
  project_id uuid,
  provider text NOT NULL CHECK (provider IN ('meta','tiktok','youtube','linkedin')),
  connection_id uuid REFERENCES public.channel_connections(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','scheduled','publishing','posted','failed','pending_credentials','canceled')),
  title text,
  caption text,
  hashtags text,
  cta text,
  asset_url text,
  aspect_ratio text,
  scheduled_at timestamptz,
  posted_at timestamptz,
  external_post_id text,
  external_url text,
  error text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_distribution_jobs_org ON public.distribution_jobs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_distribution_jobs_status ON public.distribution_jobs(status);
CREATE INDEX IF NOT EXISTS idx_distribution_jobs_scheduled ON public.distribution_jobs(scheduled_at) WHERE scheduled_at IS NOT NULL;

ALTER TABLE public.distribution_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "distribution_jobs_select_member" ON public.distribution_jobs;
CREATE POLICY "distribution_jobs_select_member" ON public.distribution_jobs
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()) OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "distribution_jobs_service_all" ON public.distribution_jobs;
CREATE POLICY "distribution_jobs_service_all" ON public.distribution_jobs
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER update_distribution_jobs_updated_at
  BEFORE UPDATE ON public.distribution_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
