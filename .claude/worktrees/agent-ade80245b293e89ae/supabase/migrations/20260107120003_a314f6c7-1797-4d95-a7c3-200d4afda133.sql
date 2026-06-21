-- =====================================================
-- FIX STORAGE RLS POLICIES - Restrict to authenticated users who own resources
-- =====================================================

-- Drop existing overly permissive policies on storage.objects
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Public can view thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Public can view character-references" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload character-references" ON storage.objects;
DROP POLICY IF EXISTS "Public can view scene-images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload scene-images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view voice-tracks" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload voice-tracks" ON storage.objects;
DROP POLICY IF EXISTS "Public can view temp-frames" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload temp-frames" ON storage.objects;
DROP POLICY IF EXISTS "Public can view video-clips" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload video-clips" ON storage.objects;
DROP POLICY IF EXISTS "Public can view final-videos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload final-videos" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated insert thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete thumbnails" ON storage.objects;

-- =====================================================
-- THUMBNAILS BUCKET
-- =====================================================
-- Public read (thumbnails are meant to be viewable)
CREATE POLICY "thumbnails_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'thumbnails');

-- Users can upload to their own folder (user_id/*)
CREATE POLICY "thumbnails_user_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'thumbnails' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can update their own files
CREATE POLICY "thumbnails_user_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'thumbnails'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own files
CREATE POLICY "thumbnails_user_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'thumbnails'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- =====================================================
-- CHARACTER-REFERENCES BUCKET
-- =====================================================
CREATE POLICY "character_refs_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'character-references');

CREATE POLICY "character_refs_user_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'character-references'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "character_refs_user_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'character-references'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "character_refs_user_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'character-references'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- =====================================================
-- SCENE-IMAGES BUCKET
-- =====================================================
CREATE POLICY "scene_images_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'scene-images');

CREATE POLICY "scene_images_user_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'scene-images'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "scene_images_user_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'scene-images'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "scene_images_user_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'scene-images'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- =====================================================
-- VOICE-TRACKS BUCKET
-- =====================================================
CREATE POLICY "voice_tracks_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'voice-tracks');

CREATE POLICY "voice_tracks_user_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'voice-tracks'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "voice_tracks_user_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'voice-tracks'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "voice_tracks_user_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'voice-tracks'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- =====================================================
-- TEMP-FRAMES BUCKET
-- =====================================================
CREATE POLICY "temp_frames_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'temp-frames');

CREATE POLICY "temp_frames_user_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'temp-frames'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "temp_frames_user_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'temp-frames'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "temp_frames_user_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'temp-frames'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- =====================================================
-- VIDEO-CLIPS BUCKET
-- =====================================================
CREATE POLICY "video_clips_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'video-clips');

CREATE POLICY "video_clips_user_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'video-clips'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "video_clips_user_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'video-clips'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "video_clips_user_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'video-clips'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- =====================================================
-- FINAL-VIDEOS BUCKET
-- =====================================================
CREATE POLICY "final_videos_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'final-videos');

CREATE POLICY "final_videos_user_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'final-videos'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "final_videos_user_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'final-videos'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "final_videos_user_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'final-videos'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- =====================================================
-- SERVICE ROLE BYPASS - Allow edge functions to manage files
-- =====================================================
-- Note: Service role bypasses RLS automatically, no policy needed

-- =====================================================
-- ADD MISSING DATABASE INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_video_clips_project_shot ON video_clips(project_id, shot_index);
CREATE INDEX IF NOT EXISTS idx_movie_projects_user_status ON movie_projects(user_id, status);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user ON credit_transactions(user_id, created_at DESC);

-- =====================================================
-- ADD QUALITY SCORE COLUMN TO VIDEO_CLIPS
-- =====================================================
ALTER TABLE video_clips ADD COLUMN IF NOT EXISTS quality_score INTEGER;
ALTER TABLE video_clips ADD COLUMN IF NOT EXISTS debug_attempts INTEGER DEFAULT 0;
ALTER TABLE video_clips ADD COLUMN IF NOT EXISTS corrective_prompts TEXT[];

-- =====================================================
-- SET DEFAULT FOR quality_tier
-- =====================================================
ALTER TABLE movie_projects ALTER COLUMN quality_tier SET DEFAULT 'standard';

-- =====================================================
-- ADD updated_at TRIGGER TO video_clips
-- =====================================================
DROP TRIGGER IF EXISTS update_video_clips_updated_at ON video_clips;
CREATE TRIGGER update_video_clips_updated_at
  BEFORE UPDATE ON video_clips
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();