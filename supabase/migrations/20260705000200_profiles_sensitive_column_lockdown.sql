-- ════════════════════════════════════════════════════════════════════════════
-- SECURITY FIX H1 — Cross-tenant + anonymous exposure of profile financial /
-- moderation / role data (HIGH).
--
-- 20260703010000_profiles_email_table_grant closed the `email` column but
-- DELIBERATELY left credits_balance + other sensitive columns granted to anon
-- AND authenticated (the comment marked it "deferred"). Combined with the
-- `Public profile read` policy (FOR SELECT USING (true)), this lets ANY client
-- holding the public anon key — including unauthenticated ones — read every
-- user's credit balance/spend, moderation state (suspension/deactivation), and
-- the legacy `role` column (admin-account enumeration).
--
-- Fix: REVOKE the financial, moderation, and role columns from anon AND
-- authenticated. Owners still read their own full row via get_my_profile() /
-- profile_self (both SECURITY DEFINER and thus bypass column grants); admin
-- pages read these via the admin_get_user_detail / admin_profiles_by_ids
-- SECURITY DEFINER RPCs. Public display columns (display_name, avatar_url,
-- bio, account_tier, …) stay granted so public profile pages keep working.
--
-- security_version is intentionally LEFT granted: AuthContext reads its own
-- security_version directly off the base table to honour admin force-logout,
-- and an integer version counter is not sensitive cross-tenant.
-- ════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  c text;
  sensitive_cols text[] := ARRAY[
    'credits_balance',
    'total_credits_purchased',
    'total_credits_used',
    'role',
    'suspended_at',
    'suspension_reason',
    'deactivated_at',
    'deactivation_reason'
  ];
BEGIN
  FOREACH c IN ARRAY sensitive_cols LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = c
    ) THEN
      EXECUTE format('REVOKE SELECT (%I) ON public.profiles FROM anon', c);
      EXECUTE format('REVOKE SELECT (%I) ON public.profiles FROM authenticated', c);
    END IF;
  END LOOP;
END $$;

-- ── Regression guard ─────────────────────────────────────────────────────────
-- Fail the migration loudly if any sensitive column is still SELECT-able by anon
-- or authenticated after the revoke above (e.g. a future grant re-opens it).
DO $$
DECLARE
  leaked text;
BEGIN
  SELECT string_agg(column_name || '→' || grantee, ', ')
    INTO leaked
  FROM information_schema.column_privileges
  WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND privilege_type = 'SELECT'
    AND grantee IN ('anon', 'authenticated')
    AND column_name IN (
      'credits_balance','total_credits_purchased','total_credits_used',
      'role','suspended_at','suspension_reason','deactivated_at','deactivation_reason'
    );
  IF leaked IS NOT NULL THEN
    RAISE EXCEPTION 'H1 lockdown failed — sensitive profile columns still readable: %', leaked;
  END IF;
END $$;
