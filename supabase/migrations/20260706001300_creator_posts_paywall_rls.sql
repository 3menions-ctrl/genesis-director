-- =====================================================================
-- Audit remediation (phase 2): close creator_posts paywall bypass
--
-- BLOCKER fixed (full-platform audit 2026-06-27):
--   "Creator posts: public read" allowed anon + authenticated to SELECT
--   EVERY column of creator_posts (including body + media_url) for any
--   non-taken-down row. The min_monthly_credits paywall was enforced ONLY
--   inside list_creator_posts() (which NULLs locked body/media_url), so a
--   direct PostgREST query
--       creator_posts?select=body,media_url&min_monthly_credits=gt.0
--   returned patron-gated content for free. RLS filters rows, not columns,
--   so the fix is to make gated rows unreadable via direct table access;
--   the metadata-with-lock feed is served exclusively by the SECURITY
--   DEFINER list_creator_posts() RPC (which bypasses RLS).
--
-- Verified: no client/edge code reads creator_posts directly or calls
-- list_creator_posts yet (pre-launch feature), and patron_subscriptions
-- self-insert was removed in 20260706000000, so the entitlement EXISTS
-- check below cannot be forged.
--
-- NOTE: migration file only. Apply via the safe ordered apply-plan.
-- =====================================================================

DROP POLICY IF EXISTS "Creator posts: public read"  ON public.creator_posts;
DROP POLICY IF EXISTS "Creator posts: entitled read" ON public.creator_posts;

-- A viewer may read a post row only when they are entitled to its full
-- contents: it is free, they are the creator, or they hold an active
-- patron subscription at >= the post's required tier. Free posts stay
-- publicly readable (anon included). Gated rows are invisible to direct
-- reads; use list_creator_posts() for the locked-metadata feed.
CREATE POLICY "Creator posts: entitled read"
  ON public.creator_posts FOR SELECT TO anon, authenticated
  USING (
    NOT is_taken_down
    AND (
      min_monthly_credits = 0
      OR creator_id = auth.uid()
      OR EXISTS (
        SELECT 1
          FROM public.patron_subscriptions ps
         WHERE ps.creator_id = creator_posts.creator_id
           AND ps.patron_id  = auth.uid()
           AND ps.cancelled_at IS NULL
           AND ps.monthly_credits >= creator_posts.min_monthly_credits
      )
    )
  );

-- (The "Creator posts: creator manages" FOR ALL policy is unchanged.)
