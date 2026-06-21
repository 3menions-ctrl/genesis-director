-- ════════════════════════════════════════════════════════════════════════
-- lobby_feed() — promote to SECURITY DEFINER so the JOIN onto profiles
-- can read creator names/avatars for anon visitors.
--
-- The function only exposes display_name + avatar_url + a small public
-- snapshot (play_count, like_count). Those columns are intentionally
-- public via the "Public profile read" policy on profiles, but the
-- "Deny anonymous access to profiles" RESTRICTIVE policy still blocks
-- direct anon SELECT — so the function must own the read.
-- ════════════════════════════════════════════════════════════════════════

ALTER FUNCTION public.lobby_feed(text, timestamptz, int) SECURITY DEFINER;
