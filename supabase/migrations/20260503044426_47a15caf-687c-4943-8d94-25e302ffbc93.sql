
-- ============================================================
-- 1. revoke_org_seat
-- ============================================================
CREATE OR REPLACE FUNCTION public.revoke_org_seat(
  p_org_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT (public.has_org_permission(p_org_id, v_caller, 'admin'::org_role) OR public.is_admin(v_caller)) THEN
    RAISE EXCEPTION 'Insufficient permissions to revoke seat';
  END IF;

  UPDATE public.org_seats
  SET revoked_at = now(),
      revoked_by = v_caller
  WHERE organization_id = p_org_id
    AND user_id = p_user_id
    AND revoked_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_active_seat');
  END IF;

  RETURN jsonb_build_object('success', true, 'org_id', p_org_id, 'user_id', p_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_org_seat(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_org_seat(uuid, uuid) TO authenticated;

-- ============================================================
-- 2. set_org_plan — apply plan defaults to an organization
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_org_plan(
  p_org_id uuid,
  p_plan text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_features public.org_plan_features%ROWTYPE;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT (public.has_org_permission(p_org_id, v_caller, 'owner'::org_role) OR public.is_admin(v_caller)) THEN
    RAISE EXCEPTION 'Only org owners or platform admins may change plan';
  END IF;

  SELECT * INTO v_features FROM public.org_plan_features WHERE plan = p_plan;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown plan: %', p_plan;
  END IF;

  UPDATE public.organizations
  SET plan = p_plan, updated_at = now()
  WHERE id = p_org_id;

  RETURN jsonb_build_object(
    'success', true,
    'plan', p_plan,
    'max_seats', v_features.max_seats,
    'included_credits_monthly', v_features.included_credits_monthly
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_org_plan(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_org_plan(uuid, text) TO authenticated;

-- ============================================================
-- 3. provision_enterprise_org — convert lead → live org
-- ============================================================
CREATE OR REPLACE FUNCTION public.provision_enterprise_org(
  p_provisioning_id uuid,
  p_owner_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_prov public.enterprise_provisioning%ROWTYPE;
  v_org_id uuid;
BEGIN
  IF NOT public.is_admin(v_caller) THEN
    RAISE EXCEPTION 'Only platform admins may provision enterprise orgs';
  END IF;

  SELECT * INTO v_prov FROM public.enterprise_provisioning WHERE id = p_provisioning_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Provisioning record not found';
  END IF;

  IF v_prov.organization_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_provisioned', 'org_id', v_prov.organization_id);
  END IF;

  -- Create organization
  INSERT INTO public.organizations (name, owner_id, plan)
  VALUES (v_prov.company_name, p_owner_user_id, 'enterprise')
  RETURNING id INTO v_org_id;

  -- Seed owner seat
  INSERT INTO public.org_seats (organization_id, user_id, role, assigned_by)
  VALUES (v_org_id, p_owner_user_id, 'owner'::org_role, v_caller)
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  -- Link provisioning record
  UPDATE public.enterprise_provisioning
  SET organization_id = v_org_id,
      status = 'active',
      updated_at = now()
  WHERE id = p_provisioning_id;

  -- Promote owner profile to enterprise
  UPDATE public.profiles
  SET account_type = 'enterprise', account_tier = 'enterprise', updated_at = now()
  WHERE id = p_owner_user_id;

  -- Audit
  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, metadata)
  VALUES (v_caller, 'provision_enterprise_org', 'organization', v_org_id,
          jsonb_build_object('provisioning_id', p_provisioning_id, 'owner_id', p_owner_user_id));

  RETURN jsonb_build_object('success', true, 'org_id', v_org_id);
END;
$$;

REVOKE ALL ON FUNCTION public.provision_enterprise_org(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provision_enterprise_org(uuid, uuid) TO authenticated;

-- ============================================================
-- 4. resolve_sso_for_email — domain → SAML provider lookup
-- ============================================================
CREATE OR REPLACE FUNCTION public.resolve_sso_for_email(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_domain text;
  v_mapping public.sso_domain_mappings%ROWTYPE;
BEGIN
  IF p_email IS NULL OR position('@' IN p_email) = 0 THEN
    RETURN jsonb_build_object('sso_required', false);
  END IF;

  v_domain := lower(split_part(p_email, '@', 2));

  SELECT * INTO v_mapping
  FROM public.sso_domain_mappings
  WHERE lower(email_domain) = v_domain
    AND active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('sso_required', false);
  END IF;

  RETURN jsonb_build_object(
    'sso_required', true,
    'domain', v_domain,
    'organization_id', v_mapping.organization_id,
    'provider_id', v_mapping.sso_provider_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_sso_for_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_sso_for_email(text) TO anon, authenticated;

-- ============================================================
-- 5. monthly_org_credit_refill — cron-driven allowance top-up
-- ============================================================
CREATE TABLE IF NOT EXISTS public.org_credit_refills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  refill_period date NOT NULL,
  credits_added integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, refill_period)
);

ALTER TABLE public.org_credit_refills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_credit_refills_select"
  ON public.org_credit_refills FOR SELECT
  TO authenticated
  USING (
    public.is_org_member(organization_id, auth.uid())
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "org_credit_refills_service"
  ON public.org_credit_refills FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.monthly_org_credit_refill()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period date := date_trunc('month', now())::date;
  v_count integer := 0;
  v_total integer := 0;
  r record;
BEGIN
  FOR r IN
    SELECT s.id AS sub_id,
           s.organization_id,
           s.user_id AS owner_id,
           o.plan,
           f.included_credits_monthly
    FROM public.subscriptions s
    JOIN public.organizations o ON o.id = s.organization_id
    JOIN public.org_plan_features f ON f.plan = o.plan
    WHERE s.organization_id IS NOT NULL
      AND s.status IN ('active', 'trialing')
      AND f.included_credits_monthly > 0
      AND NOT EXISTS (
        SELECT 1 FROM public.org_credit_refills r2
        WHERE r2.organization_id = s.organization_id
          AND r2.refill_period = v_period
      )
  LOOP
    -- Credit the org owner's profile
    PERFORM public.add_credits(
      r.owner_id,
      r.included_credits_monthly,
      format('Monthly %s plan allowance (%s)', r.plan, to_char(v_period, 'YYYY-MM')),
      NULL
    );

    INSERT INTO public.org_credit_refills (organization_id, subscription_id, refill_period, credits_added)
    VALUES (r.organization_id, r.sub_id, v_period, r.included_credits_monthly);

    v_count := v_count + 1;
    v_total := v_total + r.included_credits_monthly;
  END LOOP;

  RETURN jsonb_build_object('orgs_refilled', v_count, 'credits_added', v_total, 'period', v_period);
END;
$$;

REVOKE ALL ON FUNCTION public.monthly_org_credit_refill() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.monthly_org_credit_refill() TO service_role;

-- ============================================================
-- 6. org_billing_summary view
-- ============================================================
CREATE OR REPLACE VIEW public.org_billing_summary AS
SELECT
  o.id                          AS organization_id,
  o.name                        AS organization_name,
  o.plan                        AS plan,
  f.max_seats                   AS max_seats,
  f.included_credits_monthly    AS monthly_credit_allowance,
  COALESCE((SELECT count(*) FROM public.org_seats s
            WHERE s.organization_id = o.id AND s.revoked_at IS NULL), 0) AS active_seats,
  s.id                          AS subscription_id,
  s.status                      AS subscription_status,
  s.seats                       AS billed_seats,
  s.current_period_end          AS renews_at,
  s.cancel_at_period_end        AS cancel_pending,
  s.environment                 AS environment
FROM public.organizations o
LEFT JOIN public.org_plan_features f ON f.plan = o.plan
LEFT JOIN LATERAL (
  SELECT * FROM public.subscriptions sub
  WHERE sub.organization_id = o.id
  ORDER BY created_at DESC
  LIMIT 1
) s ON true;

GRANT SELECT ON public.org_billing_summary TO authenticated;

-- ============================================================
-- 7. Customer Portal lookup index
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer
  ON public.subscriptions (stripe_customer_id, environment);
