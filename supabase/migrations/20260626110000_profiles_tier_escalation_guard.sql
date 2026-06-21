-- ════════════════════════════════════════════════════════════════════════
-- profiles privilege-escalation guard.
--
-- The "Users can update own profile" RLS policy checks only
-- `auth.uid() = id` with no column-level restriction. That let a user
-- PATCH their own row and set `account_tier`, `account_type`,
-- `credits_balance`, `role`, or the credit ledger mirror columns —
-- self-promoting to a paid tier or granting themselves credits.
--
-- RLS can't express column-level UPDATE restrictions without GRANT
-- gymnastics that break the typed client. A BEFORE UPDATE trigger is
-- the bulletproof fix: for any update NOT performed by the service
-- role (i.e. a normal user via PostgREST), the protected columns are
-- forced back to their previous values. Server-side flows that must
-- change them (Stripe webhooks, admin RPCs, credit deduct/grant) run
-- as the service role and bypass the guard.
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_profiles_block_sensitive_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- `auth.role()` is 'service_role' for the service key, 'authenticated'
  -- for a logged-in user, 'anon' otherwise. Only the service role is
  -- allowed to mutate the protected columns.
  caller_role text := current_setting('request.jwt.claim.role', true);
BEGIN
  -- Postgres exposes the effective role differently across PostgREST
  -- versions; fall back to the session role check.
  IF caller_role IS DISTINCT FROM 'service_role'
     AND current_user IS DISTINCT FROM 'service_role'
     AND NOT pg_has_role(current_user, 'service_role', 'MEMBER')
  THEN
    -- Force every protected column back to its prior value. The user's
    -- legitimate edits (display_name, avatar_url, preferences,
    -- notification_settings, etc.) pass through untouched. All these
    -- columns exist in the live schema by the time this migration runs.
    NEW.credits_balance          := OLD.credits_balance;
    NEW.total_credits_purchased  := OLD.total_credits_purchased;
    NEW.total_credits_used       := OLD.total_credits_used;
    NEW.account_tier             := OLD.account_tier;
    NEW.account_type             := OLD.account_type;
    NEW.role                     := OLD.role;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_block_sensitive_self_update ON public.profiles;
CREATE TRIGGER trg_profiles_block_sensitive_self_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_profiles_block_sensitive_self_update();

COMMENT ON FUNCTION public.fn_profiles_block_sensitive_self_update IS
  'Reverts protected profile columns (credits, tier, role) on any non-service-role UPDATE — prevents client-side privilege escalation via PATCH.';
