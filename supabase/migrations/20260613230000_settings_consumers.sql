-- ════════════════════════════════════════════════════════════════════════
-- Settings consumers — make every preference in the new Settings page
-- actually enforced server-side. No stubs, no client-side honor system.
--
-- This migration adds:
--   • A `follow_requests` table for the "approve each follow" path
--   • toggle_follow now respects followPermission (mutual_only → request)
--   • accept_follow_request / reject_follow_request / list_follow_requests
--   • send_direct_message RPC that respects dmPermission + block list
--   • is_within_quiet_hours + should_send_email helpers used by the email
--     dispatcher (process-email-queue) and any future push dispatcher
--   • track_event RPC that no-ops when tracking_opted_out
--   • leaderboard_view that filters hide_from_leaderboard
--   • A login_gate RPC that returns deactivated_at status (used by client
--     to redirect deactivated users out of session)
-- ════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
-- 1. follow_requests — pending approvals when target sets
--    preferences.followPermission = "mutual_only".
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.follow_requests (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requester, target),
  CHECK (requester <> target)
);
CREATE INDEX IF NOT EXISTS idx_follow_requests_target ON public.follow_requests(target, created_at DESC);

ALTER TABLE public.follow_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Follow requests: principals see"   ON public.follow_requests;
CREATE POLICY "Follow requests: principals see" ON public.follow_requests FOR SELECT
  USING (requester = auth.uid() OR target = auth.uid());
