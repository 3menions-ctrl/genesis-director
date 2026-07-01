-- admin_revoke_user_sessions: upgrade from a SOFT revoke (security_version bump
-- only, which lets live sessions keep working until their next API call) to a
-- REAL server-side revoke that deletes the target's GoTrue sessions.
--
-- Why: the previous implementation (and the admin-force-logout edge fn, which
-- called `auth.admin.signOut(userId)` — the SDK treats that arg as a JWT, so it
-- errored every time) never actually invalidated sessions server-side. Deleting
-- auth.sessions immediately kills the session and cascades to auth.refresh_tokens,
-- so the user cannot mint a new access token. We still bump profiles.security_version
-- for the app-layer check that gates the *current* (already-issued) access token
-- on its next request.
--
-- SECURITY DEFINER runs as the function owner (postgres), which has DELETE on the
-- auth schema. is_admin() gating is unchanged.
CREATE OR REPLACE FUNCTION public.admin_revoke_user_sessions(
  p_target_user uuid, p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sessions_deleted int;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF p_target_user IS NULL THEN
    RAISE EXCEPTION 'p_target_user required';
  END IF;

  -- Real server-side revoke: drop every GoTrue session (cascades to
  -- refresh_tokens). Belt-and-suspenders delete of refresh_tokens by user_id
  -- (varchar) in case a deployment lacks the ON DELETE CASCADE.
  DELETE FROM auth.sessions WHERE user_id = p_target_user;
  GET DIAGNOSTICS v_sessions_deleted = ROW_COUNT;
  DELETE FROM auth.refresh_tokens WHERE user_id = p_target_user::text;

  -- App-layer: invalidate the already-issued access token on its next request.
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
    jsonb_build_object('reason', p_reason, 'sessions_revoked', v_sessions_deleted)
  );

  RETURN jsonb_build_object('success', true, 'sessions_revoked', v_sessions_deleted);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_revoke_user_sessions(uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_revoke_user_sessions(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.admin_revoke_user_sessions IS
  'Hard revoke: deletes the target user''s auth.sessions (cascades refresh_tokens) AND bumps profiles.security_version. Invalidates sessions server-side immediately; the current access token dies on its next API call. Audited.';
