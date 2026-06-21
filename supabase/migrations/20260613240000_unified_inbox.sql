-- ════════════════════════════════════════════════════════════════════════
-- Unified inbox — fires every previously-stub notification type, adds
-- reactions / reply-to / reel-anchored / tip-in-thread / AI-video-reply
-- columns to direct_messages, and exposes an `inbox_overview` RPC that
-- powers the new unified inbox lanes.
-- ════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
-- 1. notification_type — new categories the inbox uses.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'reel_like';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'reel_comment';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'reel_mention';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'tip_received';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'patron_received';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'follow_request';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'follow_accepted';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'render_progress';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'brand_inquiry';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'ai_assistant';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'crew_message';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'dm_reaction';
-- ─────────────────────────────────────────────────────────────────────────
-- 2. direct_messages enrichments — reply-to, reel anchor, attachments,
--    tip, AI video reply, edit/delete tombstones, reactions table.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.direct_messages
  ADD COLUMN IF NOT EXISTS reply_to_id  uuid REFERENCES public.direct_messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reel_id      uuid REFERENCES public.published_reels(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attachments  jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tip_amount   int,
  ADD COLUMN IF NOT EXISTS ai_video_url text,
  ADD COLUMN IF NOT EXISTS edited_at    timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at   timestamptz;

CREATE INDEX IF NOT EXISTS idx_dm_reel ON public.direct_messages(reel_id) WHERE reel_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dm_reply ON public.direct_messages(reply_to_id) WHERE reply_to_id IS NOT NULL;

-- dm_reactions — emoji reactions per message.
CREATE TABLE IF NOT EXISTS public.dm_reactions (
  message_id uuid NOT NULL REFERENCES public.direct_messages(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji      text NOT NULL CHECK (length(emoji) BETWEEN 1 AND 16),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);
CREATE INDEX IF NOT EXISTS idx_dm_reactions_msg ON public.dm_reactions(message_id);
ALTER TABLE public.dm_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "DM reactions: participants read" ON public.dm_reactions;
CREATE POLICY "DM reactions: participants read" ON public.dm_reactions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.direct_messages m
     WHERE m.id = message_id
       AND (m.sender_id = auth.uid() OR m.recipient_id = auth.uid())
  ));
DROP POLICY IF EXISTS "DM reactions: user manages own" ON public.dm_reactions;
CREATE POLICY "DM reactions: user manages own" ON public.dm_reactions FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Realtime publication for reactions.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND tablename = 'dm_reactions'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_reactions';
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. inbox_thread_state — per-user per-thread pin/snooze/archive.
--    A "thread" is keyed by a (kind, ref_id) pair; e.g. ('dm', other_user)
--    or ('reel', reel_id) or ('render', project_id).
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inbox_thread_state (
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('dm','reel','render','crew','brand','system','ai')),
  ref_id      uuid NOT NULL,
  pinned      bool NOT NULL DEFAULT false,
  archived_at timestamptz,
  snoozed_until timestamptz,
  last_read_at timestamptz,
  PRIMARY KEY (user_id, kind, ref_id)
);
ALTER TABLE public.inbox_thread_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Thread state: user manages own" ON public.inbox_thread_state;
CREATE POLICY "Thread state: user manages own" ON public.inbox_thread_state FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Reel-like notifier — fires every time someone likes one of your reels.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_notify_reel_like()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_owner uuid; v_title text;
BEGIN
  SELECT creator_id, title INTO v_owner, v_title
    FROM public.published_reels WHERE id = NEW.reel_id;
  IF v_owner IS NULL OR v_owner = NEW.user_id THEN RETURN NEW; END IF;
  INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      v_owner, 'reel_like',
      'New like',
      COALESCE(v_title, 'your reel') || ' got a like',
      jsonb_build_object('reel_id', NEW.reel_id, 'liker_id', NEW.user_id)
    );
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_reel_like ON public.reel_likes;
CREATE TRIGGER trg_notify_reel_like
  AFTER INSERT ON public.reel_likes
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_reel_like();

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Reel-comment notifier — fires for the reel owner AND any @mentions
--    parsed from the comment body.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_notify_reel_comment()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_owner uuid; v_title text; v_author_name text;
  v_mention text; v_mentioned uuid;
BEGIN
  SELECT creator_id, title INTO v_owner, v_title FROM public.published_reels WHERE id = NEW.reel_id;
  SELECT COALESCE(display_name, username) INTO v_author_name FROM public.profiles WHERE id = NEW.author_id;

  IF v_owner IS NOT NULL AND v_owner <> NEW.author_id THEN
    INSERT INTO public.notifications (user_id, type, title, body, data)
      VALUES (
        v_owner, 'reel_comment',
        COALESCE(v_author_name, 'Someone') || ' commented',
        left(NEW.body, 140),
        jsonb_build_object('reel_id', NEW.reel_id, 'comment_id', NEW.id, 'author_id', NEW.author_id)
      );
  END IF;

  -- @mention parsing — pull every @handle from the body, resolve to a
  -- profile, ping each one (excluding the author + owner already pinged).
  FOR v_mention IN
    SELECT DISTINCT lower(m[1])
      FROM regexp_matches(NEW.body, '@([a-z0-9_]{3,30})', 'gi') AS m
  LOOP
    SELECT id INTO v_mentioned FROM public.profiles WHERE username = v_mention LIMIT 1;
    IF v_mentioned IS NOT NULL
       AND v_mentioned <> NEW.author_id
       AND v_mentioned <> COALESCE(v_owner, '00000000-0000-0000-0000-000000000000'::uuid)
    THEN
      INSERT INTO public.notifications (user_id, type, title, body, data)
        VALUES (
          v_mentioned, 'reel_mention',
          COALESCE(v_author_name, 'Someone') || ' mentioned you',
          left(NEW.body, 140),
          jsonb_build_object('reel_id', NEW.reel_id, 'comment_id', NEW.id, 'author_id', NEW.author_id)
        );
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_reel_comment ON public.reel_comments;
CREATE TRIGGER trg_notify_reel_comment
  AFTER INSERT ON public.reel_comments
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_reel_comment();

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Follow notifier — fires when a new follow lands.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_notify_follow()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_follower_name text;
BEGIN
  SELECT COALESCE(display_name, username) INTO v_follower_name
    FROM public.profiles WHERE id = NEW.follower_id;
  INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      NEW.followed_id, 'follow',
      COALESCE(v_follower_name, 'Someone') || ' followed you',
      NULL,
      jsonb_build_object('follower_id', NEW.follower_id)
    );
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_follow ON public.follows;
CREATE TRIGGER trg_notify_follow
  AFTER INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_follow();

