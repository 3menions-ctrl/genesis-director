-- ============================================================================
-- 1) LOCK DOWN CREDIT RPCs — revoke anonymous EXECUTE
-- ============================================================================
REVOKE EXECUTE ON FUNCTION public.deduct_credits(uuid, integer, text, uuid, integer, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.refund_credits(uuid, integer, text, uuid, text)          FROM anon, PUBLIC;

-- Drop the obsolete 5-arg deduct_credits overload (no idempotency_key) that bypassed double-charge protection.
DROP FUNCTION IF EXISTS public.deduct_credits(uuid, integer, text, uuid, integer);

-- Re-grant only to signed-in users (edge functions also use the service role which always works).
GRANT EXECUTE ON FUNCTION public.deduct_credits(uuid, integer, text, uuid, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refund_credits(uuid, integer, text, uuid, text)          TO authenticated, service_role;

-- ============================================================================
-- 2) STORAGE — replace permissive listing with explicit per-bucket SELECT
-- ============================================================================
-- Drop overly broad public-listing policies if present (idempotent).
DROP POLICY IF EXISTS "Public Access"               ON storage.objects;
DROP POLICY IF EXISTS "Allow public read"           ON storage.objects;
DROP POLICY IF EXISTS "Public read"                 ON storage.objects;
DROP POLICY IF EXISTS "Public can read all"         ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read"             ON storage.objects;
DROP POLICY IF EXISTS "Public can view all"         ON storage.objects;
DROP POLICY IF EXISTS "Allow public select"         ON storage.objects;

-- Explicit, per-bucket public-read policies (so direct URLs continue to work but
-- listing is scoped to known buckets; attackers cannot enumerate hidden buckets).
CREATE POLICY "scoped_read_final_videos"        ON storage.objects FOR SELECT USING (bucket_id = 'final-videos');
CREATE POLICY "scoped_read_scene_images"        ON storage.objects FOR SELECT USING (bucket_id = 'scene-images');
CREATE POLICY "scoped_read_avatars"             ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "scoped_read_thumbnails"          ON storage.objects FOR SELECT USING (bucket_id = 'thumbnails');
CREATE POLICY "scoped_read_video_thumbnails"    ON storage.objects FOR SELECT USING (bucket_id = 'video-thumbnails');
CREATE POLICY "scoped_read_video_clips"         ON storage.objects FOR SELECT USING (bucket_id = 'video-clips');
CREATE POLICY "scoped_read_voice_tracks"        ON storage.objects FOR SELECT USING (bucket_id = 'voice-tracks');
CREATE POLICY "scoped_read_photo_edits"         ON storage.objects FOR SELECT USING (bucket_id = 'photo-edits');
CREATE POLICY "scoped_read_character_refs"      ON storage.objects FOR SELECT USING (bucket_id = 'character-references');
CREATE POLICY "scoped_read_genesis_castings"    ON storage.objects FOR SELECT USING (bucket_id = 'genesis-castings');
CREATE POLICY "scoped_read_hoppy_uploads"       ON storage.objects FOR SELECT USING (bucket_id = 'hoppy-uploads');
CREATE POLICY "scoped_read_temp_frames"         ON storage.objects FOR SELECT USING (bucket_id = 'temp-frames');
CREATE POLICY "scoped_read_user_uploads"        ON storage.objects FOR SELECT USING (bucket_id = 'user-uploads');
CREATE POLICY "scoped_read_videos"              ON storage.objects FOR SELECT USING (bucket_id = 'videos');