-- Admin Console infrastructure — backing tables for the operator surfaces
-- previously rendered as scaffolds (Feature Flags, Announcements, Email
-- Templates, GDPR requests, Macros, Changelog, Experiments, Refunds, Webhook
-- endpoints, Abuse rules, Backups log, Coupons, Avatar catalog, Content
-- safety, Reconcile jobs, Workspace webhooks).
--
-- Every table here is admin-scoped: RLS denies all by default and grants only
-- to `is_admin(auth.uid())`. The webhook + brand-asset tables additionally
-- allow workspace members read access.

-- ── Helpers ──────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'is_admin'
  ) THEN
    RAISE NOTICE 'is_admin() not present — RLS policies expect it; please ensure exists';
  END IF;
END $$;

-- ── 1. Feature Flags ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  description text,
  enabled boolean NOT NULL DEFAULT false,
  rollout_percentage int NOT NULL DEFAULT 0 CHECK (rollout_percentage BETWEEN 0 AND 100),
  audience text NOT NULL DEFAULT 'all' CHECK (audience IN ('all','admin','business','enterprise','beta')),
  conditions jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON public.feature_flags(key);
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ff_admin_all" ON public.feature_flags;
CREATE POLICY "ff_admin_all" ON public.feature_flags FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "ff_read_enabled" ON public.feature_flags;
CREATE POLICY "ff_read_enabled" ON public.feature_flags FOR SELECT
  USING (enabled = true);

-- ── 2. Announcements (in-app banner system) ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','success','warning','critical')),
  audience text NOT NULL DEFAULT 'all' CHECK (audience IN ('all','admin','business','enterprise','personal')),
  cta_label text,
  cta_url text,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_announcements_active ON public.announcements(active, starts_at, ends_at);
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ann_admin_all" ON public.announcements;
CREATE POLICY "ann_admin_all" ON public.announcements FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "ann_read_active" ON public.announcements;
CREATE POLICY "ann_read_active" ON public.announcements FOR SELECT
  USING (active = true AND (ends_at IS NULL OR ends_at > now()));

-- ── 3. Email Templates ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  subject text NOT NULL,
  body_html text NOT NULL,
  body_text text,
  variables jsonb DEFAULT '[]'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "et_admin_all" ON public.email_templates;
CREATE POLICY "et_admin_all" ON public.email_templates FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ── 4. GDPR Requests ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gdpr_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('export','delete','rectification','restriction')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','rejected')),
  payload_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  handled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_gdpr_status ON public.gdpr_requests(status, created_at);
ALTER TABLE public.gdpr_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gdpr_admin_all" ON public.gdpr_requests;
CREATE POLICY "gdpr_admin_all" ON public.gdpr_requests FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "gdpr_self_read" ON public.gdpr_requests;
CREATE POLICY "gdpr_self_read" ON public.gdpr_requests FOR SELECT
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "gdpr_self_insert" ON public.gdpr_requests;
CREATE POLICY "gdpr_self_insert" ON public.gdpr_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ── 5. Support Macros ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.support_macros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  tags text[] DEFAULT '{}',
  shortcut text,
  use_count int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.support_macros ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "macros_admin_all" ON public.support_macros;
CREATE POLICY "macros_admin_all" ON public.support_macros FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ── 6. Changelog Entries ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.changelog_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text,
  title text NOT NULL,
  body_md text NOT NULL,
  category text NOT NULL DEFAULT 'feature' CHECK (category IN ('feature','fix','improvement','breaking','security')),
  published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.changelog_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cl_admin_all" ON public.changelog_entries;
CREATE POLICY "cl_admin_all" ON public.changelog_entries FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "cl_read_published" ON public.changelog_entries;
CREATE POLICY "cl_read_published" ON public.changelog_entries FOR SELECT
  USING (published = true);

-- ── 7. Experiments (A/B framework) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.experiments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  hypothesis text,
  variants jsonb NOT NULL DEFAULT '["control","treatment"]'::jsonb,
  allocation jsonb NOT NULL DEFAULT '{"control":50,"treatment":50}'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','live','paused','concluded')),
  metric_primary text,
  started_at timestamptz,
  ended_at timestamptz,
  winner text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.experiments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "exp_admin_all" ON public.experiments;
