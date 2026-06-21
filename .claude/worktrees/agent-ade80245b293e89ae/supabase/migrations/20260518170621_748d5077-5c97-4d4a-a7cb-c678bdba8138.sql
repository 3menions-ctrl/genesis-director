-- Reconcile credits for the authenticated user. Compares the ledger sum to
-- the stored profile balance and writes a single corrective transaction if
-- they disagree. Returns the same shape as get_credit_state.
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
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT COALESCE(credits_balance, 0) INTO v_stored
  FROM public.profiles WHERE id = v_user;

  -- Authoritative balance = sum of all transactions for the user.
  -- credit_transactions.amount is signed (positive=credit, negative=debit).
  SELECT COALESCE(SUM(amount), 0) INTO v_ledger
  FROM public.credit_transactions
  WHERE user_id = v_user
    -- Ignore non-balance-impacting audit rows.
    AND transaction_type NOT IN ('untracked_increase', 'audit', 'security_alert');

  v_drift := v_ledger - v_stored;

  IF v_drift <> 0 THEN
    -- Write a single corrective adjustment so the ledger remains the source
    -- of truth AND the profile balance now matches it. This is idempotent
    -- per-day per-user via the idempotency_key.
    INSERT INTO public.credit_transactions (
      user_id, amount, transaction_type, description, idempotency_key, balance_after
    )
    VALUES (
      v_user,
      v_drift,
      'reconciliation',
      'Auto-reconcile: profile balance synced to ledger (drift ' || v_drift || ')',
      'reconcile:' || v_user::text || ':' || to_char(now(), 'YYYY-MM-DD"T"HH24:MI'),
      v_ledger
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    UPDATE public.profiles
       SET credits_balance = v_ledger,
           updated_at = now()
     WHERE id = v_user;

    v_stored := v_ledger;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_held
  FROM public.credit_holds
  WHERE user_id = v_user
    AND status = 'held'
    AND expires_at > now();

  RETURN jsonb_build_object(
    'success', true,
    'balance', v_stored,
    'held', v_held,
    'available', GREATEST(v_stored - v_held, 0),
    'drift_corrected', v_drift
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reconcile_user_credits() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_user_credits() TO authenticated;

-- Realtime propagation for credit-related rows so the unified hook can refresh
-- the whole app instantly when anything changes.
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.credit_holds;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.credit_transactions;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;