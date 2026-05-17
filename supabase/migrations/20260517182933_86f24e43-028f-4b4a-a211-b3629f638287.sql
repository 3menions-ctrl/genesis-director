-- Credit system hardening: make profile balance, ledger rows, and active holds agree.

CREATE OR REPLACE FUNCTION public.get_credit_state(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_balance integer := 0;
  v_held integer := 0;
  v_purchased integer := 0;
  v_used integer := 0;
BEGIN
  SELECT credits_balance, total_credits_purchased, total_credits_used
    INTO v_balance, v_purchased, v_used
  FROM public.profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'profile_not_found');
  END IF;

  SELECT COALESCE(SUM(amount), 0)
    INTO v_held
  FROM public.credit_holds
  WHERE user_id = p_user_id
    AND status = 'held'
    AND expires_at > now();

  RETURN jsonb_build_object(
    'success', true,
    'balance', COALESCE(v_balance, 0),
    'held', COALESCE(v_held, 0),
    'available', GREATEST(COALESCE(v_balance, 0) - COALESCE(v_held, 0), 0),
    'totalPurchased', COALESCE(v_purchased, 0),
    'totalUsed', COALESCE(v_used, 0)
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_credit_state(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_credit_state(uuid) TO authenticated, service_role;

CREATE UNIQUE INDEX IF NOT EXISTS credit_transactions_hold_usage_unique
ON public.credit_transactions (idempotency_key)
WHERE idempotency_key IS NOT NULL AND idempotency_key LIKE 'hold:%';

CREATE OR REPLACE FUNCTION public.add_credits(p_user_id uuid, p_amount integer, p_description text, p_stripe_payment_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  is_duplicate boolean;
  anomaly boolean;
  current_balance integer;
  new_balance integer;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 100000 THEN
    RAISE EXCEPTION 'Invalid credit amount: %', p_amount;
  END IF;

  IF p_stripe_payment_id IS NULL OR length(p_stripe_payment_id) < 5 THEN
    RAISE EXCEPTION 'Invalid Stripe payment reference';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.credit_transactions
    WHERE stripe_payment_id = p_stripe_payment_id
  ) INTO is_duplicate;

  IF is_duplicate THEN
    RETURN jsonb_build_object('success', false, 'reason', 'duplicate_payment');
  END IF;

  SELECT credits_balance INTO current_balance
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF current_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'profile_not_found');
  END IF;

  new_balance := current_balance + p_amount;
  anomaly := public.detect_credit_anomaly(p_user_id, p_amount);

  -- Insert first so the profile audit trigger can see the matching credit row.
  INSERT INTO public.credit_transactions (
    user_id, amount, transaction_type, description, stripe_payment_id, balance_after
  ) VALUES (
    p_user_id, p_amount, 'purchase', p_description, p_stripe_payment_id, new_balance
  );

  UPDATE public.profiles
  SET credits_balance = new_balance,
      total_credits_purchased = COALESCE(total_credits_purchased, 0) + p_amount,
      updated_at = now()
  WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true, 'credits_added', p_amount, 'newBalance', new_balance, 'flagged', anomaly);
END;
$function$;

