
-- Fix profiles_public: use security_invoker = true so caller's RLS is enforced,
-- not the view owner's. This eliminates the "Security Definer View" linter warning.
DROP VIEW IF EXISTS public.profiles_public CASCADE;

CREATE VIEW public.profiles_public
WITH (security_invoker = true)
AS
  SELECT
    id,
    display_name,
    avatar_url,
    created_at
  FROM public.profiles;

REVOKE ALL ON public.profiles_public FROM anon, public;
GRANT SELECT ON public.profiles_public TO authenticated;
