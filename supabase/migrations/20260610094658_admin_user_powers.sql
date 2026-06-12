-- Admin user-management powers.
--
-- This migration extends the `admin_*` RPC family with the read + non-auth
-- write operations admins need. Operations that touch `auth.users` (delete,
-- force-verify, reset password, impersonate) live in the `admin-user-action`
-- edge function because they need the service role — Postgres RLS can't
-- speak Supabase Auth Admin API.
--
-- Adds:
--   • admin_revoke_user_sessions(uuid)         — bump security_version so every
--                                                 active session re-auths.
--   • admin_get_user_detail(uuid)              — rich detail card for the
--                                                 /admin/users/:userId page.
--   • admin_recent_actions(uuid, int)          — pulls the user's audit
--                                                 trail (admin_audit_log).
--   • admin_grant_credits(uuid, int, text)     — direct credit grant +
--                                                 transaction record, audited.
--
-- All RPCs are SECURITY DEFINER with an `is_admin(auth.uid())` guard and
-- revoke EXECUTE from PUBLIC/anon. Every successful call logs to
-- `admin_audit_log` so the trail is permanent.

-- ── 1. Revoke all sessions (security_version bump) ─────────────────────
CREATE OR REPLACE FUNCTION public.admin_revoke_user_sessions(
  p_target_user uuid, p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF p_target_user IS NULL THEN
    RAISE EXCEPTION 'p_target_user required';
  END IF;

  UPDATE public.profiles
  SET security_version = COALESCE(security_version, 0) + 1,
      updated_at = now()
  WHERE id = p_target_user;

  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (
    auth.uid(),
    'revoke_sessions',
    'user',
    p_target_user::text,
    jsonb_build_object('reason', p_reason)
  );

  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_revoke_user_sessions(uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_revoke_user_sessions(uuid, text) TO authenticated;

-- ── 2. Direct credit grant (independent of admin_adjust_credits) ───────
-- `admin_adjust_credits` already exists; this is a thin convenience that
-- always grants (positive only) with an admin-specific transaction_type so
-- the user's ledger shows "Admin grant" rather than "Adjustment".
CREATE OR REPLACE FUNCTION public.admin_grant_credits(
  p_target_user uuid, p_amount int, p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance int;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'p_amount must be > 0';
  END IF;
  IF p_amount > 10000 THEN
    RAISE EXCEPTION 'p_amount cap is 10000 per grant (got %)', p_amount;
  END IF;

  UPDATE public.profiles
  SET credits_balance = COALESCE(credits_balance, 0) + p_amount,
      total_credits_purchased = COALESCE(total_credits_purchased, 0) + p_amount,
      updated_at = now()
  WHERE id = p_target_user
  RETURNING credits_balance INTO v_new_balance;

  INSERT INTO public.credit_transactions (user_id, amount, transaction_type, description)
  VALUES (p_target_user, p_amount, 'grant',
    'Admin grant: ' || COALESCE(p_reason, 'unspecified'));

  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (auth.uid(), 'grant_credits', 'user', p_target_user::text,
    jsonb_build_object('amount', p_amount, 'reason', p_reason, 'new_balance', v_new_balance));

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_grant_credits(uuid, int, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_grant_credits(uuid, int, text) TO authenticated;

-- ── 3. Rich user detail for the admin user-detail page ─────────────────
CREATE OR REPLACE FUNCTION public.admin_get_user_detail(p_target_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile jsonb;
  v_auth jsonb;
  v_stats jsonb;
  v_roles text[];
  v_orgs jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT to_jsonb(p) - 'preferences' - 'notification_settings'
  INTO v_profile
  FROM public.profiles p
  WHERE id = p_target_user;

  IF v_profile IS NULL THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  -- Limited fields from auth.users — never expose password hashes etc.
  SELECT jsonb_build_object(
    'email', email,
    'phone', phone,
    'email_confirmed_at', email_confirmed_at,
    'last_sign_in_at', last_sign_in_at,
    'created_at', created_at,
    'banned_until', banned_until,
    'is_sso_user', is_sso_user
  )
  INTO v_auth
  FROM auth.users
  WHERE id = p_target_user;

  -- Roll-up project + credit stats.
  SELECT jsonb_build_object(
    'project_count', (SELECT count(*) FROM public.movie_projects WHERE user_id = p_target_user),
    'completed_projects', (SELECT count(*) FROM public.movie_projects WHERE user_id = p_target_user AND status = 'completed'),
    'failed_projects', (SELECT count(*) FROM public.movie_projects WHERE user_id = p_target_user AND status = 'failed'),
    'lifetime_credit_grants', (SELECT COALESCE(sum(amount),0) FROM public.credit_transactions WHERE user_id = p_target_user AND transaction_type = 'grant'),
    'lifetime_credit_spend',  (SELECT COALESCE(sum(-amount),0) FROM public.credit_transactions WHERE user_id = p_target_user AND amount < 0),
    'support_message_count', (SELECT count(*) FROM public.support_messages WHERE user_id = p_target_user),
    'last_project_at', (SELECT max(created_at) FROM public.movie_projects WHERE user_id = p_target_user)
  )
  INTO v_stats;

  SELECT array_agg(role::text)
  INTO v_roles
  FROM public.user_roles
  WHERE user_id = p_target_user;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'organization_id', om.organization_id,
    'name', o.name,
    'role', om.role,
    'joined_at', om.joined_at
  )), '[]'::jsonb)
  INTO v_orgs
  FROM public.organization_members om
  JOIN public.organizations o ON o.id = om.organization_id
  WHERE om.user_id = p_target_user;

  RETURN jsonb_build_object(
    'profile', v_profile,
    'auth', COALESCE(v_auth, '{}'::jsonb),
    'stats', v_stats,
    'roles', COALESCE(to_jsonb(v_roles), '[]'::jsonb),
    'organizations', v_orgs
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_get_user_detail(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_get_user_detail(uuid) TO authenticated;

-- ── 4. Recent admin actions taken against a user ───────────────────────
CREATE OR REPLACE FUNCTION public.admin_recent_user_actions(
  p_target_user uuid, p_limit int DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', l.id,
    'admin_id', l.admin_id,
    'admin_email', (SELECT email FROM public.profiles WHERE id = l.admin_id),
    'action', l.action,
    'target_type', l.target_type,
    'target_id', l.target_id,
    'details', l.details,
    'created_at', l.created_at
  ) ORDER BY l.created_at DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT *
    FROM public.admin_audit_log
    WHERE (target_type = 'user' AND target_id = p_target_user::text)
       OR admin_id = p_target_user
    ORDER BY created_at DESC
    LIMIT p_limit
  ) l;

  RETURN v_rows;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_recent_user_actions(uuid, int) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_recent_user_actions(uuid, int) TO authenticated;

-- ── 5. Mark a user-delete request so the edge fn can finalize ──────────
-- The edge function calls auth.admin.deleteUser (service role only); we
-- write the audit row first so the destruction can be reconstructed even
-- if the edge fn fails after auth.users is wiped.
CREATE OR REPLACE FUNCTION public.admin_pre_delete_user(
  p_target_user uuid, p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Protect: an admin can't delete themselves via this RPC. This is the
  -- single most important safety check on the page.
  IF p_target_user = auth.uid() THEN
    RAISE EXCEPTION 'self_delete_forbidden';
  END IF;

  -- Protect: don't allow deleting other admins via the user-action route.
  -- Demote them first.
  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_target_user AND role::text = 'admin'
  ) THEN
    RAISE EXCEPTION 'cannot_delete_admin_demote_first';
  END IF;

  SELECT email INTO v_email FROM public.profiles WHERE id = p_target_user;

  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (
    auth.uid(),
    'delete_user_account',
    'user',
    p_target_user::text,
    jsonb_build_object(
      'reason', p_reason,
      'email_snapshot', v_email,
      'queued_at', now()
    )
  );

  RETURN jsonb_build_object('success', true, 'email_snapshot', v_email);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_pre_delete_user(uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_pre_delete_user(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.admin_revoke_user_sessions IS
  'Bumps profiles.security_version for the target user, invalidating every active session on next API call. Audited.';
COMMENT ON FUNCTION public.admin_grant_credits IS
  'Credits a user balance + writes a grant row to credit_transactions. Cap 10,000 / grant. Audited.';
COMMENT ON FUNCTION public.admin_get_user_detail IS
  'Rich user detail bundle for the admin user-detail page. Excludes preferences, notification_settings, and any auth password material.';
COMMENT ON FUNCTION public.admin_recent_user_actions IS
  'Recent admin_audit_log rows involving this user as target or actor.';
COMMENT ON FUNCTION public.admin_pre_delete_user IS
  'Writes the delete-user audit row up front so the destruction trail survives even if the edge fn fails mid-cascade. Refuses self-delete and admin-delete (demote first).';
