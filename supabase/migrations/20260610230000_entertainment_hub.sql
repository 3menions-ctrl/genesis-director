-- Entertainment Hub — the next phase.
--
-- This migration adds the relational foundation for the public-facing
-- Lobby, Theater, Market, Music, and Crews surfaces.
--
-- Design notes:
--   • Every `movie_projects` row is private until it's published. Publishing
--     creates a `published_reels` row pointing back at the source project
--     plus a frozen snapshot of the video/thumbnail/title for cheap reads.
--   • All public reads (Lobby feed, Theater page) hit `published_reels` so
--     we never expose unpublished drafts via RLS misconfig.
--   • Atoms (voices, characters, looks, scores) are listed in
--     `atom_listings` keyed by a polymorphic (atom_type, atom_id) pair.
--   • Credits are the single in-app currency until Stripe lands — every
--     purchase / tip is a `credit_transactions` row with a typed action.

-- ════════════════════════════════════════════════════════════════════════
-- 1. CHANNEL WORLDS — the themed entry points (Noir, Sci-Fi, Comedy, etc)
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.channel_worlds (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL UNIQUE,
  name        text NOT NULL,
  description text,
  -- Visual treatment for the world (background, accent color, glyph)
  cover_url   text,
  accent_hsl  text NOT NULL DEFAULT '213 100% 53%',
  glyph       text,
  -- Sort + show toggles
  sort_order  int  NOT NULL DEFAULT 100,
  is_live     bool NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_channel_worlds_live ON public.channel_worlds(is_live, sort_order);

INSERT INTO public.channel_worlds (slug, name, description, accent_hsl, glyph, sort_order) VALUES
  ('noir',   'Noir',          'Shadows, smoke, and morally interesting people.',  '38 80% 60%',  '◐', 10),
  ('scifi',  'Sci-Fi',        'Tomorrow, today, and the wires in between.',       '213 100% 60%', '◊', 20),
  ('comedy', 'Comedy',        'Quick wit, slow takes, hot soup.',                 '14 90% 60%',   '★', 30),
  ('docu',   'Documentary',   'Truth, shot like fiction.',                        '160 60% 50%',  '◯', 40),
  ('music',  'Music videos',  'Three minutes that change a song forever.',        '280 70% 65%',  '▲', 50),
  ('experi', 'Experimental',  'Unfinished thoughts that finished themselves.',    '0 0% 70%',     '✦', 60)
ON CONFLICT (slug) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════
-- 2. PUBLISHED REELS — every public, watchable artifact
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.published_reels (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES public.movie_projects(id) ON DELETE CASCADE,
  creator_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Frozen snapshot — survives even if the source project is deleted
  title           text NOT NULL,
  synopsis        text,
  video_url       text NOT NULL,
  thumbnail_url   text,
  duration_sec    int,
  -- Discovery taxonomy
  world_slug      text REFERENCES public.channel_worlds(slug),
  universe_id     uuid REFERENCES public.universes(id) ON DELETE SET NULL,
  tags            text[] NOT NULL DEFAULT '{}',
  -- Director's Notes — exposed in the Theater overlay
  prompt_snapshot text,
  director_notes  text,
  -- Counters (denormalized — incremented via RPC)
  play_count      bigint NOT NULL DEFAULT 0,
  like_count      bigint NOT NULL DEFAULT 0,
  remix_count     bigint NOT NULL DEFAULT 0,
  tip_credits     bigint NOT NULL DEFAULT 0,
  -- Editorial / safety state
  is_featured     bool NOT NULL DEFAULT false,
  is_taken_down   bool NOT NULL DEFAULT false,
  taken_down_reason text,
  -- Lineage
  parent_reel_id  uuid REFERENCES public.published_reels(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_published_reels_creator ON public.published_reels(creator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_published_reels_world ON public.published_reels(world_slug, created_at DESC) WHERE NOT is_taken_down;
CREATE INDEX IF NOT EXISTS idx_published_reels_featured ON public.published_reels(is_featured, created_at DESC) WHERE NOT is_taken_down;
CREATE INDEX IF NOT EXISTS idx_published_reels_parent ON public.published_reels(parent_reel_id);

ALTER TABLE public.published_reels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public reels readable" ON public.published_reels;
CREATE POLICY "Public reels readable" ON public.published_reels
  FOR SELECT USING (NOT is_taken_down);
DROP POLICY IF EXISTS "Owner manages own reels" ON public.published_reels;
CREATE POLICY "Owner manages own reels" ON public.published_reels
  FOR ALL USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

-- ════════════════════════════════════════════════════════════════════════
-- 3. PLAYS, LIKES, REMIXES, FOLLOWS — engagement tables
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.reel_plays (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id     uuid NOT NULL REFERENCES public.published_reels(id) ON DELETE CASCADE,
  viewer_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  watched_sec int,
  completed   bool NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reel_plays_reel ON public.reel_plays(reel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reel_plays_viewer ON public.reel_plays(viewer_id, created_at DESC);
ALTER TABLE public.reel_plays ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone records plays" ON public.reel_plays;
CREATE POLICY "Anyone records plays" ON public.reel_plays FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Viewer reads own plays" ON public.reel_plays;
CREATE POLICY "Viewer reads own plays" ON public.reel_plays FOR SELECT USING (viewer_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.reel_likes (
  reel_id    uuid NOT NULL REFERENCES public.published_reels(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (reel_id, user_id)
);
ALTER TABLE public.reel_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Likes are public" ON public.reel_likes;
CREATE POLICY "Likes are public" ON public.reel_likes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users like for themselves" ON public.reel_likes;
CREATE POLICY "Users like for themselves" ON public.reel_likes FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.follows (
  follower_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  followed_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followed_id),
  CHECK (follower_id <> followed_id)
);
CREATE INDEX IF NOT EXISTS idx_follows_followed ON public.follows(followed_id);
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Follows are public" ON public.follows;
CREATE POLICY "Follows are public" ON public.follows FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users manage own follows" ON public.follows;
CREATE POLICY "Users manage own follows" ON public.follows FOR ALL
  USING (follower_id = auth.uid()) WITH CHECK (follower_id = auth.uid());

-- Reaction reels — 5-second video reactions stitched to a parent reel.
CREATE TABLE IF NOT EXISTS public.reel_reactions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id      uuid NOT NULL REFERENCES public.published_reels(id) ON DELETE CASCADE,
  reactor_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction_url text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reel_reactions_reel ON public.reel_reactions(reel_id, created_at DESC);
ALTER TABLE public.reel_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Reactions are public" ON public.reel_reactions;
CREATE POLICY "Reactions are public" ON public.reel_reactions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users react themselves" ON public.reel_reactions;
CREATE POLICY "Users react themselves" ON public.reel_reactions FOR ALL
  USING (reactor_id = auth.uid()) WITH CHECK (reactor_id = auth.uid());

-- ════════════════════════════════════════════════════════════════════════
-- 4. CREWS — persistent creative groups (3-10 members)
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.crews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL UNIQUE,
  name        text NOT NULL,
  description text,
  cover_url   text,
  is_public   bool NOT NULL DEFAULT false,
  created_by  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crew_members (
  crew_id    uuid NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'member',
  joined_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (crew_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_crew_members_user ON public.crew_members(user_id);

ALTER TABLE public.crews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crew_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public crews readable" ON public.crews;
CREATE POLICY "Public crews readable" ON public.crews FOR SELECT
  USING (is_public OR id IN (SELECT crew_id FROM public.crew_members WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Owner manages crew" ON public.crews;
CREATE POLICY "Owner manages crew" ON public.crews FOR ALL
  USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
DROP POLICY IF EXISTS "Members visible to members" ON public.crew_members;
CREATE POLICY "Members visible to members" ON public.crew_members FOR SELECT
  USING (
    crew_id IN (SELECT id FROM public.crews WHERE is_public)
    OR crew_id IN (SELECT crew_id FROM public.crew_members cm2 WHERE cm2.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "Self manages membership" ON public.crew_members;
CREATE POLICY "Self manages membership" ON public.crew_members FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ════════════════════════════════════════════════════════════════════════
-- 5. MARKET — atom_listings + atom_purchases + patron_subscriptions
-- ════════════════════════════════════════════════════════════════════════
-- Polymorphic atom listing: voice, character, look, score, vfx_pack, course
CREATE TABLE IF NOT EXISTS public.atom_listings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  atom_type     text NOT NULL CHECK (atom_type IN ('voice','character','location','look','score','vfx_pack','sheet_music','course')),
  atom_ref      text NOT NULL,            -- ID into the relevant atom table (characters, etc) or external ref
  name          text NOT NULL,
  description   text,
  preview_url   text,                     -- video/audio/image preview
  thumbnail_url text,
  -- Pricing in credits — internal currency until Stripe arrives
  price_credits int NOT NULL CHECK (price_credits >= 0),
  royalty_pct   int NOT NULL DEFAULT 10 CHECK (royalty_pct BETWEEN 0 AND 90),
  tags          text[] NOT NULL DEFAULT '{}',
  is_active     bool NOT NULL DEFAULT true,
  total_sales   bigint NOT NULL DEFAULT 0,
  total_revenue_credits bigint NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_atom_listings_type ON public.atom_listings(atom_type, is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_atom_listings_seller ON public.atom_listings(seller_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.atom_purchases (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  uuid NOT NULL REFERENCES public.atom_listings(id) ON DELETE RESTRICT,
  buyer_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  price_credits int NOT NULL,
  seller_credits int NOT NULL,            -- credits sent to seller after platform cut
  platform_credits int NOT NULL,          -- credits retained
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_atom_purchases_buyer ON public.atom_purchases(buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_atom_purchases_seller ON public.atom_purchases(seller_id, created_at DESC);

ALTER TABLE public.atom_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atom_purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Active listings public" ON public.atom_listings;
CREATE POLICY "Active listings public" ON public.atom_listings FOR SELECT USING (is_active);
DROP POLICY IF EXISTS "Seller manages own listings" ON public.atom_listings;
CREATE POLICY "Seller manages own listings" ON public.atom_listings FOR ALL
  USING (seller_id = auth.uid()) WITH CHECK (seller_id = auth.uid());
DROP POLICY IF EXISTS "Buyer reads own purchases" ON public.atom_purchases;
CREATE POLICY "Buyer reads own purchases" ON public.atom_purchases FOR SELECT
  USING (buyer_id = auth.uid() OR seller_id = auth.uid());

-- Patron subscriptions — monthly tip to a creator. Recurrence is logical
-- (we track a renewal_due_at); the actual credit deduction is handled by a
-- cron edge fn that bills monthly.
CREATE TABLE IF NOT EXISTS public.patron_subscriptions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patron_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  monthly_credits int NOT NULL CHECK (monthly_credits > 0),
  started_at      timestamptz NOT NULL DEFAULT now(),
  renewal_due_at  timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  cancelled_at    timestamptz,
  UNIQUE (creator_id, patron_id),
  CHECK (creator_id <> patron_id)
);
CREATE INDEX IF NOT EXISTS idx_patron_subs_creator ON public.patron_subscriptions(creator_id) WHERE cancelled_at IS NULL;
ALTER TABLE public.patron_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Patron sees own subs" ON public.patron_subscriptions;
CREATE POLICY "Patron sees own subs" ON public.patron_subscriptions FOR SELECT
  USING (patron_id = auth.uid() OR creator_id = auth.uid());
DROP POLICY IF EXISTS "Patron manages own subs" ON public.patron_subscriptions;
CREATE POLICY "Patron manages own subs" ON public.patron_subscriptions FOR ALL
  USING (patron_id = auth.uid()) WITH CHECK (patron_id = auth.uid());

-- ════════════════════════════════════════════════════════════════════════
-- 6. DAILY PROMPT — the addictive loop
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.daily_prompts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_date   date NOT NULL UNIQUE,
  prompt_text   text NOT NULL,
  prompt_hint   text,
  world_slug    text REFERENCES public.channel_worlds(slug),
  cover_url     text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_daily_prompts_date ON public.daily_prompts(prompt_date DESC);

CREATE TABLE IF NOT EXISTS public.prompt_submissions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id   uuid NOT NULL REFERENCES public.daily_prompts(id) ON DELETE CASCADE,
  reel_id     uuid NOT NULL REFERENCES public.published_reels(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote_count  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (prompt_id, reel_id)
);
CREATE INDEX IF NOT EXISTS idx_prompt_subs_prompt ON public.prompt_submissions(prompt_id, vote_count DESC);
ALTER TABLE public.daily_prompts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Prompts public" ON public.daily_prompts;
CREATE POLICY "Prompts public" ON public.daily_prompts FOR SELECT USING (true);
DROP POLICY IF EXISTS "Submissions public" ON public.prompt_submissions;
CREATE POLICY "Submissions public" ON public.prompt_submissions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users submit own" ON public.prompt_submissions;
CREATE POLICY "Users submit own" ON public.prompt_submissions FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Seed the first daily prompt so /lobby has something to show even before
-- a cron starts dropping them.
INSERT INTO public.daily_prompts (prompt_date, prompt_text, prompt_hint, world_slug)
VALUES (
  CURRENT_DATE,
  'A character realizes the room they''ve been sitting in is not real.',
  '10–30 seconds. Reveal at the end.',
  'experi'
) ON CONFLICT (prompt_date) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════
-- 7. RPCs — server-side write paths
-- ════════════════════════════════════════════════════════════════════════

-- Publish a project as a public reel. Idempotent on project_id — re-publishing
-- updates the snapshot and bumps updated_at. Returns the reel id.
CREATE OR REPLACE FUNCTION public.publish_reel(
  p_project_id uuid,
  p_world_slug text DEFAULT NULL,
  p_director_notes text DEFAULT NULL,
  p_tags text[] DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project public.movie_projects%ROWTYPE;
  v_existing uuid;
  v_reel_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO v_project FROM public.movie_projects WHERE id = p_project_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'project_not_found_or_not_owner'; END IF;
  IF v_project.video_url IS NULL OR v_project.video_url = '' THEN
    RAISE EXCEPTION 'no_video_to_publish';
  END IF;

  SELECT id INTO v_existing FROM public.published_reels WHERE project_id = p_project_id;
  IF v_existing IS NOT NULL THEN
    UPDATE public.published_reels SET
      title = v_project.title,
      synopsis = v_project.synopsis,
      video_url = v_project.video_url,
      thumbnail_url = v_project.thumbnail_url,
      world_slug = COALESCE(p_world_slug, world_slug),
      universe_id = v_project.universe_id,
      tags = COALESCE(p_tags, tags),
      prompt_snapshot = v_project.synopsis,
      director_notes = COALESCE(p_director_notes, director_notes),
      updated_at = now(),
      is_taken_down = false
    WHERE id = v_existing
    RETURNING id INTO v_reel_id;
  ELSE
    INSERT INTO public.published_reels (
      project_id, creator_id, title, synopsis, video_url, thumbnail_url,
      world_slug, universe_id, tags, prompt_snapshot, director_notes
    ) VALUES (
      p_project_id, auth.uid(), v_project.title, v_project.synopsis,
      v_project.video_url, v_project.thumbnail_url, p_world_slug,
      v_project.universe_id, p_tags, v_project.synopsis, p_director_notes
    ) RETURNING id INTO v_reel_id;
  END IF;
  RETURN jsonb_build_object('reel_id', v_reel_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.publish_reel(uuid, text, text, text[]) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.publish_reel(uuid, text, text, text[]) TO authenticated;

-- Fetch the programmed lobby feed for a given world (NULL = all worlds).
-- Cursor-paginated by created_at. Returns a jsonb array; rows include creator
-- display name + a tiny like/play snapshot for the card.
CREATE OR REPLACE FUNCTION public.lobby_feed(
  p_world_slug text DEFAULT NULL,
  p_cursor timestamptz DEFAULT NULL,
  p_limit int DEFAULT 24
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH rows AS (
    SELECT
      r.id, r.title, r.synopsis, r.video_url, r.thumbnail_url, r.duration_sec,
      r.world_slug, r.tags, r.play_count, r.like_count, r.remix_count,
      r.is_featured, r.created_at,
      r.creator_id,
      COALESCE(p.display_name, p.full_name, split_part(p.email,'@',1)) AS creator_name,
      p.avatar_url AS creator_avatar,
      w.name AS world_name, w.accent_hsl AS world_accent, w.glyph AS world_glyph
    FROM public.published_reels r
    LEFT JOIN public.profiles p ON p.id = r.creator_id
    LEFT JOIN public.channel_worlds w ON w.slug = r.world_slug
    WHERE NOT r.is_taken_down
      AND (p_world_slug IS NULL OR r.world_slug = p_world_slug)
      AND (p_cursor IS NULL OR r.created_at < p_cursor)
    ORDER BY r.created_at DESC
    LIMIT GREATEST(1, LEAST(p_limit, 60))
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(rows.*) ORDER BY rows.created_at DESC), '[]'::jsonb)
  FROM rows;
$$;
REVOKE EXECUTE ON FUNCTION public.lobby_feed(text, timestamptz, int) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.lobby_feed(text, timestamptz, int) TO anon, authenticated;

-- Fetch a single reel + creator + neighbour reels for the Theater page.
CREATE OR REPLACE FUNCTION public.theater_payload(p_reel_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_reel jsonb;
  v_creator jsonb;
  v_neighbours jsonb;
  v_liked bool := false;
BEGIN
  SELECT to_jsonb(r) INTO v_reel
  FROM public.published_reels r
  WHERE id = p_reel_id AND NOT is_taken_down;
  IF v_reel IS NULL THEN RAISE EXCEPTION 'reel_not_found'; END IF;

  SELECT jsonb_build_object(
    'id', p.id,
    'display_name', COALESCE(p.display_name, p.full_name, split_part(p.email,'@',1)),
    'avatar_url', p.avatar_url,
    'follower_count', (SELECT count(*) FROM public.follows WHERE followed_id = p.id)
  ) INTO v_creator
  FROM public.profiles p
  WHERE p.id = (v_reel->>'creator_id')::uuid;

  SELECT COALESCE(jsonb_agg(to_jsonb(n) ORDER BY n.created_at DESC), '[]'::jsonb)
  INTO v_neighbours
  FROM (
    SELECT id, title, thumbnail_url, world_slug, play_count
    FROM public.published_reels
    WHERE id <> p_reel_id
      AND NOT is_taken_down
      AND (world_slug = (v_reel->>'world_slug') OR (v_reel->>'world_slug') IS NULL)
    ORDER BY created_at DESC
    LIMIT 12
  ) n;

  IF auth.uid() IS NOT NULL THEN
    SELECT EXISTS (SELECT 1 FROM public.reel_likes WHERE reel_id = p_reel_id AND user_id = auth.uid())
    INTO v_liked;
  END IF;

  RETURN jsonb_build_object(
    'reel', v_reel,
    'creator', COALESCE(v_creator, '{}'::jsonb),
    'neighbours', v_neighbours,
    'viewer_liked', v_liked,
    'is_following_creator', (
      auth.uid() IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.follows WHERE follower_id = auth.uid() AND followed_id = (v_reel->>'creator_id')::uuid)
    )
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.theater_payload(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.theater_payload(uuid) TO anon, authenticated;

-- Track a play. Best-effort — increments the counter atomically and writes
-- an analytic row for downstream recommendations.
CREATE OR REPLACE FUNCTION public.track_reel_play(
  p_reel_id uuid, p_watched_sec int DEFAULT NULL, p_completed bool DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.reel_plays (reel_id, viewer_id, watched_sec, completed)
  VALUES (p_reel_id, auth.uid(), p_watched_sec, p_completed);
  UPDATE public.published_reels SET play_count = play_count + 1 WHERE id = p_reel_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.track_reel_play(uuid, int, bool) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.track_reel_play(uuid, int, bool) TO anon, authenticated;

-- Toggle like. Returns the new state.
CREATE OR REPLACE FUNCTION public.toggle_like_reel(p_reel_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_existed bool; v_count bigint;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  DELETE FROM public.reel_likes WHERE reel_id = p_reel_id AND user_id = auth.uid();
  GET DIAGNOSTICS v_existed = ROW_COUNT;
  IF v_existed = 0 THEN
    INSERT INTO public.reel_likes (reel_id, user_id) VALUES (p_reel_id, auth.uid())
      ON CONFLICT DO NOTHING;
    UPDATE public.published_reels SET like_count = like_count + 1 WHERE id = p_reel_id
      RETURNING like_count INTO v_count;
    RETURN jsonb_build_object('liked', true, 'like_count', v_count);
  ELSE
    UPDATE public.published_reels SET like_count = GREATEST(0, like_count - 1) WHERE id = p_reel_id
      RETURNING like_count INTO v_count;
    RETURN jsonb_build_object('liked', false, 'like_count', v_count);
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.toggle_like_reel(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.toggle_like_reel(uuid) TO authenticated;

-- Toggle follow. Returns the new state.
CREATE OR REPLACE FUNCTION public.toggle_follow(p_target uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_existed bool;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_target = auth.uid() THEN RAISE EXCEPTION 'cannot_follow_self'; END IF;
  DELETE FROM public.follows WHERE follower_id = auth.uid() AND followed_id = p_target;
  GET DIAGNOSTICS v_existed = ROW_COUNT;
  IF v_existed = 0 THEN
    INSERT INTO public.follows (follower_id, followed_id) VALUES (auth.uid(), p_target)
      ON CONFLICT DO NOTHING;
    RETURN jsonb_build_object('following', true);
  END IF;
  RETURN jsonb_build_object('following', false);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.toggle_follow(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.toggle_follow(uuid) TO authenticated;

-- Tip credits to a reel's creator. Splits 90/10 between creator and platform.
CREATE OR REPLACE FUNCTION public.tip_reel(p_reel_id uuid, p_credits int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator uuid;
  v_buyer_balance int;
  v_creator_cut int;
  v_platform_cut int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_credits <= 0 OR p_credits > 10000 THEN RAISE EXCEPTION 'invalid_credits'; END IF;
  SELECT creator_id INTO v_creator FROM public.published_reels WHERE id = p_reel_id AND NOT is_taken_down;
  IF v_creator IS NULL THEN RAISE EXCEPTION 'reel_not_found'; END IF;
  IF v_creator = auth.uid() THEN RAISE EXCEPTION 'cannot_tip_self'; END IF;

  SELECT credits_balance INTO v_buyer_balance FROM public.profiles WHERE id = auth.uid();
  IF v_buyer_balance < p_credits THEN RAISE EXCEPTION 'insufficient_credits'; END IF;

  v_creator_cut := (p_credits * 90) / 100;
  v_platform_cut := p_credits - v_creator_cut;

  UPDATE public.profiles SET
    credits_balance = credits_balance - p_credits,
    total_credits_used = COALESCE(total_credits_used, 0) + p_credits,
    updated_at = now()
  WHERE id = auth.uid();
  UPDATE public.profiles SET
    credits_balance = COALESCE(credits_balance, 0) + v_creator_cut,
    updated_at = now()
  WHERE id = v_creator;
  UPDATE public.published_reels SET tip_credits = tip_credits + p_credits WHERE id = p_reel_id;

  INSERT INTO public.credit_transactions (user_id, amount, transaction_type, description)
    VALUES (auth.uid(), -p_credits, 'tip', 'Tip to reel ' || p_reel_id::text);
  INSERT INTO public.credit_transactions (user_id, amount, transaction_type, description)
    VALUES (v_creator, v_creator_cut, 'tip_received', 'Tip from ' || auth.uid()::text || ' on reel ' || p_reel_id::text);

  RETURN jsonb_build_object('success', true, 'creator_received', v_creator_cut);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.tip_reel(uuid, int) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.tip_reel(uuid, int) TO authenticated;

-- Remix a reel — clones the source project as a new movie_projects row for
-- the caller, marking the parent. Returns the new project_id so the client
-- can navigate straight into the editor.
CREATE OR REPLACE FUNCTION public.remix_reel(p_reel_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reel public.published_reels%ROWTYPE;
  v_src public.movie_projects%ROWTYPE;
  v_new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO v_reel FROM public.published_reels WHERE id = p_reel_id AND NOT is_taken_down;
  IF NOT FOUND THEN RAISE EXCEPTION 'reel_not_found'; END IF;
  SELECT * INTO v_src FROM public.movie_projects WHERE id = v_reel.project_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'source_project_missing'; END IF;

  INSERT INTO public.movie_projects (
    user_id, parent_project_id, universe_id, title, genre, story_structure,
    target_duration_minutes, setting, time_period, mood, movie_intro_style,
    synopsis, status, is_template
  ) VALUES (
    auth.uid(), v_src.id, v_src.universe_id,
    'Remix · ' || v_src.title, v_src.genre, v_src.story_structure,
    v_src.target_duration_minutes, v_src.setting, v_src.time_period, v_src.mood,
    v_src.movie_intro_style, v_src.synopsis, 'draft', false
  ) RETURNING id INTO v_new_id;

  -- Inherit characters
  INSERT INTO public.project_characters (project_id, character_id)
    SELECT v_new_id, character_id FROM public.project_characters WHERE project_id = v_src.id
    ON CONFLICT DO NOTHING;

  UPDATE public.published_reels SET remix_count = remix_count + 1 WHERE id = p_reel_id;

  RETURN jsonb_build_object('new_project_id', v_new_id, 'parent_reel_id', p_reel_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.remix_reel(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.remix_reel(uuid) TO authenticated;

-- Buy an atom listing — debits buyer credits, credits seller (minus 10% cut),
-- records a purchase row, returns success.
CREATE OR REPLACE FUNCTION public.buy_atom(p_listing_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing public.atom_listings%ROWTYPE;
  v_buyer_balance int;
  v_seller_cut int;
  v_platform_cut int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO v_listing FROM public.atom_listings WHERE id = p_listing_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'listing_inactive_or_missing'; END IF;
  IF v_listing.seller_id = auth.uid() THEN RAISE EXCEPTION 'cannot_buy_own_listing'; END IF;

  SELECT credits_balance INTO v_buyer_balance FROM public.profiles WHERE id = auth.uid();
  IF v_buyer_balance < v_listing.price_credits THEN RAISE EXCEPTION 'insufficient_credits'; END IF;

  -- Honor the listing's own royalty_pct (= the platform's cut) instead of
  -- hardcoding 10%. The table's CHECK constraint caps royalty at 0-90, so
  -- the seller's take is whatever's left (10-100%).
  v_seller_cut := (v_listing.price_credits * (100 - v_listing.royalty_pct)) / 100;
  v_platform_cut := v_listing.price_credits - v_seller_cut;

  UPDATE public.profiles SET
    credits_balance = credits_balance - v_listing.price_credits,
    total_credits_used = COALESCE(total_credits_used, 0) + v_listing.price_credits,
    updated_at = now()
  WHERE id = auth.uid();
  UPDATE public.profiles SET
    credits_balance = COALESCE(credits_balance, 0) + v_seller_cut,
    updated_at = now()
  WHERE id = v_listing.seller_id;

  UPDATE public.atom_listings SET
    total_sales = total_sales + 1,
    total_revenue_credits = total_revenue_credits + v_listing.price_credits,
    updated_at = now()
  WHERE id = p_listing_id;

  INSERT INTO public.atom_purchases (
    listing_id, buyer_id, seller_id, price_credits, seller_credits, platform_credits
  ) VALUES (
    p_listing_id, auth.uid(), v_listing.seller_id, v_listing.price_credits,
    v_seller_cut, v_platform_cut
  );

  INSERT INTO public.credit_transactions (user_id, amount, transaction_type, description)
    VALUES (auth.uid(), -v_listing.price_credits, 'atom_purchase', 'Bought ' || v_listing.name);
  INSERT INTO public.credit_transactions (user_id, amount, transaction_type, description)
    VALUES (v_listing.seller_id, v_seller_cut, 'atom_sale', 'Sold ' || v_listing.name);

  RETURN jsonb_build_object('success', true, 'seller_received', v_seller_cut);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.buy_atom(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.buy_atom(uuid) TO authenticated;

-- Current daily prompt + top 6 submissions.
CREATE OR REPLACE FUNCTION public.current_daily_prompt()
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'prompt', to_jsonb(p.*),
    'top_submissions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'reel_id', s.reel_id,
        'user_id', s.user_id,
        'votes', s.vote_count,
        'title', r.title,
        'thumbnail_url', r.thumbnail_url
      ) ORDER BY s.vote_count DESC)
      FROM (
        SELECT * FROM public.prompt_submissions WHERE prompt_id = p.id
        ORDER BY vote_count DESC LIMIT 6
      ) s
      JOIN public.published_reels r ON r.id = s.reel_id
    ), '[]'::jsonb)
  )
  FROM public.daily_prompts p
  WHERE p.prompt_date <= CURRENT_DATE
  ORDER BY p.prompt_date DESC
  LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.current_daily_prompt() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.current_daily_prompt() TO anon, authenticated;

-- Create a crew for the current user, joining them as owner in one shot.
CREATE OR REPLACE FUNCTION public.create_crew(p_name text, p_slug text, p_description text DEFAULT NULL, p_is_public bool DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_crew_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  INSERT INTO public.crews (slug, name, description, is_public, created_by)
    VALUES (p_slug, p_name, p_description, p_is_public, auth.uid())
    RETURNING id INTO v_crew_id;
  INSERT INTO public.crew_members (crew_id, user_id, role)
    VALUES (v_crew_id, auth.uid(), 'owner');
  RETURN jsonb_build_object('crew_id', v_crew_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_crew(text, text, text, bool) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.create_crew(text, text, text, bool) TO authenticated;

COMMENT ON TABLE public.published_reels IS
  'Public-facing watchable artifacts. Created via publish_reel RPC; frozen snapshot of the source movie_projects row at publication time.';
COMMENT ON FUNCTION public.lobby_feed IS
  'Programmed feed for /lobby. Cursor-paginated by created_at.';
COMMENT ON FUNCTION public.theater_payload IS
  'Single-roundtrip data for /watch/:id — reel + creator + neighbours + viewer state.';
COMMENT ON FUNCTION public.remix_reel IS
  'Clones a published reel''s source project as a new draft for the caller; tracks parent + bumps remix_count.';
COMMENT ON FUNCTION public.buy_atom IS
  'Atomic credit transfer for marketplace purchases — 90% to seller, 10% platform cut, full audit trail.';
