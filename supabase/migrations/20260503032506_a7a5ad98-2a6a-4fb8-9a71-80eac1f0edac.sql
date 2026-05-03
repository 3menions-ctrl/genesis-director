-- 1. Extend onboarding_intents with business fields
ALTER TABLE public.onboarding_intents
  ADD COLUMN IF NOT EXISTS primary_use_case text,
  ADD COLUMN IF NOT EXISTS content_goals text[],
  ADD COLUMN IF NOT EXISTS brand_colors text[],
  ADD COLUMN IF NOT EXISTS brand_voice text,
  ADD COLUMN IF NOT EXISTS current_tools text[],
  ADD COLUMN IF NOT EXISTS monthly_volume text,
  ADD COLUMN IF NOT EXISTS integrations_needed text[],
  ADD COLUMN IF NOT EXISTS billing_email text,
  ADD COLUMN IF NOT EXISTS vat_id text,
  ADD COLUMN IF NOT EXISTS invited_emails text[];

-- 2. Extend organizations with brand kit + billing
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS brand_colors text[],
  ADD COLUMN IF NOT EXISTS brand_voice text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS primary_use_case text,
  ADD COLUMN IF NOT EXISTS monthly_volume text,
  ADD COLUMN IF NOT EXISTS industry text,
  ADD COLUMN IF NOT EXISTS team_size text,
  ADD COLUMN IF NOT EXISTS billing_email text,
  ADD COLUMN IF NOT EXISTS vat_id text,
  ADD COLUMN IF NOT EXISTS billing_address jsonb;

-- 3. Update consume_onboarding_intent to apply business data to the user's workspace
CREATE OR REPLACE FUNCTION public.consume_onboarding_intent(_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _intent record;
  _uid uuid := auth.uid();
  _org_id uuid;
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

  -- For business signups, push brand/billing data onto the user's primary workspace
  IF _intent.account_type = 'business' THEN
    SELECT o.id INTO _org_id
    FROM public.organizations o
    WHERE o.created_by = _uid
    ORDER BY o.created_at ASC
    LIMIT 1;

    IF _org_id IS NOT NULL THEN
      UPDATE public.organizations
         SET name              = COALESCE(NULLIF(_intent.company_name, ''), name),
             industry          = COALESCE(NULLIF(_intent.industry, ''), industry),
             team_size         = COALESCE(NULLIF(_intent.team_size, ''), team_size),
             primary_use_case  = COALESCE(NULLIF(_intent.primary_use_case, ''), primary_use_case),
             monthly_volume    = COALESCE(NULLIF(_intent.monthly_volume, ''), monthly_volume),
             brand_colors      = COALESCE(_intent.brand_colors, brand_colors),
             brand_voice       = COALESCE(NULLIF(_intent.brand_voice, ''), brand_voice),
             billing_email     = COALESCE(NULLIF(_intent.billing_email, ''), billing_email),
             vat_id            = COALESCE(NULLIF(_intent.vat_id, ''), vat_id),
             updated_at        = now()
       WHERE id = _org_id;
    END IF;
  END IF;

  UPDATE public.onboarding_intents
     SET consumed_by_user_id = _uid,
         consumed_at         = now()
   WHERE id = _intent.id;

  RETURN jsonb_build_object(
    'ok', true,
    'account_type', _intent.account_type,
    'plan_id', _intent.selected_plan_id,
    'plan_kind', _intent.selected_plan_kind,
    'invited_emails', _intent.invited_emails
  );
END;
$function$;