-- P2-26: deduct_credits now honors idempotency even without a project_id
-- (edit-photo / inpaint-photo pass a key but no project → retries double-charged).
-- Applied to prod via Management API 2026-07-01; recorded here for history sync.

CREATE OR REPLACE FUNCTION public.deduct_credits(p_user_id uuid, p_amount integer, p_description text, p_project_id uuid DEFAULT NULL::uuid, p_clip_duration integer DEFAULT NULL::integer, p_idempotency_key text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id uuid;
  current_balance integer;
  held_total integer;
  existing_txn_id uuid;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'deduct_credits requires a positive amount (got %). Use refund_credits for refunds.', p_amount;
  END IF;

  -- P2-26: idempotency now honored even when there is NO project_id (e.g.
  -- edit-photo / inpaint-photo pass a key but no project). Previously the
  -- short-circuit required BOTH key AND project_id, so photo retries double-charged.
  IF p_idempotency_key IS NOT NULL THEN
    IF p_project_id IS NOT NULL THEN
      SELECT id INTO existing_txn_id FROM public.credit_transactions
      WHERE user_id = p_user_id AND project_id = p_project_id AND idempotency_key = p_idempotency_key LIMIT 1;
    ELSE
      SELECT id INTO existing_txn_id FROM public.credit_transactions
      WHERE user_id = p_user_id AND project_id IS NULL AND idempotency_key = p_idempotency_key LIMIT 1;
    END IF;
    IF existing_txn_id IS NOT NULL THEN RETURN TRUE; END IF;
  END IF;

  PERFORM public.expire_credit_holds();

  v_org_id := (SELECT organization_id FROM public.movie_projects WHERE id = p_project_id);

  IF v_org_id IS NOT NULL THEN
    IF NOT public.fn_org_has_min_role(v_org_id, p_user_id, 'viewer') THEN
      RETURN FALSE;
    END IF;
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
