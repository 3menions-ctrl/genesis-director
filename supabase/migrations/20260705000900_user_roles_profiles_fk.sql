-- Fix: admin Roles (/admin/roles) and Team (/admin/team) pages 400 with
--   PGRST200: no FK relationship between 'user_roles' and 'profiles'
--
-- Those pages embed `profiles(email, display_name, …)` off user_roles, but
-- user_roles.user_id only had a FK to auth.users — PostgREST can't embed
-- public.profiles through that. Every table that embeds profiles in this
-- codebase has a FK to profiles; add the matching one here. profiles.id is a
-- 1:1 mirror of auth.users.id, so this is additive (verified: 0 orphan rows).
ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
