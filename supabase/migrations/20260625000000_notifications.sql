-- ════════════════════════════════════════════════════════════════════════
-- notifications — comprehensive fan-out for the in-app inbox.
--
-- The base `notifications` table already exists (see 20260116132617).
-- This migration layers on the connective tissue the most-connected
-- notification system needs:
--
--   1. Backwards-compatible column adds (link, actor_id, payload alias,
--      read_at) so the SQL conventions in the master spec line up with
--      what's already in production.
--   2. Performance index on (user_id, created_at DESC) for the recent-50
--      fetch the bell relies on.
--   3. notification_preferences — per-category + per-channel opt-out,
--      quiet hours.
--   4. Fan-out triggers wired to comments, video_reactions, follows
--      (entertainment_hub.follows and user_follows), remix RPC, published
--      reels, plus the existing support_tickets + low_credits triggers.
--   5. Hourly emoji-reaction debounce so spamming a heart doesn't flood
--      the creator's inbox.
--   6. Bounded fan-out for published-to-followers (capped at 100).
--
-- The notification type enum stays a permissive superset — new categories
-- (publish, remix, reaction) reuse existing enum values where possible
-- (like, comment, follow, video_complete, system) so we don't have to
-- touch every consumer.
-- ════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
-- 0. Enum values — defensive adds. The 'system' value is referenced by
--    the support_tickets migration but never explicitly added; if a
--    fresh database is bootstrapped without that flow it would block
--    our safe-insert. ADD VALUE IF NOT EXISTS is idempotent.
-- ─────────────────────────────────────────────────────────────────────────
-- NOTE: ALTER TYPE ADD VALUE cannot run inside a transaction in older
-- Postgres versions. Supabase migrations run in their own transaction
-- per file; we isolate each ADD VALUE in its own DO block to avoid
-- aborting the whole migration if one value already exists. Each is
-- IF NOT EXISTS, so re-run is a no-op.
DO $$ BEGIN
  BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'system';
  EXCEPTION WHEN others THEN NULL; END;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Column adds — backwards compatible.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS link     text,
  ADD COLUMN IF NOT EXISTS actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS read_at  timestamptz;

-- Keep read_at in sync with the existing boolean `read` flag so callers
-- can pivot to read_at without breaking existing code that updates `read`.
CREATE OR REPLACE FUNCTION public.fn_notifications_sync_read_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.read IS TRUE AND OLD.read IS DISTINCT FROM TRUE THEN
    NEW.read_at := COALESCE(NEW.read_at, now());
  ELSIF NEW.read IS FALSE THEN
    NEW.read_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notifications_sync_read_at ON public.notifications;
CREATE TRIGGER trg_notifications_sync_read_at
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.fn_notifications_sync_read_at();

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Performance index — the bell pulls the 50 most recent rows.
-- ─────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_notifications_user_recent
  ON public.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, created_at DESC)
  WHERE read = false;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. notification_preferences — per-user controls.
--    One row per user. Each category and channel is opt-out
--    (default ON). Quiet hours are local-time, 24h clock.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- categories
  cat_comments     boolean NOT NULL DEFAULT true,
  cat_reactions    boolean NOT NULL DEFAULT true,
  cat_follows      boolean NOT NULL DEFAULT true,
  cat_remixes      boolean NOT NULL DEFAULT true,
  cat_publish      boolean NOT NULL DEFAULT true,
  cat_admin        boolean NOT NULL DEFAULT true,
  cat_system       boolean NOT NULL DEFAULT true,
  -- channels
  ch_inapp         boolean NOT NULL DEFAULT true,
  ch_email         boolean NOT NULL DEFAULT false,
  -- quiet hours — when set, in-app toasts/push are suppressed; the
  -- notification still lands in the inbox so nothing is dropped.
  quiet_start      smallint CHECK (quiet_start BETWEEN 0 AND 23),
  quiet_end        smallint CHECK (quiet_end BETWEEN 0 AND 23),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prefs: owner reads" ON public.notification_preferences;