-- ─────────────────────────────────────────────────────────────────────────
-- 7. Follow-request notifier — fires when a pending request lands.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_notify_follow_request()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_name text;
BEGIN
  SELECT COALESCE(display_name, username) INTO v_name
    FROM public.profiles WHERE id = NEW.requester;
  INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      NEW.target, 'follow_request',
      COALESCE(v_name, 'Someone') || ' wants to follow you',
      NULL,
      jsonb_build_object('request_id', NEW.id, 'requester_id', NEW.requester)
    );
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_follow_request ON public.follow_requests;
CREATE TRIGGER trg_notify_follow_request
  AFTER INSERT ON public.follow_requests
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_follow_request();

-- ─────────────────────────────────────────────────────────────────────────
-- 8. Tip notifier — wraps tip_reel so the creator gets pinged.
--    We extend the existing tip_reel function by adding a notification
--    insert at the end.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_notify_tip_received()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_creator uuid; v_title text; v_tipper_name text;
BEGIN
  IF NEW.kind <> 'tip_received' THEN RETURN NEW; END IF;
  IF NEW.amount <= 0 THEN RETURN NEW; END IF;
  SELECT creator_id, title INTO v_creator, v_title
    FROM public.published_reels WHERE id = (NEW.meta->>'reel_id')::uuid;
  SELECT COALESCE(display_name, username) INTO v_tipper_name
    FROM public.profiles WHERE id = (NEW.meta->>'tipper_id')::uuid;
  IF v_creator IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, data)
      VALUES (
        v_creator, 'tip_received',
        COALESCE(v_tipper_name, 'Someone') || ' tipped ' || NEW.amount || ' cr',
        COALESCE(v_title, ''),
        jsonb_build_object('reel_id', (NEW.meta->>'reel_id'), 'tipper_id', (NEW.meta->>'tipper_id'), 'amount', NEW.amount)
      );
  END IF;
  RETURN NEW;
END;
$$;

-- Patron pledge notifier — fires when patron_subscriptions row inserted.
CREATE OR REPLACE FUNCTION public.fn_notify_patron_received()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_patron_name text;
BEGIN
  SELECT COALESCE(display_name, username) INTO v_patron_name
    FROM public.profiles WHERE id = NEW.patron_id;
  INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      NEW.creator_id, 'patron_received',
      COALESCE(v_patron_name, 'A patron') || ' pledged ' || NEW.monthly_credits || ' cr/mo',
      NULL,
      jsonb_build_object('patron_id', NEW.patron_id, 'monthly_credits', NEW.monthly_credits)
    );
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_patron_received ON public.patron_subscriptions;
CREATE TRIGGER trg_notify_patron_received
  AFTER INSERT ON public.patron_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_patron_received();

-- DM notifier already exists via send_direct_message RPC inserting into
-- notifications. No trigger needed; the RPC does it.

