-- =====================================================================
-- Audit remediation (phase 2): lock down legacy client-callable credit RPCs
--
-- BLOCKERS fixed (verified by full-platform audit 2026-06-27):
--   #1  refund_production_credits self-refund: a user could call the RPC on
--       their own already-delivered shots and reclaim spent credits
--       (the cross-user guard added in 20260516142227 only blocks OTHER
--        users, not self-refund of completed work). It was never revoked
--        from `authenticated` the way its siblings add/deduct/refund_credits
--        were.
--   #7  client-trusted charge amount: charge_preproduction_credits /
--       charge_production_credits accept a client-supplied p_credits_amount
--       and only validate `> 0`, so a malicious authenticated client could
--       charge 1 credit for a 50-95 credit generation.
--
-- Root cause: these three functions are SECURITY DEFINER and granted to
-- `authenticated`, so they are reachable directly via PostgREST /rpc. The
-- REAL production billing path is the service-role hold/ledger system
-- (reserve_credits -> consume_credit_hold), which is already service_role
-- only. The client-callable variants have ZERO call sites in src/ and ZERO
-- call sites in supabase/functions/ (verified), i.e. they are dead client
-- code whose only remaining purpose is as an attack surface.
--
-- Fix: revoke EXECUTE from PUBLIC/anon/authenticated on every overload, and
-- grant only to service_role (matching add_credits/deduct_credits/
-- refund_credits). No client or edge caller breaks.
--
-- NOTE: migration file only. Apply to prod via the safe ordered apply-plan
-- (audit/11-MIGRATION-APPLY-PLAN.md), NOT a blind `db push`.
-- =====================================================================

-- charge_preproduction_credits: 2-arg wrapper + 3-arg amount variant
REVOKE EXECUTE ON FUNCTION public.charge_preproduction_credits(uuid, text)          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.charge_preproduction_credits(uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.charge_preproduction_credits(uuid, text)          TO service_role;
GRANT  EXECUTE ON FUNCTION public.charge_preproduction_credits(uuid, text, integer) TO service_role;

-- charge_production_credits: 2-arg wrapper + 3-arg amount variant
REVOKE EXECUTE ON FUNCTION public.charge_production_credits(uuid, text)          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.charge_production_credits(uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.charge_production_credits(uuid, text)          TO service_role;
GRANT  EXECUTE ON FUNCTION public.charge_production_credits(uuid, text, integer) TO service_role;

-- refund_production_credits: 3-arg (auth.uid()-derived) + 4-arg (explicit user)
REVOKE EXECUTE ON FUNCTION public.refund_production_credits(uuid, text, text)       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refund_production_credits(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.refund_production_credits(uuid, text, text)       TO service_role;
GRANT  EXECUTE ON FUNCTION public.refund_production_credits(uuid, uuid, text, text) TO service_role;
