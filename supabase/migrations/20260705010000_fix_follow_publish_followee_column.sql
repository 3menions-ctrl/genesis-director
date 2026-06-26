-- HOTFIX (M1 / audit D1): restore follow + reel-publish.
-- The 20260625000000_notifications.sql migration introduced two trigger
-- functions that reference `follows.followee_id` — but the real column is
-- `followed_id` (entertainment_hub.follows: follower_id, followed_id). The
-- bad references are evaluated UNGUARDED (before the safe-notify wrapper), so
-- every `INSERT INTO public.follows` (toggle_follow) and every
-- `INSERT INTO public.published_reels` (reel publish) raises
-- `undefined_column` and ROLLS BACK. This was live in production.
--
-- Fix: recreate both functions with `followed_id`. Bodies are otherwise
-- byte-for-byte identical to the live definitions.

CREATE OR REPLACE FUNCTION public.fn_notify_eh_follow()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
      DECLARE v_actor_name text;
      BEGIN
        IF NEW.follower_id = NEW.followed_id THEN RETURN NEW; END IF;
        SELECT COALESCE(display_name, username, 'Someone') INTO v_actor_name
          FROM public.profiles WHERE id = NEW.follower_id;
        PERFORM public.fn_notify_safe(
          NEW.followed_id,
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
      $function$;

CREATE OR REPLACE FUNCTION public.fn_notify_reel_published()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
                WHERE followed_id = $1 ORDER BY created_at DESC LIMIT 100'
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
$function$;
