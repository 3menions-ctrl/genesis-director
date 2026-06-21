
-- Harden increment_credits: revoke from end-users, add internal caller check
REVOKE EXECUTE ON FUNCTION public.increment_credits(uuid, integer) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.increment_credits(user_id_param uuid, amount_param integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Defense in depth: only service_role or postgres may invoke (revoke already enforces this for direct calls)
  IF auth.role() IS DISTINCT FROM 'service_role' AND current_user NOT IN ('postgres','supabase_admin') THEN
    RAISE EXCEPTION 'forbidden: increment_credits is service-role only';
  END IF;

  IF amount_param <= 0 OR amount_param > 10000 THEN
    RAISE EXCEPTION 'Invalid credit amount: must be between 1 and 10000';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = user_id_param) THEN
    RAISE EXCEPTION 'User not found: %', user_id_param;
  END IF;

  UPDATE profiles
  SET credits_balance = COALESCE(credits_balance, 0) + amount_param,
      updated_at = now()
  WHERE id = user_id_param;

  INSERT INTO credit_transactions (user_id, amount, transaction_type, description)
  VALUES (user_id_param, amount_param, 'system_grant', 'System credit grant via increment_credits');
END;
$function$;

-- Cron-only / service-only functions: revoke from end-users
REVOKE EXECUTE ON FUNCTION public.monthly_org_credit_refill() FROM PUBLIC, anon, authenticated;

-- Org credit consumption should be server-mediated (edge function chooses org context)
REVOKE EXECUTE ON FUNCTION public.consume_org_credits(uuid, integer, text, jsonb) FROM PUBLIC, anon, authenticated;
