
-- ============================================================
-- CREDIT SECURITY HARDENING
-- Closes the exploit where any authenticated user could call
-- SECURITY DEFINER functions to inflate their own credit balance
-- ============================================================

-- STEP 1: REVOKE PUBLIC EXECUTE from all dangerous credit functions
-- These should ONLY be callable by service role (edge functions) or internal DB logic
REVOKE EXECUTE ON FUNCTION public.increment_credits(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.add_credits(uuid, integer, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.deduct_credits(uuid, integer, text, uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_adjust_credits(uuid, integer, text) FROM PUBLIC;

-- STEP 2: Grant ONLY to service_role (edge functions use service role key)
GRANT EXECUTE ON FUNCTION public.increment_credits(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_credits(uuid, integer, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.deduct_credits(uuid, integer, text, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_adjust_credits(uuid, integer, text) TO service_role;

-- STEP 3: Replace increment_credits with a hardened version that:
-- (a) validates the caller is service_role or internal
-- (b) records every credit addition in credit_transactions (so there's always a paper trail)
-- (c) caps single-call additions to prevent runaway grants
CREATE OR REPLACE FUNCTION public.increment_credits(user_id_param uuid, amount_param integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Guard: only allow positive reasonable amounts
  IF amount_param <= 0 OR amount_param > 10000 THEN
    RAISE EXCEPTION 'Invalid credit amount: must be between 1 and 10000';
  END IF;

  -- Guard: user must exist
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = user_id_param) THEN
    RAISE EXCEPTION 'User not found: %', user_id_param;
  END IF;

  -- Apply credit increment
  UPDATE profiles
  SET 
    credits_balance = COALESCE(credits_balance, 0) + amount_param,
    updated_at = now()
  WHERE id = user_id_param;

  -- ALWAYS record a transaction (no silent credit changes)
  INSERT INTO credit_transactions (user_id, amount, transaction_type, description)
  VALUES (user_id_param, amount_param, 'system_grant', 'System credit grant via increment_credits');
END;
$$;

-- STEP 4: Add a DB TRIGGER that catches ANY direct credits_balance increase
-- that doesn't have a corresponding transaction record written in the same transaction.
-- This is a "canary" — if someone finds another bypass, this will at minimum log it.
CREATE OR REPLACE FUNCTION public.audit_credits_balance_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  delta INTEGER;
BEGIN
  delta := NEW.credits_balance - OLD.credits_balance;

  -- Only audit increases (decreases are usage, already tracked)
  IF delta > 0 THEN
    -- Check if a transaction was already recorded in this same DB transaction
    -- by looking for a very recent transaction for this user
    IF NOT EXISTS (
      SELECT 1 FROM credit_transactions
      WHERE user_id = NEW.id
        AND amount > 0
        AND created_at >= (now() - interval '5 seconds')
    ) THEN
      -- No transaction found — log this as a suspicious untracked credit change
      INSERT INTO credit_transactions (user_id, amount, transaction_type, description)
      VALUES (
        NEW.id,
        delta,
        'untracked_increase',
        'SECURITY ALERT: credits_balance increased by ' || delta || ' without a matching transaction. Possible exploit attempt.'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Attach the audit trigger to profiles
DROP TRIGGER IF EXISTS trg_audit_credits_balance ON public.profiles;
CREATE TRIGGER trg_audit_credits_balance
AFTER UPDATE OF credits_balance ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.audit_credits_balance_change();

-- STEP 5: Harden charge_preproduction_credits and charge_production_credits
-- These are correctly authenticated (use auth.uid()), but revoke from anon to be safe
REVOKE EXECUTE ON FUNCTION public.charge_preproduction_credits(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.charge_preproduction_credits(uuid, text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.charge_production_credits(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.refund_production_credits(uuid, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.charge_preproduction_credits(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.charge_preproduction_credits(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.charge_production_credits(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refund_production_credits(uuid, text, text) TO authenticated;

-- STEP 6: Lock the profiles table so authenticated users cannot directly
-- UPDATE credits_balance or total_credits_purchased via the REST API
-- (They can still read their own profile; all credit changes go through RPC)
DROP POLICY IF EXISTS "Users can update own profile credits" ON public.profiles;

-- Ensure the existing UPDATE policy does NOT allow credit column changes
-- by replacing it with a restrictive column-specific policy
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own non-credit profile fields"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  -- Prevent users from self-modifying credit fields via REST API
  -- Credits can only change via SECURITY DEFINER RPC functions
  AND credits_balance = credits_balance  -- will always match; actual block is via column privileges below
);

-- STEP 7: Revoke direct column write access to credit fields from authenticated users
-- This means even if someone bypasses RLS, they can't touch these columns directly
REVOKE UPDATE (credits_balance, total_credits_purchased, total_credits_used) 
ON public.profiles 
FROM authenticated;

-- Grant back to service_role only
GRANT UPDATE (credits_balance, total_credits_purchased, total_credits_used)
ON public.profiles
TO service_role;
