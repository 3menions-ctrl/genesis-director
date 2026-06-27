-- ============================================================================
-- Audit remediation — Phase 3 (DB medium-severity)
-- ============================================================================
-- Every statement in this file is written to be IDEMPOTENT and safe to apply
-- onto a live prod schema that may carry out-of-band drift:
--   * policies use DROP POLICY IF EXISTS + CREATE
--   * function EXECUTE grants are re-asserted via a pg_proc-driven DO loop so
--     missing functions / extra overloads never abort the migration, and
--     bare REVOKE of a not-held privilege is a no-op NOTICE (not an error)
--   * column-level table grants are inherently idempotent
--
-- Scope (open items only — the following were already fixed and are NOT touched
-- here: get_pipeline_context ownership 20260706001400, record_user_media
-- 20260704002500, creator_posts paywall 20260706001300, fn_notify_safe
-- 20260706001100, add_credits PUBLIC revoke, ledger_user_credit_balance
-- 20260704001100, organizations self-insert/update guards 20260704001100 /
-- 20260706001500).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. security_events — INSERT integrity (re-assert hardened policy)
-- ----------------------------------------------------------------------------
-- The cross-user forgery (attacker-chosen user_id) was closed by
-- 20260705000600, and `severity` is already constrained to ('info','warn',
-- 'critical') by a CHECK on the base table (20260220042441). We re-assert the
-- hardened WITH CHECK here so the fix is guaranteed present even under prod
-- policy drift. A signed-in user may only write rows attributed to themselves;
-- SECURITY DEFINER loggers and the service role keep full insert access.
DROP POLICY IF EXISTS "Security events: system insert only" ON public.security_events;

CREATE POLICY "Security events: system insert only" ON public.security_events
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role'
    OR user_id = auth.uid()
  );


-- ----------------------------------------------------------------------------
-- 2. Backend-only SECURITY DEFINER functions — make them truly backend-only
-- ----------------------------------------------------------------------------
-- These functions either mint/forge user-facing state (gamification) or write
-- pipeline state keyed by project id with NO ownership guard (IDOR). None has a
-- legitimate client caller in src/ (verified by grep) — the only live callers
-- are edge functions running with the service-role key, which bypasses GRANTs.
-- We therefore revoke EXECUTE from PUBLIC/anon/authenticated and re-grant only
-- to service_role.
--
-- Why a loop: CREATE OR REPLACE in earlier migrations reset some of these back
-- to the default PUBLIC EXECUTE (e.g. add_user_xp / update_user_streak recreated
-- in 20260516142227 after the 20260429224707 revoke). The loop re-asserts the
-- locked-down state across every overload regardless of out-of-band drift.
--
-- Gamification (self-callable XP/streak mint -> leaderboard inflation):
--   add_user_xp, update_user_streak                  (edge: gamification-event)
-- Pipeline state writers/readers (no ownership guard, IDOR / cross-tenant):
--   update_generation_checkpoint, persist_pipeline_context,
--   get_generation_checkpoint, get_project_voice_map,
--   get_or_assign_character_voice,
--   acquire_generation_lock, release_generation_lock
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'add_user_xp',
        'update_user_streak',
        'update_generation_checkpoint',
        'persist_pipeline_context',
        'get_generation_checkpoint',
        'get_project_voice_map',
        'get_or_assign_character_voice',
        'acquire_generation_lock',
        'release_generation_lock'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;


-- ----------------------------------------------------------------------------
-- 3. user_gamification — stop client forgery of xp / level / streak
-- ----------------------------------------------------------------------------
-- The "Users can update their own gamification" RLS policy (USING auth.uid() =
-- user_id) has no column restriction, so a user could directly UPDATE their own
-- row and set arbitrary xp_total / level / current_streak (leaderboard
-- domination). RLS cannot restrict columns, so we use column-level privileges:
-- revoke table-wide UPDATE and re-grant UPDATE only on the two privacy columns
-- the client legitimately writes (AccountSettings: hide_from_leaderboard,
-- tracking_opted_out). All XP/level/streak changes flow exclusively through the
-- SECURITY DEFINER functions above, which run as owner and bypass these grants.
-- The leaderboard_visible sync trigger is SECURITY DEFINER and unaffected.
REVOKE UPDATE ON public.user_gamification FROM anon, authenticated;
GRANT UPDATE (hide_from_leaderboard, tracking_opted_out)
  ON public.user_gamification TO authenticated;
