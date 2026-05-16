-- Flip voice-tracks bucket private
UPDATE storage.buckets SET public = false WHERE id = 'voice-tracks';

-- Drop any existing policies on voice-tracks (clean slate)
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (qual LIKE '%voice-tracks%' OR with_check LIKE '%voice-tracks%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- Owner-scoped RLS: first path segment must equal auth.uid()
CREATE POLICY "voice_tracks_owner_read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'voice-tracks' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "voice_tracks_owner_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'voice-tracks' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "voice_tracks_owner_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'voice-tracks' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "voice_tracks_owner_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'voice-tracks' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Admin moderation
CREATE POLICY "voice_tracks_admin_read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'voice-tracks' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "voice_tracks_admin_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'voice-tracks' AND public.has_role(auth.uid(), 'admin'));

-- Deny anon
CREATE POLICY "voice_tracks_deny_anon"
ON storage.objects AS RESTRICTIVE FOR ALL TO anon
USING (bucket_id <> 'voice-tracks')
WITH CHECK (bucket_id <> 'voice-tracks');