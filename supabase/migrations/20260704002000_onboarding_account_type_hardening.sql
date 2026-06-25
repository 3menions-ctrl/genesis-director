-- ─────────────────────────────────────────────────────────────────────────
-- C1: Lock down self-service account_type escalation.
--
-- Before: any authenticated user could INSERT an onboarding_intents row with
-- account_type='business' (RLS WITH CHECK (true)) and call
-- consume_onboarding_intent() to flip their own profile to 'business' — no
-- eligibility check, and a re-consume could change account_type after
-- onboarding. This broke the business↔personal mutual-exclusivity invariant.
--
-- After:
--   1. account_type can only be SET during first onboarding. Once a profile
--      has onboarding_completed = true, an intent that would CHANGE account_type
--      is rejected ('account_type_locked').
--   2. Granting 'business' requires a real business email — free/consumer email
--      domains are rejected ('business_email_required').
-- All other profile-field hydration is preserved.
-- ─────────────────────────────────────────────────────────────────────────

-- Helper: is the email on a known free/consumer provider (i.e. NOT a business domain)?
CREATE OR REPLACE FUNCTION public.is_free_email_domain(_email text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(split_part(coalesce(_email, ''), '@', 2)) IN (
    'gmail.com','googlemail.com',
    'yahoo.com','yahoo.co.uk','yahoo.co.in','ymail.com','rocketmail.com',
    'hotmail.com','hotmail.co.uk','outlook.com','live.com','msn.com','passport.com',
    'aol.com','aim.com',
    'icloud.com','me.com','mac.com',
    'proton.me','protonmail.com','pm.me',
    'gmx.com','gmx.net','mail.com','email.com','zoho.com','yandex.com','yandex.ru',
    'hey.com','fastmail.com','tutanota.com','tuta.io','hushmail.com',
    'inbox.com','mailinator.com','disroot.org'
  );
$$;
REVOKE ALL ON FUNCTION public.is_free_email_domain(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_free_email_domain(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.consume_onboarding_intent(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _intent  record;
  _profile record;
  _email   text;
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
  END IF;

  SELECT * INTO _intent FROM public.onboarding_intents
   WHERE intent_token = _token
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'intent_not_found');
  END IF;

  IF _intent.consumed_by_user_id IS NOT NULL AND _intent.consumed_by_user_id <> _uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'intent_already_consumed');
  END IF;

  SELECT account_type, onboarding_completed INTO _profile
    FROM public.profiles WHERE id = _uid;

  -- (1) account_type is immutable after onboarding. An intent that would CHANGE
  --     it on an already-onboarded profile is an escalation attempt — reject it.
  IF coalesce(_profile.onboarding_completed, false)
     AND _intent.account_type IS NOT NULL
     AND _intent.account_type IS DISTINCT FROM _profile.account_type THEN
    RETURN jsonb_build_object('ok', false, 'error', 'account_type_locked');
  END IF;

  -- (2) Granting 'business' requires a real business email domain.
  IF _intent.account_type = 'business'
     AND _intent.account_type IS DISTINCT FROM coalesce(_profile.account_type, 'personal') THEN
    SELECT email INTO _email FROM auth.users WHERE id = _uid;
    IF _email IS NULL OR public.is_free_email_domain(_email) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'business_email_required');
    END IF;
  END IF;

  UPDATE public.profiles
     SET account_type        = COALESCE(_intent.account_type, account_type),
         full_name           = COALESCE(NULLIF(_intent.display_name, ''), full_name),
         display_name        = COALESCE(NULLIF(_intent.display_name, ''), display_name),
         company             = COALESCE(NULLIF(_intent.company_name, ''), company),
         job_title           = COALESCE(NULLIF(_intent.job_role, ''), job_title),
         use_case            = COALESCE(NULLIF(array_to_string(_intent.goals, ','), ''), use_case),
         onboarding_completed = true,
         updated_at          = now()
   WHERE id = _uid;

  UPDATE public.onboarding_intents
     SET consumed_by_user_id = _uid,
         consumed_at         = now()
   WHERE id = _intent.id;

  RETURN jsonb_build_object(
    'ok', true,
    'account_type', _intent.account_type,
    'plan_id', _intent.selected_plan_id,
    'plan_kind', _intent.selected_plan_kind
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_onboarding_intent(text) TO authenticated;
