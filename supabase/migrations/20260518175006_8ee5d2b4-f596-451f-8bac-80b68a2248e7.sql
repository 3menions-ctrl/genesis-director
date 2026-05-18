
-- 1. BACKFILL: align ledger with stored balance for every user, one-time.
DO $$
DECLARE
  r RECORD;
  v_ledger int;
  v_drift int;
BEGIN
  FOR r IN SELECT id, COALESCE(credits_balance, 0) AS stored FROM public.profiles LOOP
    SELECT COALESCE(SUM(amount), 0) INTO v_ledger
      FROM public.credit_transactions
     WHERE user_id = r.id
       AND transaction_type NOT IN ('untracked_increase','audit','security_alert');

    v_drift := r.stored - v_ledger;

    IF v_drift <> 0 AND NOT EXISTS (
      SELECT 1 FROM public.credit_transactions
       WHERE user_id = r.id
         AND transaction_type = 'seed_balance'
         AND description LIKE 'Ledger-as-truth migration%'
    ) THEN
      INSERT INTO public.credit_transactions (
        user_id, amount, transaction_type, description, balance_after
      ) VALUES (
        r.id,
        v_drift,
        'seed_balance',
        'Ledger-as-truth migration: align ledger with stored balance',
        r.stored
      );
    END IF;
  END LOOP;

  UPDATE public.profiles p
     SET credits_balance = sub.s,
         updated_at = now()
    FROM (
      SELECT user_id, COALESCE(SUM(amount), 0)::int AS s
        FROM public.credit_transactions
       WHERE transaction_type NOT IN ('untracked_increase','audit','security_alert')
       GROUP BY user_id
    ) sub
   WHERE p.id = sub.user_id
     AND p.credits_balance IS DISTINCT FROM sub.s;
END $$;

-- 2. AUTO-SYNC trigger: every ledger insert updates profiles.credits_balance.
CREATE OR REPLACE FUNCTION public.sync_balance_from_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.transaction_type IN ('untracked_increase','audit','security_alert') THEN
    RETURN NEW;
  END IF;

  UPDATE public.profiles
     SET credits_balance = COALESCE(credits_balance, 0) + NEW.amount,
         updated_at = now()
   WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_balance_from_ledger ON public.credit_transactions;
CREATE TRIGGER trg_sync_balance_from_ledger
  AFTER INSERT ON public.credit_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_balance_from_ledger();

-- 3. RECONCILE: simple rewrite from ledger. No drift backfill, no silent inserts.
CREATE OR REPLACE FUNCTION public.reconcile_user_credits()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_ledger int := 0;
  v_held int := 0;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_ledger
    FROM public.credit_transactions
   WHERE user_id = v_user
     AND transaction_type NOT IN ('untracked_increase','audit','security_alert');

  UPDATE public.profiles
     SET credits_balance = v_ledger,
         updated_at = now()
   WHERE id = v_user
     AND credits_balance IS DISTINCT FROM v_ledger;

  SELECT COALESCE(SUM(amount), 0) INTO v_held
    FROM public.credit_holds
   WHERE user_id = v_user
     AND status = 'held'
     AND expires_at > now();

  RETURN jsonb_build_object(
    'success', true,
    'balance', v_ledger,
    'held', v_held,
    'available', GREATEST(v_ledger - v_held, 0)
  );
END;
$$;

-- 4. READ RPC: ledger balance for current user (or admin reading any user).
CREATE OR REPLACE FUNCTION public.get_ledger_balance(p_user_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ledger int := 0;
  v_held int := 0;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  IF p_user_id <> auth.uid() AND NOT public.is_admin(auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_ledger
    FROM public.credit_transactions
   WHERE user_id = p_user_id
     AND transaction_type NOT IN ('untracked_increase','audit','security_alert');

  SELECT COALESCE(SUM(amount), 0) INTO v_held
    FROM public.credit_holds
   WHERE user_id = p_user_id
     AND status = 'held'
     AND expires_at > now();

  RETURN jsonb_build_object(
    'success', true,
    'balance', v_ledger,
    'held', v_held,
    'available', GREATEST(v_ledger - v_held, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_ledger_balance(uuid) TO authenticated;
