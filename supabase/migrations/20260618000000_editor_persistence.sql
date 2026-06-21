-- Editor persistence — per-clip properties (color grade, audio mix) +
-- per-clip effects + project-level master loudness.
--
-- These columns close the gap between in-editor mutations and
-- project-mode renders. Before this migration:
--   • seamless-stitcher.project-mode SELECTed `properties` and
--     `effects` from video_clips — columns that didn't exist, so the
--     reads returned undefined and every project-mode render shipped
--     with the raw mix and zero grading regardless of what the user
--     had set in the Inspector.
--   • movie_projects had no master_loudness column, so the project
--     row's delivery preset had no home and ExportPanel had to keep
--     it in localStorage only.
--
-- After this migration the editor can round-trip every Era 1 surface
-- through the database, and final-assembly → seamless-stitcher project
-- mode honors the same per-clip data the editor displays.

-- ─── video_clips: per-clip post-prod state ───────────────────────────
ALTER TABLE public.video_clips
  ADD COLUMN IF NOT EXISTS properties JSONB,
  ADD COLUMN IF NOT EXISTS effects    JSONB;

COMMENT ON COLUMN public.video_clips.properties IS
  'Per-clip post-production properties — { colorGrade, audioMix, volume, opacity, ... }. Written by the editor when the user touches the Color Grade or Audio Mix Inspector panels. Read by seamless-stitcher to compile per-input FFmpeg filter chains.';

COMMENT ON COLUMN public.video_clips.effects IS
  'Per-clip effect instances (filmstock, glitch, crossover recipes). Authored in the EffectsPanel inspector and consumed by bakeClipEffects in supabase/functions/_shared/effects-bake.ts.';

-- ─── movie_projects: project-level delivery loudness ─────────────────
ALTER TABLE public.movie_projects
  ADD COLUMN IF NOT EXISTS master_loudness TEXT;

ALTER TABLE public.movie_projects
  ADD CONSTRAINT movie_projects_master_loudness_check
  CHECK (master_loudness IS NULL OR master_loudness IN ('off', 'streaming', 'podcast', 'broadcast', 'cinema'));

COMMENT ON COLUMN public.movie_projects.master_loudness IS
  'EBU R128 delivery preset for the final mix — off | streaming | podcast | broadcast | cinema. Applied as a `loudnorm` filter after the audio xfade chain in seamless-stitcher so the whole edit ships at the right LUFS.';
