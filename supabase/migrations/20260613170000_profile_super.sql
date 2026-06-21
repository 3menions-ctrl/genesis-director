-- ════════════════════════════════════════════════════════════════════════
-- Profile-super pass. Adds the columns + tables backing:
--   1. Featured reel (channel-trailer pattern)
--   4. Verified badge (verified_at + verified_kind)
--   3. Pinned collections (jsonb array of {id, name, cover_url, reel_ids[]})
--   6. Patron tiers + funding goals
--   7. profile_similar_creators RPC
-- Plus the profile_overview update that hydrates featured reel + tiers.
-- ════════════════════════════════════════════════════════════════════════

-- 1) Featured reel: a single hand-picked reel acts as the channel trailer.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS featured_reel_id uuid REFERENCES public.published_reels(id) ON DELETE SET NULL;

-- 4) Verified badge.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_kind text CHECK (verified_kind IS NULL OR verified_kind IN ('identity','domain','creator','partner'));

-- 3) Pinned collections — groups of pinned reels with a name + cover.
-- jsonb array; each element: { id text, name text, cover_url text, reel_ids text[] }
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pinned_collections jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 6) Patron tiers — per-creator pricing rungs.
CREATE TABLE IF NOT EXISTS public.patron_tiers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position        int NOT NULL CHECK (position BETWEEN 0 AND 9),
  name            text NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
  monthly_credits int NOT NULL CHECK (monthly_credits BETWEEN 1 AND 100000),
  perks           text NOT NULL DEFAULT '',
  accent_hsl      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (creator_id, position)
);
ALTER TABLE public.patron_tiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Patron tiers: public read" ON public.patron_tiers;
CREATE POLICY "Patron tiers: public read"
  ON public.patron_tiers FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Patron tiers: creator manages" ON public.patron_tiers;
CREATE POLICY "Patron tiers: creator manages"
  ON public.patron_tiers FOR ALL
  TO authenticated USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

-- 6b) Funding goals — single-line, single-target meters.
CREATE TABLE IF NOT EXISTS public.patron_goals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label           text NOT NULL CHECK (length(label) BETWEEN 1 AND 120),
  target_credits  int NOT NULL CHECK (target_credits > 0),
  archived_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (creator_id) -- only one active goal per creator at a time
);
ALTER TABLE public.patron_goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Patron goals: public read" ON public.patron_goals;
CREATE POLICY "Patron goals: public read"
  ON public.patron_goals FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Patron goals: creator manages" ON public.patron_goals;
CREATE POLICY "Patron goals: creator manages"
  ON public.patron_goals FOR ALL TO authenticated
  USING (creator_id = auth.uid()) WITH CHECK (creator_id = auth.uid());

-- 7) Similar creators — interest-overlap recommender. Returns up to N
-- opt-in profiles that share interests with the target (excluding self
-- and the viewer).
CREATE OR REPLACE FUNCTION public.profile_similar_creators(p_target uuid, p_limit int DEFAULT 6)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer uuid := auth.uid();
  v_target_interests text[];
  v_rows jsonb;
BEGIN
  SELECT COALESCE(interests, ARRAY[]::text[]) INTO v_target_interests
    FROM public.profiles WHERE id = p_target;
  IF v_target_interests IS NULL OR array_length(v_target_interests, 1) IS NULL THEN
    RETURN jsonb_build_array();
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.overlap DESC, t.created_at DESC), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT
      p.id,
      p.username,
      p.display_name,
      p.avatar_url,
      p.cover_url,
      p.country,
      p.tagline,
      p.location,
      (SELECT count(*) FROM unnest(p.interests) x WHERE x = ANY (v_target_interests)) AS overlap,
      p.created_at
    FROM public.profiles p
    WHERE p.id <> p_target
      AND (v_viewer IS NULL OR p.id <> v_viewer)
      AND p.deactivated_at IS NULL
      AND p.is_discoverable = true
      AND p.interests && v_target_interests
    ORDER BY overlap DESC, p.created_at DESC
    LIMIT p_limit
  ) t;

  RETURN v_rows;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.profile_similar_creators(uuid, int) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.profile_similar_creators(uuid, int) TO anon, authenticated;

