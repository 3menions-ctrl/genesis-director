-- M17 (partial) / audit #23: enforce blocks in the public feed.
-- lobby_feed filtered only is_taken_down, so a blocked creator's reels still
-- appeared in the viewer's feed despite the block promise. Exclude reels from
-- anyone in a block relationship with the viewer (either direction). Anonymous
-- viewers (auth.uid() IS NULL) have no blocks, so the filter is a no-op for them.
CREATE OR REPLACE FUNCTION public.lobby_feed(p_world_slug text DEFAULT NULL::text, p_cursor timestamp with time zone DEFAULT NULL::timestamp with time zone, p_limit integer DEFAULT 24)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      AND NOT EXISTS (
        SELECT 1 FROM public.user_blocks ub
        WHERE (ub.blocker_id = auth.uid() AND ub.blocked_id = r.creator_id)
           OR (ub.blocker_id = r.creator_id AND ub.blocked_id = auth.uid())
      )
    ORDER BY r.created_at DESC
    LIMIT GREATEST(1, LEAST(p_limit, 60))
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(rows.*) ORDER BY rows.created_at DESC), '[]'::jsonb)
  FROM rows;
$function$;
