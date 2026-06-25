-- Continuity Engine: persist the per-clip continuity audit result.
--
-- hollywood-pipeline's continuity gate scores every clip against its
-- boundary contract and writes the composite here so the continuity
-- report (and best-clip selection) can use it. Additive + nullable so
-- existing rows and older pipeline versions are unaffected.

ALTER TABLE public.video_clips
  ADD COLUMN IF NOT EXISTS continuity_score integer,
  ADD COLUMN IF NOT EXISTS continuity_verdict text,
  ADD COLUMN IF NOT EXISTS boundary_type text;

COMMENT ON COLUMN public.video_clips.continuity_score IS
  'Continuity Engine composite (0-100) for this clip vs its boundary contract.';
COMMENT ON COLUMN public.video_clips.continuity_verdict IS
  'pass | soft-fail | hard-fail — the contract-relative verdict at admit time.';
COMMENT ON COLUMN public.video_clips.boundary_type IS
  'CONTINUOUS | MATCH_CUT | HARD_CUT | TIME_JUMP | LOCATION_CHANGE | INTRO.';
