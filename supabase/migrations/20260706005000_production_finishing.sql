-- ─────────────────────────────────────────────────────────────────────────
-- Production Finishing Studio
--
-- Adds the post-stitch "finishing pass" output + job state to movie_projects.
-- The finishing pass takes the stitched master (video_url) and runs a single
-- Replicate-ffmpeg pass that applies a unified house color-grade (LUT), an
-- optional 4K Lanczos upscale, and optional 60fps motion interpolation.
--
--   finished_video_url  permanent signed URL to the finished render. Kept
--                       SEPARATE from video_url (the stitched master) so the
--                       user can always fall back to the ungraded cut.
--   finishing_state     job state JSON:
--                         { status: idle|processing|completed|error,
--                           options: { houseLutId, upscale4k, interpolate60fps },
--                           startedAt, finishedAt, error, sourceUrl, cost, cached }
--
-- New columns inherit the existing movie_projects RLS policies (owner-scoped),
-- so no policy changes are required.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.movie_projects
  add column if not exists finished_video_url text,
  add column if not exists finishing_state    jsonb;

comment on column public.movie_projects.finished_video_url is
  'Finishing Studio output: signed URL to the house-graded / 4K / 60fps render. Distinct from video_url (the stitched master).';

comment on column public.movie_projects.finishing_state is
  'Finishing Studio job state: { status: idle|processing|completed|error, options, startedAt, finishedAt, error, sourceUrl, cost, cached }.';
