-- Add missing fields for quality tier and pro features tracking
ALTER TABLE public.movie_projects 
ADD COLUMN IF NOT EXISTS quality_tier text DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS music_url text,
ADD COLUMN IF NOT EXISTS pro_features_data jsonb DEFAULT '{}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.movie_projects.quality_tier IS 'Quality tier: standard (25 credits) or professional (50 credits)';
COMMENT ON COLUMN public.movie_projects.music_url IS 'URL to generated background music track';
COMMENT ON COLUMN public.movie_projects.pro_features_data IS 'Professional tier features data: musicSync, colorGrading, sfx, visualDebugger stats';