-- =====================================================================
-- Audit remediation (phase 2): fix TO-less ("Service role ...") storage
-- write policies that actually applied to PUBLIC (anon + authenticated).
--
-- BLOCKER fixed (full-platform audit 2026-06-27):
--   The original bucket migrations created write policies with NO `TO`
--   clause, so despite the "Service role can ..." names they applied to
--   PUBLIC. service_role bypasses RLS entirely and never needed them, so
--   their only effect was to let anon/authenticated write to public,
--   product-origin buckets (arbitrary unlimited-size content hosting,
--   defacement of shared avatar/thumbnail catalogs):
--     - final-videos   : "Service role can upload final videos"     (INSERT, TO-less)   [20260106120200]
--     - video-thumbnails: "Service role can manage video thumbnails" (ALL,    TO-less)   [20260117043437]
--     - avatars        : "Service role can upload avatars"          (INSERT, TO-less)   [20260130021839]
--                        "Service role can update avatars"          (UPDATE, TO-less)   [20260130021839]
--   Later storage migrations (20260429224630 / 20260501222531 /
--   20260608010403) hardened READs and added owner-folder UPDATE/DELETE for
--   other buckets, but never dropped these write policies.
--
-- Fix: drop the TO-less write policies and replace with owner-folder
-- policies scoped TO authenticated, matching the established pattern
--   (storage.foldername(name))[1] = (auth.uid())::text
-- which fits every real client upload path:
--   avatars          ${user.id}/<ts>.<ext>                 (AccountSettings)
--   video-thumbnails ${userId}/${projectId}/<id>.thumb.jpg (editor/publish)
--   final-videos     ${userId}/...                         (edge signed URL;
--                    service_role bypasses RLS, so direct writes still work)
--
-- Also add file_size_limit to the two buckets the audit flagged as
-- unbounded (final-videos, avatars) as defense-in-depth.
--
-- NOTE: migration file only. Apply via the safe ordered apply-plan.
-- =====================================================================

-- ---- final-videos -----------------------------------------------------
DROP POLICY IF EXISTS "Service role can upload final videos" ON storage.objects;

DROP POLICY IF EXISTS "final_videos_user_insert" ON storage.objects;
CREATE POLICY "final_videos_user_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'final-videos' AND (storage.foldername(name))[1] = (auth.uid())::text);

-- ---- video-thumbnails -------------------------------------------------
DROP POLICY IF EXISTS "Service role can manage video thumbnails" ON storage.objects;

DROP POLICY IF EXISTS "video_thumbnails_user_insert" ON storage.objects;
CREATE POLICY "video_thumbnails_user_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'video-thumbnails' AND (storage.foldername(name))[1] = (auth.uid())::text);

DROP POLICY IF EXISTS "video_thumbnails_user_update" ON storage.objects;
CREATE POLICY "video_thumbnails_user_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'video-thumbnails' AND (storage.foldername(name))[1] = (auth.uid())::text)
  WITH CHECK (bucket_id = 'video-thumbnails' AND (storage.foldername(name))[1] = (auth.uid())::text);

DROP POLICY IF EXISTS "video_thumbnails_user_delete" ON storage.objects;
CREATE POLICY "video_thumbnails_user_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'video-thumbnails' AND (storage.foldername(name))[1] = (auth.uid())::text);

-- ---- avatars ----------------------------------------------------------
DROP POLICY IF EXISTS "Service role can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Service role can update avatars" ON storage.objects;

DROP POLICY IF EXISTS "avatars_user_insert" ON storage.objects;
CREATE POLICY "avatars_user_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (auth.uid())::text);

DROP POLICY IF EXISTS "avatars_user_update" ON storage.objects;
CREATE POLICY "avatars_user_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (auth.uid())::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (auth.uid())::text);

-- ---- bucket-level size caps (defense-in-depth) ------------------------
-- 2 GiB for stitched final videos, 10 MiB for avatars (client caps at 5 MiB).
UPDATE storage.buckets SET file_size_limit = 2147483648 WHERE id = 'final-videos' AND file_size_limit IS NULL;
UPDATE storage.buckets SET file_size_limit = 10485760   WHERE id = 'avatars'      AND file_size_limit IS NULL;
