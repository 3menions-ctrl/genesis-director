-- Add aspect_ratio column to movie_projects table
ALTER TABLE public.movie_projects 
ADD COLUMN IF NOT EXISTS aspect_ratio text DEFAULT '16:9';