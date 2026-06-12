-- ════════════════════════════════════════════════════════════════════════
-- Premieres — scheduled, live-viewer reel debuts.
--
-- A creator schedules a premiere for a published reel; followers get
-- notified; at showtime the reel page becomes a "theater" with live
-- viewer count + reactions streaming in. Replaces the silent "publish
-- → reel appears in lobby" with an event.
--
-- This migration creates the schema only. The Theater page and
-- countdown UI land in the next code drop; the API surface is
-- usable today via the schedule_premiere / cancel_premiere RPCs.
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.premieres (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id         uuid NOT NULL REFERENCES public.published_reels(id) ON DELETE CASCADE,
  creator_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  starts_at       timestamptz NOT NULL,
  -- Duration is best-effort — used to compute "ended_at" so the
  -- theater UI can transition out of live mode automatically.
  duration_seconds int NOT NULL DEFAULT 60 CHECK (duration_seconds BETWEEN 1 AND 7200),
  -- "live" while the showtime window is open, "ended" after, "cancelled"
  -- if the creator pulled the plug. "scheduled" is the default.
  status          text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','live','ended','cancelled')),
  -- Public title shown in the lobby marquee + notifications. Falls back
  -- to the reel's own title if null.
  title           text,
  -- Optional creator-authored intro shown before the curtain rises.
  intro_text      text,
  -- Live counters bumped via RPCs / triggers.
  rsvp_count      int  NOT NULL DEFAULT 0,
  peak_viewer_count int NOT NULL DEFAULT 0,
  tip_credits     int  NOT NULL DEFAULT 0,
  -- Bookkeeping
  created_at      timestamptz NOT NULL DEFAULT now(),
  cancelled_at    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_premieres_starts_at ON public.premieres (starts_at);
CREATE INDEX IF NOT EXISTS idx_premieres_reel ON public.premieres (reel_id);
CREATE INDEX IF NOT EXISTS idx_premieres_creator ON public.premieres (creator_id);

ALTER TABLE public.premieres ENABLE ROW LEVEL SECURITY;

-- Public read: anyone can see scheduled / live / ended premieres.
CREATE POLICY "Premieres public read"
  ON public.premieres FOR SELECT TO anon, authenticated USING (true);

-- Only the reel's creator can write rows directly.
CREATE POLICY "Premieres creator writes"
  ON public.premieres FOR ALL TO authenticated
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

-- ── RSVP — who's planning to attend ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.premiere_rsvps (
  premiere_id uuid NOT NULL REFERENCES public.premieres(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rsvp_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (premiere_id, user_id)
);

ALTER TABLE public.premiere_rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Premiere RSVPs self-manage"
  ON public.premiere_rsvps FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Bump rsvp_count on insert / decrement on delete.
CREATE OR REPLACE FUNCTION public.premiere_rsvp_count_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.premieres SET rsvp_count = rsvp_count + 1 WHERE id = NEW.premiere_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.premieres SET rsvp_count = GREATEST(rsvp_count - 1, 0) WHERE id = OLD.premiere_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_premiere_rsvp_count_sync ON public.premiere_rsvps;
CREATE TRIGGER trg_premiere_rsvp_count_sync
  AFTER INSERT OR DELETE ON public.premiere_rsvps
  FOR EACH ROW EXECUTE FUNCTION public.premiere_rsvp_count_sync();

-- ── Live reactions during a premiere ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.premiere_reactions (
  id          bigserial PRIMARY KEY,
  premiere_id uuid NOT NULL REFERENCES public.premieres(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  emoji       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_premiere_reactions_premiere
  ON public.premiere_reactions (premiere_id, created_at DESC);

ALTER TABLE public.premiere_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Premiere reactions public read"
  ON public.premiere_reactions FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Premiere reactions auth insert"
  ON public.premiere_reactions FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- ── RPCs ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.schedule_premiere(
  p_reel_id uuid,
  p_starts_at timestamptz,
  p_duration_seconds int DEFAULT 60,
  p_title text DEFAULT NULL,
  p_intro_text text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator uuid;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF p_starts_at < now() THEN RAISE EXCEPTION 'starts_at_in_past'; END IF;

  SELECT creator_id INTO v_creator FROM public.published_reels WHERE id = p_reel_id;
  IF v_creator IS NULL THEN RAISE EXCEPTION 'reel_not_found'; END IF;
  IF v_creator <> auth.uid() THEN RAISE EXCEPTION 'not_owner'; END IF;

  INSERT INTO public.premieres (
    reel_id, creator_id, starts_at, duration_seconds, title, intro_text
  ) VALUES (
    p_reel_id, v_creator, p_starts_at, p_duration_seconds, p_title, p_intro_text
  ) RETURNING id INTO v_id;

  -- Fan out a notification to followers — best-effort, swallows error
  -- so a notifications outage doesn't block premiere creation.
  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    SELECT
      f.follower_id,
      'premiere_scheduled',
      COALESCE(p_title, 'A premiere is on the calendar'),
      'A creator you follow scheduled a premiere.',
      jsonb_build_object('premiere_id', v_id, 'reel_id', p_reel_id, 'starts_at', p_starts_at)
    FROM public.follows f
    WHERE f.followed_id = v_creator;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN v_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.schedule_premiere(uuid, timestamptz, int, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.schedule_premiere(uuid, timestamptz, int, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_premiere(p_premiere_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_creator uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  SELECT creator_id INTO v_creator FROM public.premieres WHERE id = p_premiere_id;
  IF v_creator IS NULL THEN RAISE EXCEPTION 'premiere_not_found'; END IF;
  IF v_creator <> auth.uid() THEN RAISE EXCEPTION 'not_owner'; END IF;

  UPDATE public.premieres
    SET status = 'cancelled', cancelled_at = now()
    WHERE id = p_premiere_id AND status IN ('scheduled', 'live');
  RETURN FOUND;
END $$;

REVOKE EXECUTE ON FUNCTION public.cancel_premiere(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_premiere(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.rsvp_premiere(p_premiere_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  INSERT INTO public.premiere_rsvps (premiere_id, user_id)
  VALUES (p_premiere_id, auth.uid())
  ON CONFLICT DO NOTHING;
  RETURN TRUE;
END $$;

REVOKE EXECUTE ON FUNCTION public.rsvp_premiere(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rsvp_premiere(uuid) TO authenticated;
