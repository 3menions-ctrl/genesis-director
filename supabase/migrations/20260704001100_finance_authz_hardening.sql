-- AUDIT FIX (Critical + Medium authorization on financial data):
--
-- 1) CRITICAL — organizations.credits_balance was directly client-writable.
--    The "Admins and owners can update organizations" UPDATE policy
--    (20260502172041) has no WITH CHECK and no column restriction, and the only
--    BEFORE UPDATE trigger on the table is update_updated_at_column. Because
--    20260704000700 now debits organizations.credits_balance for org-project
--    generations, any org owner/admin (every user auto-gets a personal org, and
--    any user can INSERT an org as created_by=self) could
--        UPDATE public.organizations SET credits_balance = 1000000 WHERE id = <theirs>
--    via PostgREST and generate for free. Mirror the proven profiles guard
--    (fn_profiles_block_sensitive_self_update, 20260626110000): revert the
--    protected money columns on any non-service-role UPDATE.
--
-- 2) MEDIUM — ledger_user_credit_balance(uuid) and creator_pending_payout_cents(uuid)
--    are SECURITY DEFINER, GRANTed to authenticated, with NO ownership check, so
--    any authenticated user could read any other user's credit balance / pending
--    payout by passing their uid. Lock both down.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) organizations protected-column guard
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_organizations_block_sensitive_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role text := current_setting('request.jwt.claim.role', true);
BEGIN
  -- Only the service role (Stripe/Polar webhooks, topup_org_credits, the
  -- org-pool consume/deduct RPCs) may mutate the pool columns. Normal users
  -- editing org name/settings via PostgREST are forced back on these columns.
  IF caller_role IS DISTINCT FROM 'service_role'
     AND current_user IS DISTINCT FROM 'service_role'
     AND NOT pg_has_role(current_user, 'service_role', 'MEMBER')
  THEN
    NEW.credits_balance         := OLD.credits_balance;
    NEW.total_credits_purchased := OLD.total_credits_purchased;
    NEW.total_credits_used      := OLD.total_credits_used;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_organizations_block_sensitive_self_update ON public.organizations;
CREATE TRIGGER trg_organizations_block_sensitive_self_update
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.fn_organizations_block_sensitive_self_update();

COMMENT ON FUNCTION public.fn_organizations_block_sensitive_self_update IS
  'Reverts protected organization money columns (credits_balance, total_credits_*) on any non-service-role UPDATE — prevents client-side org credit self-grant via PATCH.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2a) ledger_user_credit_balance — no runtime callers (credit_ledger_total was
--     reverted off it by C-1). Revoke from authenticated so it cannot be used to
--     read arbitrary users' ledger balances. Keep service_role for reporting.
-- ─────────────────────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.ledger_user_credit_balance(uuid) FROM authenticated, anon, PUBLIC;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2b) creator_pending_payout_cents — called arg-less by the client
--     (defaults to auth.uid()). Add an ownership/admin guard so passing an
--     explicit foreign uid can no longer read another creator's pending payout.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.creator_pending_payout_cents(p_user_id uuid DEFAULT auth.uid())
RETURNS int
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_role   text := COALESCE(current_setting('request.jwt.claim.role', true), '');
BEGIN
  IF v_role <> 'service_role'
     AND (v_caller IS NULL OR (p_user_id <> v_caller AND NOT public.is_admin(v_caller)))
  THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN COALESCE((
    SELECT SUM(usd_cents)
    FROM public.creator_earnings_ledger
    WHERE user_id = p_user_id AND payout_id IS NULL
  ), 0);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.creator_pending_payout_cents(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.creator_pending_payout_cents(uuid) TO authenticated, service_role;
