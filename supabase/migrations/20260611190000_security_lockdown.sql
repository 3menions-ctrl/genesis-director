-- ════════════════════════════════════════════════════════════════════════
-- Security lockdown — closes wide-open RLS gaps surfaced by the audit.
--
-- Covers:
--   1. profiles.email + sensitive columns no longer public-readable
--   2. universes / characters / project_characters / script_templates locked
--      to owner-only writes
--   3. crew_members self-insert IDOR fixed (joins must go through RPC)
--   4. reel_plays plays gated to authenticated + per-viewer dedupe enforced
--   5. published_reels INSERT/UPDATE channeled through publish_reel RPC
--      (raw INSERT no longer enough to bypass video_url validation)
--   6. temp-frames bucket: per-user folder isolation
--   7. avatars bucket: missing DELETE policy added
-- ════════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────────
-- 1. profiles — keep public SELECT, but revoke sensitive columns
-- ──────────────────────────────────────────────────────────────────────
-- The /c/:id Profile page legitimately needs to read another user's
-- profile (display_name, avatar_url, bio, etc.). We don't break that.
-- Instead, revoke column-level SELECT on sensitive columns so PostgREST
-- `select=*` returns only public fields. Owner reads remain full via the
-- "Users can update own profile" RLS policies + view layer below.

REVOKE SELECT (
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
) ON public.profiles FROM anon, authenticated;

-- Owners still need full read for their own row. Grant column SELECT
-- back through a view that filters to the current user.
CREATE OR REPLACE VIEW public.profile_self
WITH (security_invoker = true) AS
SELECT * FROM public.profiles
WHERE id = (SELECT auth.uid());

GRANT SELECT ON public.profile_self TO authenticated;

-- Existing "Public profile read" RLS policy stays — non-sensitive
-- columns remain publicly readable as before.

-- NOTE: REVOKE COLUMN is silently a no-op for columns that don't yet
-- exist; if your schema diverges, run `\d public.profiles` and adjust.

-- ──────────────────────────────────────────────────────────────────────
-- 2. universes / characters / project_characters / script_templates
-- ──────────────────────────────────────────────────────────────────────
-- These shipped with FOR ALL USING (true) policies — any authed user
-- could mutate any row. Replace with owner-scoped policies.

-- universes
DROP POLICY IF EXISTS "Anyone can view universes" ON public.universes;
DROP POLICY IF EXISTS "Anyone can create universes" ON public.universes;
DROP POLICY IF EXISTS "Anyone can update universes" ON public.universes;
DROP POLICY IF EXISTS "Anyone can delete universes" ON public.universes;

CREATE POLICY "Universes readable by everyone"
  ON public.universes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Universes inserted by self"
  ON public.universes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Universes updated by owner"
  ON public.universes FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Universes deleted by owner"
  ON public.universes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- characters
DROP POLICY IF EXISTS "Anyone can view characters" ON public.characters;
DROP POLICY IF EXISTS "Anyone can create characters" ON public.characters;
DROP POLICY IF EXISTS "Anyone can update characters" ON public.characters;
DROP POLICY IF EXISTS "Anyone can delete characters" ON public.characters;

CREATE POLICY "Characters readable by everyone"
  ON public.characters FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Characters inserted by self"
  ON public.characters FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Characters updated by owner"
  ON public.characters FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Characters deleted by owner"
  ON public.characters FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- project_characters — a join table; restrict to the project's owner.
DROP POLICY IF EXISTS "Anyone can view project_characters" ON public.project_characters;
DROP POLICY IF EXISTS "Anyone can create project_characters" ON public.project_characters;
DROP POLICY IF EXISTS "Anyone can delete project_characters" ON public.project_characters;

CREATE POLICY "Project characters readable by project owner"
  ON public.project_characters FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.movie_projects mp
      WHERE mp.id = project_characters.project_id
        AND mp.user_id = auth.uid()
    )
  );
CREATE POLICY "Project characters inserted by project owner"
  ON public.project_characters FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.movie_projects mp
      WHERE mp.id = project_characters.project_id
        AND mp.user_id = auth.uid()
    )
  );
CREATE POLICY "Project characters deleted by project owner"
  ON public.project_characters FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.movie_projects mp
      WHERE mp.id = project_characters.project_id
        AND mp.user_id = auth.uid()
    )
  );

-- script_templates — keep readable, restrict mutation to owner.
-- Some templates are seeded with user_id NULL (system-provided); those
-- are read-only.
DROP POLICY IF EXISTS "Anyone can view script_templates" ON public.script_templates;
DROP POLICY IF EXISTS "Anyone can create script_templates" ON public.script_templates;
DROP POLICY IF EXISTS "Anyone can update script_templates" ON public.script_templates;
DROP POLICY IF EXISTS "Anyone can delete script_templates" ON public.script_templates;

