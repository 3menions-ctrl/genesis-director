-- Add continuity_manifest column to video_clips for persistence
-- This stores the AI-extracted continuity data (spatial, lighting, props, emotional, action, etc.)
-- that must be passed to the next clip for seamless transitions

ALTER TABLE public.video_clips
ADD COLUMN IF NOT EXISTS continuity_manifest jsonb DEFAULT '{}'::jsonb;

-- Add comment explaining the column
COMMENT ON COLUMN public.video_clips.continuity_manifest IS 'AI-extracted continuity data from last frame including spatial positioning, lighting, props, emotional state, action momentum - passed to next clip for seamless transitions';