CREATE OR REPLACE FUNCTION public.consume_credit_hold(p_hold_id uuid, p_description text DEFAULT NULL::text, p_clip_duration integer DEFAULT NULL::integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_hold credit_holds%ROWTYPE;
  v_balance integer;
  v_new_balance integer;
BEGIN
  SELECT * INTO v_hold
  FROM public.credit_holds
  WHERE id = p_hold_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'hold_not_found');
  END IF;

  IF v_hold.status = 'consumed' THEN
    RETURN jsonb_build_object('success', true, 'reused', true, 'amount', v_hold.amount);
  END IF;

  IF v_hold.status <> 'held' THEN
    RETURN jsonb_build_object('success', false, 'error', 'hold_not_active', 'status', v_hold.status);
  END IF;

  IF v_hold.expires_at <= now() THEN
    UPDATE public.credit_holds SET status = 'expired', released_at = now() WHERE id = v_hold.id;
    RETURN jsonb_build_object('success', false, 'error', 'hold_expired');
  END IF;

  SELECT credits_balance INTO v_balance
  FROM public.profiles
  WHERE id = v_hold.user_id
  FOR UPDATE;

  IF v_balance IS NULL OR v_balance < v_hold.amount THEN
    UPDATE public.credit_holds SET status = 'released', released_at = now() WHERE id = v_hold.id;
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_balance', 'balance', v_balance);
  END IF;

  v_new_balance := v_balance - v_hold.amount;

  UPDATE public.profiles
  SET credits_balance = v_new_balance,
      total_credits_used = COALESCE(total_credits_used, 0) + v_hold.amount,
      updated_at = now()
  WHERE id = v_hold.user_id;

  INSERT INTO public.credit_transactions (
    user_id, amount, transaction_type, description, project_id, clip_duration_seconds, idempotency_key, balance_after
  ) VALUES (
    v_hold.user_id,
    -v_hold.amount,
    'usage',
    COALESCE(p_description, v_hold.description, 'Generation'),
    v_hold.project_id,
    p_clip_duration,
    'hold:' || v_hold.id::text,
    v_new_balance
  )
  ON CONFLICT DO NOTHING;

  UPDATE public.credit_holds
  SET status = 'consumed', consumed_at = now()
  WHERE id = v_hold.id;

  RETURN jsonb_build_object('success', true, 'amount', v_hold.amount, 'newBalance', v_new_balance);
END;
$function$;

CREATE OR REPLACE FUNCTION public.refund_credits(p_user_id uuid, p_amount integer, p_description text, p_project_id uuid DEFAULT NULL::uuid, p_idempotency_key text DEFAULT NULL::text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  existing_txn_id uuid;
  current_balance integer;
  new_balance integer;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'refund_credits requires a positive amount (got %).', p_amount;
  END IF;

  IF p_idempotency_key IS NOT NULL AND p_project_id IS NOT NULL THEN
    SELECT id INTO existing_txn_id
    FROM public.credit_transactions
    WHERE user_id = p_user_id
      AND project_id = p_project_id
      AND idempotency_key = p_idempotency_key
      AND transaction_type = 'refund'
    LIMIT 1;

    IF existing_txn_id IS NOT NULL THEN
      RETURN TRUE;
    END IF;
  END IF;

  SELECT credits_balance INTO current_balance
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF current_balance IS NULL THEN
    RETURN FALSE;
  END IF;

  new_balance := current_balance + p_amount;

  INSERT INTO public.credit_transactions (
    user_id, amount, transaction_type, description, project_id, idempotency_key, balance_after
  ) VALUES (
    p_user_id, p_amount, 'refund', p_description, p_project_id, p_idempotency_key, new_balance
  );

  UPDATE public.profiles
  SET credits_balance = new_balance,
      total_credits_used = GREATEST(0, COALESCE(total_credits_used, 0) - p_amount),
      updated_at = now()
  WHERE id = p_user_id;

  RETURN TRUE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.audit_credits_balance_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  delta integer;
  v_match_count integer;
BEGIN
  delta := NEW.credits_balance - OLD.credits_balance;

  IF delta <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_match_count
  FROM public.credit_transactions
  WHERE user_id = NEW.id
    AND amount = delta
    AND amount > 0
    AND created_at >= (now() - interval '2 minutes')
    AND transaction_type IN (
      'welcome_bonus','purchase','refund','referral_bonus',
      'system_grant','admin_grant','bonus','promo','reward'
    );

  IF v_match_count = 0 THEN
    INSERT INTO public.credit_transactions (user_id, amount, transaction_type, description, balance_after)
    VALUES (
      NEW.id,
      delta,
      'untracked_increase',
      'SECURITY ALERT: credits_balance increased by ' || delta || ' without a matching transaction. Possible exploit attempt.',
      NEW.credits_balance
    );
  END IF;

  RETURN NEW;
END;
$function$;