CREATE POLICY "exp_admin_all" ON public.experiments FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ── 8. Refund Requests ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.refund_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  charge_id text,
  amount_cents int NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','denied','processed')),
  stripe_refund_id text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  handled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON public.refund_requests(status, created_at);
ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rf_admin_all" ON public.refund_requests;
CREATE POLICY "rf_admin_all" ON public.refund_requests FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "rf_self_read" ON public.refund_requests;
CREATE POLICY "rf_self_read" ON public.refund_requests FOR SELECT
  USING (auth.uid() = user_id);

-- ── 9. Webhook Endpoints (workspace-scoped + admin global) ───────────────
CREATE TABLE IF NOT EXISTS public.webhook_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  url text NOT NULL,
  description text,
  events text[] NOT NULL DEFAULT '{}',
  secret text NOT NULL DEFAULT encode(gen_random_bytes(24),'hex'),
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_delivered_at timestamptz,
  failure_count int NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_webhooks_org ON public.webhook_endpoints(organization_id, active);
ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wh_admin_all" ON public.webhook_endpoints;
CREATE POLICY "wh_admin_all" ON public.webhook_endpoints FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "wh_org_members" ON public.webhook_endpoints;
CREATE POLICY "wh_org_members" ON public.webhook_endpoints FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- ── 10. Webhook Deliveries (delivery log) ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id uuid REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
  event text NOT NULL,
  payload jsonb NOT NULL,
  response_status int,
  response_body text,
  attempt int NOT NULL DEFAULT 1,
  succeeded boolean NOT NULL DEFAULT false,
  delivered_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wd_endpoint ON public.webhook_deliveries(endpoint_id, delivered_at DESC);
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wd_admin_all" ON public.webhook_deliveries;
CREATE POLICY "wd_admin_all" ON public.webhook_deliveries FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "wd_org_members" ON public.webhook_deliveries;
CREATE POLICY "wd_org_members" ON public.webhook_deliveries FOR SELECT
  USING (
    endpoint_id IN (
      SELECT id FROM public.webhook_endpoints
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid()
      )
    )
  );

-- ── 11. Abuse Rules (rate-limit + blocklist) ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.abuse_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('ip_block','email_block','rate_limit','trusted_partner')),
  pattern text NOT NULL,
  reason text,
  ttl_expires_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  hits int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_abuse_kind ON public.abuse_rules(kind, active);
ALTER TABLE public.abuse_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "abuse_admin_all" ON public.abuse_rules;
CREATE POLICY "abuse_admin_all" ON public.abuse_rules FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ── 12. Backups Log ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.db_backups_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  size_bytes bigint,
  storage_path text,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','success','failed','retained','expired')),
  notes text
);
ALTER TABLE public.db_backups_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bk_admin_all" ON public.db_backups_log;
CREATE POLICY "bk_admin_all" ON public.db_backups_log FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ── 13. Coupons (mirror of Stripe coupons for read + admin actions) ──────
CREATE TABLE IF NOT EXISTS public.discount_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text,
  percent_off int CHECK (percent_off BETWEEN 0 AND 100),
  amount_off_cents int CHECK (amount_off_cents >= 0),
  currency text DEFAULT 'usd',
  duration text NOT NULL DEFAULT 'once' CHECK (duration IN ('once','repeating','forever')),
  duration_in_months int,
  max_redemptions int,
  times_redeemed int NOT NULL DEFAULT 0,
  expires_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  stripe_coupon_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.discount_coupons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cp_admin_all" ON public.discount_coupons;
CREATE POLICY "cp_admin_all" ON public.discount_coupons FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ── 14. Avatar Catalog ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.avatar_catalog_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  category text,
  thumbnail_url text,
  preview_video_url text,
  tags text[] DEFAULT '{}',
  featured boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT true,
  rank int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_avc_enabled ON public.avatar_catalog_entries(enabled, rank);
ALTER TABLE public.avatar_catalog_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "avc_admin_all" ON public.avatar_catalog_entries;
CREATE POLICY "avc_admin_all" ON public.avatar_catalog_entries FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "avc_read_enabled" ON public.avatar_catalog_entries;
CREATE POLICY "avc_read_enabled" ON public.avatar_catalog_entries FOR SELECT
  USING (enabled = true);