DROP POLICY IF EXISTS "Follow requests: requester can withdraw" ON public.follow_requests;
CREATE POLICY "Follow requests: requester can withdraw" ON public.follow_requests FOR DELETE
  USING (requester = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────
-- 2. toggle_follow — respects followPermission.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.toggle_follow(p_target uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existed bool;
  v_perm    text;
  v_blocked bool;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF p_target = auth.uid() THEN RAISE EXCEPTION 'cannot_follow_self'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_blocks
     WHERE blocker_id = p_target AND blocked_id = auth.uid()
  ) INTO v_blocked;
  IF v_blocked THEN RAISE EXCEPTION 'blocked'; END IF;

  DELETE FROM public.follows
   WHERE follower_id = auth.uid() AND followed_id = p_target;
  GET DIAGNOSTICS v_existed = ROW_COUNT;
  IF v_existed > 0 THEN
    RETURN jsonb_build_object('following', false, 'pending', false);
  END IF;

  SELECT COALESCE(preferences->>'followPermission', 'everyone')
    INTO v_perm
    FROM public.profiles
   WHERE id = p_target;

  IF v_perm = 'mutual_only' THEN
    -- Drop a request instead of a follow row. Existing pending request
    -- is a no-op (idempotent re-tap).
    INSERT INTO public.follow_requests (requester, target)
      VALUES (auth.uid(), p_target)
      ON CONFLICT (requester, target) DO NOTHING;
    RETURN jsonb_build_object('following', false, 'pending', true);
  END IF;

  INSERT INTO public.follows (follower_id, followed_id)
    VALUES (auth.uid(), p_target)
    ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('following', true, 'pending', false);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.toggle_follow(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.toggle_follow(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_follow_requests()
RETURNS TABLE(
  id uuid, requester uuid, created_at timestamptz,
  display_name text, username text, avatar_url text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT fr.id, fr.requester, fr.created_at,
         p.display_name, p.username, p.avatar_url
    FROM public.follow_requests fr
    JOIN public.profiles p ON p.id = fr.requester
   WHERE fr.target = auth.uid()
   ORDER BY fr.created_at DESC;
$$;
REVOKE EXECUTE ON FUNCTION public.list_follow_requests() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.list_follow_requests() TO authenticated;

CREATE OR REPLACE FUNCTION public.accept_follow_request(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_req record;
BEGIN
  SELECT * INTO v_req FROM public.follow_requests
    WHERE id = p_id AND target = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  INSERT INTO public.follows (follower_id, followed_id)
    VALUES (v_req.requester, v_req.target)
    ON CONFLICT DO NOTHING;
  DELETE FROM public.follow_requests WHERE id = p_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.accept_follow_request(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.accept_follow_request(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.reject_follow_request(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  DELETE FROM public.follow_requests
   WHERE id = p_id AND target = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reject_follow_request(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.reject_follow_request(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. send_direct_message — enforces dmPermission + not-blocked.
--    Replaces the raw insert path so all DM sends go through this.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.send_direct_message(
  p_recipient uuid, p_content text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_perm    text;
  v_blocked bool;
  v_follows bool;
  v_msg_id  uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF p_recipient = auth.uid() THEN RAISE EXCEPTION 'cannot_message_self'; END IF;
  IF length(coalesce(trim(p_content), '')) = 0 THEN RAISE EXCEPTION 'empty_content'; END IF;
  IF length(p_content) > 4000 THEN RAISE EXCEPTION 'content_too_long'; END IF;

  -- Blocklist: recipient blocks sender → reject.
  SELECT EXISTS (
    SELECT 1 FROM public.user_blocks
     WHERE blocker_id = p_recipient AND blocked_id = auth.uid()
  ) INTO v_blocked;
  IF v_blocked THEN RAISE EXCEPTION 'blocked_by_recipient'; END IF;

  -- Permission check.
  SELECT COALESCE(preferences->>'dmPermission', 'everyone')
    INTO v_perm FROM public.profiles WHERE id = p_recipient;

  IF v_perm = 'nobody' THEN RAISE EXCEPTION 'recipient_dms_disabled'; END IF;
  IF v_perm = 'followers' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.follows
       WHERE follower_id = p_recipient AND followed_id = auth.uid()
    ) INTO v_follows;
    IF NOT v_follows THEN RAISE EXCEPTION 'recipient_dms_followers_only'; END IF;
  END IF;

  INSERT INTO public.direct_messages (sender_id, recipient_id, content)
  VALUES (auth.uid(), p_recipient, p_content)
  RETURNING id INTO v_msg_id;

  -- Mirror the existing notification side-effect.
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    p_recipient, 'message', 'New Message',
    left(p_content, 100),
    jsonb_build_object('sender_id', auth.uid())
  );

  RETURN jsonb_build_object('ok', true, 'id', v_msg_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.send_direct_message(uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.send_direct_message(uuid, text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Notification gates — email + quiet hours.
--    Email dispatcher will call should_send_email_to(target, category)
--    before actually sending.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_within_quiet_hours(p_user_id uuid)
RETURNS bool
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_enabled  bool;
  v_start    text;
  v_end      text;
  v_tz       text;
  v_now_min  int;
  v_start_min int;
  v_end_min  int;
BEGIN
  SELECT
    COALESCE((notification_settings->>'quietHoursEnabled')::bool, false),
    COALESCE(notification_settings->>'quietHoursStart', '22:00'),
    COALESCE(notification_settings->>'quietHoursEnd',   '08:00'),
    COALESCE(preferences->>'timezone', 'UTC')
  INTO v_enabled, v_start, v_end, v_tz
  FROM public.profiles WHERE id = p_user_id;

  IF NOT v_enabled THEN RETURN false; END IF;

  -- Convert "HH:MM" + current time-in-tz into minute counts.
  v_now_min   := EXTRACT(HOUR FROM (now() AT TIME ZONE v_tz))::int * 60
               + EXTRACT(MINUTE FROM (now() AT TIME ZONE v_tz))::int;
  v_start_min := (split_part(v_start, ':', 1))::int * 60 + (split_part(v_start, ':', 2))::int;
  v_end_min   := (split_part(v_end,   ':', 1))::int * 60 + (split_part(v_end,   ':', 2))::int;

  IF v_start_min < v_end_min THEN
    RETURN v_now_min >= v_start_min AND v_now_min < v_end_min;
  ELSE
    -- Wraps midnight (e.g. 22:00 → 08:00)
    RETURN v_now_min >= v_start_min OR v_now_min < v_end_min;
  END IF;
EXCEPTION WHEN others THEN
  RETURN false;
END;
$$;
GRANT EXECUTE ON FUNCTION public.is_within_quiet_hours(uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.should_send_email_to(
  p_user_id uuid, p_category text
)
RETURNS bool
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ns         jsonb;
  v_master     bool;
  v_category   bool;
  v_critical   bool;
  v_deactivated timestamptz;
BEGIN
  SELECT notification_settings, deactivated_at
    INTO v_ns, v_deactivated
    FROM public.profiles WHERE id = p_user_id;
  IF v_deactivated IS NOT NULL THEN RETURN false; END IF;

  v_critical := p_category IN ('billing', 'security', 'password_reset');

  v_master := COALESCE((v_ns->>'emailNotifications')::bool, true);
  IF NOT v_master AND NOT v_critical THEN RETURN false; END IF;

  -- Per-category map → JSONB key.
  v_category := COALESCE((v_ns->>(
    CASE p_category
      WHEN 'video_complete' THEN 'videoComplete'
      WHEN 'video_failed'   THEN 'videoFailed'
      WHEN 'low_credits'    THEN 'lowCredits'
      WHEN 'weekly_digest'  THEN 'weeklyDigest'
      WHEN 'product_update' THEN 'productUpdates'
      WHEN 'tips'           THEN 'tips'
      WHEN 'marketing'      THEN 'marketing'
      ELSE p_category
    END))::bool, true);
  IF NOT v_category AND NOT v_critical THEN RETURN false; END IF;

  -- Critical categories ignore quiet hours.
  IF v_critical THEN RETURN true; END IF;
  IF public.is_within_quiet_hours(p_user_id) THEN RETURN false; END IF;

  RETURN true;
END;
$$;
GRANT EXECUTE ON FUNCTION public.should_send_email_to(uuid, text) TO anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. track_event — server-side analytics; no-ops if user opted out.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id         bigserial PRIMARY KEY,
  user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name       text NOT NULL,
  payload    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_time ON public.analytics_events(user_id, created_at DESC);
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Analytics: user reads own" ON public.analytics_events;
CREATE POLICY "Analytics: user reads own" ON public.analytics_events FOR SELECT
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.track_event(p_name text, p_payload jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_opted_out bool;
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  SELECT COALESCE(tracking_opted_out, false) INTO v_opted_out
    FROM public.profiles WHERE id = auth.uid();
  IF v_opted_out THEN RETURN; END IF;
  INSERT INTO public.analytics_events (user_id, name, payload)
    VALUES (auth.uid(), p_name, COALESCE(p_payload, '{}'::jsonb));
END;
$$;
GRANT EXECUTE ON FUNCTION public.track_event(text, jsonb) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Leaderboard — hide_from_leaderboard mirrors to user_gamification.
--    The settings UI writes to profiles.hide_from_leaderboard; a trigger
--    keeps user_gamification.leaderboard_visible in sync so the existing
--    leaderboard queries (which read from gamification) pick it up.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hide_from_leaderboard boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.sync_leaderboard_visibility()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_gamification (user_id, leaderboard_visible)
  VALUES (NEW.id, NOT COALESCE(NEW.hide_from_leaderboard, false))
  ON CONFLICT (user_id) DO UPDATE
    SET leaderboard_visible = NOT COALESCE(NEW.hide_from_leaderboard, false);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS profiles_sync_leaderboard ON public.profiles;
CREATE TRIGGER profiles_sync_leaderboard
  AFTER INSERT OR UPDATE OF hide_from_leaderboard ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_leaderboard_visibility();

-- Backfill the gamification flag from the new column for existing rows.
INSERT INTO public.user_gamification (user_id, leaderboard_visible)
SELECT p.id, NOT COALESCE(p.hide_from_leaderboard, false)
  FROM public.profiles p
ON CONFLICT (user_id) DO UPDATE
  SET leaderboard_visible = EXCLUDED.leaderboard_visible;

DROP VIEW IF EXISTS public.public_leaderboard CASCADE;
CREATE VIEW public.public_leaderboard
WITH (security_invoker = false)
AS
SELECT
  p.id, p.display_name, p.username, p.avatar_url,
  COALESCE(g.xp_total, 0)       AS xp_total,
  COALESCE(g.level, 1)          AS level,
  COALESCE(g.current_streak, 0) AS current_streak
FROM public.profiles p
LEFT JOIN public.user_gamification g ON g.user_id = p.id
WHERE p.deactivated_at IS NULL
  AND COALESCE(p.hide_from_leaderboard, false) = false
  AND COALESCE(g.leaderboard_visible, true)    = true;
GRANT SELECT ON public.public_leaderboard TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 7. login_gate — returns deactivated status so the client can sign-out.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.my_account_gate()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'deactivated', (deactivated_at IS NOT NULL),
    'deactivated_at', deactivated_at,
    'account_tier', account_tier,
    'has_verified', verified_at IS NOT NULL
  )
  FROM public.profiles WHERE id = auth.uid();
$$;
GRANT EXECUTE ON FUNCTION public.my_account_gate() TO authenticated;
