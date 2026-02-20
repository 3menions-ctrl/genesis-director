
-- Create a SECURITY DEFINER RPC for admin to fetch all projects
-- This bypasses any RLS edge cases and is the correct pattern for admin data access
CREATE OR REPLACE FUNCTION public.admin_list_projects(
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0,
  p_status text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_sort_by text DEFAULT 'updated_at',
  p_sort_order text DEFAULT 'desc'
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  title text,
  status text,
  genre text,
  mode text,
  is_public boolean,
  video_url text,
  thumbnail_url text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  likes_count integer,
  aspect_ratio text,
  user_email text,
  user_name text,
  clips_total bigint,
  clips_completed bigint,
  clips_failed bigint,
  clips_pending bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  RETURN QUERY
  SELECT
    mp.id,
    mp.user_id,
    mp.title::text,
    mp.status::text,
    mp.genre::text,
    mp.mode::text,
    mp.is_public,
    mp.video_url::text,
    mp.thumbnail_url::text,
    mp.created_at,
    mp.updated_at,
    COALESCE(p.email, 'Unknown')::text AS user_email,
    COALESCE(p.display_name, 'Unknown')::text AS user_name,
    COALESCE(clip_stats.total, 0) AS clips_total,
    COALESCE(clip_stats.completed, 0) AS clips_completed,
    COALESCE(clip_stats.failed, 0) AS clips_failed,
    COALESCE(clip_stats.pending, 0) AS clips_pending
  FROM movie_projects mp
  LEFT JOIN profiles p ON p.id = mp.user_id
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE vc.status = 'completed') AS completed,
      COUNT(*) FILTER (WHERE vc.status = 'failed') AS failed,
      COUNT(*) FILTER (WHERE vc.status NOT IN ('completed', 'failed')) AS pending
    FROM video_clips vc
    WHERE vc.project_id = mp.id
  ) clip_stats ON true
  WHERE
    (p_status IS NULL OR mp.status = p_status)
    AND (
      p_search IS NULL
      OR mp.title ILIKE '%' || p_search || '%'
      OR p.email ILIKE '%' || p_search || '%'
      OR p.display_name ILIKE '%' || p_search || '%'
      OR mp.id::text ILIKE '%' || p_search || '%'
    )
  ORDER BY
    CASE WHEN p_sort_by = 'updated_at' AND p_sort_order = 'desc' THEN mp.updated_at END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'updated_at' AND p_sort_order = 'asc' THEN mp.updated_at END ASC NULLS LAST,
    CASE WHEN p_sort_by = 'created_at' AND p_sort_order = 'desc' THEN mp.created_at END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'created_at' AND p_sort_order = 'asc' THEN mp.created_at END ASC NULLS LAST,
    CASE WHEN p_sort_by = 'title' AND p_sort_order = 'desc' THEN mp.title END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'title' AND p_sort_order = 'asc' THEN mp.title END ASC NULLS LAST,
    mp.updated_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;
