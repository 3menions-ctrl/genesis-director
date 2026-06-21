-- Backfill movie_projects.video_clips from video_clips table for completed projects
-- This ensures the Library page can render thumbnails/playback without per-card DB roundtrips.
UPDATE public.movie_projects mp
SET video_clips = sub.urls,
    updated_at = now()
FROM (
  SELECT 
    project_id,
    array_agg(video_url ORDER BY shot_index) FILTER (WHERE video_url IS NOT NULL) AS urls
  FROM public.video_clips
  WHERE status = 'completed' AND video_url IS NOT NULL
  GROUP BY project_id
) sub
WHERE mp.id = sub.project_id
  AND mp.status = 'completed'
  AND (mp.video_clips IS NULL OR array_length(mp.video_clips, 1) IS NULL OR array_length(mp.video_clips, 1) = 0)
  AND sub.urls IS NOT NULL
  AND array_length(sub.urls, 1) > 0;

-- Auto-sync trigger: when a video_clip completes, append its URL to the parent project's video_clips array
CREATE OR REPLACE FUNCTION public.sync_video_clips_to_project()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.video_url IS NOT NULL THEN
    UPDATE public.movie_projects mp
    SET video_clips = COALESCE(
      (
        SELECT array_agg(video_url ORDER BY shot_index)
        FROM public.video_clips
        WHERE project_id = NEW.project_id
          AND status = 'completed'
          AND video_url IS NOT NULL
      ),
      mp.video_clips
    ),
    updated_at = now()
    WHERE mp.id = NEW.project_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_video_clips_to_project_trigger ON public.video_clips;
CREATE TRIGGER sync_video_clips_to_project_trigger
  AFTER INSERT OR UPDATE OF status, video_url ON public.video_clips
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_video_clips_to_project();