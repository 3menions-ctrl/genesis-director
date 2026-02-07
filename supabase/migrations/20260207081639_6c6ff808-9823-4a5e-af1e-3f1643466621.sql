
-- Add country column to profiles table for geographic analytics
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS country text;

-- Add index for analytics queries
CREATE INDEX IF NOT EXISTS idx_profiles_country ON public.profiles(country);
