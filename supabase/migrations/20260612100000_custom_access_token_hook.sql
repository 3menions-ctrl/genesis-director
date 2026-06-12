-- ════════════════════════════════════════════════════════════════════════
-- Custom Access Token Hook
--
-- A Postgres function Supabase Auth calls every time it mints an access
-- token. Whatever JSON we return becomes part of the JWT, readable on
-- the client via `session.access_token` (decoded) or any standard JWT
-- decoder. No HTTP roundtrip — pure DB, fast.
--
-- Default behaviour added by this migration:
--   * `app_metadata.role`       — the user's app_role from user_roles
--   * `app_metadata.account_type` — personal | business | enterprise
--   * `app_metadata.account_tier` — free | pro | enterprise
--   * `app_metadata.is_admin`   — boolean shortcut
--   * `app_metadata.current_org_id` — the user's last-used workspace
--                                     (read from organization_members)
--
-- To turn the hook on:
--   1. Push this migration.
--   2. Supabase Dashboard → Authentication → Hooks → Custom Access Token
--      → Enable, pick "Postgres", function = `public.custom_access_token_hook`.
--
-- To extend: edit the body below. Anything you set under `claims` ends
-- up in the JWT. Keep total token size under 8KB.
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id        uuid := (event->>'user_id')::uuid;
  claims           jsonb := event->'claims';
  app_metadata     jsonb := COALESCE(claims->'app_metadata', '{}'::jsonb);
  v_role           text;
  v_account_type   text;
  v_account_tier   text;
  v_is_admin       boolean := false;
  v_current_org_id uuid;
BEGIN
  -- ── role + admin flag (most common hook use case) ─────────────────
  -- user_roles can have multiple rows per user; pick the highest-power
  -- one. 'admin' beats everything else.
  SELECT role::text INTO v_role
  FROM public.user_roles
  WHERE user_id = v_user_id
  ORDER BY (role::text = 'admin') DESC, created_at ASC
  LIMIT 1;

  v_is_admin := COALESCE(v_role = 'admin', false);

  -- ── account_type + account_tier from profiles ─────────────────────
  -- Read direct columns; no need for the full profile_overview RPC.
  SELECT
    account_type,
    account_tier
  INTO v_account_type, v_account_tier
  FROM public.profiles
  WHERE id = v_user_id;

  -- ── current organization ──────────────────────────────────────────
  -- Pick the most-recently-touched membership.
  SELECT om.organization_id INTO v_current_org_id
  FROM public.organization_members om
  WHERE om.user_id = v_user_id
  ORDER BY om.last_active_at DESC NULLS LAST, om.joined_at DESC NULLS LAST
  LIMIT 1;

  -- ── compose the new app_metadata block ────────────────────────────
  app_metadata := app_metadata
    || jsonb_build_object(
         'role',           COALESCE(v_role, 'user'),
         'is_admin',       v_is_admin,
         'account_type',   COALESCE(v_account_type, 'personal'),
         'account_tier',   COALESCE(v_account_tier, 'free'),
         'current_org_id', v_current_org_id
       );

  claims := jsonb_set(claims, '{app_metadata}', app_metadata, true);

  -- Return the modified event back to GoTrue.
  RETURN jsonb_set(event, '{claims}', claims, true);
EXCEPTION WHEN OTHERS THEN
  -- Critical: never let a hook error block sign-in. If anything in this
  -- function blows up, return the unmodified event so the user can still
  -- log in. Surface the error to the dashboard logs instead.
  RAISE WARNING 'custom_access_token_hook failed: %', SQLERRM;
  RETURN event;
END;
$$;

-- ── Grants ─────────────────────────────────────────────────────────
-- GoTrue (the auth service) connects as the `supabase_auth_admin` role.
-- It needs EXECUTE on the hook function and SELECT on every table the
-- function reads. Without these the hook fires but reads nothing.
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM authenticated, anon, public;

GRANT SELECT ON public.user_roles           TO supabase_auth_admin;
GRANT SELECT ON public.profiles             TO supabase_auth_admin;
GRANT SELECT ON public.organization_members TO supabase_auth_admin;

-- ── RLS bypass ─────────────────────────────────────────────────────
-- supabase_auth_admin already bypasses RLS because BYPASSRLS is set on
-- the role at the cluster level. If for some reason that changes,
-- ALTER ROLE supabase_auth_admin BYPASSRLS; would fix it.
