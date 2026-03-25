
-- Referral system tables
CREATE TABLE public.referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

CREATE TABLE public.referral_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code_id uuid NOT NULL REFERENCES public.referral_codes(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referrer_credited boolean NOT NULL DEFAULT false,
  referred_credited boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(referred_user_id)
);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_redemptions ENABLE ROW LEVEL SECURITY;

-- Users can read their own referral code
CREATE POLICY "Users can read own referral code" ON public.referral_codes
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Users can insert their own referral code
CREATE POLICY "Users can create own referral code" ON public.referral_codes
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Users can read their own redemptions
CREATE POLICY "Users can read own redemptions" ON public.referral_redemptions
  FOR SELECT TO authenticated USING (
    referred_user_id = auth.uid() OR
    referral_code_id IN (SELECT id FROM public.referral_codes WHERE user_id = auth.uid())
  );

-- RPC to redeem a referral code (awards 10 credits to both parties)
CREATE OR REPLACE FUNCTION public.redeem_referral_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_referral_code referral_codes%ROWTYPE;
  v_already_redeemed boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Find the referral code
  SELECT * INTO v_referral_code FROM referral_codes WHERE code = UPPER(p_code);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code');
  END IF;

  -- Can't refer yourself
  IF v_referral_code.user_id = v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot use your own referral code');
  END IF;

  -- Check if user already redeemed any code
  SELECT EXISTS(SELECT 1 FROM referral_redemptions WHERE referred_user_id = v_user_id) INTO v_already_redeemed;
  IF v_already_redeemed THEN
    RETURN jsonb_build_object('success', false, 'error', 'You have already used a referral code');
  END IF;

  -- Create redemption record
  INSERT INTO referral_redemptions (referral_code_id, referred_user_id, referrer_credited, referred_credited)
  VALUES (v_referral_code.id, v_user_id, true, true);

  -- Award 10 credits to referred user
  UPDATE profiles SET credits_balance = credits_balance + 10 WHERE id = v_user_id;
  INSERT INTO credit_transactions (user_id, amount, transaction_type, description)
  VALUES (v_user_id, 10, 'referral_bonus', 'Referral bonus: used code ' || UPPER(p_code));

  -- Award 10 credits to referrer
  UPDATE profiles SET credits_balance = credits_balance + 10 WHERE id = v_referral_code.user_id;
  INSERT INTO credit_transactions (user_id, amount, transaction_type, description)
  VALUES (v_referral_code.user_id, 10, 'referral_bonus', 'Referral bonus: someone used your code');

  RETURN jsonb_build_object('success', true, 'credits_awarded', 10);
END;
$$;
