-- Make deduct_credits auto-route to organization credits when the project belongs to one.
-- Personal credits are only used when the project has no organization_id.
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
AS $function$
DECLARE
  current_balance INTEGER;
  existing_txn_id UUID;
  v_org_id UUID;
  v_org_balance INTEGER;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'deduct_credits requires a positive amount (got %). Use refund_credits for refunds.', p_amount;
  END IF;

  -- Resolve org context from project
  IF p_project_id IS NOT NULL THEN
    SELECT organization_id INTO v_org_id
    FROM movie_projects
    WHERE id = p_project_id
    LIMIT 1;
  END IF;

  -- ===== ORG-SCOPED PATH =====
  IF v_org_id IS NOT NULL THEN
    -- Idempotency check (org-scoped via credit_transactions.organization_id if present, else project)
    IF p_idempotency_key IS NOT NULL THEN
      SELECT id INTO existing_txn_id
      FROM credit_transactions
      WHERE project_id = p_project_id
        AND idempotency_key = p_idempotency_key
      LIMIT 1;
      IF existing_txn_id IS NOT NULL THEN
        RETURN TRUE;
      END IF;
    END IF;

    -- Lock org row, check balance, deduct
    SELECT credits_balance INTO v_org_balance
    FROM organizations
    WHERE id = v_org_id
    FOR UPDATE;

    IF v_org_balance IS NULL OR v_org_balance < p_amount THEN
      RETURN FALSE;
    END IF;

    UPDATE organizations
    SET credits_balance = credits_balance - p_amount,
        total_credits_used = COALESCE(total_credits_used, 0) + p_amount,
        updated_at = now()
    WHERE id = v_org_id;

    -- Log as a transaction tagged to the spending user but for org bookkeeping
    INSERT INTO credit_transactions (
      user_id, amount, transaction_type, description,
      project_id, clip_duration_seconds, idempotency_key, balance_after
    ) VALUES (
      p_user_id, -p_amount, 'consumption',
      COALESCE(p_description, '') || ' [org]',
      p_project_id, p_clip_duration, p_idempotency_key, v_org_balance - p_amount
    );

    RETURN TRUE;
  END IF;

  -- ===== PERSONAL PATH (unchanged) =====
  IF p_idempotency_key IS NOT NULL AND p_project_id IS NOT NULL THEN
    SELECT id INTO existing_txn_id
    FROM credit_transactions
    WHERE user_id = p_user_id
      AND project_id = p_project_id
      AND idempotency_key = p_idempotency_key
    LIMIT 1;
    IF existing_txn_id IS NOT NULL THEN
      RETURN TRUE;
    END IF;
  END IF;

  SELECT credits_balance INTO current_balance
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF current_balance IS NULL OR current_balance < p_amount THEN
    RETURN FALSE;
  END IF;

  UPDATE profiles
  SET credits_balance = credits_balance - p_amount,
      updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO credit_transactions (
    user_id, amount, transaction_type, description,
    project_id, clip_duration_seconds, idempotency_key, balance_after
  ) VALUES (
    p_user_id, -p_amount, 'consumption', p_description,
    p_project_id, p_clip_duration, p_idempotency_key, current_balance - p_amount
  );

  RETURN TRUE;
END;
$function$;