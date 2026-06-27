-- =====================================================================
-- Audit remediation (phase 2): lock fn_notify_safe / fn_wants_notification
--
-- BLOCKER fixed (full-platform audit 2026-06-27):
--   fn_notify_safe is SECURITY DEFINER, inserts a notification for an
--   ARBITRARY p_user_id with caller-controlled type/title/body/link, and
--   carried Postgres' default EXECUTE-to-PUBLIC (no REVOKE in
--   20260625000000_notifications.sql). It is reachable directly via
--   PostgREST /rpc by anon + authenticated, enabling mass spoofed
--   "system" notifications with phishing deep-links and inbox-flood DoS.
--   (The table-level forge via a permissive INSERT policy was already
--   closed in 20260213025841; this RPC path bypasses RLS via DEFINER.)
--
-- fn_wants_notification is the same class (SECURITY DEFINER, default
-- PUBLIC execute) and leaks another user's notification preferences.
--
-- Both are internal helpers: they are only invoked by the SECURITY DEFINER
-- trigger functions in the same migration (fn_notify_project_comment,
-- fn_notify_reel_reaction, fn_notify_user_follow, fn_notify_reel_published,
-- fn_notify_project_remix, ...). Those run as the function owner, who
-- retains EXECUTE, so revoking from API roles does NOT break fan-out
-- (same rationale as the trigger-only revokes in 20260516142227).
-- Verified: no direct caller in src/ or supabase/functions/.
--
-- NOTE: migration file only. Apply via the safe ordered apply-plan.
-- =====================================================================

REVOKE EXECUTE ON FUNCTION public.fn_notify_safe(uuid, text, text, text, text, uuid, jsonb, text)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_wants_notification(uuid, text)
  FROM PUBLIC, anon, authenticated;

-- service_role may still need to fan out notifications from edge functions.
GRANT EXECUTE ON FUNCTION public.fn_notify_safe(uuid, text, text, text, text, uuid, jsonb, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_wants_notification(uuid, text)
  TO service_role;
