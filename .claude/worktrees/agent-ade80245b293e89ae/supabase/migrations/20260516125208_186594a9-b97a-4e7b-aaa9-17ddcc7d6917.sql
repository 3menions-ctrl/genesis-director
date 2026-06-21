ALTER TABLE public.training_videos
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.movie_projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS video_engine text,
  ADD COLUMN IF NOT EXISTS clip_count integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS aspect_ratio text DEFAULT '16:9',
  ADD COLUMN IF NOT EXISTS manifest_url text,
  ADD COLUMN IF NOT EXISTS stitched_video_url text;

CREATE INDEX IF NOT EXISTS idx_training_videos_project_id ON public.training_videos(project_id);
CREATE INDEX IF NOT EXISTS idx_training_videos_user_created ON public.training_videos(user_id, created_at DESC);