
-- Add RESTRICTIVE deny-all policies for anonymous users on tables that are missing them
-- (movie_projects, profiles, credit_transactions already have these)

-- Characters: deny anonymous access
CREATE POLICY "Deny anonymous access to characters"
ON public.characters
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Universes: deny anonymous access
CREATE POLICY "Deny anonymous access to universes"
ON public.universes
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Script templates: deny anonymous access
CREATE POLICY "Deny anonymous access to script_templates"
ON public.script_templates
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Project characters: deny anonymous access
CREATE POLICY "Deny anonymous access to project_characters"
ON public.project_characters
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);
