-- =========================================================
-- 0. PROFILE SUSPENSION FIELDS (used by admin RPCs)
-- =========================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspension_reason text;

-- =========================================================
-- 1. SUBSCRIPTIONS (Stripe-mirrored, env-aware, seat-aware)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  stripe_subscription_id text NOT NULL,
  stripe_customer_id text NOT NULL,
  product_id text,
  price_id text NOT NULL,
  seat_price_id text,
  seats integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  environment text NOT NULL DEFAULT 'sandbox',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stripe_subscription_id, environment)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_env ON public.subscriptions(user_id, environment);
CREATE INDEX IF NOT EXISTS idx_subscriptions_org_env ON public.subscriptions(organization_id, environment);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscriptions_select_own" ON public.subscriptions;
CREATE POLICY "subscriptions_select_own" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (organization_id IS NOT NULL AND public.is_org_member(organization_id, auth.uid()))
    OR public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "subscriptions_service_all" ON public.subscriptions;
CREATE POLICY "subscriptions_service_all" ON public.subscriptions
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.has_active_subscription(p_user_id uuid, p_env text DEFAULT 'live')
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = p_user_id AND environment = p_env
      AND (
        (status IN ('active','trialing','past_due')
         AND (current_period_end IS NULL OR current_period_end > now()))
        OR (status = 'canceled' AND current_period_end > now())
      )
  );
$$;

-- Mirror tier/type back to the profile whenever a subscription is upserted
CREATE OR REPLACE FUNCTION public.sync_subscription_to_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_active boolean;
  v_type text;
  v_tier text;
BEGIN
  v_active := NEW.status IN ('active','trialing','past_due')
              AND (NEW.current_period_end IS NULL OR NEW.current_period_end > now());

  -- price_id → (account_type, account_tier) per Bible
  v_type := CASE NEW.price_id
    WHEN 'starter_monthly'    THEN 'personal'
    WHEN 'pro_monthly'        THEN 'personal'
    WHEN 'pro_yearly'         THEN 'personal'
    WHEN 'growth_monthly'     THEN 'business'
    WHEN 'growth_yearly'      THEN 'business'
    WHEN 'scale_monthly'      THEN 'business'
    WHEN 'scale_yearly'       THEN 'business'
    WHEN 'enterprise_monthly' THEN 'enterprise'
    WHEN 'enterprise_yearly'  THEN 'enterprise'
    ELSE NULL
  END;
  v_tier := CASE NEW.price_id
    WHEN 'starter_monthly'    THEN 'free'
    WHEN 'pro_monthly'        THEN 'pro'
    WHEN 'pro_yearly'         THEN 'pro'
    WHEN 'growth_monthly'     THEN 'growth'
    WHEN 'growth_yearly'      THEN 'growth'
    WHEN 'scale_monthly'      THEN 'scale'
    WHEN 'scale_yearly'       THEN 'scale'
    WHEN 'enterprise_monthly' THEN 'enterprise'
    WHEN 'enterprise_yearly'  THEN 'enterprise'
    ELSE NULL
  END;

  IF v_active AND v_type IS NOT NULL THEN
    UPDATE public.profiles
    SET account_type = v_type, account_tier = v_tier, updated_at = now()
    WHERE id = NEW.user_id;
  ELSIF NOT v_active THEN
    UPDATE public.profiles
    SET account_tier = 'free', updated_at = now()
    WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_subscription_to_profile ON public.subscriptions;
CREATE TRIGGER trg_sync_subscription_to_profile
  AFTER INSERT OR UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.sync_subscription_to_profile();

