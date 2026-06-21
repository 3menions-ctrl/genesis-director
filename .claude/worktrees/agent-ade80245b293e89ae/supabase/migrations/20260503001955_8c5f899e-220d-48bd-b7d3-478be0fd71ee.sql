
-- Pre-signup onboarding intents (captured before user has an account)
CREATE TABLE IF NOT EXISTS public.onboarding_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_token text NOT NULL UNIQUE,
  account_type text NOT NULL CHECK (account_type IN ('personal','business','enterprise')),
  selected_plan_id text,
  selected_plan_kind text CHECK (selected_plan_kind IN ('credits','subscription','contact')),
  -- Personal
  goals text[],
  experience_level text,
  -- Business
  company_name text,
  team_size text,
  industry text,
  job_role text,
  -- Enterprise
  expected_volume text,
  needs_sso boolean DEFAULT false,
  needs_sla boolean DEFAULT false,
  needs_api boolean DEFAULT false,
  contact_email text,
  contact_phone text,
  -- Common
  display_name text,
  consumed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_intents_token ON public.onboarding_intents(intent_token);
CREATE INDEX IF NOT EXISTS idx_onboarding_intents_consumed ON public.onboarding_intents(consumed_by_user_id);

ALTER TABLE public.onboarding_intents ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon) can create an intent (pre-signup)
CREATE POLICY "Anyone can create onboarding intent"
  ON public.onboarding_intents FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Anyone can read by token (used when consuming after signup)
CREATE POLICY "Anyone can read onboarding intent by token"
  ON public.onboarding_intents FOR SELECT
  TO anon, authenticated
  USING (true);

-- Authenticated users can update only to mark as consumed
CREATE POLICY "Authenticated can consume own intent"
  ON public.onboarding_intents FOR UPDATE
  TO authenticated
  USING (consumed_by_user_id IS NULL OR consumed_by_user_id = auth.uid())
  WITH CHECK (consumed_by_user_id = auth.uid());

-- Helper: consume intent into the caller's profile
CREATE OR REPLACE FUNCTION public.consume_onboarding_intent(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _intent record;
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
