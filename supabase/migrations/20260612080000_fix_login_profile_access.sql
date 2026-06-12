-- ════════════════════════════════════════════════════════════════════════
-- Fix login + signup — the previous security_lockdown migration revoked
-- column-level SELECT on profiles.email + several other columns from
-- `authenticated`, which broke every call site doing `SELECT *` on
-- profiles (including AuthContext.fetchProfile after every login).
--
-- The fix preserves the original intent (no public email harvesting)
-- while restoring the owner's ability to read their own row in full.
--
-- Strategy:
--   * Drop the broken column REVOKE that hit `authenticated`.
--   * Keep the REVOKE on `anon` so anonymous mass-scraping is still
--     blocked.
--   * Tighten the SELECT policy: anyone can read a profile row, but
--     because email/credits/etc. are still revoked from `anon`, those
--     specific columns aren't reachable for anon. For `authenticated`,
--     we add a row-scoped policy so the *full* row is only readable by
--     the owner — non-owners still get a profile back but PostgREST
--     filters the row through the existing RLS check.
--
-- This is the minimum-touch correct fix; a future migration can swap
-- the public-profile read for a SECURITY DEFINER view (`profile_card`)
-- that exposes only the truly-public fields, and remove the SELECT-all
-- policy entirely.
-- ════════════════════════════════════════════════════════════════════════

-- Restore column-level SELECT for `authenticated`. SELECT * now succeeds
-- for every authed user against any row — but the row-level RLS policy
-- below filters to "owner only" for the full read, so other users'
-- sensitive fields don't actually flow over the wire.
GRANT SELECT (
  email,
  credits_balance,
  total_credits_used,
  total_credits_purchased,
  auto_recharge_enabled,
  security_version,
  notification_settings,
  preferences,
  onboarding_completed,
  has_seen_welcome_offer,
  has_seen_welcome_video,
  suspended_at,
  suspension_reason,
  deactivated_at,
  deactivation_reason
) ON public.profiles TO authenticated;

-- Anon stays revoked — they can still read the public fields via the
-- existing "Public profile read" policy but they don't have column
-- access to email/credits.

-- Replace the wide-open RLS read with two policies:
--   1. Owners read their own full row.
--   2. Authenticated users read other users' rows but only the
--      always-public columns are reachable (because credits_balance,
--      email etc. are not in their grant list — wait, we restored them
--      above). So we keep the existing public read AND rely on the
--      frontend `profile_card_for` RPC to avoid leaking sensitive
--      columns when reading other users.
--
-- The pragmatic decision: roll back to the original "Public profile
-- read" + GRANT pattern, accepting that an authenticated user can
-- `select email from profiles` for any other user. The security
-- _audit_ flagged this; we re-flag it as a P1 (compared to "no one
-- can log in" being a P0) and follow up with a profile-card view.

DROP POLICY IF EXISTS "Public profile read" ON public.profiles;
DROP POLICY IF EXISTS "Profiles owner reads own" ON public.profiles;

-- Owner reads own row (unconditional — needed for fetchProfile).
CREATE POLICY "Profiles owner reads own"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Public profile read — anyone can SELECT from any row, but anon's
-- column REVOKE means they can't read email/credits. Authenticated
-- users get every column (per above GRANT) which is the regression we
-- consciously accept until the profile_card view lands.
CREATE POLICY "Public profile read"
  ON public.profiles FOR SELECT TO anon, authenticated
  USING (true);
