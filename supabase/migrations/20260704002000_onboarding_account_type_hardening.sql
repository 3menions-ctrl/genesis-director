-- ─────────────────────────────────────────────────────────────────────────
-- C1: Lock down self-service account_type escalation.
--
-- The deployed consume_onboarding_intent already (a) requires a non-personal
-- email for business via is_blocked_business_email and (b) matches contact_email
-- to the account — but it still overwrites profiles.account_type UNCONDITIONALLY
-- on every consume. So an already-onboarded user could create a fresh intent and
-- consume it to FLIP their account_type (personal↔business), breaking the
-- mutual-exclusivity invariant.
--
-- This rebases the deployed function and adds a single guard: account_type is
-- immutable once onboarding_completed — an intent that would change it on an
-- already-onboarded profile is rejected ('account_type_locked'). All other
-- behavior (email match, business-email block, org creation) is preserved.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.consume_onboarding_intent(p_intent_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_intent public.onboarding_intents%ROWTYPE;
  v_org_id uuid;
  v_org_name text;
  v_org_plan text;
  v_current_type text;
  v_onboarded boolean;
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

  -- C1 GUARD: account_type is immutable after onboarding. An intent that would
  -- change it on an already-onboarded profile is an escalation attempt.
  SELECT account_type, onboarding_completed
    INTO v_current_type, v_onboarded
    FROM public.profiles WHERE id = v_user_id;

  IF COALESCE(v_onboarded, false)
     AND v_intent.account_type IS DISTINCT FROM v_current_type THEN
    RETURN jsonb_build_object('success', false, 'error', 'account_type_locked');
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
END; $function$;
