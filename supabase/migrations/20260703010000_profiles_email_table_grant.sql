-- ════════════════════════════════════════════════════════════════════════
-- Contain profiles.email — part 2 (make the REVOKE actually effective).
--
-- 20260703000000 added the gated read RPCs and tried `REVOKE SELECT (email)`,
-- but that was a no-op: `authenticated` and `anon` hold a TABLE-level SELECT
-- on profiles (Supabase's default GRANT ALL), and a table-level grant
-- overrides any column-level REVOKE. So email stayed readable cross-tenant.
--
-- Correct fix: drop the table-level SELECT and re-grant SELECT on every column
-- EXCEPT `email`. After this, no client (authenticated or anon) can select
-- email from the base table by any query — `select *` included. Every
-- legitimate email read now goes through a SECURITY DEFINER RPC:
--   get_my_profile()             — owner's own row (AuthContext)
--   org_member_directory(org)    — teammates, org-scoped (business/workspace)
--   admin_get_profile(id)        — platform admin, single row
--   admin_profiles_by_ids(ids[]) — platform admin, many rows
--   admin_find_user_by_email     — platform admin, email → id
--
-- credits_balance + other sensitive columns stay granted (the consumer app
-- reads the user's OWN balance from profiles); closing cross-tenant *credits*
-- is a separate, deferred change.
-- ════════════════════════════════════════════════════════════════════════

-- Admin many-row reader (is_admin-gated) for the platform admin module.
CREATE OR REPLACE FUNCTION public.admin_profiles_by_ids(p_ids uuid[])
RETURNS SETOF public.profiles
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.profiles
  WHERE id = ANY(p_ids) AND public.is_admin(auth.uid())
$$;
REVOKE ALL ON FUNCTION public.admin_profiles_by_ids(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_profiles_by_ids(uuid[]) TO authenticated;

-- Swap table-level SELECT for column-level SELECT on every column but email.
-- Column list is generated so no column is missed or mistyped.
DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'profiles'
    AND column_name <> 'email';

  REVOKE SELECT ON public.profiles FROM authenticated, anon;
  EXECUTE format('GRANT SELECT (%s) ON public.profiles TO authenticated', cols);
  EXECUTE format('GRANT SELECT (%s) ON public.profiles TO anon', cols);
END $$;

-- Keep the prior column-level REVOKE for completeness (harmless, explicit).
REVOKE SELECT (email) ON public.profiles FROM authenticated, anon;