-- Extend profile_overview to include featured_reel + verified state +
-- pinned_collections + patron_tiers + patron_goal. Public-safe.
CREATE OR REPLACE FUNCTION public.profile_overview(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_profile jsonb;
  v_is_owner bool;
  v_stats jsonb;
  v_recent_reels jsonb;
  v_top_reels jsonb;
  v_followers_30d int;
  v_plays_30d bigint;
  v_pinned jsonb;
  v_featured jsonb;
  v_tiers jsonb;
  v_goal jsonb;
  v_goal_progress int;
  v_viewer_following bool := false;
BEGIN
  v_is_owner := auth.uid() IS NOT NULL AND auth.uid() = p_user_id;

  SELECT to_jsonb(p.*)
       - CASE WHEN v_is_owner THEN ARRAY[]::text[]
              ELSE ARRAY['credits_balance','total_credits_used','total_credits_purchased']::text[]
         END
    INTO v_profile
    FROM public.profiles p
   WHERE p.id = p_user_id;

  IF v_profile IS NULL THEN
    RETURN jsonb_build_object(
      'profile', NULL,
      'stats', jsonb_build_object(),
      'recent_reels', jsonb_build_array(),
      'top_reels', jsonb_build_array(),
      'pinned_reels', jsonb_build_array(),
      'featured_reel', NULL,
      'patron_tiers', jsonb_build_array(),
      'patron_goal', NULL,
      'is_owner', false,
      'viewer_following', false
    );
  END IF;

  SELECT jsonb_build_object(
    'reels',     (SELECT count(*) FROM public.published_reels WHERE creator_id = p_user_id AND NOT is_taken_down),
    'plays',     COALESCE((SELECT sum(play_count) FROM public.published_reels WHERE creator_id = p_user_id AND NOT is_taken_down), 0),
    'likes',     COALESCE((SELECT sum(like_count) FROM public.published_reels WHERE creator_id = p_user_id AND NOT is_taken_down), 0),
    'remixes',   COALESCE((SELECT sum(remix_count) FROM public.published_reels WHERE creator_id = p_user_id AND NOT is_taken_down), 0),
    'tips',      COALESCE((SELECT sum(tip_credits) FROM public.published_reels WHERE creator_id = p_user_id AND NOT is_taken_down), 0),
    'followers', (SELECT count(*) FROM public.follows WHERE followed_id = p_user_id),
    'following', (SELECT count(*) FROM public.follows WHERE follower_id = p_user_id),
    'projects',  (SELECT count(*) FROM public.movie_projects WHERE user_id = p_user_id),
    'crews',     (SELECT count(*) FROM public.crew_members WHERE user_id = p_user_id),
    'universes', (SELECT count(*) FROM public.universe_members WHERE user_id = p_user_id)
  ) INTO v_stats;

  SELECT count(*) INTO v_followers_30d
    FROM public.follows
   WHERE followed_id = p_user_id AND created_at > now() - interval '30 days';

  SELECT COALESCE(count(*), 0) INTO v_plays_30d
    FROM public.reel_plays rp
    JOIN public.published_reels r ON r.id = rp.reel_id
   WHERE r.creator_id = p_user_id AND rp.created_at > now() - interval '30 days';

  v_stats := v_stats || jsonb_build_object(
    'followers_30d', v_followers_30d,
    'plays_30d', v_plays_30d
  );

  SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC), jsonb_build_array())
    INTO v_recent_reels
    FROM (
      SELECT id, title, thumbnail_url, video_url, play_count, like_count,
             remix_count, world_slug, is_featured, created_at
        FROM public.published_reels
       WHERE creator_id = p_user_id AND NOT is_taken_down
       ORDER BY created_at DESC
       LIMIT 12
    ) r;

  SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.play_count DESC), jsonb_build_array())
    INTO v_top_reels
    FROM (
      SELECT id, title, thumbnail_url, video_url, play_count, like_count, world_slug
        FROM public.published_reels
       WHERE creator_id = p_user_id AND NOT is_taken_down
       ORDER BY play_count DESC
       LIMIT 6
    ) r;

  SELECT COALESCE(jsonb_agg(to_jsonb(r)), jsonb_build_array())
    INTO v_pinned
    FROM public.published_reels r
   WHERE r.id IN (
     SELECT unnest(COALESCE(pinned_reel_ids, ARRAY[]::uuid[]))
       FROM public.profiles
      WHERE id = p_user_id
   )
     AND NOT r.is_taken_down;

  -- Featured reel — single row, the channel-trailer.
  SELECT to_jsonb(r) INTO v_featured
    FROM public.published_reels r
   WHERE r.id = (SELECT featured_reel_id FROM public.profiles WHERE id = p_user_id)
     AND NOT r.is_taken_down;

  -- Patron tiers (ordered).
  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.position), jsonb_build_array())
    INTO v_tiers
    FROM (
      SELECT id, position, name, monthly_credits, perks, accent_hsl
        FROM public.patron_tiers
       WHERE creator_id = p_user_id
       ORDER BY position
    ) t;

  -- Funding goal + computed progress from currently-active subs.
  SELECT jsonb_build_object(
    'id', g.id, 'label', g.label, 'target_credits', g.target_credits
  ) INTO v_goal
    FROM public.patron_goals g
   WHERE g.creator_id = p_user_id AND g.archived_at IS NULL
   LIMIT 1;
  IF v_goal IS NOT NULL THEN
    SELECT COALESCE(sum(monthly_credits)::int, 0) INTO v_goal_progress
      FROM public.patron_subscriptions
     WHERE creator_id = p_user_id AND cancelled_at IS NULL;
    v_goal := v_goal || jsonb_build_object('current_credits', v_goal_progress);
  END IF;

  IF auth.uid() IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.follows
       WHERE follower_id = auth.uid() AND followed_id = p_user_id
    ) INTO v_viewer_following;
  END IF;

  RETURN jsonb_build_object(
    'profile', v_profile,
    'stats', v_stats,
    'recent_reels', v_recent_reels,
    'top_reels', v_top_reels,
    'pinned_reels', v_pinned,
    'featured_reel', v_featured,
    'patron_tiers', v_tiers,
    'patron_goal', v_goal,
    'is_owner', v_is_owner,
    'viewer_following', v_viewer_following
  );
