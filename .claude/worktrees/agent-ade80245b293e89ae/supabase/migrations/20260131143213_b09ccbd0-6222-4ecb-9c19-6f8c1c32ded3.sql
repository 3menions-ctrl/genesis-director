-- Create increment_credits function for refund logic
CREATE OR REPLACE FUNCTION public.increment_credits(
  user_id_param UUID,
  amount_param INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET 
    credits_balance = COALESCE(credits_balance, 0) + amount_param,
    updated_at = now()
  WHERE id = user_id_param;
END;
$$;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION public.increment_credits(UUID, INTEGER) TO service_role;

COMMENT ON FUNCTION public.increment_credits IS 'Safely increment user credits balance for refunds and rewards';