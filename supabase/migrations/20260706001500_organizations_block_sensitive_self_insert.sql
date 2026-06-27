-- =====================================================================
-- Audit remediation (phase 2): block org credit self-mint on INSERT
--
-- BLOCKER fixed (full-platform audit 2026-06-27):
--   20260704001100 added fn_organizations_block_sensitive_self_update as a
--   BEFORE UPDATE trigger, closing the PATCH self-grant of
--   organizations.credits_balance. But the INSERT path is still open: the
--   "Authenticated users can create organizations" policy only checks
--   auth.uid() = created_by, with no column guard, so a user can
--       INSERT INTO public.organizations (created_by, credits_balance)
--       VALUES (auth.uid(), 1000000)
--   via PostgREST, become owner via trg_add_org_creator, and then drain the
--   minted pool through the org-pool spend RPCs (reserve_credits /
--   consume_credit_hold / deduct_credits) — generating for free.
--
-- Fix: mirror the proven UPDATE guard as a BEFORE INSERT trigger that forces
-- the protected money columns to 0 for any non-service-role insert. The
-- SECURITY DEFINER personal-org creator (create_personal_org_for_new_user,
-- owned by a superuser that is a member of service_role) is exempt and may
-- seed initial balances; Stripe/Polar webhooks and create_org_for_user run
-- as service_role and are likewise exempt.
--
-- NOTE: migration file only. Apply via the safe ordered apply-plan.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.fn_organizations_block_sensitive_self_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role text := current_setting('request.jwt.claim.role', true);
BEGIN
  IF caller_role IS DISTINCT FROM 'service_role'
     AND current_user IS DISTINCT FROM 'service_role'
     AND NOT pg_has_role(current_user, 'service_role', 'MEMBER')
  THEN
    NEW.credits_balance         := 0;
    NEW.total_credits_purchased := 0;
    NEW.total_credits_used      := 0;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_organizations_block_sensitive_self_insert ON public.organizations;
CREATE TRIGGER trg_organizations_block_sensitive_self_insert
  BEFORE INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.fn_organizations_block_sensitive_self_insert();

COMMENT ON FUNCTION public.fn_organizations_block_sensitive_self_insert IS
  'Forces protected organization money columns (credits_balance, total_credits_*) to 0 on any non-service-role INSERT — prevents client-side org credit self-mint at creation.';
