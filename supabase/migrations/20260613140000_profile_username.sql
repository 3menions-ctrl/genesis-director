-- ════════════════════════════════════════════════════════════════════════
-- profiles.username — public vanity handle, UNIQUE, lowercase.
--
-- Used by the canonical share URL:  /c/@<username>
-- Falls back to /c/<uuid> for users who haven't claimed a handle.
--
-- Constraints:
--   • 3..30 chars
--   • a–z, 0–9, underscore
--   • lowercase enforced via citext-style fold in the policy + check
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text;

-- Lowercase + length + character-class check.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'profiles_username_format'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_username_format
      CHECK (
        username IS NULL
        OR (username ~ '^[a-z0-9_]{3,30}$')
      );
  END IF;
END$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_username
  ON public.profiles (username)
  WHERE username IS NOT NULL;

-- Lookup helper. SECURITY DEFINER so anon visitors can resolve
-- @handle → uuid for /c/@handle without leaking the full profiles table.
CREATE OR REPLACE FUNCTION public.resolve_username(p_username text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE username = lower(p_username) LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.resolve_username(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.resolve_username(text) TO anon, authenticated;

-- Extend the find_friends_directory view to surface the handle so
-- cards on /find-friends can link to the canonical /c/@handle URL.
DROP VIEW IF EXISTS public.find_friends_directory CASCADE;
CREATE VIEW public.find_friends_directory
WITH (security_invoker = false)
AS
SELECT
  id, username, display_name, avatar_url, cover_url, bio, tagline,
  location, country, interests, profile_view_count, created_at
FROM public.profiles
WHERE is_discoverable = true
  AND deactivated_at IS NULL
  AND display_name IS NOT NULL;
GRANT SELECT ON public.find_friends_directory TO anon, authenticated;
COMMENT ON VIEW public.find_friends_directory IS
  'Opt-in friend-discovery directory with vanity username for canonical URLs.';

-- Likewise extend profiles_public — the visitor-facing read view.
DROP VIEW IF EXISTS public.profiles_public CASCADE;
CREATE VIEW public.profiles_public
WITH (security_invoker = false)
AS
SELECT
  id, username, display_name, avatar_url, cover_url, bio, tagline,
  location, country, interests, profile_view_count
FROM public.profiles
WHERE deactivated_at IS NULL;
GRANT SELECT ON public.profiles_public TO anon, authenticated;
COMMENT ON VIEW public.profiles_public IS
  'Public-safe profile fields. Includes vanity username for canonical URLs.';
