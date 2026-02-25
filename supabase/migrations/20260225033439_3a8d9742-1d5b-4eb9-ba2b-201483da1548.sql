
-- Fix profiles_public view: use security_invoker = false so it can read all profiles
-- This is safe because the view only exposes id, display_name, avatar_url (no PII)
DROP VIEW IF EXISTS public.profiles_public CASCADE;

CREATE VIEW public.profiles_public
WITH (security_invoker = false)
AS
SELECT 
  id,
  display_name,
  avatar_url
FROM public.profiles;

-- Allow both authenticated and anon users to see public profiles
GRANT SELECT ON public.profiles_public TO authenticated, anon;

COMMENT ON VIEW public.profiles_public IS 'Public-safe profile data for social features. Only exposes id, display_name, avatar_url.';
