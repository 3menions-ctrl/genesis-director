-- ════════════════════════════════════════════════════════════════════════
-- profile_mutual_follows(p_target uuid)
--
-- Returns a tiny social-proof payload for the visitor:
--   { mutual_total, sample: [{id, display_name, avatar_url}, ...] }
--
-- "Mutual" = users that BOTH the signed-in viewer AND the target follow.
-- For anon visitors (auth.uid() IS NULL) we return an empty payload so
-- the front-end can render nothing without an error.
--
-- SECURITY DEFINER so the join across `follows` + `profiles` is permitted
-- past the RLS perimeter (the row data we expose — display_name +
-- avatar_url — is already publicly readable via profiles_public).
-- ════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.profile_mutual_follows(p_target uuid, p_sample int DEFAULT 3)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer uuid := auth.uid();
  v_sample jsonb;
  v_total int;
BEGIN
  IF v_viewer IS NULL OR v_viewer = p_target THEN
    RETURN jsonb_build_object('mutual_total', 0, 'sample', jsonb_build_array());
  END IF;

  SELECT COALESCE(jsonb_agg(
           jsonb_build_object(
             'id', p.id,
             'display_name', p.display_name,
             'avatar_url', p.avatar_url
           )
           ORDER BY p.display_name
         ), jsonb_build_array())
    INTO v_sample
  FROM (
    SELECT followed_id
      FROM public.follows
     WHERE follower_id = v_viewer
    INTERSECT
    SELECT follower_id
      FROM public.follows
     WHERE followed_id = p_target
  ) m
  JOIN public.profiles p ON p.id = m.followed_id
  LIMIT p_sample;

  SELECT count(*) INTO v_total
  FROM (
    SELECT followed_id
      FROM public.follows
     WHERE follower_id = v_viewer
    INTERSECT
    SELECT follower_id
      FROM public.follows
     WHERE followed_id = p_target
  ) m;

  RETURN jsonb_build_object('mutual_total', v_total, 'sample', v_sample);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.profile_mutual_follows(uuid, int) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.profile_mutual_follows(uuid, int) TO anon, authenticated;
