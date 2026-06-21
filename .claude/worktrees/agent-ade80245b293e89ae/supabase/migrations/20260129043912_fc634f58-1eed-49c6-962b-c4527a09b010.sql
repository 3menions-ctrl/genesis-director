-- Add RLS policy to allow viewing video clips from public projects (for Gallery)
CREATE POLICY "Anyone can view clips from public projects"
ON public.video_clips
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.movie_projects mp
    WHERE mp.id = video_clips.project_id
    AND mp.is_public = true
  )
);

-- Mark admin's completed projects as public for Gallery display
UPDATE public.movie_projects
SET is_public = true
WHERE user_id = 'd600868d-651a-46f6-a621-a727b240ac7c'
AND status = 'completed'
AND video_url IS NOT NULL;