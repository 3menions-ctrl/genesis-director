-- Tighten + enrich the people search side of `search_everything`.
--
-- 1. SECURITY: stop matching against profiles.email. The previous
--    impl let any signed-in user search by email substring, which
--    leaks identity. Drop email from the WHERE and SELECT.
-- 2. ENRICHMENT: search bio + tagline + location (added in
--    20260614000000_profile_richness.sql) so people are findable by
--    what they do, not just their display name. Return tagline and
--    location so the People grid can render them.
--
-- The function signature stays the same; only the people sub-query
-- changes. Callers don't need updates.

CREATE OR REPLACE FUNCTION public.search_everything(
  p_query text,
  p_limit int DEFAULT 12
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_like        text;
  v_reels       jsonb;
  v_creators    jsonb;
  v_universes   jsonb;
  v_crews       jsonb;
BEGIN
  v_like := '%' || coalesce(p_query, '') || '%';

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'title', r.title,
    'thumbnail_url', r.thumbnail_url,
    'play_count', r.play_count,
    'world_slug', r.world_slug,
    'creator_id', r.creator_id
  )), '[]'::jsonb)
  INTO v_reels
  FROM (
    SELECT * FROM public.published_reels
    WHERE NOT is_taken_down
      AND (title ILIKE v_like OR director_notes ILIKE v_like)
    ORDER BY play_count DESC NULLS LAST
    LIMIT p_limit
  ) r;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'display_name', p.display_name,
    'full_name', p.full_name,
    'avatar_url', p.avatar_url,
    'tagline', p.tagline,
    'location', p.location,
    'bio', p.bio,
    'follower_count', (SELECT count(*) FROM public.follows WHERE followed_id = p.id),
    'reel_count', (SELECT count(*) FROM public.published_reels WHERE creator_id = p.id AND NOT is_taken_down)
  )), '[]'::jsonb)
  INTO v_creators
  FROM (
    SELECT * FROM public.profiles
    WHERE display_name ILIKE v_like
       OR full_name   ILIKE v_like
       OR bio         ILIKE v_like
       OR tagline     ILIKE v_like
       OR location    ILIKE v_like
    ORDER BY updated_at DESC NULLS LAST
    LIMIT p_limit
  ) p;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', u.id, 'name', u.name, 'description', u.description
  )), '[]'::jsonb)
  INTO v_universes
  FROM (
    SELECT * FROM public.universes
    WHERE name ILIKE v_like OR description ILIKE v_like
    ORDER BY created_at DESC NULLS LAST
    LIMIT p_limit
  ) u;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', c.id, 'name', c.name, 'description', c.description
  )), '[]'::jsonb)
  INTO v_crews
  FROM (
    SELECT * FROM public.crews
    WHERE name ILIKE v_like OR description ILIKE v_like
    ORDER BY created_at DESC NULLS LAST
    LIMIT p_limit
  ) c;

  RETURN jsonb_build_object(
    'reels',     v_reels,
    'creators',  v_creators,
    'universes', v_universes,
    'crews',     v_crews
  );
END;
$$;
