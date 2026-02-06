-- Add column to track if user has seen the welcome video
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS has_seen_welcome_video boolean DEFAULT false;

-- Comment for clarity
COMMENT ON COLUMN public.profiles.has_seen_welcome_video IS 'Tracks whether user has viewed the studio storytelling journey welcome video';