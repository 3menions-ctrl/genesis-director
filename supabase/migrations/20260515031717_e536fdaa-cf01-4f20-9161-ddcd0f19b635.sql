ALTER TABLE public.movie_projects
  DROP CONSTRAINT IF EXISTS movie_projects_video_engine_check;

ALTER TABLE public.movie_projects
  ADD CONSTRAINT movie_projects_video_engine_check
  CHECK (
    video_engine IS NULL
    OR video_engine = ANY (ARRAY['kling'::text, 'seedance'::text, 'veo'::text, 'runway'::text, 'sora'::text])
  );