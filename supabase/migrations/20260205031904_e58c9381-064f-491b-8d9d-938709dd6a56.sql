-- Add unique constraint on stripe_payment_id for purchase transactions
-- This prevents duplicate credit awards from webhook retries

-- First, check if there are any existing duplicates (there shouldn't be)
-- If there are, we'd need to handle them, but let's assume clean data

-- Add unique constraint for non-null stripe_payment_id values
CREATE UNIQUE INDEX IF NOT EXISTS credit_transactions_stripe_payment_unique 
ON credit_transactions (stripe_payment_id) 
WHERE stripe_payment_id IS NOT NULL;

-- Update the add_credits function to be idempotent
CREATE OR REPLACE FUNCTION public.add_credits(
  p_user_id uuid, 
  p_amount integer, 
  p_stripe_payment_id text, 
  p_description text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_existing_count integer;
BEGIN
  -- IDEMPOTENCY CHECK: Prevent duplicate credit awards from webhook retries
  IF p_stripe_payment_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_existing_count
    FROM credit_transactions
    WHERE stripe_payment_id = p_stripe_payment_id;
    
    IF v_existing_count > 0 THEN
      -- Already processed this payment - return success but don't add credits again
      RAISE NOTICE 'Payment % already processed, skipping duplicate', p_stripe_payment_id;
      RETURN TRUE;
    END IF;
  END IF;

  -- Add credits to user profile
  UPDATE profiles
  SET 
    credits_balance = credits_balance + p_amount,
    total_credits_purchased = total_credits_purchased + p_amount,
    updated_at = now()
  WHERE id = p_user_id;
  
  -- Verify user exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found: %', p_user_id;
  END IF;
  
  -- Record transaction (protected by unique index on stripe_payment_id)
  INSERT INTO credit_transactions (user_id, amount, transaction_type, description, stripe_payment_id)
  VALUES (p_user_id, p_amount, 'purchase', p_description, p_stripe_payment_id);
  
  RETURN TRUE;
EXCEPTION
  WHEN unique_violation THEN
    -- Concurrent webhook retry - payment already processed
    RAISE NOTICE 'Concurrent payment processing detected for %, returning success', p_stripe_payment_id;
    RETURN TRUE;
END;
$function$;