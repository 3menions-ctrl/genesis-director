
-- Replace the overly permissive public SELECT policy on movie_projects
-- The current "Anyone can view public videos" policy exposes ALL columns including
-- pipeline_state, pipeline_context_snapshot, generation_checkpoint, pro_features_data
-- which contain internal API details and processing logic.

-- Drop the old policy
DROP POLICY IF EXISTS "Anyone can view public videos" ON public.movie_projects;

-- Create a new policy that only allows public access for authenticated users
-- Public viewing should go through the movie_projects_public view instead
CREATE POLICY "Authenticated users can view public videos"
  ON public.movie_projects FOR SELECT
  TO authenticated
  USING (is_public = true);

-- Add RESTRICTIVE anon deny to movie_projects
CREATE POLICY "Deny anonymous access to movie_projects"
  ON public.movie_projects AS RESTRICTIVE
  FOR ALL TO anon
  USING (false)
  WITH CHECK (false);
