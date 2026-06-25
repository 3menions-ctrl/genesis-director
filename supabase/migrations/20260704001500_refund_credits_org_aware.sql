-- ─────────────────────────────────────────────────────────────────────────
-- Make refund_credits ORG-AWARE (pairs with 20260704000700 org-pool consumption).
--
-- After 000700, deduct_credits/consume_credit_hold route ORG-project spend to the
-- ORG pool (organizations.credits_balance). But refund_credits still only credited
-- the PERSONAL ledger — so a refund for an org project (e.g. the editor's sync or
-- async failure refund, which passes p_project_id) would return credits to the
-- wrong pool. This routes the refund to the same pool the project debits from.
--
-- Personal path: unchanged (positive 'refund' row in credit_transactions).
-- Org path: positive 'refund' row tagged with organization_id + restore
--           organizations.credits_balance (and un-count total_credits_used,
--           floored at 0). Idempotent on (project_id, idempotency_key, 'refund').
--
-- !! Money-path function — verify on a snapshot/clone before prod (see
--    FINANCE_DEPLOY_PLAN.md). Ships with the org-pool set, NOT applied to prod here.
-- ─────────────────────────────────────────────────────────────────────────
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
  v_org_id uuid;
  existing_txn_id uuid;
  current_balance integer;
  new_balance integer;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'refund_credits requires a positive amount (got %).', p_amount;
  END IF;

  v_org_id := (SELECT organization_id FROM public.movie_projects WHERE id = p_project_id);

  IF v_org_id IS NOT NULL THEN
    -- ── ORG POOL PATH ──────────────────────────────────────────────────────
    -- Idempotency: one 'refund' row per (project, key).
    IF p_idempotency_key IS NOT NULL AND p_project_id IS NOT NULL THEN
      SELECT id INTO existing_txn_id FROM public.credit_transactions
      WHERE project_id = p_project_id
        AND idempotency_key = p_idempotency_key
        AND transaction_type = 'refund'
      LIMIT 1;
      IF existing_txn_id IS NOT NULL THEN RETURN TRUE; END IF;
    END IF;

    SELECT credits_balance INTO current_balance
    FROM public.organizations WHERE id = v_org_id FOR UPDATE;
    IF NOT FOUND THEN RETURN FALSE; END IF;

    INSERT INTO public.credit_transactions (
      user_id, amount, transaction_type, description, project_id,
      idempotency_key, balance_after, organization_id
    ) VALUES (
      p_user_id, p_amount, 'refund', p_description, p_project_id,
      p_idempotency_key, current_balance + p_amount, v_org_id
    );

    UPDATE public.organizations
    SET credits_balance     = credits_balance + p_amount,
        total_credits_used  = GREATEST(0, total_credits_used - p_amount),
        updated_at          = now()
    WHERE id = v_org_id;

    RETURN TRUE;
  END IF;

  -- ── PERSONAL PATH (unchanged from prior definition) ──────────────────────
  PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  IF p_idempotency_key IS NOT NULL AND p_project_id IS NOT NULL THEN
    SELECT id INTO existing_txn_id FROM public.credit_transactions
    WHERE user_id = p_user_id
      AND project_id = p_project_id
      AND idempotency_key = p_idempotency_key
      AND transaction_type = 'refund'
    LIMIT 1;
    IF existing_txn_id IS NOT NULL THEN RETURN TRUE; END IF;
  END IF;

  new_balance := public.credit_ledger_total(p_user_id) + p_amount;

  INSERT INTO public.credit_transactions (
    user_id, amount, transaction_type, description, project_id,
    idempotency_key, balance_after
  ) VALUES (
    p_user_id, p_amount, 'refund', p_description, p_project_id,
    p_idempotency_key, new_balance
  );

  RETURN TRUE;
END;
$$;
