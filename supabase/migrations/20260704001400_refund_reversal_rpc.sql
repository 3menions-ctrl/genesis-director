-- AUDIT FIX (High): refunds/chargebacks never reversed purchased credits.
-- polar-webhook had no refund case at all; the Stripe handler routed
-- charge.refunded only to an admin alert. A user could buy a credit pack, spend
-- the credits, then refund through the provider and keep the value.
--
-- This adds a service-role-only reversal RPC. It is idempotent on the provider
-- reference (one reversal per refunded payment) and inserts a NEGATIVE
-- 'refund_reversal' transaction, which credit_ledger_total counts (it is not in
-- the excluded set), so the balance reflects the clawback. The balance is allowed
-- to go negative: if the customer already spent the refunded credits they now
-- carry a deficit that must be cleared before they can spend again — the correct
-- accounting outcome for a refund-after-spend.
--
-- Wired into supabase/functions/polar-webhook (order.refunded) in this branch;
-- the Stripe charge.refunded path is FLAGGED for follow-up (it lacks the original
-- credit/user metadata on the charge event and needs a payment->grant lookup).

CREATE OR REPLACE FUNCTION public.reverse_credit_purchase(
  p_user_id uuid,
  p_amount integer,
  p_description text,
  p_reference text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ref text;
  new_balance integer;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'user_required');
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'reverse_credit_purchase requires a positive amount (got %)', p_amount;
  END IF;
  IF p_reference IS NULL OR length(p_reference) < 3 THEN
    RAISE EXCEPTION 'reverse_credit_purchase requires a stable reference';
  END IF;

  v_ref := 'refund_reversal:' || p_reference;

  PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'profile_not_found');
  END IF;

  -- Idempotent: one reversal per refunded payment reference.
  IF EXISTS (SELECT 1 FROM public.credit_transactions WHERE stripe_payment_id = v_ref) THEN
    RETURN jsonb_build_object('success', true, 'reused', true, 'newBalance', public.credit_ledger_total(p_user_id));
  END IF;

  new_balance := public.credit_ledger_total(p_user_id) - p_amount;

  INSERT INTO public.credit_transactions (
    user_id, amount, transaction_type, description, stripe_payment_id, balance_after
  ) VALUES (
    p_user_id, -p_amount, 'refund_reversal', COALESCE(p_description, 'Refund/chargeback reversal'), v_ref, new_balance
  );

  RETURN jsonb_build_object('success', true, 'reversed', p_amount, 'newBalance', public.credit_ledger_total(p_user_id), 'source', 'ledger');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reverse_credit_purchase(uuid, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_credit_purchase(uuid, integer, text, text) TO service_role;
