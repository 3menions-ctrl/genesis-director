-- =====================================================
-- FIX: Narration/dialogue should be OFF by default
-- This ensures new projects don't automatically include voice/narration
-- Users must explicitly opt-in to dialogue/narration
-- =====================================================

ALTER TABLE public.movie_projects 
ALTER COLUMN include_narration SET DEFAULT false;

-- Update any existing projects that might have true incorrectly set
-- (Only if they don't have voice audio already generated)
UPDATE public.movie_projects 
SET include_narration = false 
WHERE include_narration = true 
AND voice_audio_url IS NULL;