CREATE OR REPLACE FUNCTION public.reconcile_user_credits()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_stored int := 0;
  v_ledger int := 0;
  v_drift int := 0;
  v_held int := 0;
  v_final_balance int := 0;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT COALESCE(credits_balance, 0) INTO v_stored
  FROM public.profiles
  WHERE id = v_user
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'profile_not_found');
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_ledger
  FROM public.credit_transactions
  WHERE user_id = v_user
    AND transaction_type NOT IN ('untracked_increase', 'audit', 'security_alert');

  v_drift := v_stored - v_ledger;
  v_final_balance := v_stored;

  IF v_drift > 0 THEN
    INSERT INTO public.credit_transactions (
      user_id, amount, transaction_type, description, idempotency_key, balance_after
    )
    VALUES (
      v_user,
      v_drift,
      'reconciliation',
      'Auto-reconcile: preserved stored credit balance by backfilling missing ledger credit (drift +' || v_drift || ')',
      'reconcile-preserve:' || v_user::text || ':' || to_char(now(), 'YYYY-MM-DD"T"HH24:MI'),
      v_stored
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
  ELSIF v_drift < 0 THEN
    v_final_balance := v_ledger;
    UPDATE public.profiles
       SET credits_balance = v_final_balance,
           updated_at = now()
     WHERE id = v_user;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_held
  FROM public.credit_holds
  WHERE user_id = v_user
    AND status = 'held'
    AND expires_at > now();

  RETURN jsonb_build_object(
    'success', true,
    'balance', v_final_balance,
    'held', v_held,
    'available', GREATEST(v_final_balance - v_held, 0),
    'drift_corrected', v_drift
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reconcile_user_credits() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_user_credits() TO authenticated;