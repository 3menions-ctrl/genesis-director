-- Persist the chosen video engine on each project so we can audit/debug
-- which model actually ran the generation.
ALTER TABLE public.movie_projects
  ADD COLUMN IF NOT EXISTS video_engine text;

-- Backfill: every existing project ran on Kling V3 (the only live engine so far)
UPDATE public.movie_projects
SET video_engine = 'kling'
WHERE video_engine IS NULL;

-- Constrain to known engines going forward
ALTER TABLE public.movie_projects
  DROP CONSTRAINT IF EXISTS movie_projects_video_engine_check;
ALTER TABLE public.movie_projects
  ADD CONSTRAINT movie_projects_video_engine_check
  CHECK (video_engine IS NULL OR video_engine IN ('kling','seedance','veo'));

-- Index for admin filtering / cost reports per engine
CREATE INDEX IF NOT EXISTS idx_movie_projects_video_engine
  ON public.movie_projects (video_engine);