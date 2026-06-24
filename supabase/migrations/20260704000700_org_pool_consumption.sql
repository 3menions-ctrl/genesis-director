-- FEATURE (product decision): org generations must ALWAYS consume the ORG
-- credit pool (organizations.credits_balance), not the member's personal
-- credits. Previously reserve_credits/consume_credit_hold/deduct_credits were
-- entirely user-scoped and the org pool was never debited (decorative).
--
-- Model (builds on 20260704000600 which tags credit_transactions.organization_id
-- from the row's project, and 20260704000000 which made credit_ledger_total read
-- credit_transactions):
--   • A generation for a project that has an organization_id reserves/charges
--     against the ORG pool. The spend is recorded as a credit_transactions row
--     with organization_id set (for per-member attribution + the B-2 analytics),
--     but is EXCLUDED from the member's personal ledger and personal holds — so
--     it never touches their personal balance.
--   • Personal projects behave exactly as before.
--
-- ⚠️ MONEY-PATH, UN-DEPLOYED. Validate in staging:
--   1) org-project generation debits organizations.credits_balance (not the
--      member's personal balance), and shows on the business credit/billing pages;
--   2) personal generation still debits personal credits unchanged;
--   3) holds: an in-flight org generation reduces org "available" but not the
--      member's personal available; release/expiry frees it.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Personal balance EXCLUDES org-tagged spend.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.credit_ledger_total(p_user_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE(SUM(amount), 0)::integer
  FROM public.credit_transactions
  WHERE user_id = p_user_id
    AND organization_id IS NULL
    AND transaction_type NOT IN ('untracked_increase','audit','security_alert');
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Personal active holds EXCLUDE holds on org projects.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.active_credit_holds_total(p_user_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE(SUM(h.amount), 0)::integer
  FROM public.credit_holds h
  WHERE h.user_id = p_user_id
    AND h.status = 'held'
    AND h.expires_at > now()
    AND NOT EXISTS (
      SELECT 1 FROM public.movie_projects mp
      WHERE mp.id = h.project_id AND mp.organization_id IS NOT NULL
    );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) reserve_credits — org pool path when the project belongs to an org.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reserve_credits(p_user_id uuid, p_amount integer, p_project_id uuid DEFAULT NULL::uuid, p_description text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text, p_ttl_seconds integer DEFAULT 900)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_org_id uuid;
  v_existing credit_holds%ROWTYPE;
  v_balance integer := 0;
  v_held_total integer := 0;
  v_available integer := 0;
  v_hold credit_holds%ROWTYPE;
  v_src text := 'ledger';
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'user_required');
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'reserve_credits requires positive amount (got %)', p_amount;
  END IF;

  PERFORM public.expire_credit_holds();

  v_org_id := (SELECT organization_id FROM public.movie_projects WHERE id = p_project_id);

  IF v_org_id IS NOT NULL THEN
    -- ORG POOL PATH
    v_src := 'org';
    SELECT credits_balance INTO v_balance FROM public.organizations WHERE id = v_org_id FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'org_not_found');
    END IF;
    SELECT COALESCE(SUM(h.amount), 0) INTO v_held_total
    FROM public.credit_holds h
    JOIN public.movie_projects mp ON mp.id = h.project_id
    WHERE mp.organization_id = v_org_id AND h.status = 'held' AND h.expires_at > now();
  ELSE
    -- PERSONAL PATH
    PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'profile_not_found');
    END IF;
    v_balance := public.credit_ledger_total(p_user_id);
    v_held_total := public.active_credit_holds_total(p_user_id);
  END IF;

  -- Idempotency reuse (holds are keyed by user_id + idempotency_key).
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.credit_holds
    WHERE user_id = p_user_id AND idempotency_key = p_idempotency_key LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', v_existing.status = 'held' AND v_existing.expires_at > now(),
        'holdId', v_existing.id, 'amount', v_existing.amount, 'status', v_existing.status,
        'expiresAt', v_existing.expires_at, 'balance', v_balance, 'reserved', v_held_total,
        'available', GREATEST(v_balance - v_held_total, 0), 'effectiveBalance', GREATEST(v_balance - v_held_total, 0),
        'source', v_src, 'reused', true);
    END IF;
  END IF;

  v_available := v_balance - v_held_total;
  IF v_available < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_credits',
      'balance', v_balance, 'reserved', v_held_total, 'held', v_held_total,
      'available', GREATEST(v_available, 0), 'effectiveBalance', GREATEST(v_available, 0),
      'required', p_amount, 'source', v_src);
  END IF;

  INSERT INTO public.credit_holds (user_id, project_id, amount, description, idempotency_key, expires_at)
  VALUES (p_user_id, p_project_id, p_amount, p_description, p_idempotency_key,
    now() + make_interval(secs => GREATEST(COALESCE(p_ttl_seconds, 900), 60)))
  RETURNING * INTO v_hold;

  RETURN jsonb_build_object('success', true, 'holdId', v_hold.id, 'amount', v_hold.amount,
    'status', v_hold.status, 'expiresAt', v_hold.expires_at, 'balance', v_balance,
    'reserved', v_held_total + v_hold.amount, 'held', v_held_total + v_hold.amount,
    'available', GREATEST(v_available - p_amount, 0), 'effectiveBalance', GREATEST(v_available - p_amount, 0),
    'source', v_src, 'reused', false);
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) consume_credit_hold — org path debits the org pool.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.consume_credit_hold(p_hold_id uuid, p_description text DEFAULT NULL::text, p_clip_duration integer DEFAULT NULL::integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_hold credit_holds%ROWTYPE;
  v_org_id uuid;
  v_balance integer := 0;
  v_balance_after integer := 0;
  v_inserted boolean := false;
BEGIN
  SELECT * INTO v_hold FROM public.credit_holds WHERE id = p_hold_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'hold_not_found');
  END IF;
  IF v_hold.status = 'consumed' THEN
    RETURN jsonb_build_object('success', true, 'reused', true, 'amount', v_hold.amount, 'source', 'reused');
  END IF;
  IF v_hold.status <> 'held' THEN
    RETURN jsonb_build_object('success', false, 'error', 'hold_not_active', 'status', v_hold.status);
  END IF;
  IF v_hold.expires_at <= now() THEN
    UPDATE public.credit_holds SET status = 'expired', released_at = now() WHERE id = v_hold.id;
    RETURN jsonb_build_object('success', false, 'error', 'hold_expired');
  END IF;

  v_org_id := (SELECT organization_id FROM public.movie_projects WHERE id = v_hold.project_id);

  IF v_org_id IS NOT NULL THEN
    -- ORG POOL PATH: debit the org wallet, record an org-tagged usage row (which
    -- credit_ledger_total ignores for the member's personal balance).
    SELECT credits_balance INTO v_balance FROM public.organizations WHERE id = v_org_id FOR UPDATE;
    IF v_balance < v_hold.amount THEN
      UPDATE public.credit_holds SET status = 'released', released_at = now() WHERE id = v_hold.id;
      RETURN jsonb_build_object('success', false, 'error', 'insufficient_balance', 'balance', v_balance, 'source', 'org');
    END IF;
    v_balance_after := v_balance - v_hold.amount;

    INSERT INTO public.credit_transactions (
      user_id, amount, transaction_type, description, project_id, clip_duration_seconds, idempotency_key, balance_after, organization_id
    ) VALUES (
      v_hold.user_id, -v_hold.amount, 'usage', COALESCE(p_description, v_hold.description, 'Generation'),
      v_hold.project_id, p_clip_duration, 'hold:' || v_hold.id::text, v_balance_after, v_org_id
    )
    ON CONFLICT DO NOTHING
    RETURNING true INTO v_inserted;

    UPDATE public.organizations
    SET credits_balance = credits_balance - v_hold.amount,
        total_credits_used = total_credits_used + v_hold.amount,
        updated_at = now()
    WHERE id = v_org_id;

    UPDATE public.credit_holds SET status = 'consumed', consumed_at = now() WHERE id = v_hold.id;
    RETURN jsonb_build_object('success', true, 'amount', v_hold.amount, 'newBalance', v_balance_after, 'inserted', COALESCE(v_inserted, false), 'source', 'org');
  END IF;

  -- PERSONAL PATH (unchanged behavior)
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
    v_hold.user_id, -v_hold.amount, 'usage', COALESCE(p_description, v_hold.description, 'Generation'),
    v_hold.project_id, p_clip_duration, 'hold:' || v_hold.id::text, v_balance_after
  )
  ON CONFLICT DO NOTHING
  RETURNING true INTO v_inserted;
  UPDATE public.credit_holds SET status = 'consumed', consumed_at = now() WHERE id = v_hold.id;
  RETURN jsonb_build_object('success', true, 'amount', v_hold.amount, 'newBalance', public.credit_ledger_total(v_hold.user_id), 'inserted', COALESCE(v_inserted, false), 'source', 'ledger');
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) deduct_credits — direct (no-hold) path; org pool when the project is org's.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.deduct_credits(p_user_id uuid, p_amount integer, p_description text, p_project_id uuid DEFAULT NULL::uuid, p_clip_duration integer DEFAULT NULL::integer, p_idempotency_key text DEFAULT NULL::text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_org_id uuid;
  current_balance integer;
  held_total integer;
  existing_txn_id uuid;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'deduct_credits requires a positive amount (got %). Use refund_credits for refunds.', p_amount;
  END IF;

  IF p_idempotency_key IS NOT NULL AND p_project_id IS NOT NULL THEN
    SELECT id INTO existing_txn_id FROM public.credit_transactions
    WHERE user_id = p_user_id AND project_id = p_project_id AND idempotency_key = p_idempotency_key LIMIT 1;
    IF existing_txn_id IS NOT NULL THEN RETURN TRUE; END IF;
  END IF;

  PERFORM public.expire_credit_holds();

  v_org_id := (SELECT organization_id FROM public.movie_projects WHERE id = p_project_id);

  IF v_org_id IS NOT NULL THEN
    -- ORG POOL PATH
    SELECT credits_balance INTO current_balance FROM public.organizations WHERE id = v_org_id FOR UPDATE;
    IF NOT FOUND THEN RETURN FALSE; END IF;
    IF current_balance < p_amount THEN RETURN FALSE; END IF;
    INSERT INTO public.credit_transactions (
      user_id, amount, transaction_type, description, project_id, clip_duration_seconds, idempotency_key, balance_after, organization_id
    ) VALUES (
      p_user_id, -p_amount, 'usage', p_description, p_project_id, p_clip_duration, p_idempotency_key, current_balance - p_amount, v_org_id
    );
    UPDATE public.organizations
    SET credits_balance = credits_balance - p_amount,
        total_credits_used = total_credits_used + p_amount,
        updated_at = now()
    WHERE id = v_org_id;
    RETURN TRUE;
  END IF;

  -- PERSONAL PATH (unchanged behavior)
  PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  current_balance := public.credit_ledger_total(p_user_id);
  held_total := public.active_credit_holds_total(p_user_id);
  IF current_balance - held_total < p_amount THEN RETURN FALSE; END IF;
  INSERT INTO public.credit_transactions (
    user_id, amount, transaction_type, description, project_id, clip_duration_seconds, idempotency_key, balance_after
  ) VALUES (
    p_user_id, -p_amount, 'usage', p_description, p_project_id, p_clip_duration, p_idempotency_key, current_balance - p_amount
  );
  RETURN TRUE;
END;
$function$;
