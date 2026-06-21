-- ════════════════════════════════════════════════════════════════════════
-- Patron revenue is private — only the creator themselves can see how
-- many credits / how many patrons their pledges are bringing in.
-- profile_overview previously surfaced `current_credits` (the rolled-up
-- monthly total of all active pledges) to every viewer; this strips it
-- out for non-owners and removes the patron-count surfaces too.
-- The goal `label` and `target_credits` still render publicly so visitors
-- understand what the creator is funding toward — they just can't see
-- how far along they are.
-- ════════════════════════════════════════════════════════════════════════

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

  SELECT to_jsonb(r) INTO v_featured
    FROM public.published_reels r
   WHERE r.id = (SELECT featured_reel_id FROM public.profiles WHERE id = p_user_id)
     AND NOT r.is_taken_down;

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.position), jsonb_build_array())
    INTO v_tiers
    FROM (
      SELECT id, position, name, monthly_credits, perks, accent_hsl
        FROM public.patron_tiers
       WHERE creator_id = p_user_id
       ORDER BY position
    ) t;

  -- Funding goal + computed progress. The goal label and target are
  -- public (so visitors see what the creator is raising for), but the
  -- live progress total is OWNER-ONLY. Non-owners see only the target.
  SELECT jsonb_build_object(
    'id', g.id, 'label', g.label, 'target_credits', g.target_credits
  ) INTO v_goal
    FROM public.patron_goals g
   WHERE g.creator_id = p_user_id AND g.archived_at IS NULL
   LIMIT 1;
  IF v_goal IS NOT NULL AND v_is_owner THEN
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

REVOKE EXECUTE ON FUNCTION public.profile_overview(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.profile_overview(uuid) TO anon, authenticated;
