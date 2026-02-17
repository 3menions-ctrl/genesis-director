-- Allow project owners to always view their own projects
-- This was missing after the security hardening migration dropped the permissive "Anyone can view" policy
CREATE POLICY "Owners can view their own projects"
  ON public.movie_projects FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);