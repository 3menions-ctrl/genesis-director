-- Add new columns to movie_projects for specialized video modes
ALTER TABLE public.movie_projects 
ADD COLUMN IF NOT EXISTS mode text DEFAULT 'text-to-video',
ADD COLUMN IF NOT EXISTS source_video_url text,
ADD COLUMN IF NOT EXISTS source_image_url text,
ADD COLUMN IF NOT EXISTS avatar_voice_id text,
ADD COLUMN IF NOT EXISTS pipeline_state jsonb DEFAULT '{}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.movie_projects.mode IS 'Video generation mode: text-to-video, avatar, motion-transfer, video-to-video';
COMMENT ON COLUMN public.movie_projects.source_video_url IS 'Source video URL for motion-transfer and video-to-video modes';
COMMENT ON COLUMN public.movie_projects.source_image_url IS 'Source/reference image URL for avatar and image-based modes';
COMMENT ON COLUMN public.movie_projects.avatar_voice_id IS 'Voice ID for avatar mode TTS';
COMMENT ON COLUMN public.movie_projects.pipeline_state IS 'JSON state tracking for specialized pipelines';