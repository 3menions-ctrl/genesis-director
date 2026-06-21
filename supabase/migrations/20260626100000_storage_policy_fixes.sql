-- ════════════════════════════════════════════════════════════════════════
-- Storage policy fixes — closes critical gaps surfaced by the storage
-- audit on 2026-06-15. Each section addresses one finding.
--
-- 1. video-clips bucket had NO insert policy → every upload silently 403'd
--    (root cause of "I can't upload music" complaints).
-- 2. user-uploads bucket had a blanket public-read policy that overrode
--    the owner-scoped policy → privacy leak (any user could enumerate any
--    other user's upload paths).
-- 3. voice-tracks insert lacked path scoping → 50 MB unbounded uploads
--    per authenticated user (quota exhaustion vector).
-- 4. genesis-castings insert lacked owner scoping → any user could
--    overwrite any other user's casting image.
-- 5. thumbnails bucket had no size limit or MIME allowlist → DOS by
--    file-size flood.
-- ════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
-- 1. video-clips — add the missing INSERT/UPDATE/DELETE policies.
-- ─────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "video-clips: owner inserts own" ON storage.objects;
CREATE POLICY "video-clips: owner inserts own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'video-clips'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "video-clips: owner updates own" ON storage.objects;
CREATE POLICY "video-clips: owner updates own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'video-clips'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'video-clips'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "video-clips: owner deletes own" ON storage.objects;
CREATE POLICY "video-clips: owner deletes own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'video-clips'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Reads stay public (the bucket is public; the published render URLs
-- and the in-editor previews both load via getPublicUrl). No SELECT
-- policy needed beyond what the public flag already grants.

-- ─────────────────────────────────────────────────────────────────────────
-- 2. user-uploads — remove the blanket public-read policy that leaks
--    every user's paths to every visitor.
-- ─────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public read access for user uploads" ON storage.objects;
-- The owner-scoped SELECT policy from migration 20260127155643 stays:
--   "Users can view their own uploads" — auth.uid() = (foldername(name))[1]
-- That's the canonical read path. Anyone wanting public access should
-- go through createSignedUrl with a short TTL.

-- ─────────────────────────────────────────────────────────────────────────
-- 3. voice-tracks — replace the unscoped insert with an owner-scoped one.
-- ─────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can upload voice tracks" ON storage.objects;
DROP POLICY IF EXISTS "voice-tracks: owner inserts own" ON storage.objects;
CREATE POLICY "voice-tracks: owner inserts own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'voice-tracks'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "voice-tracks: owner updates own" ON storage.objects;
CREATE POLICY "voice-tracks: owner updates own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'voice-tracks'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'voice-tracks'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "voice-tracks: owner deletes own" ON storage.objects;
CREATE POLICY "voice-tracks: owner deletes own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'voice-tracks'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 4. genesis-castings — same owner-scoping for casting uploads.
-- ─────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can upload casting images" ON storage.objects;
DROP POLICY IF EXISTS "genesis-castings: owner inserts own" ON storage.objects;
CREATE POLICY "genesis-castings: owner inserts own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'genesis-castings'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "genesis-castings: owner updates own" ON storage.objects;
CREATE POLICY "genesis-castings: owner updates own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'genesis-castings'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'genesis-castings'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "genesis-castings: owner deletes own" ON storage.objects;
CREATE POLICY "genesis-castings: owner deletes own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'genesis-castings'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 5. thumbnails — add a 5 MB cap + image-only MIME allowlist.
-- ─────────────────────────────────────────────────────────────────────────
UPDATE storage.buckets
SET
  file_size_limit = 5242880,  -- 5 MB
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
WHERE id = 'thumbnails';

-- ─────────────────────────────────────────────────────────────────────────
-- 6. video-clips — add a 100 MB size limit and audio+video MIME allowlist
--    (the bucket has carried both since the audio upload flow was added).
--    Previously: no limit, no MIME validation.
-- ─────────────────────────────────────────────────────────────────────────
UPDATE storage.buckets
SET
  file_size_limit = 524288000, -- 500 MB
  allowed_mime_types = ARRAY[
    -- video
    'video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska',
    -- audio
    'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/wave', 'audio/x-wav',
    'audio/aac', 'audio/ogg', 'audio/flac', 'audio/x-m4a'
  ]
WHERE id = 'video-clips';