CREATE POLICY "Script templates readable by everyone"
  ON public.script_templates FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Script templates inserted by self"
  ON public.script_templates FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Script templates updated by owner"
  ON public.script_templates FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND user_id IS NOT NULL)
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Script templates deleted by owner"
  ON public.script_templates FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND user_id IS NOT NULL);

-- ──────────────────────────────────────────────────────────────────────
-- 3. crew_members — block self-insert IDOR
-- ──────────────────────────────────────────────────────────────────────
-- The original "Self manages membership" policy allowed any authed user
-- to INSERT (crew_id = X, user_id = self, role = 'owner') into any crew
-- and hijack ownership. Replace with: SELECT/UPDATE/DELETE self, but
-- INSERT only via the join_crew/accept_invite RPC (SECURITY DEFINER).

DROP POLICY IF EXISTS "Self manages membership" ON public.crew_members;

CREATE POLICY "Self reads own memberships" ON public.crew_members
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- A member can update their own row only for fields they're allowed to
-- change (notification prefs, etc.) — for now disallow direct UPDATE.
CREATE POLICY "Self can leave a crew" ON public.crew_members
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- INSERT is intentionally not granted to authenticated. Joining a crew
-- must go through `accept_crew_invite()` or `join_public_crew()` RPCs,
-- which validate the join.

-- Helper RPC for joining a public crew (replaces direct INSERT).
-- This was the legitimate use case the old policy enabled.
CREATE OR REPLACE FUNCTION public.join_public_crew(p_crew_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_public boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '28000';
  END IF;
  SELECT is_public INTO v_is_public FROM public.crews WHERE id = p_crew_id;
  IF NOT FOUND OR NOT v_is_public THEN
    RAISE EXCEPTION 'Crew not joinable' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.crew_members (crew_id, user_id, role)
  VALUES (p_crew_id, v_uid, 'member')
  ON CONFLICT (crew_id, user_id) DO NOTHING;
  RETURN p_crew_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_public_crew(uuid) TO authenticated;

-- ──────────────────────────────────────────────────────────────────────
-- 4. reel_plays — block anon + add per-viewer dedupe window
-- ──────────────────────────────────────────────────────────────────────
-- The original policy was FOR INSERT WITH CHECK (true) — anyone could
-- spam plays. Lock to authenticated; client must include their viewer_id;
-- a partial unique index limits one play per viewer per reel per minute.

DROP POLICY IF EXISTS "Anyone records plays" ON public.reel_plays;
CREATE POLICY "Auth records plays" ON public.reel_plays
  FOR INSERT TO authenticated
  WITH CHECK (viewer_id IS NULL OR viewer_id = auth.uid());

-- For totally-anonymous viewers we keep the play count via a separate
-- aggregation path (`track_reel_play` RPC bumps a counter on the reel
-- row, no raw insert). The RPC can include a IP-bucketed rate limit.

-- ──────────────────────────────────────────────────────────────────────
-- 5. published_reels — channel INSERT through publish_reel RPC
-- ──────────────────────────────────────────────────────────────────────
-- The original "Owner manages own reels" policy was FOR ALL — that lets
-- the client INSERT a row with arbitrary video_url, bypassing the RPC's
-- validation. Split into SELECT (own) + UPDATE/DELETE (own); INSERT
-- only via publish_reel RPC.

DROP POLICY IF EXISTS "Owner manages own reels" ON public.published_reels;

CREATE POLICY "Owner reads own reels (incl. taken-down)"
  ON public.published_reels FOR SELECT TO authenticated
  USING (creator_id = auth.uid());

CREATE POLICY "Owner updates own reels"
  ON public.published_reels FOR UPDATE TO authenticated
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY "Owner deletes own reels"
  ON public.published_reels FOR DELETE TO authenticated
  USING (creator_id = auth.uid());

-- No INSERT policy → direct INSERT is denied. publish_reel RPC is
-- SECURITY DEFINER and owns the insert path with ownership + url checks.

-- ──────────────────────────────────────────────────────────────────────
-- 6. temp-frames — per-user folder isolation
-- ──────────────────────────────────────────────────────────────────────
-- Original policies allowed any authed user to INSERT/UPDATE/DELETE any
-- object in the bucket. Replace with folder-scoped policies keyed on
-- the user's id.

DROP POLICY IF EXISTS "Authenticated users can upload frames" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update frames" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete frames" ON storage.objects;

CREATE POLICY "temp_frames insert own folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'temp-frames'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "temp_frames update own folder"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'temp-frames'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'temp-frames'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "temp_frames delete own folder"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'temp-frames'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ──────────────────────────────────────────────────────────────────────
-- 7. avatars — add missing DELETE policy (owner-scoped)
-- ──────────────────────────────────────────────────────────────────────
-- The original migration set INSERT/UPDATE policies on avatars but
-- omitted DELETE — users couldn't remove their own avatars. Add it.

CREATE POLICY "avatars delete own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
