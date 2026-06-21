-- Add is_public column to movie_projects for sharing videos
ALTER TABLE public.movie_projects 
ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false;

-- Create policy to allow anyone to view public videos
CREATE POLICY "Anyone can view public videos" 
ON public.movie_projects 
FOR SELECT 
USING (is_public = true);

-- Create index for faster public video queries
CREATE INDEX IF NOT EXISTS idx_movie_projects_is_public ON public.movie_projects(is_public) WHERE is_public = true;