-- ─────────────────────────────────────────────────────────────────────────
-- 9. send_direct_message v2 — accepts reply_to, reel anchor, attachments.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.send_direct_message(
  p_recipient   uuid,
  p_content     text,
  p_reply_to_id uuid DEFAULT NULL,
  p_reel_id     uuid DEFAULT NULL,
  p_attachments jsonb DEFAULT '[]'::jsonb
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
  IF length(coalesce(trim(p_content), '')) = 0 AND COALESCE(jsonb_array_length(p_attachments), 0) = 0 THEN
    RAISE EXCEPTION 'empty_content';
  END IF;
  IF length(p_content) > 4000 THEN RAISE EXCEPTION 'content_too_long'; END IF;

  SELECT EXISTS (SELECT 1 FROM public.user_blocks WHERE blocker_id = p_recipient AND blocked_id = auth.uid())
    INTO v_blocked;
  IF v_blocked THEN RAISE EXCEPTION 'blocked_by_recipient'; END IF;

  SELECT COALESCE(preferences->>'dmPermission', 'everyone') INTO v_perm
    FROM public.profiles WHERE id = p_recipient;
  IF v_perm = 'nobody' THEN RAISE EXCEPTION 'recipient_dms_disabled'; END IF;
  IF v_perm = 'followers' THEN
    SELECT EXISTS (SELECT 1 FROM public.follows WHERE follower_id = p_recipient AND followed_id = auth.uid()) INTO v_follows;
    IF NOT v_follows THEN RAISE EXCEPTION 'recipient_dms_followers_only'; END IF;
  END IF;

  INSERT INTO public.direct_messages (sender_id, recipient_id, content, reply_to_id, reel_id, attachments)
  VALUES (auth.uid(), p_recipient, p_content, p_reply_to_id, p_reel_id, COALESCE(p_attachments, '[]'::jsonb))
  RETURNING id INTO v_msg_id;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    p_recipient, 'message', 'New message',
    left(p_content, 100),
    jsonb_build_object('sender_id', auth.uid(), 'message_id', v_msg_id, 'reel_id', p_reel_id)
  );

  RETURN jsonb_build_object('ok', true, 'id', v_msg_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.send_direct_message(uuid, text, uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.send_direct_message(uuid, text, uuid, uuid, jsonb) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 10. tip_in_thread — send a DM that includes a credit tip in one shot.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tip_in_thread(
  p_recipient uuid, p_amount int, p_content text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_balance int; v_creator_cut int; v_platform_cut int; v_msg_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF p_recipient = auth.uid() THEN RAISE EXCEPTION 'cannot_tip_self'; END IF;
  IF p_amount <= 0 OR p_amount > 10000 THEN RAISE EXCEPTION 'invalid_amount'; END IF;

  SELECT credits_balance INTO v_balance FROM public.profiles WHERE id = auth.uid();
  IF v_balance IS NULL OR v_balance < p_amount THEN RAISE EXCEPTION 'insufficient_balance'; END IF;

  v_creator_cut  := (p_amount * 90) / 100;
  v_platform_cut := p_amount - v_creator_cut;

  -- Debit tipper
  INSERT INTO public.credit_transactions (user_id, kind, amount, meta)
    VALUES (auth.uid(), 'tip_sent', -p_amount, jsonb_build_object('recipient_id', p_recipient));
  -- Credit creator
  INSERT INTO public.credit_transactions (user_id, kind, amount, meta)
    VALUES (p_recipient, 'tip_received', v_creator_cut, jsonb_build_object('tipper_id', auth.uid(), 'gross', p_amount));

  -- Send the DM with the tip stamped on it.
  INSERT INTO public.direct_messages (sender_id, recipient_id, content, tip_amount)
    VALUES (auth.uid(), p_recipient, COALESCE(NULLIF(trim(p_content), ''), 'Tipped ' || p_amount || ' credits'), p_amount)
    RETURNING id INTO v_msg_id;

  INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      p_recipient, 'tip_received',
      'Tip received · ' || v_creator_cut || ' cr',
      'You got tipped ' || p_amount || ' credits in DMs.',
      jsonb_build_object('amount', p_amount, 'tipper_id', auth.uid(), 'message_id', v_msg_id)
    );
  RETURN jsonb_build_object('ok', true, 'message_id', v_msg_id, 'creator_cut', v_creator_cut);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.tip_in_thread(uuid, int, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.tip_in_thread(uuid, int, text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 11. react_to_message — toggle an emoji reaction.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.react_to_message(p_message_id uuid, p_emoji text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_existed bool;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.direct_messages
     WHERE id = p_message_id AND (sender_id = auth.uid() OR recipient_id = auth.uid())
  ) THEN RAISE EXCEPTION 'not_a_participant'; END IF;
  DELETE FROM public.dm_reactions
   WHERE message_id = p_message_id AND user_id = auth.uid() AND emoji = p_emoji;
  GET DIAGNOSTICS v_existed = ROW_COUNT;
  IF v_existed > 0 THEN
    RETURN jsonb_build_object('reacted', false);
  END IF;
  INSERT INTO public.dm_reactions (message_id, user_id, emoji)
    VALUES (p_message_id, auth.uid(), p_emoji);
  RETURN jsonb_build_object('reacted', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.react_to_message(uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.react_to_message(uuid, text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 12. Thread state helpers — pin/snooze/archive/mark_read.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_thread_state(
  p_kind text, p_ref_id uuid,
  p_pinned bool DEFAULT NULL,
  p_archived bool DEFAULT NULL,
  p_snoozed_until timestamptz DEFAULT NULL,
  p_mark_read bool DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  INSERT INTO public.inbox_thread_state (user_id, kind, ref_id, pinned, archived_at, snoozed_until, last_read_at)
  VALUES (
    auth.uid(), p_kind, p_ref_id,
    COALESCE(p_pinned, false),
    CASE WHEN p_archived = true THEN now() ELSE NULL END,
    p_snoozed_until,
    CASE WHEN p_mark_read = true THEN now() ELSE NULL END
  )
  ON CONFLICT (user_id, kind, ref_id) DO UPDATE
    SET pinned        = COALESCE(EXCLUDED.pinned, public.inbox_thread_state.pinned),
        archived_at   = CASE
                          WHEN p_archived IS NULL THEN public.inbox_thread_state.archived_at
                          WHEN p_archived = true  THEN now()
                          ELSE NULL
                        END,
        snoozed_until = COALESCE(EXCLUDED.snoozed_until, public.inbox_thread_state.snoozed_until),
        last_read_at  = CASE
                          WHEN p_mark_read = true THEN now()
                          ELSE public.inbox_thread_state.last_read_at
                        END;
  RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_thread_state(text, uuid, bool, bool, timestamptz, bool) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 13. inbox_overview — counts per lane + top items.
--     Lanes: people · comments · mentions · tips_pledges · renders · crew
--            · brand · system · ai
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.inbox_overview()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_dm_unread int := 0;
  v_comments_unread int := 0;
  v_mentions_unread int := 0;
  v_tips_unread int := 0;
  v_renders_unread int := 0;
  v_system_unread int := 0;
  v_brand_unread int := 0;
  v_follow_requests int := 0;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error', 'auth_required'); END IF;

  -- People (DMs)
  SELECT count(*) INTO v_dm_unread
    FROM public.direct_messages m
   WHERE m.recipient_id = v_uid AND m.read_at IS NULL AND m.deleted_at IS NULL;

  -- Notifications-driven lane counts (only unread).
  SELECT count(*) FILTER (WHERE type IN ('reel_comment')) INTO v_comments_unread
    FROM public.notifications WHERE user_id = v_uid AND read = false;
  SELECT count(*) FILTER (WHERE type = 'reel_mention') INTO v_mentions_unread
    FROM public.notifications WHERE user_id = v_uid AND read = false;
  SELECT count(*) FILTER (WHERE type IN ('tip_received','patron_received'))
    INTO v_tips_unread
    FROM public.notifications WHERE user_id = v_uid AND read = false;
  SELECT count(*) FILTER (WHERE type IN ('video_complete','video_started','video_failed','render_progress'))
    INTO v_renders_unread
    FROM public.notifications WHERE user_id = v_uid AND read = false;
  SELECT count(*) FILTER (WHERE type = 'brand_inquiry') INTO v_brand_unread
    FROM public.notifications WHERE user_id = v_uid AND read = false;
  SELECT count(*) FILTER (WHERE type IN (
    'achievement','challenge_complete','level_up','streak_milestone',
    'low_credits','org_member_joined','org_welcome','org_role_changed',
    'org_credits_low','patron_lapsed','follow','follow_accepted'
  )) INTO v_system_unread
    FROM public.notifications WHERE user_id = v_uid AND read = false;
  SELECT count(*) INTO v_follow_requests FROM public.follow_requests WHERE target = v_uid;

  RETURN jsonb_build_object(
    'lanes', jsonb_build_object(
      'people',        v_dm_unread,
      'comments',      v_comments_unread,
      'mentions',      v_mentions_unread,
      'tips_pledges',  v_tips_unread,
      'renders',       v_renders_unread,
      'brand',         v_brand_unread,
      'system',        v_system_unread + v_follow_requests
    )
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.inbox_overview() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 14. inbox_list_lane — returns a unified feed per lane.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.inbox_list_lane(
  p_lane text,
  p_limit int DEFAULT 30,
  p_offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_rows jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN '[]'::jsonb; END IF;

  IF p_lane = 'people' THEN
    -- One row per conversation partner with last message preview + unread.
    SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.last_at DESC), '[]'::jsonb)
      INTO v_rows
    FROM (
      WITH partners AS (
        SELECT
          CASE WHEN m.sender_id = v_uid THEN m.recipient_id ELSE m.sender_id END AS partner_id,
          MAX(m.created_at) AS last_at
        FROM public.direct_messages m
        WHERE (m.sender_id = v_uid OR m.recipient_id = v_uid)
          AND m.deleted_at IS NULL
        GROUP BY 1
      )
      SELECT
        p.id AS partner_id,
        p.display_name, p.username, p.avatar_url,
        pa.last_at,
        (
          SELECT content FROM public.direct_messages m2
           WHERE ((m2.sender_id = v_uid AND m2.recipient_id = p.id)
              OR  (m2.sender_id = p.id    AND m2.recipient_id = v_uid))
             AND m2.deleted_at IS NULL
           ORDER BY m2.created_at DESC LIMIT 1
        ) AS last_message,
        (
          SELECT count(*) FROM public.direct_messages m3
           WHERE m3.recipient_id = v_uid AND m3.sender_id = p.id
             AND m3.read_at IS NULL AND m3.deleted_at IS NULL
        ) AS unread
      FROM partners pa
      JOIN public.profiles p ON p.id = pa.partner_id
      ORDER BY pa.last_at DESC
      LIMIT p_limit OFFSET p_offset
    ) t;

  ELSIF p_lane IN ('comments','mentions','tips_pledges','renders','brand','system') THEN
    SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.created_at DESC), '[]'::jsonb)
      INTO v_rows
    FROM (
      SELECT id, type, title, body, data, read, created_at
        FROM public.notifications
       WHERE user_id = v_uid
         AND type = ANY (
           CASE p_lane
             WHEN 'comments'      THEN ARRAY['reel_comment']::notification_type[]
             WHEN 'mentions'      THEN ARRAY['reel_mention']::notification_type[]
             WHEN 'tips_pledges'  THEN ARRAY['tip_received','patron_received','patron_lapsed']::notification_type[]
             WHEN 'renders'       THEN ARRAY['video_complete','video_started','video_failed','render_progress']::notification_type[]
             WHEN 'brand'         THEN ARRAY['brand_inquiry']::notification_type[]
             WHEN 'system'        THEN ARRAY['achievement','challenge_complete','level_up','streak_milestone','low_credits','org_member_joined','org_welcome','org_role_changed','org_credits_low','follow','follow_accepted','follow_request']::notification_type[]
           END
         )
       ORDER BY created_at DESC
       LIMIT p_limit OFFSET p_offset
    ) t;
  ELSE
    v_rows := '[]'::jsonb;
  END IF;

  RETURN v_rows;
END;
$$;
GRANT EXECUTE ON FUNCTION public.inbox_list_lane(text, int, int) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 15. mark_notifications_read — bulk mark by ids or by lane.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_lane_read(p_lane text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_types notification_type[];
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF p_lane = 'people' THEN
    UPDATE public.direct_messages SET read_at = now()
      WHERE recipient_id = auth.uid() AND read_at IS NULL;
    RETURN jsonb_build_object('ok', true);
  END IF;
  v_types := CASE p_lane
    WHEN 'comments'      THEN ARRAY['reel_comment']::notification_type[]
    WHEN 'mentions'      THEN ARRAY['reel_mention']::notification_type[]
    WHEN 'tips_pledges'  THEN ARRAY['tip_received','patron_received','patron_lapsed']::notification_type[]
    WHEN 'renders'       THEN ARRAY['video_complete','video_started','video_failed','render_progress']::notification_type[]
    WHEN 'brand'         THEN ARRAY['brand_inquiry']::notification_type[]
    WHEN 'system'        THEN ARRAY['achievement','challenge_complete','level_up','streak_milestone','low_credits','org_member_joined','org_welcome','org_role_changed','org_credits_low','follow','follow_accepted','follow_request']::notification_type[]
    ELSE ARRAY[]::notification_type[]
  END;
  UPDATE public.notifications SET read = true
    WHERE user_id = auth.uid() AND read = false AND type = ANY (v_types);
  RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.mark_lane_read(text) TO authenticated;
-- ════════════════════════════════════════════════════════════════════════
-- Inbox part 3 — patron-gated channels, crew rooms, brand inquiries,
-- AI video reply job tracking.
-- ════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
-- 1. chat_rooms — generic multi-participant room (patron channels +
--    crew rooms). One table, two kinds, gated by membership rules.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_rooms (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind            text NOT NULL CHECK (kind IN ('patron','crew','public')),
  owner_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  /** Patron tier gate (NULL = open to all patrons of this creator;
   *  set to min_monthly_credits required to read).
   *  Crew: NULL.
   */
  min_monthly_credits int,
  /** For crew rooms, the movie_project this room is anchored to. */
  project_id      uuid REFERENCES public.movie_projects(id) ON DELETE CASCADE,
  name            text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  description     text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  archived_at     timestamptz
);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_owner ON public.chat_rooms(owner_id) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_chat_rooms_project ON public.chat_rooms(project_id) WHERE project_id IS NOT NULL AND archived_at IS NULL;
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;

-- chat_room_members — explicit member list (crew rooms add by invite;
-- patron rooms are implicit via patron_subscriptions but we still
-- materialize for fast read).
CREATE TABLE IF NOT EXISTS public.chat_room_members (
  room_id    uuid NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','member')),
  joined_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_room_members_user ON public.chat_room_members(user_id);
ALTER TABLE public.chat_room_members ENABLE ROW LEVEL SECURITY;

-- chat_messages — messages in a room.
CREATE TABLE IF NOT EXISTS public.chat_room_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     uuid NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  sender_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content     text NOT NULL CHECK (length(content) BETWEEN 1 AND 4000),
  reply_to_id uuid REFERENCES public.chat_room_messages(id) ON DELETE SET NULL,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  edited_at   timestamptz,
  deleted_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_room_messages_room ON public.chat_room_messages(room_id, created_at DESC);
ALTER TABLE public.chat_room_messages ENABLE ROW LEVEL SECURITY;

-- Realtime publication for rooms + room messages.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'chat_room_messages') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_room_messages';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'chat_room_members') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_room_members';
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Membership helper — works for both patron rooms (implicit via
-- patron_subscriptions) and crew rooms (explicit via chat_room_members).
CREATE OR REPLACE FUNCTION public.is_room_member(p_room_id uuid, p_user_id uuid)
RETURNS bool
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_room record;
  v_member bool;
  v_patron_pledge int;
BEGIN
  SELECT * INTO v_room FROM public.chat_rooms WHERE id = p_room_id;
  IF NOT FOUND OR v_room.archived_at IS NOT NULL THEN RETURN false; END IF;
  IF v_room.owner_id = p_user_id THEN RETURN true; END IF;

  IF v_room.kind = 'patron' THEN
    -- Implicit membership via an active patron_subscription with sufficient credits.
    SELECT COALESCE(MAX(monthly_credits), 0) INTO v_patron_pledge
      FROM public.patron_subscriptions
     WHERE creator_id = v_room.owner_id AND patron_id = p_user_id AND cancelled_at IS NULL;
    RETURN v_patron_pledge >= COALESCE(v_room.min_monthly_credits, 0);
  END IF;

  -- Crew / public — explicit member row.
  SELECT EXISTS (
    SELECT 1 FROM public.chat_room_members
     WHERE room_id = p_room_id AND user_id = p_user_id
  ) INTO v_member;
  IF v_room.kind = 'public' AND NOT v_member THEN
    -- Public rooms are readable by anyone signed-in even without explicit join.
    RETURN true;
  END IF;
  RETURN v_member;
END;
$$;
GRANT EXECUTE ON FUNCTION public.is_room_member(uuid, uuid) TO anon, authenticated;

-- RLS policies — use the helper.
DROP POLICY IF EXISTS "Rooms: members read" ON public.chat_rooms;
CREATE POLICY "Rooms: members read" ON public.chat_rooms FOR SELECT
  USING (public.is_room_member(id, auth.uid()) OR owner_id = auth.uid());
DROP POLICY IF EXISTS "Rooms: owner manages" ON public.chat_rooms;
CREATE POLICY "Rooms: owner manages" ON public.chat_rooms FOR ALL
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Room members: members read" ON public.chat_room_members;
CREATE POLICY "Room members: members read" ON public.chat_room_members FOR SELECT
  USING (public.is_room_member(room_id, auth.uid()));
DROP POLICY IF EXISTS "Room members: owner manages" ON public.chat_room_members;
CREATE POLICY "Room members: owner manages" ON public.chat_room_members FOR ALL
  USING (EXISTS (SELECT 1 FROM public.chat_rooms r WHERE r.id = room_id AND r.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.chat_rooms r WHERE r.id = room_id AND r.owner_id = auth.uid()));
DROP POLICY IF EXISTS "Room members: user self-joins public" ON public.chat_room_members;
CREATE POLICY "Room members: user self-joins public" ON public.chat_room_members FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.chat_rooms r WHERE r.id = room_id AND r.kind = 'public')
  );

DROP POLICY IF EXISTS "Room messages: members read" ON public.chat_room_messages;
CREATE POLICY "Room messages: members read" ON public.chat_room_messages FOR SELECT
  USING (public.is_room_member(room_id, auth.uid()));
DROP POLICY IF EXISTS "Room messages: members send" ON public.chat_room_messages;
CREATE POLICY "Room messages: members send" ON public.chat_room_messages FOR INSERT
  TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_room_member(room_id, auth.uid()));
DROP POLICY IF EXISTS "Room messages: author edits own" ON public.chat_room_messages;
CREATE POLICY "Room messages: author edits own" ON public.chat_room_messages FOR UPDATE
  USING (sender_id = auth.uid()) WITH CHECK (sender_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────
-- 2. ensure_project_crew_room — auto-spawn a crew room for a project.
--    Called from client when a project opens; idempotent.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ensure_project_crew_room(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_owner uuid; v_name text; v_room_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  SELECT user_id, COALESCE(title, 'Untitled') INTO v_owner, v_name
    FROM public.movie_projects WHERE id = p_project_id;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'project_not_found'; END IF;
  IF v_owner <> auth.uid() THEN RAISE EXCEPTION 'not_project_owner'; END IF;

  SELECT id INTO v_room_id FROM public.chat_rooms
   WHERE project_id = p_project_id AND archived_at IS NULL LIMIT 1;
  IF v_room_id IS NULL THEN
    INSERT INTO public.chat_rooms (kind, owner_id, project_id, name, description)
      VALUES ('crew', v_owner, p_project_id, 'Crew · ' || v_name, 'Production room for ' || v_name)
      RETURNING id INTO v_room_id;
    INSERT INTO public.chat_room_members (room_id, user_id, role)
      VALUES (v_room_id, v_owner, 'owner')
      ON CONFLICT DO NOTHING;
  END IF;
  RETURN jsonb_build_object('room_id', v_room_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.ensure_project_crew_room(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. list_my_rooms — every patron room (the user qualifies for) and
--    every crew room they own or are a member of.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.list_my_rooms()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_rows jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN '[]'::jsonb; END IF;
  SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb ORDER BY r.created_at DESC), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT r.id, r.kind, r.name, r.description, r.owner_id, r.project_id,
           r.min_monthly_credits, r.created_at,
           (
             SELECT count(*) FROM public.chat_room_messages m
              WHERE m.room_id = r.id AND m.deleted_at IS NULL
                AND m.created_at > COALESCE(
                  (SELECT last_read_at FROM public.inbox_thread_state s
                    WHERE s.user_id = v_uid AND s.kind = 'crew' AND s.ref_id = r.id),
                  '1970-01-01'::timestamptz
                )
                AND m.sender_id <> v_uid
           ) AS unread,
           (
             SELECT row_to_json(p) FROM (
               SELECT m.content, m.created_at, m.sender_id
                 FROM public.chat_room_messages m
                WHERE m.room_id = r.id AND m.deleted_at IS NULL
                ORDER BY m.created_at DESC LIMIT 1
             ) p
           ) AS last
      FROM public.chat_rooms r
     WHERE r.archived_at IS NULL
       AND (r.owner_id = v_uid OR public.is_room_member(r.id, v_uid))
  ) r;
  RETURN v_rows;
END;
$$;
GRANT EXECUTE ON FUNCTION public.list_my_rooms() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. brand_inquiries — structured inbound sponsor inquiries.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.brand_inquiries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_name      text NOT NULL CHECK (length(brand_name) BETWEEN 1 AND 120),
  contact_email   text,
  budget_usd      int NOT NULL CHECK (budget_usd >= 0),
  deliverables    text NOT NULL,
  deadline        date,
  notes           text,
  status          text NOT NULL DEFAULT 'new' CHECK (status IN ('new','accepted','declined','archived')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_brand_inquiries_recipient ON public.brand_inquiries(recipient_id, created_at DESC);
ALTER TABLE public.brand_inquiries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Brand inquiries: participants read" ON public.brand_inquiries;
CREATE POLICY "Brand inquiries: participants read" ON public.brand_inquiries FOR SELECT
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());
DROP POLICY IF EXISTS "Brand inquiries: anyone can send" ON public.brand_inquiries;
CREATE POLICY "Brand inquiries: anyone can send" ON public.brand_inquiries FOR INSERT
  TO authenticated WITH CHECK (sender_id = auth.uid());
DROP POLICY IF EXISTS "Brand inquiries: recipient updates status" ON public.brand_inquiries;
CREATE POLICY "Brand inquiries: recipient updates status" ON public.brand_inquiries FOR UPDATE
  USING (recipient_id = auth.uid()) WITH CHECK (recipient_id = auth.uid());

-- Notifier: drop a notification when a new inquiry arrives.
CREATE OR REPLACE FUNCTION public.fn_notify_brand_inquiry()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      NEW.recipient_id, 'brand_inquiry',
      NEW.brand_name || ' wants to work with you',
      'Budget · $' || NEW.budget_usd::text || (CASE WHEN NEW.deadline IS NOT NULL THEN ' · due ' || NEW.deadline::text ELSE '' END),
      jsonb_build_object('inquiry_id', NEW.id, 'sender_id', NEW.sender_id, 'brand_name', NEW.brand_name)
    );
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_brand_inquiry ON public.brand_inquiries;
CREATE TRIGGER trg_notify_brand_inquiry
  AFTER INSERT ON public.brand_inquiries
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_brand_inquiry();

-- ─────────────────────────────────────────────────────────────────────────
-- 5. ai_video_reply_jobs — track the AI-reply generation handoff.
--    The studio engine reads pending jobs, generates a video, drops
--    the url back, then the DM is auto-sent.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_video_reply_jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt        text NOT NULL,
  tone          text NOT NULL DEFAULT 'warm',
  status        text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','generating','ready','failed','cancelled')),
  engine        text NOT NULL DEFAULT 'wan',
  video_url     text,
  error         text,
  message_id    uuid REFERENCES public.direct_messages(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_video_jobs_sender ON public.ai_video_reply_jobs(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_video_jobs_status ON public.ai_video_reply_jobs(status) WHERE status IN ('queued','generating');
ALTER TABLE public.ai_video_reply_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "AI jobs: participants read" ON public.ai_video_reply_jobs;
CREATE POLICY "AI jobs: participants read" ON public.ai_video_reply_jobs FOR SELECT
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());
DROP POLICY IF EXISTS "AI jobs: sender creates" ON public.ai_video_reply_jobs;
CREATE POLICY "AI jobs: sender creates" ON public.ai_video_reply_jobs FOR INSERT
  TO authenticated WITH CHECK (sender_id = auth.uid());

-- start_ai_video_reply — enqueues a job. Edge function picks it up and
-- generates a personalized video via the Studio engine.
CREATE OR REPLACE FUNCTION public.start_ai_video_reply(
  p_recipient uuid, p_prompt text, p_tone text DEFAULT 'warm'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_engine text;
  v_job_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF p_recipient = auth.uid() THEN RAISE EXCEPTION 'cannot_message_self'; END IF;
  IF length(coalesce(trim(p_prompt), '')) = 0 THEN RAISE EXCEPTION 'empty_prompt'; END IF;

  SELECT COALESCE(preferences->>'defaultEngine', 'wan') INTO v_engine
    FROM public.profiles WHERE id = auth.uid();

  INSERT INTO public.ai_video_reply_jobs (sender_id, recipient_id, prompt, tone, engine)
    VALUES (auth.uid(), p_recipient, p_prompt, p_tone, v_engine)
    RETURNING id INTO v_job_id;

  RETURN jsonb_build_object('ok', true, 'job_id', v_job_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.start_ai_video_reply(uuid, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.start_ai_video_reply(uuid, text, text) TO authenticated;

-- Realtime for jobs.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'ai_video_reply_jobs') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_video_reply_jobs';
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;
-- ════════════════════════════════════════════════════════════════════════
-- Unified inbox feed — one RPC returning every event (DM, notification,
-- room message, follow request) interleaved chronologically. Powers
-- the new "All" lane that combines everything into one timeline.
-- ════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.inbox_list_all(
  p_limit  int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_rows jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN '[]'::jsonb; END IF;

  -- Union DM-thread previews + notifications + pending follow requests.
  WITH dm_threads AS (
    SELECT
      'dm'::text AS kind,
      'message'::text AS subkind,
      partner_id::text AS ref_id,
      MAX(m.created_at) AS at,
      jsonb_build_object(
        'partner_id', partner_id,
        'display_name', p.display_name,
        'username',     p.username,
        'avatar_url',   p.avatar_url,
        'preview', (
          SELECT content FROM public.direct_messages mm
           WHERE ((mm.sender_id = v_uid AND mm.recipient_id = partner_id)
              OR  (mm.sender_id = partner_id AND mm.recipient_id = v_uid))
             AND mm.deleted_at IS NULL
           ORDER BY mm.created_at DESC LIMIT 1
        ),
        'unread', (
          SELECT count(*) FROM public.direct_messages mm
           WHERE mm.recipient_id = v_uid AND mm.sender_id = partner_id
             AND mm.read_at IS NULL AND mm.deleted_at IS NULL
        )
      ) AS payload
    FROM (
      SELECT
        CASE WHEN m.sender_id = v_uid THEN m.recipient_id ELSE m.sender_id END AS partner_id,
        m.created_at
      FROM public.direct_messages m
      WHERE (m.sender_id = v_uid OR m.recipient_id = v_uid) AND m.deleted_at IS NULL
    ) m
    JOIN public.profiles p ON p.id = partner_id
    GROUP BY partner_id, p.display_name, p.username, p.avatar_url
  ),
  notifs AS (
    SELECT
      'notification'::text AS kind,
      n.type::text AS subkind,
      n.id::text AS ref_id,
      n.created_at AS at,
      jsonb_build_object(
        'id',         n.id,
        'title',      n.title,
        'body',       n.body,
        'data',       n.data,
        'read',       n.read,
        'type',       n.type
      ) AS payload
    FROM public.notifications n
    WHERE n.user_id = v_uid
  ),
  rooms AS (
    SELECT
      'room'::text AS kind,
      r.kind::text AS subkind,
      r.id::text AS ref_id,
      COALESCE(
        (SELECT MAX(created_at) FROM public.chat_room_messages WHERE room_id = r.id AND deleted_at IS NULL),
        r.created_at
      ) AS at,
      jsonb_build_object(
        'id', r.id, 'name', r.name, 'description', r.description, 'kind', r.kind,
        'preview', (
          SELECT content FROM public.chat_room_messages mm
           WHERE mm.room_id = r.id AND mm.deleted_at IS NULL
           ORDER BY mm.created_at DESC LIMIT 1
        )
      ) AS payload
    FROM public.chat_rooms r
    WHERE r.archived_at IS NULL
      AND (r.owner_id = v_uid OR public.is_room_member(r.id, v_uid))
  ),
  follow_reqs AS (
    SELECT
      'follow_request'::text AS kind,
      'follow_request'::text AS subkind,
      fr.id::text AS ref_id,
      fr.created_at AS at,
      jsonb_build_object(
        'request_id',   fr.id,
        'requester_id', fr.requester,
        'display_name', p.display_name,
        'username',     p.username,
        'avatar_url',   p.avatar_url
      ) AS payload
    FROM public.follow_requests fr
    JOIN public.profiles p ON p.id = fr.requester
    WHERE fr.target = v_uid
  ),
  brand_inq AS (
    SELECT
      'brand'::text AS kind,
      'brand_inquiry'::text AS subkind,
      bi.id::text AS ref_id,
      bi.created_at AS at,
      jsonb_build_object(
        'inquiry_id',   bi.id,
        'brand_name',   bi.brand_name,
        'budget_usd',   bi.budget_usd,
        'deadline',     bi.deadline,
        'status',       bi.status,
        'sender_id',    bi.sender_id
      ) AS payload
    FROM public.brand_inquiries bi
    WHERE bi.recipient_id = v_uid AND bi.status = 'new'
  )
  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.at DESC), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT * FROM dm_threads
    UNION ALL SELECT * FROM notifs
    UNION ALL SELECT * FROM rooms
    UNION ALL SELECT * FROM follow_reqs
    UNION ALL SELECT * FROM brand_inq
    ORDER BY at DESC
    LIMIT p_limit OFFSET p_offset
  ) t;

  RETURN v_rows;
END;
$$;
GRANT EXECUTE ON FUNCTION public.inbox_list_all(int, int) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- Day summary — counts for the "Today" hero strip.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.inbox_day_summary()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN '{}'::jsonb; END IF;
  RETURN jsonb_build_object(
    'dms_today',     (SELECT count(*) FROM public.direct_messages WHERE recipient_id = v_uid AND created_at >= date_trunc('day', now())),
    'tips_today',    (SELECT count(*) FROM public.notifications WHERE user_id = v_uid AND type IN ('tip_received','patron_received') AND created_at >= date_trunc('day', now())),
    'renders_today', (SELECT count(*) FROM public.notifications WHERE user_id = v_uid AND type IN ('video_complete','video_started','video_failed') AND created_at >= date_trunc('day', now())),
    'follows_today', (SELECT count(*) FROM public.notifications WHERE user_id = v_uid AND type = 'follow' AND created_at >= date_trunc('day', now())),
    'comments_today',(SELECT count(*) FROM public.notifications WHERE user_id = v_uid AND type IN ('reel_comment','reel_mention') AND created_at >= date_trunc('day', now())),
    'unread_total',  (
      SELECT COUNT(*) FROM public.notifications WHERE user_id = v_uid AND read = false
    ) + (
      SELECT COUNT(*) FROM public.direct_messages WHERE recipient_id = v_uid AND read_at IS NULL AND deleted_at IS NULL
    )
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.inbox_day_summary() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- DM @mention trigger — parses outgoing DM content for @mentions and
-- pings every mentioned user.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_notify_dm_mentions()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sender_name text; v_mention text; v_mentioned uuid;
BEGIN
  SELECT COALESCE(display_name, username) INTO v_sender_name
    FROM public.profiles WHERE id = NEW.sender_id;
  FOR v_mention IN
    SELECT DISTINCT lower(m[1])
      FROM regexp_matches(COALESCE(NEW.content, ''), '@([a-z0-9_]{3,30})', 'gi') AS m
  LOOP
    SELECT id INTO v_mentioned FROM public.profiles WHERE username = v_mention LIMIT 1;
    IF v_mentioned IS NOT NULL
       AND v_mentioned <> NEW.sender_id
       AND v_mentioned <> NEW.recipient_id THEN
      INSERT INTO public.notifications (user_id, type, title, body, data)
        VALUES (
          v_mentioned, 'reel_mention',
          COALESCE(v_sender_name, 'Someone') || ' mentioned you in a message',
          left(NEW.content, 140),
          jsonb_build_object('sender_id', NEW.sender_id, 'message_id', NEW.id)
        );
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_dm_mentions ON public.direct_messages;
CREATE TRIGGER trg_notify_dm_mentions
  AFTER INSERT ON public.direct_messages
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_dm_mentions();
-- ════════════════════════════════════════════════════════════════════════
-- Glue for the AI-video-reply worker:
--   • movie_projects columns (is_ai_reply, ai_reply_job_id)
--   • Trigger that, when a movie_project finishes and an ai_reply_job_id
--     is set, invokes the worker via pg_net (immediate delivery so the
--     user doesn't wait for the next cron tick).
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE public.movie_projects
  ADD COLUMN IF NOT EXISTS is_ai_reply       bool NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_reply_job_id   uuid REFERENCES public.ai_video_reply_jobs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_movie_projects_ai_reply ON public.movie_projects(ai_reply_job_id) WHERE ai_reply_job_id IS NOT NULL;

-- Trigger function: when an AI-reply project transitions to 'completed',
-- nudge the worker to deliver. pg_net.http_post is fire-and-forget so it
-- won't slow the project transaction.
CREATE OR REPLACE FUNCTION public.fn_ai_reply_project_done()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_url     text;
  v_anon    text;
BEGIN
  IF NEW.ai_reply_job_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('completed', 'failed', 'cancelled') THEN RETURN NEW; END IF;
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  -- Best-effort fire-and-forget worker nudge. The worker itself is
  -- idempotent so duplicate calls are safe.
  BEGIN
    v_url  := current_setting('app.settings.supabase_url', true);
    v_anon := current_setting('app.settings.supabase_anon_key', true);
    IF v_url IS NULL OR v_url = '' THEN
      -- Fallback to the conventional URL from the project ref.
      v_url := 'https://ywcwaumozoejierlfkgj.supabase.co';
    END IF;
    PERFORM net.http_post(
      url     := v_url || '/functions/v1/process-ai-video-replies',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body    := '{}'::jsonb
    );
  EXCEPTION WHEN others THEN
    -- Don't fail the parent transaction just because the worker ping failed.
    RAISE NOTICE '[ai-reply] worker nudge failed: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_ai_reply_project_done ON public.movie_projects;
CREATE TRIGGER trg_ai_reply_project_done
  AFTER UPDATE OF status ON public.movie_projects
  FOR EACH ROW EXECUTE FUNCTION public.fn_ai_reply_project_done();

-- Same idea for the enqueue side: when start_ai_video_reply creates a
-- new job row, nudge the worker so the user doesn't wait for cron.
CREATE OR REPLACE FUNCTION public.fn_ai_reply_job_queued()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_url text;
BEGIN
  IF NEW.status <> 'queued' THEN RETURN NEW; END IF;
  BEGIN
    v_url := current_setting('app.settings.supabase_url', true);
    IF v_url IS NULL OR v_url = '' THEN
      v_url := 'https://ywcwaumozoejierlfkgj.supabase.co';
    END IF;
    PERFORM net.http_post(
      url     := v_url || '/functions/v1/process-ai-video-replies',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body    := '{}'::jsonb
    );
  EXCEPTION WHEN others THEN
    RAISE NOTICE '[ai-reply] enqueue nudge failed: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_ai_reply_job_queued ON public.ai_video_reply_jobs;
CREATE TRIGGER trg_ai_reply_job_queued
  AFTER INSERT ON public.ai_video_reply_jobs
  FOR EACH ROW EXECUTE FUNCTION public.fn_ai_reply_job_queued();
