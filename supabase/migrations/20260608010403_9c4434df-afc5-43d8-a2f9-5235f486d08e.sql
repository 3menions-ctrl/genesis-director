
DROP POLICY IF EXISTS "Users can delete scene images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update scene images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete temp frames" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update temp frames" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete videos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update videos" ON storage.objects;

DROP POLICY IF EXISTS "temp_frames_user_delete" ON storage.objects;
CREATE POLICY "temp_frames_user_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'temp-frames' AND (storage.foldername(name))[1] = (auth.uid())::text);

DROP POLICY IF EXISTS "temp_frames_user_update" ON storage.objects;
CREATE POLICY "temp_frames_user_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'temp-frames' AND (storage.foldername(name))[1] = (auth.uid())::text);

DROP POLICY IF EXISTS "videos_user_delete" ON storage.objects;
CREATE POLICY "videos_user_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'videos' AND (storage.foldername(name))[1] = (auth.uid())::text);

DROP POLICY IF EXISTS "videos_user_update" ON storage.objects;
CREATE POLICY "videos_user_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'videos' AND (storage.foldername(name))[1] = (auth.uid())::text);

DROP POLICY IF EXISTS "final_videos_user_select" ON storage.objects;
CREATE POLICY "final_videos_user_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'final-videos' AND (storage.foldername(name))[1] = (auth.uid())::text);

DROP POLICY IF EXISTS "video_clips_user_select" ON storage.objects;
CREATE POLICY "video_clips_user_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'video-clips' AND (storage.foldername(name))[1] = (auth.uid())::text);

DROP POLICY IF EXISTS "videos_user_select" ON storage.objects;
CREATE POLICY "videos_user_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'videos' AND (storage.foldername(name))[1] = (auth.uid())::text);

DROP POLICY IF EXISTS "Users can read own consumed intent" ON public.onboarding_intents;
CREATE POLICY "Users can read own consumed intent" ON public.onboarding_intents
  FOR SELECT TO authenticated
  USING (consumed_by_user_id = auth.uid());

DROP POLICY IF EXISTS "Authenticated users access own channels" ON realtime.messages;
CREATE POLICY "Authenticated users access own channels" ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    realtime.topic() LIKE 'user:' || (auth.uid())::text || '%'
    OR realtime.topic() LIKE (auth.uid())::text || '%'
  );

DROP POLICY IF EXISTS "Authenticated users publish own channels" ON realtime.messages;
CREATE POLICY "Authenticated users publish own channels" ON realtime.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    realtime.topic() LIKE 'user:' || (auth.uid())::text || '%'
    OR realtime.topic() LIKE (auth.uid())::text || '%'
  );
