-- Ledger-authoritative credit rebuild
-- The transaction ledger is the only balance source. profiles.credits_balance remains a cache only.

CREATE OR REPLACE FUNCTION public.credit_ledger_total(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(SUM(amount), 0)::integer
  FROM public.credit_transactions
  WHERE user_id = p_user_id
    AND transaction_type NOT IN ('untracked_increase','audit','security_alert');
$$;

CREATE OR REPLACE FUNCTION public.active_credit_holds_total(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(SUM(amount), 0)::integer
  FROM public.credit_holds
  WHERE user_id = p_user_id
    AND status = 'held'
    AND expires_at > now();
$$;

CREATE OR REPLACE FUNCTION public.expire_credit_holds()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH expired AS (
    UPDATE public.credit_holds
    SET status = 'expired', released_at = now()
    WHERE status = 'held' AND expires_at <= now()
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM expired;

  RETURN COALESCE(v_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_balance_from_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.transaction_type IN ('untracked_increase','audit','security_alert') THEN
    RETURN NEW;
  END IF;

  UPDATE public.profiles
  SET credits_balance = public.credit_ledger_total(NEW.user_id),
      total_credits_purchased = GREATEST(0, (
        SELECT COALESCE(SUM(amount), 0)::integer
        FROM public.credit_transactions
        WHERE user_id = NEW.user_id
          AND amount > 0
          AND transaction_type NOT IN ('untracked_increase','audit','security_alert')
      )),
      total_credits_used = GREATEST(0, -(
        SELECT COALESCE(SUM(amount), 0)::integer
        FROM public.credit_transactions
        WHERE user_id = NEW.user_id
          AND amount < 0
          AND transaction_type NOT IN ('untracked_increase','audit','security_alert')
      )),
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

CREATE OR REPLACE FUNCTION public.get_credit_state(p_user_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_requester uuid := auth.uid();
  v_role text := COALESCE(current_setting('request.jwt.claim.role', true), '');
  v_balance integer := 0;
  v_held integer := 0;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  IF v_role <> 'service_role' AND (v_requester IS NULL OR (p_user_id <> v_requester AND NOT public.is_admin(v_requester))) THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'profile_not_found');
  END IF;

  v_balance := public.credit_ledger_total(p_user_id);
  v_held := public.active_credit_holds_total(p_user_id);

  RETURN jsonb_build_object(
    'success', true,
    'balance', v_balance,
    'held', v_held,
    'available', GREATEST(v_balance - v_held, 0),
    'source', 'ledger',
    'totalPurchased', GREATEST(0, (
      SELECT COALESCE(SUM(amount), 0)::integer
      FROM public.credit_transactions
      WHERE user_id = p_user_id
        AND amount > 0
        AND transaction_type NOT IN ('untracked_increase','audit','security_alert')
    )),
    'totalUsed', GREATEST(0, -(
      SELECT COALESCE(SUM(amount), 0)::integer
      FROM public.credit_transactions
      WHERE user_id = p_user_id
        AND amount < 0
        AND transaction_type NOT IN ('untracked_increase','audit','security_alert')
    ))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_ledger_balance(p_user_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN public.get_credit_state(p_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.reconcile_user_credits()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_balance integer := 0;
  v_held integer := 0;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  PERFORM public.expire_credit_holds();

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user) THEN
    RETURN jsonb_build_object('success', false, 'error', 'profile_not_found');
  END IF;

  v_balance := public.credit_ledger_total(v_user);
  v_held := public.active_credit_holds_total(v_user);

  UPDATE public.profiles
  SET credits_balance = v_balance,
      total_credits_purchased = GREATEST(0, (
        SELECT COALESCE(SUM(amount), 0)::integer
        FROM public.credit_transactions
        WHERE user_id = v_user
          AND amount > 0
          AND transaction_type NOT IN ('untracked_increase','audit','security_alert')
      )),
      total_credits_used = GREATEST(0, -(
        SELECT COALESCE(SUM(amount), 0)::integer
        FROM public.credit_transactions
        WHERE user_id = v_user
          AND amount < 0
          AND transaction_type NOT IN ('untracked_increase','audit','security_alert')
      )),
      updated_at = now()
  WHERE id = v_user;

  RETURN jsonb_build_object(
    'success', true,
    'balance', v_balance,
    'held', v_held,
    'available', GREATEST(v_balance - v_held, 0),
    'source', 'ledger'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_credits(
  p_user_id uuid,
  p_amount integer,
  p_project_id uuid DEFAULT NULL::uuid,
  p_description text DEFAULT NULL::text,
  p_idempotency_key text DEFAULT NULL::text,
  p_ttl_seconds integer DEFAULT 900
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existing credit_holds%ROWTYPE;
  v_balance integer := 0;
  v_held_total integer := 0;
  v_available integer := 0;
  v_hold credit_holds%ROWTYPE;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'user_required');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'reserve_credits requires positive amount (got %)', p_amount;
  END IF;

  PERFORM public.expire_credit_holds();
  PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'profile_not_found');
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM public.credit_holds
    WHERE user_id = p_user_id AND idempotency_key = p_idempotency_key
    LIMIT 1;

    IF FOUND THEN
      v_balance := public.credit_ledger_total(p_user_id);
      v_held_total := public.active_credit_holds_total(p_user_id);
      RETURN jsonb_build_object(
        'success', v_existing.status = 'held' AND v_existing.expires_at > now(),
        'holdId', v_existing.id,
        'amount', v_existing.amount,
        'status', v_existing.status,
        'expiresAt', v_existing.expires_at,
        'balance', v_balance,
        'reserved', v_held_total,
        'available', GREATEST(v_balance - v_held_total, 0),
        'effectiveBalance', GREATEST(v_balance - v_held_total, 0),
        'source', 'ledger',
        'reused', true
      );
    END IF;
  END IF;

  v_balance := public.credit_ledger_total(p_user_id);
  v_held_total := public.active_credit_holds_total(p_user_id);
  v_available := v_balance - v_held_total;

  IF v_available < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'insufficient_credits',
      'balance', v_balance,
      'reserved', v_held_total,
      'held', v_held_total,
      'available', GREATEST(v_available, 0),
      'effectiveBalance', GREATEST(v_available, 0),
      'required', p_amount,
      'source', 'ledger'
    );
  END IF;

  INSERT INTO public.credit_holds (
    user_id, project_id, amount, description, idempotency_key, expires_at
  ) VALUES (
    p_user_id, p_project_id, p_amount, p_description, p_idempotency_key,
    now() + make_interval(secs => GREATEST(COALESCE(p_ttl_seconds, 900), 60))
  )
  RETURNING * INTO v_hold;

  RETURN jsonb_build_object(
    'success', true,
    'holdId', v_hold.id,
    'amount', v_hold.amount,
    'status', v_hold.status,
    'expiresAt', v_hold.expires_at,
    'balance', v_balance,
    'reserved', v_held_total + v_hold.amount,
    'held', v_held_total + v_hold.amount,
    'available', GREATEST(v_available - p_amount, 0),
    'effectiveBalance', GREATEST(v_available - p_amount, 0),
    'source', 'ledger',
    'reused', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_credit_hold(
  p_hold_id uuid,
  p_description text DEFAULT NULL::text,
  p_clip_duration integer DEFAULT NULL::integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_hold credit_holds%ROWTYPE;
  v_balance integer := 0;
  v_balance_after integer := 0;
  v_inserted boolean := false;
BEGIN
  SELECT * INTO v_hold
  FROM public.credit_holds
  WHERE id = p_hold_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'hold_not_found');
  END IF;

  IF v_hold.status = 'consumed' THEN
    v_balance := public.credit_ledger_total(v_hold.user_id);
    RETURN jsonb_build_object('success', true, 'reused', true, 'amount', v_hold.amount, 'balance', v_balance, 'newBalance', v_balance, 'source', 'ledger');
  END IF;

  IF v_hold.status <> 'held' THEN
    RETURN jsonb_build_object('success', false, 'error', 'hold_not_active', 'status', v_hold.status);
  END IF;

  IF v_hold.expires_at <= now() THEN
    UPDATE public.credit_holds SET status = 'expired', released_at = now() WHERE id = v_hold.id;
    RETURN jsonb_build_object('success', false, 'error', 'hold_expired');
  END IF;

  PERFORM 1 FROM public.profiles WHERE id = v_hold.user_id FOR UPDATE;
  v_balance := public.credit_ledger_total(v_hold.user_id);

  IF v_balance < v_hold.amount THEN
    UPDATE public.credit_holds SET status = 'released', released_at = now() WHERE id = v_hold.id;
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_balance', 'balance', v_balance, 'source', 'ledger');
  END IF;

  v_balance_after := v_balance - v_hold.amount;

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
    v_balance_after
  )
  ON CONFLICT DO NOTHING
  RETURNING true INTO v_inserted;

  UPDATE public.credit_holds
  SET status = 'consumed', consumed_at = now()
  WHERE id = v_hold.id;

  RETURN jsonb_build_object('success', true, 'amount', v_hold.amount, 'newBalance', public.credit_ledger_total(v_hold.user_id), 'inserted', COALESCE(v_inserted, false), 'source', 'ledger');
END;
$$;

CREATE OR REPLACE FUNCTION public.release_credit_hold(p_hold_id uuid, p_reason text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_hold credit_holds%ROWTYPE;
  v_balance integer := 0;
  v_held integer := 0;
BEGIN
  SELECT * INTO v_hold FROM public.credit_holds WHERE id = p_hold_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'hold_not_found');
  END IF;

  IF v_hold.status <> 'held' THEN
    v_balance := public.credit_ledger_total(v_hold.user_id);
    v_held := public.active_credit_holds_total(v_hold.user_id);
    RETURN jsonb_build_object(
      'success', v_hold.status IN ('released','expired','consumed'),
      'reused', true,
      'status', v_hold.status,
      'balance', v_balance,
      'held', v_held,
      'available', GREATEST(v_balance - v_held, 0),
      'source', 'ledger'
    );
  END IF;

  UPDATE public.credit_holds
  SET status = 'released',
      released_at = now(),
      description = COALESCE(p_reason, description)
  WHERE id = v_hold.id;

  v_balance := public.credit_ledger_total(v_hold.user_id);
  v_held := public.active_credit_holds_total(v_hold.user_id);

  RETURN jsonb_build_object('success', true, 'amount', v_hold.amount, 'balance', v_balance, 'held', v_held, 'available', GREATEST(v_balance - v_held, 0), 'source', 'ledger');
END;
$$;

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
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 100000 THEN
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

CREATE OR REPLACE FUNCTION public.refund_credits(
  p_user_id uuid,
  p_amount integer,
  p_description text,
  p_project_id uuid DEFAULT NULL::uuid,
  p_idempotency_key text DEFAULT NULL::text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  existing_txn_id uuid;
  new_balance integer;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'refund_credits requires a positive amount (got %).', p_amount;
  END IF;

  PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN FALSE;
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

  new_balance := public.credit_ledger_total(p_user_id) + p_amount;

  INSERT INTO public.credit_transactions (
    user_id, amount, transaction_type, description, project_id, idempotency_key, balance_after
  ) VALUES (
    p_user_id, p_amount, 'refund', p_description, p_project_id, p_idempotency_key, new_balance
  );

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.deduct_credits(
  p_user_id uuid,
  p_amount integer,
  p_description text,
  p_project_id uuid DEFAULT NULL::uuid,
  p_clip_duration integer DEFAULT NULL::integer,
  p_idempotency_key text DEFAULT NULL::text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_balance integer;
  held_total integer;
  existing_txn_id uuid;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'deduct_credits requires a positive amount (got %). Use refund_credits for refunds.', p_amount;
  END IF;

  IF p_idempotency_key IS NOT NULL AND p_project_id IS NOT NULL THEN
    SELECT id INTO existing_txn_id
    FROM public.credit_transactions
    WHERE user_id = p_user_id
      AND project_id = p_project_id
      AND idempotency_key = p_idempotency_key
    LIMIT 1;

    IF existing_txn_id IS NOT NULL THEN
      RETURN TRUE;
    END IF;
  END IF;

  PERFORM public.expire_credit_holds();
  PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  current_balance := public.credit_ledger_total(p_user_id);
  held_total := public.active_credit_holds_total(p_user_id);

  IF current_balance - held_total < p_amount THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.credit_transactions (
    user_id, amount, transaction_type, description,
    project_id, clip_duration_seconds, idempotency_key, balance_after
  ) VALUES (
    p_user_id, -p_amount, 'usage', p_description,
    p_project_id, p_clip_duration, p_idempotency_key, current_balance - p_amount
  );

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_adjust_credits(p_target_user_id uuid, p_amount integer, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  admin_user_id uuid := auth.uid();
  new_balance integer;
BEGIN
  IF NOT public.is_admin(admin_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  IF p_amount IS NULL OR p_amount = 0 THEN
    RAISE EXCEPTION 'Credit adjustment amount is required';
  END IF;

  PERFORM 1 FROM public.profiles WHERE id = p_target_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'profile_not_found');
  END IF;

  new_balance := public.credit_ledger_total(p_target_user_id) + p_amount;
  IF new_balance < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_credits', 'balance', public.credit_ledger_total(p_target_user_id));
  END IF;

  INSERT INTO public.credit_transactions (user_id, amount, transaction_type, description, balance_after)
  VALUES (
    p_target_user_id,
    p_amount,
    CASE WHEN p_amount >= 0 THEN 'admin_grant' ELSE 'admin_deduct' END,
    p_reason,
    new_balance
  );

  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (admin_user_id, 'adjust_credits', 'user', p_target_user_id::text,
    jsonb_build_object('amount', p_amount, 'reason', p_reason, 'new_balance', new_balance, 'source', 'ledger'));

  RETURN jsonb_build_object('success', true, 'new_balance', public.credit_ledger_total(p_target_user_id), 'source', 'ledger');
END;
$$;

CREATE OR REPLACE FUNCTION public.charge_preproduction_credits(p_project_id uuid, p_shot_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN public.charge_preproduction_credits(p_project_id, p_shot_id, 2);
END;
$$;

CREATE OR REPLACE FUNCTION public.charge_preproduction_credits(p_project_id uuid, p_shot_id text, p_credits_amount integer DEFAULT 2)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_balance integer;
  v_held integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF p_credits_amount IS NULL OR p_credits_amount <= 0 THEN
    RAISE EXCEPTION 'charge_preproduction_credits requires positive amount';
  END IF;

  PERFORM public.expire_credit_holds();
  PERFORM 1 FROM public.profiles WHERE id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'profile_not_found');
  END IF;

  v_balance := public.credit_ledger_total(v_user_id);
  v_held := public.active_credit_holds_total(v_user_id);

  IF v_balance - v_held < p_credits_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient credits', 'required', p_credits_amount, 'available', GREATEST(v_balance - v_held, 0), 'source', 'ledger');
  END IF;

  INSERT INTO public.production_credit_phases (user_id, project_id, shot_id, phase, credits_amount, status)
  VALUES (v_user_id, p_project_id, p_shot_id, 'pre_production', p_credits_amount, 'charged');

  INSERT INTO public.credit_transactions (user_id, amount, transaction_type, description, project_id, balance_after)
  VALUES (v_user_id, -p_credits_amount, 'usage', 'Pre-production: Script & Image Gen for shot ' || p_shot_id, p_project_id, v_balance - p_credits_amount);

  RETURN jsonb_build_object('success', true, 'credits_charged', p_credits_amount, 'remaining_balance', public.credit_ledger_total(v_user_id), 'source', 'ledger');
END;
$$;

CREATE OR REPLACE FUNCTION public.charge_production_credits(p_project_id uuid, p_shot_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN public.charge_production_credits(p_project_id, p_shot_id, 6);
END;
$$;

CREATE OR REPLACE FUNCTION public.charge_production_credits(p_project_id uuid, p_shot_id text, p_credits_amount integer DEFAULT 6)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_balance integer;
  v_held integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF p_credits_amount IS NULL OR p_credits_amount <= 0 THEN
    RAISE EXCEPTION 'charge_production_credits requires positive amount';
  END IF;

  PERFORM public.expire_credit_holds();
  PERFORM 1 FROM public.profiles WHERE id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'profile_not_found');
  END IF;

  v_balance := public.credit_ledger_total(v_user_id);
  v_held := public.active_credit_holds_total(v_user_id);

  IF v_balance - v_held < p_credits_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient credits', 'required', p_credits_amount, 'available', GREATEST(v_balance - v_held, 0), 'source', 'ledger');
  END IF;

  INSERT INTO public.production_credit_phases (user_id, project_id, shot_id, phase, credits_amount, status)
  VALUES (v_user_id, p_project_id, p_shot_id, 'production', p_credits_amount, 'charged');

  INSERT INTO public.credit_transactions (user_id, amount, transaction_type, description, project_id, balance_after)
  VALUES (v_user_id, -p_credits_amount, 'usage', 'Production: Video & Voice Gen for shot ' || p_shot_id, p_project_id, v_balance - p_credits_amount);

  RETURN jsonb_build_object('success', true, 'credits_charged', p_credits_amount, 'remaining_balance', public.credit_ledger_total(v_user_id), 'source', 'ledger');
END;
$$;

-- Re-sync cache for every existing user from the ledger.
UPDATE public.profiles p
SET credits_balance = public.credit_ledger_total(p.id),
    total_credits_purchased = GREATEST(0, (
      SELECT COALESCE(SUM(amount), 0)::integer
      FROM public.credit_transactions
      WHERE user_id = p.id
        AND amount > 0
        AND transaction_type NOT IN ('untracked_increase','audit','security_alert')
    )),
    total_credits_used = GREATEST(0, -(
      SELECT COALESCE(SUM(amount), 0)::integer
      FROM public.credit_transactions
      WHERE user_id = p.id
        AND amount < 0
        AND transaction_type NOT IN ('untracked_increase','audit','security_alert')
    )),
    updated_at = now();

REVOKE EXECUTE ON FUNCTION public.credit_ledger_total(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.active_credit_holds_total(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_credit_state(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_ledger_balance(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reconcile_user_credits() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_credit_state(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_ledger_balance(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_user_credits() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_credits(uuid, integer, uuid, text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_credit_hold(uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_credit_hold(uuid, text) TO service_role;