-- Remove the blanket deny-all policy that blocks anonymous SELECT on movie_projects
DROP POLICY IF EXISTS "Deny anonymous access to movie_projects" ON public.movie_projects;