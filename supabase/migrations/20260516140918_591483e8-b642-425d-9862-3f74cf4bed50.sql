-- 1. Flip bucket private
UPDATE storage.buckets SET public = false WHERE id = 'user-uploads';

-- 2. Drop any pre-existing policies on this bucket (idempotent reset)
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT polname FROM pg_policy
    WHERE polrelid = 'storage.objects'::regclass
      AND polname LIKE 'user-uploads %'
  LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', pol.polname);
  END LOOP;
END$$;

-- 3. Owner-scoped RLS (folder name MUST equal auth.uid())
CREATE POLICY "user-uploads owner can read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'user-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "user-uploads owner can insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'user-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "user-uploads owner can update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'user-uploads' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'user-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "user-uploads owner can delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'user-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 4. Service-role full access for pipeline edge functions
CREATE POLICY "user-uploads service role full access"
  ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'user-uploads')
  WITH CHECK (bucket_id = 'user-uploads');