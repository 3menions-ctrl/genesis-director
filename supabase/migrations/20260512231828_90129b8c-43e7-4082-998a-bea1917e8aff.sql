
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS require_2fa boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_recharge_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_recharge_threshold integer,
  ADD COLUMN IF NOT EXISTS auto_recharge_amount integer,
  ADD COLUMN IF NOT EXISTS spend_alert_daily integer,
  ADD COLUMN IF NOT EXISTS spend_alert_weekly integer,
  ADD COLUMN IF NOT EXISTS slack_webhook_url text,
  ADD COLUMN IF NOT EXISTS zapier_webhook_url text,
  ADD COLUMN IF NOT EXISTS onboarded_at timestamptz;

ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS monthly_credit_limit integer,
  ADD COLUMN IF NOT EXISTS credits_used_this_month integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_period_start date NOT NULL DEFAULT date_trunc('month', now())::date;

CREATE TABLE IF NOT EXISTS public.org_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  domain text NOT NULL,
  verification_token text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  verified_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, domain)
);
ALTER TABLE public.org_domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org admins read domains" ON public.org_domains FOR SELECT TO authenticated
  USING (public.fn_org_has_min_role(organization_id, auth.uid(), 'admin'));
CREATE POLICY "org admins insert domains" ON public.org_domains FOR INSERT TO authenticated
  WITH CHECK (public.fn_org_has_min_role(organization_id, auth.uid(), 'admin'));
CREATE POLICY "org admins update domains" ON public.org_domains FOR UPDATE TO authenticated
  USING (public.fn_org_has_min_role(organization_id, auth.uid(), 'admin'));
CREATE POLICY "org admins delete domains" ON public.org_domains FOR DELETE TO authenticated
  USING (public.fn_org_has_min_role(organization_id, auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.feature_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid,
  feature text NOT NULL,
  email text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.feature_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members can request features" ON public.feature_requests FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IS NULL
    OR public.fn_org_has_min_role(organization_id, auth.uid(), 'viewer')
  );
CREATE POLICY "members read own requests" ON public.feature_requests FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (organization_id IS NOT NULL AND public.fn_org_has_min_role(organization_id, auth.uid(), 'admin'))
  );

CREATE TABLE IF NOT EXISTS public.org_spend_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid,
  credits integer NOT NULL,
  reason text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_org_spend_events_org_time
  ON public.org_spend_events (organization_id, occurred_at DESC);
ALTER TABLE public.org_spend_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org admins read spend" ON public.org_spend_events FOR SELECT TO authenticated
  USING (public.fn_org_has_min_role(organization_id, auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.set_org_security_policy(p_org uuid, p_require_2fa boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.fn_org_has_min_role(p_org, auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.organizations SET require_2fa = p_require_2fa, updated_at = now() WHERE id = p_org;
END $$;

CREATE OR REPLACE FUNCTION public.set_org_auto_recharge(p_org uuid, p_enabled boolean, p_threshold integer, p_amount integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.fn_org_has_min_role(p_org, auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_enabled AND (coalesce(p_threshold,0) <= 0 OR coalesce(p_amount,0) <= 0) THEN
    RAISE EXCEPTION 'threshold and amount must be positive';
  END IF;
  UPDATE public.organizations
     SET auto_recharge_enabled = p_enabled,
         auto_recharge_threshold = p_threshold,
         auto_recharge_amount = p_amount,
         updated_at = now()
   WHERE id = p_org;
END $$;

CREATE OR REPLACE FUNCTION public.set_org_integration_webhook(p_org uuid, p_kind text, p_url text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.fn_org_has_min_role(p_org, auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_url IS NOT NULL AND p_url !~* '^https://' THEN RAISE EXCEPTION 'webhook url must be https'; END IF;
  IF p_kind = 'slack' THEN
    UPDATE public.organizations SET slack_webhook_url = p_url, updated_at = now() WHERE id = p_org;
  ELSIF p_kind = 'zapier' THEN
    UPDATE public.organizations SET zapier_webhook_url = p_url, updated_at = now() WHERE id = p_org;
  ELSE RAISE EXCEPTION 'unknown integration kind';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_org_spend_alerts(p_org uuid, p_daily integer, p_weekly integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.fn_org_has_min_role(p_org, auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.organizations
     SET spend_alert_daily = p_daily, spend_alert_weekly = p_weekly, updated_at = now()
   WHERE id = p_org;
END $$;

CREATE OR REPLACE FUNCTION public.set_member_credit_limit(p_org uuid, p_user uuid, p_limit integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.fn_org_has_min_role(p_org, auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.organization_members
     SET monthly_credit_limit = p_limit
   WHERE organization_id = p_org AND user_id = p_user;
END $$;

CREATE OR REPLACE FUNCTION public.mark_org_onboarded(p_org uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.fn_org_has_min_role(p_org, auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.organizations SET onboarded_at = now(), onboarding_completed = true WHERE id = p_org;
END $$;

CREATE OR REPLACE FUNCTION public.add_org_domain(p_org uuid, p_domain text)
RETURNS public.org_domains LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.org_domains;
BEGIN
  IF NOT public.fn_org_has_min_role(p_org, auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.org_domains(organization_id, domain, created_by)
  VALUES (p_org, lower(p_domain), auth.uid())
  RETURNING * INTO r;
  RETURN r;
END $$;
