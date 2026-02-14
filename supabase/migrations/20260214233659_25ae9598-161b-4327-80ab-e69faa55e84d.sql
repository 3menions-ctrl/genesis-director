
-- SECURITY: Tighten storage policies that allow anonymous uploads/deletes
-- These buckets currently allow ANY unauthenticated user to upload or delete files

-- Drop overly permissive policies on thumbnails bucket
DROP POLICY IF EXISTS "Anyone can upload thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update thumbnails" ON storage.objects;

-- Drop overly permissive policies on character-references bucket  
DROP POLICY IF EXISTS "Anyone can upload character references" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update character references" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete character references" ON storage.objects;

-- Drop overly permissive policies on temp-frames bucket
DROP POLICY IF EXISTS "Authenticated users can upload frames" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update frames" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete frames" ON storage.objects;

-- Drop overly permissive policy on scene-images
DROP POLICY IF EXISTS "Authenticated users can upload scene images" ON storage.objects;

-- Recreate with proper auth checks
CREATE POLICY "Authenticated users can upload thumbnails"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'thumbnails');

CREATE POLICY "Authenticated users can update thumbnails"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'thumbnails');

CREATE POLICY "Authenticated users can upload character references"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'character-references');

CREATE POLICY "Authenticated users can update character references"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'character-references');

CREATE POLICY "Authenticated users can delete character references"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'character-references');

CREATE POLICY "Authenticated users can upload temp frames"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'temp-frames');

CREATE POLICY "Authenticated users can update temp frames"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'temp-frames');

CREATE POLICY "Authenticated users can delete temp frames"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'temp-frames');

CREATE POLICY "Authenticated users can upload scene images v2"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'scene-images');
