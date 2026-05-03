-- STEP 1 + 2: Standardize account_type + backfill
UPDATE public.profiles SET account_type = 'personal' WHERE account_type IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN account_type SET DEFAULT 'personal',
  ALTER COLUMN account_type SET NOT NULL;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_account_type_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_account_type_check
  CHECK (account_type IN ('personal','business','enterprise','admin'));

-- STEP 3: Disable auto-org trigger
DROP TRIGGER IF EXISTS create_personal_org_for_new_user_trigger ON public.profiles;
DROP TRIGGER IF EXISTS create_personal_org_trigger ON public.profiles;
DROP TRIGGER IF EXISTS on_profile_created_create_org ON public.profiles;

CREATE OR REPLACE FUNCTION public.create_org_for_user(
  p_user_id uuid, p_name text, p_plan text DEFAULT 'starter'
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_org_id uuid; v_slug text;
BEGIN
  v_slug := regexp_replace(LOWER(p_name), '[^a-z0-9]+', '-', 'g')
            || '-' || substr(p_user_id::text, 1, 8);
  INSERT INTO public.organizations (name, slug, created_by, plan)
  VALUES (p_name, v_slug, p_user_id, p_plan)
  RETURNING id INTO v_org_id;
  RETURN v_org_id;
END; $$;

-- STEP 4: Rename legacy plan
UPDATE public.organizations SET plan = 'growth' WHERE plan = 'business_growth';
ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_plan_check;
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_plan_check
  CHECK (plan IN ('starter','growth','scale','enterprise'));

-- STEP 8: Add 'editor' to org_role
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'editor' AND enumtypid = 'public.org_role'::regtype
  ) THEN
    ALTER TYPE public.org_role ADD VALUE 'editor' BEFORE 'reviewer';
  END IF;
END $$;

-- STEP 7: has_account_type helper
CREATE OR REPLACE FUNCTION public.has_account_type(p_user_id uuid, p_account_type text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id AND account_type = p_account_type);
$$;

-- STEP 6: Work-email enforcement
CREATE TABLE IF NOT EXISTS public.blocked_email_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text UNIQUE NOT NULL,
  reason text NOT NULL DEFAULT 'personal_email_provider',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.blocked_email_domains ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blocked_email_domains_admin_all" ON public.blocked_email_domains;
CREATE POLICY "blocked_email_domains_admin_all" ON public.blocked_email_domains
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "blocked_email_domains_read_authenticated" ON public.blocked_email_domains;
CREATE POLICY "blocked_email_domains_read_authenticated" ON public.blocked_email_domains
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.blocked_email_domains (domain, reason) VALUES
  ('gmail.com','personal_email_provider'),('googlemail.com','personal_email_provider'),
  ('yahoo.com','personal_email_provider'),('yahoo.co.uk','personal_email_provider'),
  ('ymail.com','personal_email_provider'),('hotmail.com','personal_email_provider'),
  ('hotmail.co.uk','personal_email_provider'),('outlook.com','personal_email_provider'),
  ('live.com','personal_email_provider'),('msn.com','personal_email_provider'),
  ('icloud.com','personal_email_provider'),('me.com','personal_email_provider'),
  ('mac.com','personal_email_provider'),('aol.com','personal_email_provider'),
  ('protonmail.com','personal_email_provider'),('proton.me','personal_email_provider'),
  ('pm.me','personal_email_provider'),('gmx.com','personal_email_provider'),
  ('gmx.net','personal_email_provider'),('mail.com','personal_email_provider'),
  ('zoho.com','personal_email_provider'),('yandex.com','personal_email_provider'),
  ('tutanota.com','personal_email_provider'),('fastmail.com','personal_email_provider')
ON CONFLICT (domain) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_blocked_business_email(p_email text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocked_email_domains
    WHERE domain = LOWER(split_part(p_email, '@', 2))
  );
$$;

-- STEP 5: Replace consume_onboarding_intent
DROP FUNCTION IF EXISTS public.consume_onboarding_intent(text);

CREATE OR REPLACE FUNCTION public.consume_onboarding_intent(p_intent_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_intent public.onboarding_intents%ROWTYPE;
  v_org_id uuid;
  v_org_name text;
  v_org_plan text;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  SELECT * INTO v_intent FROM public.onboarding_intents
  WHERE intent_token = p_intent_token LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid intent token');
  END IF;

  IF v_intent.consumed_at IS NOT NULL THEN
    IF v_intent.consumed_by_user_id = v_user_id THEN
      RETURN jsonb_build_object('success', true, 'already_consumed', true,
                                'account_type', v_intent.account_type);
    END IF;
    RETURN jsonb_build_object('success', false, 'error', 'Intent already consumed');
  END IF;

  IF v_intent.contact_email IS NOT NULL
     AND LOWER(v_intent.contact_email) <> LOWER(v_user_email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Intent email does not match account');
  END IF;

  IF v_intent.account_type NOT IN ('personal','business','enterprise') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid account type in intent');
  END IF;

  IF v_intent.account_type = 'business'
     AND public.is_blocked_business_email(v_user_email) THEN
    RETURN jsonb_build_object('success', false,
      'error', 'Business accounts require a work email (personal email providers are blocked)');
  END IF;

  UPDATE public.profiles
  SET account_type = v_intent.account_type,
      onboarding_completed = true,
      updated_at = now()
  WHERE id = v_user_id;

  IF v_intent.account_type IN ('business','enterprise') THEN
    v_org_name := COALESCE(NULLIF(v_intent.company_name,''),
                           split_part(v_user_email,'@',1) || ' Workspace');
    v_org_plan := CASE
      WHEN v_intent.account_type = 'enterprise' THEN 'enterprise'
      WHEN v_intent.expected_volume IN ('high','very_high') THEN 'scale'
      ELSE 'growth'
    END;
    v_org_id := public.create_org_for_user(v_user_id, v_org_name, v_org_plan);
  END IF;

  UPDATE public.onboarding_intents
  SET consumed_at = now(), consumed_by_user_id = v_user_id
  WHERE id = v_intent.id;

  RETURN jsonb_build_object('success', true,
    'account_type', v_intent.account_type, 'organization_id', v_org_id);
END; $$;
