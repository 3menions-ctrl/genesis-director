-- profile_similar_creators: add a cold-start fallback.
--
-- The previous version filtered to profiles sharing at least one interest
-- with the target (and returned an empty array when the target had no
-- interests). A creator whose interests no one else shares — e.g. a brand
-- new account, or one with a niche interest like "music" that the seeded
-- creators don't carry — saw an empty "suggested to follow" rail.
--
-- Now we rank ALL discoverable creators: shared-interest matches first (by
-- overlap), then everyone else by recency. The rail is always populated
-- while still surfacing genuinely-similar creators at the top.

CREATE OR REPLACE FUNCTION public.profile_similar_creators(p_target uuid, p_limit integer DEFAULT 6)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_viewer uuid := auth.uid();
  v_target_interests text[];
  v_rows jsonb;
BEGIN
  SELECT COALESCE(interests, ARRAY[]::text[]) INTO v_target_interests
    FROM public.profiles WHERE id = p_target;

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
    ORDER BY overlap DESC, p.created_at DESC
    LIMIT p_limit
  ) t;

  RETURN v_rows;
END;
$function$;
