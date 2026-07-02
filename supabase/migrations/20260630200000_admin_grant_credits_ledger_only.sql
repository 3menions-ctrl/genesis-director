-- admin_grant_credits: grant via the LEDGER only.
--
-- The previous implementation did `UPDATE profiles SET credits_balance = ... + p_amount`
-- and then inserted a credit_transactions row. The direct balance UPDATE trips
-- trg_audit_credits_balance, which logs a bogus
--   transaction_type='untracked_increase'
--   "SECURITY ALERT: credits_balance increased ... without a matching transaction"
-- row on every admin grant, and double-touches the balance.
--
-- Correct pattern (per the credits architecture: credit_transactions is the
-- ledger, profiles.credits_balance is a cache): INSERT the ledger row ONLY and
-- let trg_sync_balance_from_ledger recompute credits_balance / totals. That
-- trigger explicitly skips untracked_increase/audit/security_alert types, so no
-- false alert is raised.
CREATE OR REPLACE FUNCTION public.admin_grant_credits(
  p_target_user uuid, p_amount int, p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance int;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'p_amount must be > 0';
  END IF;
  IF p_amount > 10000 THEN
    RAISE EXCEPTION 'p_amount cap is 10000 per grant (got %)', p_amount;
  END IF;

  -- Ledger row only. trg_sync_balance_from_ledger (AFTER INSERT) updates
  -- profiles.credits_balance + total_credits_purchased within this transaction,
  -- so the SELECT below reads the freshly-synced value.
  INSERT INTO public.credit_transactions (user_id, amount, transaction_type, description)
  VALUES (p_target_user, p_amount, 'grant',
    'Admin grant: ' || COALESCE(p_reason, 'unspecified'));

  SELECT credits_balance INTO v_new_balance
  FROM public.profiles WHERE id = p_target_user;

  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (auth.uid(), 'grant_credits', 'user', p_target_user::text,
    jsonb_build_object('amount', p_amount, 'reason', p_reason, 'new_balance', v_new_balance));

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_grant_credits(uuid, int, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_grant_credits(uuid, int, text) TO authenticated;

COMMENT ON FUNCTION public.admin_grant_credits IS
  'Grants credits by inserting a credit_transactions ledger row (type=grant); the ledger-sync trigger updates profiles.credits_balance. Never writes credits_balance directly (that trips the untracked_increase audit alert). Cap 10,000/grant. Audited.';
