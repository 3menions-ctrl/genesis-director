-- ─────────────────────────────────────────────────────────────────────────
-- Universal post lip-sync
--
-- Lets a dialogue clip rendered on ANY engine get perfect lip-sync as a post
-- pass (TTS of the shot's dialogue → LatentSync over the clip), decoupling
-- lip-sync from the generator (today only Kling has native lip-sync).
--
--   source_video_url  the ORIGINAL clip, preserved on first sync so re-syncs
--                     always run on the un-synced source (and revert is possible).
--   lipsync_url       the lip-synced result. video_url is also pointed at it so
--                     a re-stitch incorporates the synced clip into the film.
--
-- Additive + nullable — existing clips unaffected.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.video_clips
  add column if not exists source_video_url text,
  add column if not exists lipsync_url       text;

comment on column public.video_clips.source_video_url is
  'Original clip URL preserved before the first lip-sync pass (revert/re-sync source).';
comment on column public.video_clips.lipsync_url is
  'Lip-synced version of this clip (LatentSync). When set, video_url also points here so re-stitch uses it.';
