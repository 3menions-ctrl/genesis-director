-- Add video_clips column to store array of video URLs
ALTER TABLE public.movie_projects 
ADD COLUMN IF NOT EXISTS video_clips text[] DEFAULT NULL;