-- ── 15. Content Safety Rules (in addition to shared blocklist) ───────────
CREATE TABLE IF NOT EXISTS public.content_safety_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern text NOT NULL,
  match_type text NOT NULL DEFAULT 'substring' CHECK (match_type IN ('substring','regex','exact')),
  severity text NOT NULL DEFAULT 'warn' CHECK (severity IN ('warn','block')),
  category text,
  active boolean NOT NULL DEFAULT true,
  hits int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.content_safety_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "csr_admin_all" ON public.content_safety_rules;
CREATE POLICY "csr_admin_all" ON public.content_safety_rules FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ── 16. Reconcile Jobs (Stripe ↔ Supabase reconciliation) ────────────────
CREATE TABLE IF NOT EXISTS public.reconcile_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','success','partial','failed')),
  scanned int DEFAULT 0,
  matched int DEFAULT 0,
  discrepancies int DEFAULT 0,
  report jsonb,
  triggered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.reconcile_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rj_admin_all" ON public.reconcile_jobs;
CREATE POLICY "rj_admin_all" ON public.reconcile_jobs FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ── 17. Custom Roles (RBAC for Enterprise) ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.custom_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_custom_role_per_org ON public.custom_roles(organization_id, name);
ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cr_admin_all" ON public.custom_roles;
CREATE POLICY "cr_admin_all" ON public.custom_roles FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "cr_org_members" ON public.custom_roles;
CREATE POLICY "cr_org_members" ON public.custom_roles FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- ── 18. Workspace Integrations (Drive/Notion/Slack tokens) ───────────────
CREATE TABLE IF NOT EXISTS public.workspace_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('google_drive','notion','slack','zapier','dropbox')),
  external_account_id text,
  display_name text,
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  scopes text[],
  metadata jsonb DEFAULT '{}'::jsonb,
  connected_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  connected_at timestamptz NOT NULL DEFAULT now(),
  last_synced_at timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked','expired','error'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_workspace_integration_per_provider ON public.workspace_integrations(organization_id, provider);
ALTER TABLE public.workspace_integrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wi_org_members" ON public.workspace_integrations;
CREATE POLICY "wi_org_members" ON public.workspace_integrations FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- ── 19. Brand Assets (logo uploads) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.workspace_brand_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('logo_primary','logo_dark','logo_mark','wordmark','favicon')),
  storage_path text NOT NULL,
  public_url text,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_workspace_brand_asset ON public.workspace_brand_assets(organization_id, kind);
ALTER TABLE public.workspace_brand_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wba_org_members" ON public.workspace_brand_assets;
CREATE POLICY "wba_org_members" ON public.workspace_brand_assets FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- ── 20. Storage bucket for brand assets ──────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('workspace-brand', 'workspace-brand', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "brand_read_public" ON storage.objects;
CREATE POLICY "brand_read_public" ON storage.objects FOR SELECT
  USING (bucket_id = 'workspace-brand');

DROP POLICY IF EXISTS "brand_write_org_members" ON storage.objects;
CREATE POLICY "brand_write_org_members" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'workspace-brand'
    AND (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "brand_delete_org_members" ON storage.objects;
CREATE POLICY "brand_delete_org_members" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'workspace-brand'
    AND (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- ── 21. Seed system feature flags (idempotent) ───────────────────────────
INSERT INTO public.feature_flags (key, description, enabled, rollout_percentage, audience)
VALUES
  ('motion_transfer.enabled', 'Motion Transfer mode is selectable', true, 100, 'all'),
  ('webhooks.enabled', 'Workspace webhooks UI', true, 100, 'business'),
  ('integrations.drive', 'Google Drive workspace integration', false, 0, 'business'),
  ('integrations.notion', 'Notion workspace integration', false, 0, 'business'),
  ('enterprise.sso', 'Enterprise SSO/SAML', false, 0, 'enterprise'),
  ('enterprise.custom_roles', 'Custom RBAC roles for Enterprise', false, 0, 'enterprise')
ON CONFLICT (key) DO NOTHING;
