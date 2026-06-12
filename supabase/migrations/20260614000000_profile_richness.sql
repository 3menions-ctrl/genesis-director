-- ════════════════════════════════════════════════════════════════════════
-- Profile richness — schema additions for the comprehensive Profile page.
-- Adds the columns needed for cover images, taglines, external links,
-- pinned reels, and location. All nullable; existing rows stay intact.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cover_url        text,
  ADD COLUMN IF NOT EXISTS bio              text,
  ADD COLUMN IF NOT EXISTS tagline          text,
  ADD COLUMN IF NOT EXISTS location         text,
  ADD COLUMN IF NOT EXISTS external_links   jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS pinned_reel_ids  uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS profile_view_count bigint NOT NULL DEFAULT 0;

-- Allow the world to read public-profile-facing columns. Owner can write
-- their own row (already covered by existing "Users can update own
-- profile" policy). We add an explicit PUBLIC select policy so anyone
-- can see another creator's profile — necessary for /c/:id pages.
DROP POLICY IF EXISTS "Public profile read" ON public.profiles;
CREATE POLICY "Public profile read" ON public.profiles
  FOR SELECT USING (true);

-- ════════════════════════════════════════════════════════════════════════
-- profile-covers bucket — public-read for hero banners.
-- Folder convention: {user_id}/cover-{timestamp}.{ext}
-- ════════════════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('profile-covers', 'profile-covers', true, 10485760,
        ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Profile covers public read" ON storage.objects;
CREATE POLICY "Profile covers public read"
ON storage.objects FOR SELECT USING (bucket_id = 'profile-covers');

DROP POLICY IF EXISTS "Profile covers owner insert" ON storage.objects;
CREATE POLICY "Profile covers owner insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'profile-covers'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Profile covers owner update" ON storage.objects;
CREATE POLICY "Profile covers owner update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'profile-covers'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Profile covers owner delete" ON storage.objects;
CREATE POLICY "Profile covers owner delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'profile-covers'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ════════════════════════════════════════════════════════════════════════
-- profile_overview RPC — one round-trip payload for the Profile page.
--   • core profile row
--   • aggregate stats (reels, followers, following, plays, likes, projects)
--   • the recent activity timeline (last 30 days of reels published)
--   • viewer's follow state (when authenticated)
--
-- Anyone can call it (including anon) for public profile views; the
-- private/sensitive stats (credits, total_spent) are stripped from the
-- response when the viewer is not the owner.
-- ════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.profile_overview(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_profile jsonb;
  v_is_owner bool;
  v_stats jsonb;
  v_recent_reels jsonb;
  v_top_reels jsonb;
  v_followers_30d int;
  v_plays_30d bigint;
  v_pinned jsonb;
  v_viewer_following bool := false;
BEGIN
  v_is_owner := auth.uid() IS NOT NULL AND auth.uid() = p_user_id;

  SELECT to_jsonb(p.*)
       - CASE WHEN v_is_owner THEN '{}'::text[]
              ELSE ARRAY['credits_balance','total_credits_used','total_credits_purchased'] END
    INTO v_profile
    FROM public.profiles p
   WHERE p.id = p_user_id;
  IF v_profile IS NULL THEN RAISE EXCEPTION 'profile_not_found'; END IF;

  -- Stats: counts in one go.
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

  -- Last 30 days deltas.
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

  -- Recent reels (newest first, top 12)
  SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC), '[]'::jsonb)
    INTO v_recent_reels
    FROM (
      SELECT id, title, thumbnail_url, video_url, play_count, like_count,
             remix_count, world_slug, is_featured, created_at
        FROM public.published_reels
       WHERE creator_id = p_user_id AND NOT is_taken_down
       ORDER BY created_at DESC
       LIMIT 12
    ) r;

  -- Top reels (most-played, top 6)
  SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.play_count DESC), '[]'::jsonb)
    INTO v_top_reels
    FROM (
      SELECT id, title, thumbnail_url, video_url, play_count, like_count, world_slug
        FROM public.published_reels
       WHERE creator_id = p_user_id AND NOT is_taken_down
       ORDER BY play_count DESC
       LIMIT 6
    ) r;

  -- Pinned reels: resolve UUIDs to reel rows.
  SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]'::jsonb)
    INTO v_pinned
    FROM public.published_reels r
   WHERE r.id = ANY (
     (SELECT COALESCE(pinned_reel_ids, '{}')::uuid[] FROM public.profiles WHERE id = p_user_id)
   )
     AND NOT r.is_taken_down;

  -- Viewer state.
  IF auth.uid() IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.follows
       WHERE follower_id = auth.uid() AND followed_id = p_user_id
    ) INTO v_viewer_following;
  END IF;

  RETURN jsonb_build_object(
    'profile',        v_profile,
    'stats',          v_stats,
    'recent_reels',   v_recent_reels,
    'top_reels',      v_top_reels,
    'pinned_reels',   v_pinned,
    'is_owner',       v_is_owner,
    'viewer_following', v_viewer_following
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.profile_overview(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.profile_overview(uuid) TO anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- profile_play_series — last 30 days of daily plays for a creator.
-- Used by the engagement chart on the Profile page. Stable, anonymizable.
-- ════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.profile_play_series(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH days AS (
    SELECT generate_series((CURRENT_DATE - interval '29 days')::date, CURRENT_DATE, '1 day') AS day
  ), plays AS (
    SELECT date_trunc('day', rp.created_at)::date AS day, count(*) AS n
      FROM public.reel_plays rp
      JOIN public.published_reels r ON r.id = rp.reel_id
     WHERE r.creator_id = p_user_id
       AND rp.created_at >= CURRENT_DATE - interval '29 days'
     GROUP BY 1
  ), followers AS (
    SELECT date_trunc('day', created_at)::date AS day, count(*) AS n
      FROM public.follows
     WHERE followed_id = p_user_id
       AND created_at >= CURRENT_DATE - interval '29 days'
     GROUP BY 1
  )
  SELECT jsonb_build_object(
    'series', COALESCE(jsonb_agg(jsonb_build_object(
      'day', d.day,
      'plays', COALESCE(p.n, 0),
      'followers', COALESCE(f.n, 0)
    ) ORDER BY d.day ASC), '[]'::jsonb)
  )
  FROM days d
  LEFT JOIN plays p     ON p.day = d.day
  LEFT JOIN followers f ON f.day = d.day;
$$;
REVOKE EXECUTE ON FUNCTION public.profile_play_series(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.profile_play_series(uuid) TO anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- update_profile_text — single RPC for all editable profile text fields.
-- Server-validates lengths so the UI can stay simple.
-- ════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.update_profile_text(
  p_display_name text DEFAULT NULL,
  p_bio          text DEFAULT NULL,
  p_tagline      text DEFAULT NULL,
  p_location     text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_display_name IS NOT NULL AND length(p_display_name) > 60 THEN RAISE EXCEPTION 'display_name_too_long'; END IF;
  IF p_bio          IS NOT NULL AND length(p_bio) > 600 THEN RAISE EXCEPTION 'bio_too_long'; END IF;
  IF p_tagline      IS NOT NULL AND length(p_tagline) > 160 THEN RAISE EXCEPTION 'tagline_too_long'; END IF;
  IF p_location     IS NOT NULL AND length(p_location) > 80 THEN RAISE EXCEPTION 'location_too_long'; END IF;

  UPDATE public.profiles SET
    display_name = COALESCE(NULLIF(trim(p_display_name), ''), display_name),
    bio          = CASE WHEN p_bio IS NOT NULL     THEN NULLIF(trim(p_bio), '')     ELSE bio END,
    tagline      = CASE WHEN p_tagline IS NOT NULL THEN NULLIF(trim(p_tagline), '') ELSE tagline END,
    location     = CASE WHEN p_location IS NOT NULL THEN NULLIF(trim(p_location), '') ELSE location END,
    updated_at   = now()
  WHERE id = auth.uid();
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.update_profile_text(text, text, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.update_profile_text(text, text, text, text) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- update_profile_links — set the external_links jsonb. Whitelisted keys.
-- ════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.update_profile_links(p_links jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed text[] := ARRAY[
    'website','twitter','instagram','youtube','tiktok','github','linkedin','spotify','soundcloud'
  ];
  v_filtered jsonb := '{}'::jsonb;
  v_key text;
  v_val text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF jsonb_typeof(p_links) <> 'object' THEN RAISE EXCEPTION 'links_must_be_object'; END IF;

  FOR v_key, v_val IN SELECT * FROM jsonb_each_text(p_links) LOOP
    IF v_key = ANY(v_allowed) AND v_val IS NOT NULL AND length(v_val) > 0 AND length(v_val) <= 200 THEN
      v_filtered := v_filtered || jsonb_build_object(v_key, v_val);
    END IF;
  END LOOP;

  UPDATE public.profiles SET
    external_links = v_filtered,
    updated_at = now()
  WHERE id = auth.uid();
  RETURN jsonb_build_object('success', true, 'links', v_filtered);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.update_profile_links(jsonb) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.update_profile_links(jsonb) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- pin_unpin_reel — toggle a reel id in/out of pinned_reel_ids (max 3).
-- ════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.toggle_pin_reel(p_reel_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pinned uuid[];
  v_already bool;
  v_owned bool;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  SELECT EXISTS (SELECT 1 FROM public.published_reels WHERE id = p_reel_id AND creator_id = auth.uid())
    INTO v_owned;
  IF NOT v_owned THEN RAISE EXCEPTION 'not_your_reel'; END IF;

  SELECT COALESCE(pinned_reel_ids, '{}') INTO v_pinned
    FROM public.profiles WHERE id = auth.uid();

  v_already := p_reel_id = ANY(v_pinned);
  IF v_already THEN
    UPDATE public.profiles SET
      pinned_reel_ids = array_remove(pinned_reel_ids, p_reel_id),
      updated_at = now()
    WHERE id = auth.uid();
    RETURN jsonb_build_object('pinned', false);
  ELSE
    IF array_length(v_pinned, 1) >= 3 THEN
      RAISE EXCEPTION 'max_pinned_reached';
    END IF;
    UPDATE public.profiles SET
      pinned_reel_ids = array_append(pinned_reel_ids, p_reel_id),
      updated_at = now()
    WHERE id = auth.uid();
    RETURN jsonb_build_object('pinned', true);
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.toggle_pin_reel(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.toggle_pin_reel(uuid) TO authenticated;
