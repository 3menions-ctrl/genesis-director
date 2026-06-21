-- 1) Add idempotency_key column to credit_transactions
ALTER TABLE public.credit_transactions
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- 2) Partial unique index: prevent the same (user, project, key) from being charged twice
CREATE UNIQUE INDEX IF NOT EXISTS credit_transactions_idempotency_unique
  ON public.credit_transactions (user_id, project_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND project_id IS NOT NULL;

-- 3) Harden deduct_credits: reject non-positive amounts, support idempotency
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
BEGIN
  -- HARDENING: reject non-positive amounts. Refunds MUST use refund_credits().
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'deduct_credits requires a positive amount (got %). Use refund_credits for refunds.', p_amount;
  END IF;

  -- IDEMPOTENCY: if a deduction with this key already exists for this project, return TRUE without re-charging
  IF p_idempotency_key IS NOT NULL AND p_project_id IS NOT NULL THEN
    SELECT id INTO existing_txn_id
    FROM credit_transactions
    WHERE user_id = p_user_id
      AND project_id = p_project_id
      AND idempotency_key = p_idempotency_key
    LIMIT 1;

    IF existing_txn_id IS NOT NULL THEN
      RETURN TRUE; -- already charged, no-op
    END IF;
  END IF;

  -- Lock the row and get current balance
  SELECT credits_balance INTO current_balance
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF current_balance IS NULL THEN
    RETURN FALSE;
  END IF;

  IF current_balance < p_amount THEN
    RETURN FALSE;
  END IF;

  UPDATE profiles
  SET
    credits_balance = credits_balance - p_amount,
    total_credits_used = total_credits_used + p_amount,
    updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO credit_transactions (
    user_id, amount, transaction_type, description,
    project_id, clip_duration_seconds, idempotency_key
  )
  VALUES (
    p_user_id, -p_amount, 'usage', p_description,
    p_project_id, p_clip_duration, p_idempotency_key
  );

  RETURN TRUE;
END;
$function$;

-- 4) Single source-of-truth refund function (positive p_amount = credits to give back)
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
AS $function$
DECLARE
  existing_txn_id UUID;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'refund_credits requires a positive amount (got %).', p_amount;
  END IF;

  -- IDEMPOTENCY: refund only once per key
  IF p_idempotency_key IS NOT NULL AND p_project_id IS NOT NULL THEN
    SELECT id INTO existing_txn_id
    FROM credit_transactions
    WHERE user_id = p_user_id
      AND project_id = p_project_id
      AND idempotency_key = p_idempotency_key
      AND transaction_type = 'refund'
    LIMIT 1;

    IF existing_txn_id IS NOT NULL THEN
      RETURN TRUE;
    END IF;
  END IF;

  -- Lock the row, restore balance
  PERFORM 1 FROM profiles WHERE id = p_user_id FOR UPDATE;

  UPDATE profiles
  SET
    credits_balance = credits_balance + p_amount,
    total_credits_used = GREATEST(0, total_credits_used - p_amount),
    updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO credit_transactions (
    user_id, amount, transaction_type, description,
    project_id, idempotency_key
  )
  VALUES (
    p_user_id, p_amount, 'refund', p_description,
    p_project_id, p_idempotency_key
  );

  RETURN TRUE;
END;
$function$;