-- Drop existing permissive policies on movie_projects
DROP POLICY IF EXISTS "Anyone can view movie_projects" ON public.movie_projects;
DROP POLICY IF EXISTS "Anyone can create movie_projects" ON public.movie_projects;
DROP POLICY IF EXISTS "Anyone can update movie_projects" ON public.movie_projects;
DROP POLICY IF EXISTS "Anyone can delete movie_projects" ON public.movie_projects;

-- Create proper user-scoped RLS policies
CREATE POLICY "Users can view own projects"
ON public.movie_projects
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own projects"
ON public.movie_projects
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects"
ON public.movie_projects
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects"
ON public.movie_projects
FOR DELETE
USING (auth.uid() = user_id);