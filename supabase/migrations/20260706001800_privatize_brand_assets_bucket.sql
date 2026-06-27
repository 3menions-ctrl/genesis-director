-- =====================================================================
-- Audit remediation (phase 2): privatize the brand-assets bucket
--
-- BLOCKER fixed (full-platform audit 2026-06-27):
--   The brand-assets bucket was public=true with a blanket public-read
--   policy, and BusinessAssets stored org logos / fonts / confidential
--   brand-guideline documents there (paths `${orgId}/${kind}/...`) with
--   getPublicUrl. Any unauthenticated party with the URL could fetch a paid
--   business customer's confidential materials (a public bucket serves ALL
--   objects via the public endpoint regardless of RLS, so the asset could
--   not be gated while the bucket stayed public).
--
-- Fix:
--   * Set the bucket private (public=false).
--   * Drop the blanket public-read policies.
--   * Add an org-scoped SELECT policy so only members of the owning org can
--     read its assets (and therefore mint signed URLs client-side). The
--     uuid cast is CASE-guarded so the shared `intro/intro.mp4` row (read
--     only by service-role edge functions) never trips it.
--   * Existing org-scoped INSERT (producer) / DELETE (admin) policies from
--     20260503034030 are unchanged.
--
-- Companion code changes (same commit):
--   * BusinessAssets.tsx mints short-lived signed URLs on load instead of
--     storing/using public URLs.
--   * seamless-stitcher edge fn fetches intro.mp4 via createSignedUrl
--     (service-role) instead of getPublicUrl. brand-video-download already
--     uses service-role .download(), so it is unaffected.
--
-- NOTE: migration file only. Apply via the safe ordered apply-plan.
-- =====================================================================

UPDATE storage.buckets SET public = false WHERE id = 'brand-assets';

DROP POLICY IF EXISTS "Brand assets readable"          ON storage.objects;
DROP POLICY IF EXISTS "Brand assets publicly readable" ON storage.objects;

DROP POLICY IF EXISTS "Org members read their brand folder" ON storage.objects;
CREATE POLICY "Org members read their brand folder"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'brand-assets'
  AND CASE
        WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          THEN public.has_org_permission(((storage.foldername(name))[1])::uuid, auth.uid(), 'viewer'::org_role)
        ELSE false
      END
);
