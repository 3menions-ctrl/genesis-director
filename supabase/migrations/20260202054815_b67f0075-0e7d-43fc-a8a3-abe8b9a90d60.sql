-- Fix the SECURITY DEFINER view issue
-- Drop the view and recreate with SECURITY INVOKER (default, safer behavior)

DROP VIEW IF EXISTS public.video_clips_public;

-- Recreate with explicit SECURITY INVOKER to use the querying user's permissions
CREATE VIEW public.video_clips_public 
WITH (security_invoker = on) AS
SELECT 
  vc.id,
  vc.project_id,
  vc.shot_index,
  vc.video_url,
  vc.status,
  vc.duration_seconds,
  vc.created_at
FROM public.video_clips vc
JOIN public.movie_projects mp ON vc.project_id = mp.id
WHERE mp.is_public = true AND vc.status = 'completed' AND vc.video_url IS NOT NULL;

-- Grant access to the view for anon/authenticated
GRANT SELECT ON public.video_clips_public TO anon, authenticated;