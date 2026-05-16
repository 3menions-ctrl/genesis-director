
-- =====================================================================
-- SECURITY HARDENING: Drop exploitable credit-charge overloads and
-- revoke EXECUTE on edge-function-only RPCs from API roles.
-- =====================================================================

-- 1) CRITICAL: Two SECURITY DEFINER overloads accept p_user_id as a parameter
--    and perform NO check that auth.uid() = p_user_id. Any authenticated
--    user could call them to drain another user's credits.
--    These overloads are not referenced anywhere in app code (only the
--    p_project_id/p_shot_id variants are used). Drop them entirely.
DROP FUNCTION IF EXISTS public.charge_preproduction_credits(p_user_id uuid, p_project_id uuid, p_shot_id text);
DROP FUNCTION IF EXISTS public.charge_production_credits(p_user_id uuid, p_project_id uuid, p_shot_id text);

-- 2) Edge-function-only RPCs. All call sites use the service-role client,
--    which bypasses GRANTs, so revoking EXECUTE from API roles does not
--    break functionality but closes a direct-attack surface.
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.find_api_key_owner(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_signup_analytics() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.detect_credit_anomaly(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_widget_analytics(uuid, text) FROM PUBLIC, anon, authenticated;