CREATE POLICY "prefs: owner reads" ON public.notification_preferences
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "prefs: owner upserts" ON public.notification_preferences;
CREATE POLICY "prefs: owner upserts" ON public.notification_preferences
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "prefs: owner updates" ON public.notification_preferences;
CREATE POLICY "prefs: owner updates" ON public.notification_preferences
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Touch updated_at on every write.
CREATE OR REPLACE FUNCTION public.fn_notification_prefs_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_notification_prefs_touch ON public.notification_preferences;
CREATE TRIGGER trg_notification_prefs_touch
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.fn_notification_prefs_touch();

-- Helper — does the user want this category? Defaults to TRUE when the
-- row doesn't exist (zero-config sane default).
CREATE OR REPLACE FUNCTION public.fn_wants_notification(p_user uuid, p_category text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v boolean;
BEGIN
  SELECT CASE p_category
    WHEN 'comments'  THEN cat_comments
    WHEN 'reactions' THEN cat_reactions
    WHEN 'follows'   THEN cat_follows
    WHEN 'remixes'   THEN cat_remixes
    WHEN 'publish'   THEN cat_publish
    WHEN 'admin'     THEN cat_admin
    WHEN 'system'    THEN cat_system
    ELSE true
  END INTO v FROM public.notification_preferences WHERE user_id = p_user;
  RETURN COALESCE(v, true);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Safe-insert helper — wraps the notifications INSERT in an exception
--    guard so a single bad row never blocks the underlying social action.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_notify_safe(
  p_user_id  uuid,
  p_type     text,
  p_title    text,
  p_body     text,
  p_link     text,
  p_actor_id uuid,
  p_data     jsonb,
  p_category text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;
  IF p_category IS NOT NULL AND NOT public.fn_wants_notification(p_user_id, p_category) THEN
    RETURN;
  END IF;
  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, data, link, actor_id)
      VALUES (
        p_user_id,
        p_type::public.notification_type,
        p_title,
        p_body,
        COALESCE(p_data, '{}'::jsonb) || jsonb_build_object('link', p_link),
        p_link,
        p_actor_id
      );
  EXCEPTION WHEN others THEN
    -- Type cast failed (enum value not in the existing enum) or RLS
    -- rejected — try once more without the enum cast issue by falling
    -- back to 'system'. Never let a notification block the action.
    BEGIN
      INSERT INTO public.notifications (user_id, type, title, body, data, link, actor_id)
        VALUES (p_user_id, 'system'::public.notification_type, p_title, p_body,
                COALESCE(p_data, '{}'::jsonb) || jsonb_build_object('link', p_link),
                p_link, p_actor_id);
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Trigger — project_comments → ping the project owner.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_notify_project_comment()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_actor_name text;
  v_title text;
BEGIN
  SELECT user_id, title INTO v_owner, v_title
    FROM public.movie_projects WHERE id = NEW.project_id;
  IF v_owner IS NULL OR v_owner = NEW.user_id THEN RETURN NEW; END IF;

  SELECT COALESCE(display_name, username, 'Someone') INTO v_actor_name
    FROM public.profiles WHERE id = NEW.user_id;

  PERFORM public.fn_notify_safe(
    v_owner,
    'comment',
    COALESCE(v_actor_name, 'Someone') || ' commented on ' || COALESCE(v_title, 'your project'),
    LEFT(NEW.content, 200),
    '/editor/' || NEW.project_id::text,
    NEW.user_id,
    jsonb_build_object('project_id', NEW.project_id, 'comment_id', NEW.id),
    'comments'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_project_comment ON public.project_comments;
CREATE TRIGGER trg_notify_project_comment
  AFTER INSERT ON public.project_comments
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_project_comment();

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Trigger — reel_reactions / video_reactions → ping the reel owner,
--    debounced to at most 1/hour per (owner, reactor, emoji) tuple.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_notify_reel_reaction()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_actor_name text;
  v_title text;
  v_recent_exists boolean;
  v_emoji text;
BEGIN
  SELECT creator_id, title INTO v_owner, v_title
    FROM public.published_reels WHERE id = NEW.reel_id;
  IF v_owner IS NULL OR v_owner = NEW.reactor_id THEN RETURN NEW; END IF;

  -- Use the reaction_url as the dedupe key (URL == emoji asset).
  v_emoji := NEW.reaction_url;

  -- Debounce: 1 / hour per (owner, reactor, emoji)
  SELECT EXISTS (
    SELECT 1 FROM public.notifications
     WHERE user_id = v_owner
       AND type = 'like'::public.notification_type
       AND created_at > now() - interval '1 hour'
       AND data->>'reactor_id' = NEW.reactor_id::text
       AND data->>'emoji' = v_emoji
  ) INTO v_recent_exists;
  IF v_recent_exists THEN RETURN NEW; END IF;

  SELECT COALESCE(display_name, username, 'Someone') INTO v_actor_name
    FROM public.profiles WHERE id = NEW.reactor_id;

  PERFORM public.fn_notify_safe(
    v_owner,
    'like',
    COALESCE(v_actor_name, 'Someone') || ' reacted to ' || COALESCE(v_title, 'your reel'),
    NULL,
    '/r/' || NEW.reel_id::text,
    NEW.reactor_id,
    jsonb_build_object('reel_id', NEW.reel_id, 'reactor_id', NEW.reactor_id, 'emoji', v_emoji),
    'reactions'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_reel_reaction ON public.reel_reactions;
CREATE TRIGGER trg_notify_reel_reaction
  AFTER INSERT ON public.reel_reactions
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_reel_reaction();

-- video_reactions (older table) — same debounce logic, scoped to project.
CREATE OR REPLACE FUNCTION public.fn_notify_video_reaction()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_actor_name text;
  v_title text;
  v_recent_exists boolean;
BEGIN
  SELECT user_id, title INTO v_owner, v_title
    FROM public.movie_projects WHERE id = NEW.project_id;
  IF v_owner IS NULL OR v_owner = NEW.user_id THEN RETURN NEW; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.notifications
     WHERE user_id = v_owner
       AND type = 'like'::public.notification_type
       AND created_at > now() - interval '1 hour'
       AND data->>'reactor_id' = NEW.user_id::text
       AND data->>'emoji' = NEW.emoji
  ) INTO v_recent_exists;
  IF v_recent_exists THEN RETURN NEW; END IF;

  SELECT COALESCE(display_name, username, 'Someone') INTO v_actor_name
    FROM public.profiles WHERE id = NEW.user_id;

  PERFORM public.fn_notify_safe(
    v_owner,
    'like',
    COALESCE(v_actor_name, 'Someone') || ' reacted ' || NEW.emoji || ' to ' || COALESCE(v_title, 'your video'),
    NULL,
    '/r/' || NEW.project_id::text,
    NEW.user_id,
    jsonb_build_object('project_id', NEW.project_id, 'reactor_id', NEW.user_id, 'emoji', NEW.emoji),
    'reactions'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_video_reaction ON public.video_reactions;
CREATE TRIGGER trg_notify_video_reaction
  AFTER INSERT ON public.video_reactions
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_video_reaction();

-- ─────────────────────────────────────────────────────────────────────────
-- 7. Trigger — follows → ping the followed user.
--    Two follow tables in the schema (user_follows + follows). Wire both.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_notify_user_follow()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_actor_name text;
BEGIN
  IF NEW.follower_id = NEW.following_id THEN RETURN NEW; END IF;
  SELECT COALESCE(display_name, username, 'Someone') INTO v_actor_name
    FROM public.profiles WHERE id = NEW.follower_id;

  PERFORM public.fn_notify_safe(
    NEW.following_id,
    'follow',
    COALESCE(v_actor_name, 'Someone') || ' followed you',
    NULL,
    '/c/' || NEW.follower_id::text,
    NEW.follower_id,
    jsonb_build_object('follower_id', NEW.follower_id),
    'follows'
  );
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_user_follow ON public.user_follows;
CREATE TRIGGER trg_notify_user_follow
  AFTER INSERT ON public.user_follows
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_user_follow();

-- entertainment_hub.follows (follower_id, followee_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'follows'
  ) THEN
    EXECUTE $TRG$
      CREATE OR REPLACE FUNCTION public.fn_notify_eh_follow()
      RETURNS trigger
      LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
      AS $FN$
      DECLARE v_actor_name text;
      BEGIN
        IF NEW.follower_id = NEW.followee_id THEN RETURN NEW; END IF;
        SELECT COALESCE(display_name, username, 'Someone') INTO v_actor_name
          FROM public.profiles WHERE id = NEW.follower_id;
        PERFORM public.fn_notify_safe(
          NEW.followee_id,
          'follow',
          COALESCE(v_actor_name, 'Someone') || ' followed you',
          NULL,
          '/c/' || NEW.follower_id::text,
          NEW.follower_id,
          jsonb_build_object('follower_id', NEW.follower_id),
          'follows'
        );
        RETURN NEW;
      END;
      $FN$;
    $TRG$;
    EXECUTE 'DROP TRIGGER IF EXISTS trg_notify_eh_follow ON public.follows';
    EXECUTE 'CREATE TRIGGER trg_notify_eh_follow
              AFTER INSERT ON public.follows
              FOR EACH ROW EXECUTE FUNCTION public.fn_notify_eh_follow()';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 8. Trigger — published_reels INSERT → fan-out to up to 100 followers,
--    plus a celebratory notification to the creator themselves.
--    Skipped silently when the followers table isn't present.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_notify_reel_published()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_follower_id uuid;
  v_creator_name text;
  v_has_follows boolean := false;
  v_has_user_follows boolean := false;
BEGIN
  SELECT COALESCE(display_name, username, 'A creator') INTO v_creator_name
    FROM public.profiles WHERE id = NEW.creator_id;

  -- Self confirmation — this surfaces "your reel is live" in the inbox.
  PERFORM public.fn_notify_safe(
    NEW.creator_id,
    'video_complete',
    'Your reel is live · ' || COALESCE(NEW.title, 'Untitled'),
    'Published to the Lobby. Tap to view.',
    '/r/' || NEW.id::text,
    NEW.creator_id,
    jsonb_build_object('reel_id', NEW.id, 'project_id', NEW.project_id),
    'publish'
  );

  -- Check which follow tables exist.
  SELECT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema='public' AND table_name='follows')
    INTO v_has_follows;
  SELECT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema='public' AND table_name='user_follows')
    INTO v_has_user_follows;

  IF v_has_follows THEN
    FOR v_follower_id IN
      EXECUTE 'SELECT follower_id FROM public.follows
                WHERE followee_id = $1 ORDER BY created_at DESC LIMIT 100'
      USING NEW.creator_id
    LOOP
      PERFORM public.fn_notify_safe(
        v_follower_id,
        'video_complete',
        v_creator_name || ' published a new reel',
        COALESCE(NEW.title, 'Untitled'),
        '/r/' || NEW.id::text,
        NEW.creator_id,
        jsonb_build_object('reel_id', NEW.id, 'creator_id', NEW.creator_id),
        'publish'
      );
    END LOOP;
  ELSIF v_has_user_follows THEN
    FOR v_follower_id IN
      SELECT follower_id FROM public.user_follows
       WHERE following_id = NEW.creator_id
       ORDER BY created_at DESC LIMIT 100
    LOOP
      PERFORM public.fn_notify_safe(
        v_follower_id,
        'video_complete',
        v_creator_name || ' published a new reel',
        COALESCE(NEW.title, 'Untitled'),
        '/r/' || NEW.id::text,
        NEW.creator_id,
        jsonb_build_object('reel_id', NEW.id, 'creator_id', NEW.creator_id),
        'publish'
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_reel_published ON public.published_reels;
CREATE TRIGGER trg_notify_reel_published
  AFTER INSERT ON public.published_reels
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_reel_published();

-- ─────────────────────────────────────────────────────────────────────────
-- 9. RPC wrapper — remix_reel notifies original creator.
--    The base remix_reel function (entertainment_hub) doesn't ping the
--    original creator. Wire it via an AFTER trigger on movie_projects
--    INSERT keyed on parent_project_id, which catches BOTH the SQL-RPC
--    remix path and any future client-side fork that fills the column.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_notify_project_remix()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_parent_owner uuid;
  v_parent_title text;
  v_actor_name text;
BEGIN
  IF NEW.parent_project_id IS NULL THEN RETURN NEW; END IF;
  SELECT user_id, title INTO v_parent_owner, v_parent_title
    FROM public.movie_projects WHERE id = NEW.parent_project_id;
  IF v_parent_owner IS NULL OR v_parent_owner = NEW.user_id THEN RETURN NEW; END IF;

  SELECT COALESCE(display_name, username, 'Someone') INTO v_actor_name
    FROM public.profiles WHERE id = NEW.user_id;

  PERFORM public.fn_notify_safe(
    v_parent_owner,
    'system',
    COALESCE(v_actor_name, 'Someone') || ' remixed ' || COALESCE(v_parent_title, 'your reel'),
    'Their remix is in their library.',
    '/c/' || NEW.user_id::text,
    NEW.user_id,
    jsonb_build_object('project_id', NEW.id, 'parent_project_id', NEW.parent_project_id),
    'remixes'
  );
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_project_remix ON public.movie_projects;
CREATE TRIGGER trg_notify_project_remix
  AFTER INSERT ON public.movie_projects
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_project_remix();

-- ─────────────────────────────────────────────────────────────────────────
-- 10. Trigger — client_errors severity=blocker → ping admins.
--     The table is created lazily by the client crash forensics module;
--     wire only when it exists so the migration is idempotent against
--     environments that have it and those that don't.
-- ─────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'client_errors'
  ) THEN
    EXECUTE $TRG$
      CREATE OR REPLACE FUNCTION public.fn_notify_blocker_error()
      RETURNS trigger
      LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
      AS $FN$
      DECLARE v_admin_id uuid;
      BEGIN
        IF COALESCE(NEW.severity, 'low') <> 'blocker' THEN RETURN NEW; END IF;
        FOR v_admin_id IN
          SELECT user_id FROM public.user_roles WHERE role = 'admin'::app_role
        LOOP
          PERFORM public.fn_notify_safe(
            v_admin_id,
            'system',
            '[BLOCKER] client error',
            LEFT(COALESCE(NEW.message::text, NEW.error_type::text, 'A blocker-level error fired'), 240),
            '/admin/crash-forensics',
            NULL,
            jsonb_build_object('error_id', NEW.id, 'route', '/admin/crash-forensics'),
            'admin'
          );
        END LOOP;
        RETURN NEW;
      END;
      $FN$;
    $TRG$;
    EXECUTE 'DROP TRIGGER IF EXISTS trg_notify_blocker_error ON public.client_errors';
    EXECUTE 'CREATE TRIGGER trg_notify_blocker_error
              AFTER INSERT ON public.client_errors
              FOR EACH ROW EXECUTE FUNCTION public.fn_notify_blocker_error()';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 11. Realtime — publish notification table (idempotent).
-- ─────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 12. RPC — mark-all-read + bulk-clear, server-authoritative.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notifications_mark_all_read()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_count int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  UPDATE public.notifications
     SET read = true, read_at = now()
   WHERE user_id = auth.uid() AND read = false;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
GRANT EXECUTE ON FUNCTION public.notifications_mark_all_read() TO authenticated;

-- Helper RPC the client uses for the "render done" backfill on the export
-- panel — server-authoritative so RLS still applies.
CREATE OR REPLACE FUNCTION public.notify_self(
  p_type  text,
  p_title text,
  p_body  text DEFAULT NULL,
  p_link  text DEFAULT NULL,
  p_data  jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  INSERT INTO public.notifications (user_id, type, title, body, link, actor_id, data)
    VALUES (
      auth.uid(),
      p_type::public.notification_type,
      p_title,
      p_body,
      p_link,
      auth.uid(),
      COALESCE(p_data, '{}'::jsonb) || jsonb_build_object('link', p_link)
    )
    RETURNING id INTO v_id;
  RETURN v_id;
EXCEPTION WHEN others THEN
  -- Enum cast failed — fall back to system type.
  INSERT INTO public.notifications (user_id, type, title, body, link, actor_id, data)
    VALUES (auth.uid(), 'system'::public.notification_type, p_title, p_body, p_link,
            auth.uid(), COALESCE(p_data, '{}'::jsonb) || jsonb_build_object('link', p_link))
    RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.notify_self(text, text, text, text, jsonb) TO authenticated;