-- =========================================================
-- 2. ORG PLAN FEATURES (declarative tier capabilities)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.org_plan_features (
  plan text PRIMARY KEY,
  max_seats integer NOT NULL,
  max_concurrent_renders integer NOT NULL,
  included_credits_monthly integer NOT NULL DEFAULT 0,
  brand_kits_enabled boolean NOT NULL DEFAULT false,
  shared_assets_enabled boolean NOT NULL DEFAULT false,
  sso_enabled boolean NOT NULL DEFAULT false,
  api_access boolean NOT NULL DEFAULT false,
  dedicated_lane boolean NOT NULL DEFAULT false,
  sla_response_hours integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.org_plan_features ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_plan_features_read_all" ON public.org_plan_features;
CREATE POLICY "org_plan_features_read_all" ON public.org_plan_features
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "org_plan_features_admin_write" ON public.org_plan_features;
CREATE POLICY "org_plan_features_admin_write" ON public.org_plan_features
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

INSERT INTO public.org_plan_features
  (plan, max_seats, max_concurrent_renders, included_credits_monthly, brand_kits_enabled, shared_assets_enabled, sso_enabled, api_access, dedicated_lane, sla_response_hours)
VALUES
  ('starter',    1,   1,    0,   false, false, false, false, false, NULL),
  ('growth',     10,  3,    500, true,  true,  false, false, false, 48),
  ('scale',      50,  10,   2500,true,  true,  false, true,  false, 24),
  ('enterprise', 9999,50,   10000,true, true,  true,  true,  true,  4)
ON CONFLICT (plan) DO UPDATE SET
  max_seats = EXCLUDED.max_seats,
  max_concurrent_renders = EXCLUDED.max_concurrent_renders,
  included_credits_monthly = EXCLUDED.included_credits_monthly,
  brand_kits_enabled = EXCLUDED.brand_kits_enabled,
  shared_assets_enabled = EXCLUDED.shared_assets_enabled,
  sso_enabled = EXCLUDED.sso_enabled,
  api_access = EXCLUDED.api_access,
  dedicated_lane = EXCLUDED.dedicated_lane,
  sla_response_hours = EXCLUDED.sla_response_hours;

-- =========================================================
-- 3. ORG SEATS (drives per-seat Stripe quantity)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.org_seats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.org_role NOT NULL DEFAULT 'editor',
  assigned_by uuid,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by uuid,
  UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_seats_org_active
  ON public.org_seats(organization_id) WHERE revoked_at IS NULL;

ALTER TABLE public.org_seats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_seats_select" ON public.org_seats;
CREATE POLICY "org_seats_select" ON public.org_seats
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()) OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "org_seats_admin_manage" ON public.org_seats;
CREATE POLICY "org_seats_admin_manage" ON public.org_seats
  FOR ALL TO authenticated
  USING (
    public.has_org_permission(organization_id, auth.uid(), 'admin')
    OR public.is_admin(auth.uid())
  )
  WITH CHECK (
    public.has_org_permission(organization_id, auth.uid(), 'admin')
    OR public.is_admin(auth.uid())
  );

