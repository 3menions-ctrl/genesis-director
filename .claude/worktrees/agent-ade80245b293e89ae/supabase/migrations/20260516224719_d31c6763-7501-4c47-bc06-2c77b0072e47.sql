
-- 1. Flip bucket to private. Public URLs cease to resolve immediately.
UPDATE storage.buckets
SET public = false
WHERE id = 'character-references';

-- 2. Drop every existing policy on storage.objects that targets this bucket.
--    We rebuild a clean, owner-scoped set below. The historical migrations
--    layered ~10 overlapping policies (some permissive, some scoped); the
--    safest path is to wipe and redeclare.
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND (
        qual ILIKE '%character-references%'
        OR with_check ILIKE '%character-references%'
        OR policyname ILIKE '%character%reference%'
        OR policyname ILIKE '%character_refs%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- 3. Owner SELECT — first path segment must equal auth.uid().
CREATE POLICY "char_refs_owner_read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'character-references'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Owner INSERT — must upload into own folder.
CREATE POLICY "char_refs_owner_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'character-references'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 5. Owner UPDATE — own folder only.
CREATE POLICY "char_refs_owner_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'character-references'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'character-references'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 6. Owner DELETE — own folder only.
CREATE POLICY "char_refs_owner_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'character-references'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 7. Admin override (read) — for moderation / support tooling.
CREATE POLICY "char_refs_admin_read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'character-references'
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- 8. Admin override (delete) — for moderation takedowns.
CREATE POLICY "char_refs_admin_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'character-references'
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- 9. Explicit anon deny — defense in depth (even though no policy grants it).
CREATE POLICY "char_refs_deny_anon"
ON storage.objects AS RESTRICTIVE
FOR ALL
TO anon
USING (bucket_id <> 'character-references')
WITH CHECK (bucket_id <> 'character-references');
