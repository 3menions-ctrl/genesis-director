-- ════════════════════════════════════════════════════════════════════════
-- Find Friends — opt-in discoverability for personal profiles.
--
-- profiles.is_discoverable defaults to FALSE — users explicitly choose
-- whether their profile appears in the public friend-discovery directory.
-- The find_friends_directory view filters to opt-in rows only, so anon
-- + authenticated visitors of the /find-friends surface never see anyone
-- who hasn't consented.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_discoverable boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_discoverable
  ON public.profiles(is_discoverable)
  WHERE is_discoverable = true;

DROP VIEW IF EXISTS public.find_friends_directory CASCADE;

CREATE VIEW public.find_friends_directory
WITH (security_invoker = false)
AS
SELECT
  id,
  display_name,
  avatar_url,
  cover_url,
  bio,
  tagline,
  location,
  country,
  interests,
  profile_view_count,
  created_at
FROM public.profiles
WHERE is_discoverable = true
  AND deactivated_at IS NULL
  AND display_name IS NOT NULL;

GRANT SELECT ON public.find_friends_directory TO anon, authenticated;

COMMENT ON VIEW public.find_friends_directory IS
  'Opt-in friend-discovery directory. Only profiles with is_discoverable=true appear.';
