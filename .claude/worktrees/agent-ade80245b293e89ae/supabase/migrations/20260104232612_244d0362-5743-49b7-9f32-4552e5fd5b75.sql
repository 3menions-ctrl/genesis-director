-- Add include_narration column to movie_projects table
ALTER TABLE public.movie_projects 
ADD COLUMN include_narration BOOLEAN NOT NULL DEFAULT true;