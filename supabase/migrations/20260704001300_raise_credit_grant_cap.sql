-- AUDIT FIX (High): the 100,000-credit hard cap silently drops the largest paid
-- plans. add_credits raises 'Invalid credit amount' for p_amount > 100000, and
-- both webhooks skip a grant > 100000. But create-plan-checkout sells
-- business_growth_yearly (60,000) and business_scale_yearly (240,000) credits.
-- A customer who buys business_scale_yearly is charged for 240,000 credits and
-- granted ZERO (webhook logs "no creditable amount" and returns 200) — exactly
-- the "paid, no credits" failure mode, re-introduced at the cap boundary.
--
-- Fix: raise the single-grant cap to 1,000,000 (covers the largest catalog plan
-- with headroom). detect_credit_anomaly still flags unusually large grants for
-- review — the cap was never the only fraud control. The matching webhook guards
-- are raised to 1,000,000 in polar-webhook and _shared/stripe-webhook-handler.
--
-- Body is otherwise identical to 20260518175601 (verbatim), only the cap changes.

CREATE OR REPLACE FUNCTION public.add_credits(p_user_id uuid, p_amount integer, p_description text, p_stripe_payment_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  is_duplicate boolean;
  anomaly boolean;
  new_balance integer;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 1000000 THEN
    RAISE EXCEPTION 'Invalid credit amount: %', p_amount;
  END IF;

  IF p_stripe_payment_id IS NULL OR length(p_stripe_payment_id) < 5 THEN
    RAISE EXCEPTION 'Invalid Stripe payment reference';
  END IF;

  PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'profile_not_found');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.credit_transactions
    WHERE stripe_payment_id = p_stripe_payment_id
  ) INTO is_duplicate;

  IF is_duplicate THEN
    RETURN jsonb_build_object('success', false, 'reason', 'duplicate_payment', 'newBalance', public.credit_ledger_total(p_user_id));
  END IF;

  new_balance := public.credit_ledger_total(p_user_id) + p_amount;
  anomaly := public.detect_credit_anomaly(p_user_id, p_amount);

  INSERT INTO public.credit_transactions (
    user_id, amount, transaction_type, description, stripe_payment_id, balance_after
  ) VALUES (
    p_user_id, p_amount, 'purchase', p_description, p_stripe_payment_id, new_balance
  );

  RETURN jsonb_build_object('success', true, 'credits_added', p_amount, 'newBalance', public.credit_ledger_total(p_user_id), 'flagged', anomaly, 'source', 'ledger');
END;
$$;
