-- Add admin SELECT policies to all tables for full visibility

-- movie_projects: Allow admins to view all projects
CREATE POLICY "Admins can view all projects"
ON public.movie_projects
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.role = 'admin'::app_role
));

-- profiles: Allow admins to view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.role = 'admin'::app_role
));

-- characters: Allow admins to view all characters
CREATE POLICY "Admins can view all characters"
ON public.characters
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.role = 'admin'::app_role
));

-- stitch_jobs: Allow admins to view all stitch jobs
CREATE POLICY "Admins can view all stitch jobs"
ON public.stitch_jobs
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.role = 'admin'::app_role
));

-- project_templates: Allow admins to view all templates
CREATE POLICY "Admins can view all templates"
ON public.project_templates
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.role = 'admin'::app_role
));

-- script_templates: Allow admins to view all script templates
CREATE POLICY "Admins can view all script templates"
ON public.script_templates
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.role = 'admin'::app_role
));

-- universes: Allow admins to view all universes
CREATE POLICY "Admins can view all universes"
ON public.universes
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.role = 'admin'::app_role
));

-- universe_members: Allow admins to view all members
CREATE POLICY "Admins can view all universe members"
ON public.universe_members
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.role = 'admin'::app_role
));

-- universe_activity: Allow admins to view all activity
CREATE POLICY "Admins can view all universe activity"
ON public.universe_activity
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.role = 'admin'::app_role
));

-- universe_continuity: Allow admins to view all continuity
CREATE POLICY "Admins can view all universe continuity"
ON public.universe_continuity
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.role = 'admin'::app_role
));

-- universe_invitations: Allow admins to view all invitations
CREATE POLICY "Admins can view all universe invitations"
ON public.universe_invitations
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.role = 'admin'::app_role
));

-- production_credit_phases: Allow admins to view all phases
CREATE POLICY "Admins can view all credit phases"
ON public.production_credit_phases
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.role = 'admin'::app_role
));

-- project_characters: Allow admins to view all project characters
CREATE POLICY "Admins can view all project characters"
ON public.project_characters
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.role = 'admin'::app_role
));

-- character_loans: Allow admins to view all loans
CREATE POLICY "Admins can view all character loans"
ON public.character_loans
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.role = 'admin'::app_role
));

-- video_likes: Allow admins to view all likes
CREATE POLICY "Admins can view all video likes"
ON public.video_likes
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.role = 'admin'::app_role
));