END;
$func$;

-- Refresh views to surface the new columns to the read API.
DROP VIEW IF EXISTS public.profiles_public CASCADE;
CREATE VIEW public.profiles_public
WITH (security_invoker = false)
AS
SELECT
  id, username, display_name, avatar_url, cover_url, bio, tagline,
  location, country, interests, profile_view_count,
  featured_reel_id, verified_at, verified_kind, pinned_collections
FROM public.profiles
WHERE deactivated_at IS NULL;
GRANT SELECT ON public.profiles_public TO anon, authenticated;

DROP VIEW IF EXISTS public.find_friends_directory CASCADE;
CREATE VIEW public.find_friends_directory
WITH (security_invoker = false)
AS
SELECT
  id, username, display_name, avatar_url, cover_url, bio, tagline,
  location, country, interests, profile_view_count, created_at,
  featured_reel_id, verified_at, verified_kind
FROM public.profiles
WHERE is_discoverable = true
  AND deactivated_at IS NULL
  AND display_name IS NOT NULL;
GRANT SELECT ON public.find_friends_directory TO anon, authenticated;

-- Pledge with optional tier reference. Idempotent over (creator, patron).
-- Keeps backward compat with the existing pledge_patron signature.
DROP FUNCTION IF EXISTS public.pledge_patron_tier(uuid, uuid);
CREATE OR REPLACE FUNCTION public.pledge_patron_tier(p_creator_id uuid, p_tier_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_amt int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  SELECT monthly_credits INTO v_amt FROM public.patron_tiers
   WHERE id = p_tier_id AND creator_id = p_creator_id;
  IF v_amt IS NULL THEN RAISE EXCEPTION 'tier_not_found'; END IF;
  RETURN public.pledge_patron(p_creator_id, v_amt);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.pledge_patron_tier(uuid, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.pledge_patron_tier(uuid, uuid) TO authenticated;
