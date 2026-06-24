-- ════════════════════════════════════════════════════════════════════════
-- Contain profiles.email — close the cross-tenant email leak.
--
-- Before this migration: `profiles` has a `SELECT USING (true)` policy plus a
-- column GRANT of `email` to `authenticated`, so ANY signed-in user could read
-- ANY other user's email (incl. members of other organizations) with a hand-
-- crafted query. The business module (Team / Overview / Telemetry / Danger)
-- and two admin pages relied on `select email from profiles`.
--
-- Fix: route every legitimate email read through a SECURITY DEFINER function
-- that enforces the relationship in the database, then REVOKE the `email`
-- column from `authenticated` so the base table can no longer leak it.
--
--   • get_my_profile()                — owner reads their OWN full row
--                                        (replaces AuthContext `select('*')`).
--   • org_member_directory(org_id)     — a member reads their TEAMMATES'
--                                        id/name/avatar/email (org-scoped).
--   • admin_get_profile(user_id)       — platform admin reads any full row.
--   • admin_find_user_by_email(email)  — platform admin resolves id by email.
--
-- `credits_balance` and the other sensitive columns remain granted for now
-- (the consumer app reads the user's OWN balance from profiles); closing the
-- cross-tenant *credits* read needs an own-row/view split and is deferred.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Owner reads their own full row ───────────────────────────────────────
-- SECURITY DEFINER so it returns every column (incl. email) to the owner even
-- after the column REVOKE below. Strictly scoped to auth.uid().
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS SETOF public.profiles
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.profiles WHERE id = auth.uid()
$$;
REVOKE ALL ON FUNCTION public.get_my_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;

-- ── 2. Org-scoped member directory ──────────────────────────────────────────
-- Returns teammate identities (incl. email) ONLY when the caller is a member
-- of p_org_id. is_org_member() is itself SECURITY DEFINER (no RLS recursion).
CREATE OR REPLACE FUNCTION public.org_member_directory(p_org_id uuid)
RETURNS TABLE (id uuid, display_name text, full_name text, avatar_url text, email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.display_name, p.full_name, p.avatar_url, p.email
  FROM public.profiles p
  JOIN public.organization_members m ON m.user_id = p.id
  WHERE m.organization_id = p_org_id
    AND public.is_org_member(p_org_id, auth.uid())
$$;
REVOKE ALL ON FUNCTION public.org_member_directory(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_member_directory(uuid) TO authenticated;

-- ── 3. Platform-admin full-row read ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_get_profile(p_user_id uuid)
RETURNS SETOF public.profiles
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.profiles
  WHERE id = p_user_id AND public.is_admin(auth.uid())
$$;
REVOKE ALL ON FUNCTION public.admin_get_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_profile(uuid) TO authenticated;

-- ── 4. Platform-admin email → id lookup ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_find_user_by_email(p_email text)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id FROM public.profiles p
  WHERE lower(p.email) = lower(trim(p_email))
    AND public.is_admin(auth.uid())
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.admin_find_user_by_email(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_find_user_by_email(text) TO authenticated;

-- ── 5. Close the column at the base table ───────────────────────────────────
-- `authenticated` accesses profiles via column-level grants only (there is no
-- table-level SELECT grant to authenticated), so this REVOKE is effective:
-- after it, no client query — UI or hand-crafted — can read email from the
-- base table. `anon` was already revoked. service_role/definer bypass RLS.
REVOKE SELECT (email) ON public.profiles FROM authenticated;