CREATE OR REPLACE FUNCTION public.get_org_seat_count(p_org_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COUNT(*)::int FROM public.org_seats
  WHERE organization_id = p_org_id AND revoked_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.assign_org_seat(
  p_org_id uuid, p_user_id uuid, p_role public.org_role DEFAULT 'editor'
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_max integer;
  v_current integer;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF NOT public.has_org_permission(p_org_id, v_caller, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions');
  END IF;

  SELECT f.max_seats INTO v_max
  FROM public.organizations o
  JOIN public.org_plan_features f ON f.plan = o.plan
  WHERE o.id = p_org_id;

  v_current := public.get_org_seat_count(p_org_id);
  IF v_current >= v_max THEN
    RETURN jsonb_build_object('success', false, 'error', 'Seat limit reached for plan');
  END IF;

  INSERT INTO public.org_seats (organization_id, user_id, role, assigned_by)
  VALUES (p_org_id, p_user_id, p_role, v_caller)
  ON CONFLICT (organization_id, user_id)
  DO UPDATE SET role = EXCLUDED.role, revoked_at = NULL, revoked_by = NULL;

  -- Mirror as org member
  INSERT INTO public.organization_members (organization_id, user_id, role, invited_by)
  VALUES (p_org_id, p_user_id, p_role, v_caller)
  ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  RETURN jsonb_build_object('success', true, 'seats', public.get_org_seat_count(p_org_id));
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_org_seat(p_org_id uuid, p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF NOT public.has_org_permission(p_org_id, v_caller, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions');
  END IF;

  UPDATE public.org_seats
  SET revoked_at = now(), revoked_by = v_caller
  WHERE organization_id = p_org_id AND user_id = p_user_id AND revoked_at IS NULL;

  DELETE FROM public.organization_members
  WHERE organization_id = p_org_id AND user_id = p_user_id AND role <> 'owner';

  RETURN jsonb_build_object('success', true, 'seats', public.get_org_seat_count(p_org_id));
END;
$$;

-- =========================================================
-- 4. BRAND KITS (real table, multi-kit per org)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.brand_kits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  logo_url text,
  primary_color text,
  accent_color text,
  background_color text,
  text_color text,
  font_heading text,
  font_body text,
  voice_tone text,
  voice_style text,
  guidelines_url text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_kits_org ON public.brand_kits(organization_id);

ALTER TABLE public.brand_kits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "brand_kits_select_members" ON public.brand_kits;
CREATE POLICY "brand_kits_select_members" ON public.brand_kits
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()) OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "brand_kits_write_editors" ON public.brand_kits;
CREATE POLICY "brand_kits_write_editors" ON public.brand_kits
  FOR ALL TO authenticated
  USING (
    public.has_org_permission(organization_id, auth.uid(), 'editor')
    OR public.is_admin(auth.uid())
  )
  WITH CHECK (
    public.has_org_permission(organization_id, auth.uid(), 'editor')
    OR public.is_admin(auth.uid())
  );

CREATE TRIGGER update_brand_kits_updated_at
  BEFORE UPDATE ON public.brand_kits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 5. ORG SHARED ASSETS (videos/images/voices/audio)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.org_shared_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  asset_type text NOT NULL CHECK (asset_type IN ('video','image','audio','voice','character','project')),
  asset_url text,
  source_id uuid,
  title text,
  description text,
  tags text[],
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  shared_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shared_assets_org_type
  ON public.org_shared_assets(organization_id, asset_type);

ALTER TABLE public.org_shared_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shared_assets_select_members" ON public.org_shared_assets;
CREATE POLICY "shared_assets_select_members" ON public.org_shared_assets
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()) OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "shared_assets_write_editors" ON public.org_shared_assets;
CREATE POLICY "shared_assets_write_editors" ON public.org_shared_assets
  FOR INSERT TO authenticated
  WITH CHECK (
    shared_by = auth.uid() AND (
      public.has_org_permission(organization_id, auth.uid(), 'editor')
      OR public.is_admin(auth.uid())
    )
  );

DROP POLICY IF EXISTS "shared_assets_update_editors" ON public.org_shared_assets;
CREATE POLICY "shared_assets_update_editors" ON public.org_shared_assets
  FOR UPDATE TO authenticated
  USING (
    public.has_org_permission(organization_id, auth.uid(), 'editor')
    OR public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "shared_assets_delete_admins" ON public.org_shared_assets;
CREATE POLICY "shared_assets_delete_admins" ON public.org_shared_assets
  FOR DELETE TO authenticated
  USING (
    public.has_org_permission(organization_id, auth.uid(), 'admin')
    OR shared_by = auth.uid()
    OR public.is_admin(auth.uid())
  );

CREATE TRIGGER update_shared_assets_updated_at
  BEFORE UPDATE ON public.org_shared_assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 6. ENTERPRISE PROVISIONING WORKFLOW
-- =========================================================
CREATE TABLE IF NOT EXISTS public.enterprise_provisioning (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_inquiry_id uuid REFERENCES public.sales_inquiries(id) ON DELETE SET NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  primary_contact_email text NOT NULL,
  company_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','contracted','provisioned','active','suspended','cancelled')),
  contract_value_cents integer,
  contract_start_at timestamptz,
  contract_end_at timestamptz,
  included_seats integer NOT NULL DEFAULT 10,
  included_credits_monthly integer NOT NULL DEFAULT 10000,
  notes text,
  assigned_admin uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.enterprise_provisioning ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ep_admin_all" ON public.enterprise_provisioning;
CREATE POLICY "ep_admin_all" ON public.enterprise_provisioning
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "ep_owner_read" ON public.enterprise_provisioning;
CREATE POLICY "ep_owner_read" ON public.enterprise_provisioning
  FOR SELECT TO authenticated
  USING (
    organization_id IS NOT NULL
    AND public.has_org_permission(organization_id, auth.uid(), 'owner')
  );

CREATE TRIGGER update_enterprise_provisioning_updated_at
  BEFORE UPDATE ON public.enterprise_provisioning
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 7. SSO DOMAIN MAPPINGS (SAML auto-routing)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.sso_domain_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  saml_provider_id text,
  is_verified boolean NOT NULL DEFAULT false,
  verification_token text,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (domain)
);

ALTER TABLE public.sso_domain_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sso_admin_all" ON public.sso_domain_mappings;
CREATE POLICY "sso_admin_all" ON public.sso_domain_mappings
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "sso_owner_read" ON public.sso_domain_mappings;
CREATE POLICY "sso_owner_read" ON public.sso_domain_mappings
  FOR SELECT TO authenticated
  USING (public.has_org_permission(organization_id, auth.uid(), 'owner'));

DROP POLICY IF EXISTS "sso_public_read_verified" ON public.sso_domain_mappings;
CREATE POLICY "sso_public_read_verified" ON public.sso_domain_mappings
  FOR SELECT TO anon
  USING (is_verified = true);

CREATE OR REPLACE FUNCTION public.find_org_by_email_domain(p_email text)
RETURNS TABLE(organization_id uuid, saml_provider_id text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT s.organization_id, s.saml_provider_id
  FROM public.sso_domain_mappings s
  WHERE s.domain = LOWER(split_part(p_email, '@', 2))
    AND s.is_verified = true
  LIMIT 1;
$$;

-- =========================================================
-- 8. ADMIN IMPERSONATION SESSIONS (audit-only)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.admin_impersonation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  reason text NOT NULL,
  expires_at timestamptz NOT NULL,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_impersonation_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "imp_admin_all" ON public.admin_impersonation_sessions;
CREATE POLICY "imp_admin_all" ON public.admin_impersonation_sessions
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- =========================================================
-- 9. ADMIN LIFECYCLE RPCs
-- =========================================================
CREATE OR REPLACE FUNCTION public.admin_change_account_type(
  p_target_user uuid, p_new_type text, p_reason text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_old text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_new_type NOT IN ('personal','business','enterprise','admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid account type');
  END IF;

  SELECT account_type INTO v_old FROM public.profiles WHERE id = p_target_user;
  UPDATE public.profiles SET account_type = p_new_type, updated_at = now() WHERE id = p_target_user;

  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (auth.uid(), 'change_account_type', 'user', p_target_user::text,
    jsonb_build_object('old', v_old, 'new', p_new_type, 'reason', p_reason));

  RETURN jsonb_build_object('success', true, 'old', v_old, 'new', p_new_type);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_force_tier(
  p_target_user uuid, p_new_tier text, p_reason text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_old text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT account_tier INTO v_old FROM public.profiles WHERE id = p_target_user;
  UPDATE public.profiles SET account_tier = p_new_tier, updated_at = now() WHERE id = p_target_user;

  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (auth.uid(), 'force_tier', 'user', p_target_user::text,
    jsonb_build_object('old', v_old, 'new', p_new_tier, 'reason', p_reason));

  RETURN jsonb_build_object('success', true, 'old', v_old, 'new', p_new_tier);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_suspend_account(
  p_target_user uuid, p_reason text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  UPDATE public.profiles
  SET suspended_at = now(),
      suspension_reason = p_reason,
      security_version = COALESCE(security_version,0) + 1,
      updated_at = now()
  WHERE id = p_target_user;

  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (auth.uid(), 'suspend_account', 'user', p_target_user::text,
    jsonb_build_object('reason', p_reason));

  RETURN jsonb_build_object('success', true);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_unsuspend_account(p_target_user uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.profiles
  SET suspended_at = NULL, suspension_reason = NULL, updated_at = now()
  WHERE id = p_target_user;

  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (auth.uid(), 'unsuspend_account', 'user', p_target_user::text, '{}'::jsonb);

  RETURN jsonb_build_object('success', true);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_transfer_org_owner(
  p_org_id uuid, p_new_owner uuid, p_reason text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_old uuid;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT user_id INTO v_old FROM public.organization_members
  WHERE organization_id = p_org_id AND role = 'owner' LIMIT 1;

  -- Promote new owner first to satisfy "last owner" guard
  INSERT INTO public.organization_members (organization_id, user_id, role, invited_by)
  VALUES (p_org_id, p_new_owner, 'owner', auth.uid())
  ON CONFLICT (organization_id, user_id) DO UPDATE SET role = 'owner';

  -- Then demote old owner
  IF v_old IS NOT NULL AND v_old <> p_new_owner THEN
    UPDATE public.organization_members SET role = 'admin'
    WHERE organization_id = p_org_id AND user_id = v_old;
  END IF;

  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (auth.uid(), 'transfer_org_owner', 'organization', p_org_id::text,
    jsonb_build_object('old_owner', v_old, 'new_owner', p_new_owner, 'reason', p_reason));

  RETURN jsonb_build_object('success', true, 'old_owner', v_old, 'new_owner', p_new_owner);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_delete_org(p_org_id uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (auth.uid(), 'delete_org', 'organization', p_org_id::text,
    jsonb_build_object('reason', p_reason));

  DELETE FROM public.organizations WHERE id = p_org_id;
  RETURN jsonb_build_object('success', true);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_create_impersonation_token(
  p_target_user uuid, p_reason text, p_ttl_minutes integer DEFAULT 30
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  INSERT INTO public.admin_impersonation_sessions (admin_user_id, target_user_id, reason, expires_at)
  VALUES (auth.uid(), p_target_user, p_reason, now() + make_interval(mins => p_ttl_minutes))
  RETURNING id INTO v_id;

  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (auth.uid(), 'create_impersonation_token', 'user', p_target_user::text,
    jsonb_build_object('session_id', v_id, 'ttl_minutes', p_ttl_minutes, 'reason', p_reason));

  RETURN jsonb_build_object('success', true, 'session_id', v_id,
    'expires_at', now() + make_interval(mins => p_ttl_minutes));
END; $$;

CREATE OR REPLACE FUNCTION public.admin_activate_enterprise_org(
  p_provisioning_id uuid,
  p_org_name text,
  p_owner_email text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_org_id uuid;
  v_owner_id uuid;
  v_prov public.enterprise_provisioning%ROWTYPE;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT * INTO v_prov FROM public.enterprise_provisioning WHERE id = p_provisioning_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Provisioning record not found'); END IF;

  SELECT id INTO v_owner_id FROM auth.users WHERE LOWER(email) = LOWER(p_owner_email) LIMIT 1;
  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Owner must sign up first with ' || p_owner_email);
  END IF;

  v_org_id := public.create_org_for_user(v_owner_id, p_org_name, 'enterprise');

  UPDATE public.profiles SET account_type = 'enterprise', account_tier = 'enterprise'
  WHERE id = v_owner_id;

  UPDATE public.enterprise_provisioning
  SET organization_id = v_org_id, status = 'active', updated_at = now()
  WHERE id = p_provisioning_id;

  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (auth.uid(), 'activate_enterprise_org', 'organization', v_org_id::text,
    jsonb_build_object('provisioning_id', p_provisioning_id, 'owner_id', v_owner_id));

  RETURN jsonb_build_object('success', true, 'organization_id', v_org_id);
END; $$;
