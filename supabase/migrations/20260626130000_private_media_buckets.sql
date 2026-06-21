-- ════════════════════════════════════════════════════════════════════════
-- Privatize photo-edits + support-screenshots buckets.
--
-- Both were created public=true with a blanket "anyone can read"
-- storage.objects SELECT policy (USING bucket_id = '<bucket>'), so a
-- public bucket bypasses RLS on read entirely — ANY visitor could
-- enumerate/read every user's edited photos and every bug-report
-- screenshot (which may contain PII / account state). Same class of leak
-- as the already-fixed user-uploads bucket.
--
-- Fix: flip both buckets to public=false and drop the blanket-read
-- policies, leaving owner-scoped (and admin) read. Consumers were
-- switched to createSignedUrl() so display/permalinks keep working:
--   • supabase/functions/edit-photo/index.ts  (service-role signs result)
--   • src/pages/Help.tsx                       (user signs own screenshot)
--
-- Idempotent / re-runnable.
-- ════════════════════════════════════════════════════════════════════════

-- ── photo-edits ─────────────────────────────────────────────────────────
UPDATE storage.buckets SET public = false WHERE id = 'photo-edits';

-- Drop the two blanket-read policies (the owner-scoped "Users can view
-- own photos" SELECT policy is kept).
DROP POLICY IF EXISTS "Public can view photos" ON storage.objects;
DROP POLICY IF EXISTS "scoped_read_photo_edits" ON storage.objects;

-- ── support-screenshots ─────────────────────────────────────────────────
UPDATE storage.buckets SET public = false WHERE id = 'support-screenshots';

-- Drop the blanket-read policy (admin "manage all" + owner upload/delete
-- are kept; we add an owner-scoped read below so the submitter can sign
-- their own screenshot URL).
DROP POLICY IF EXISTS "Support screenshots: readable" ON storage.objects;

DROP POLICY IF EXISTS "Support screenshots: owner reads own" ON storage.objects;
CREATE POLICY "Support screenshots: owner reads own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'support-screenshots'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
