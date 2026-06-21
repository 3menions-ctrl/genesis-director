-- Drop the authenticated-only policy for public videos
DROP POLICY IF EXISTS "Authenticated users can view public videos" ON public.movie_projects;

-- Create a new policy that allows EVERYONE (anon + authenticated) to view public completed videos
CREATE POLICY "Anyone can view public videos"
ON public.movie_projects
FOR SELECT
USING (is_public = true AND status = 'completed');