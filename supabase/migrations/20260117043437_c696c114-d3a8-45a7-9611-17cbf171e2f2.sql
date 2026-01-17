-- Create storage bucket for video thumbnails
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('video-thumbnails', 'video-thumbnails', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to video thumbnails
CREATE POLICY "Public read access for video thumbnails"
ON storage.objects FOR SELECT
USING (bucket_id = 'video-thumbnails');

-- Allow service role to insert/update thumbnails
CREATE POLICY "Service role can manage video thumbnails"
ON storage.objects FOR ALL
USING (bucket_id = 'video-thumbnails')
WITH CHECK (bucket_id = 'video-thumbnails');