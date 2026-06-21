-- ════════════════════════════════════════════════════════════════════════
-- movie_projects.video_engine — accept 'wan' as the free-tier engine.
--
-- The original constraint pre-dated the Wan rollout. Without this, any
-- project_id created with video_engine='wan' (the Studio default since
-- the free-tier wiring) hits a check-constraint violation.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.movie_projects
  DROP CONSTRAINT IF EXISTS movie_projects_video_engine_check;

ALTER TABLE public.movie_projects
  ADD CONSTRAINT movie_projects_video_engine_check CHECK (
    video_engine IS NULL OR video_engine = ANY (
      ARRAY['wan'::text, 'kling'::text, 'seedance'::text, 'veo'::text, 'runway'::text, 'sora'::text]
    )
  );
