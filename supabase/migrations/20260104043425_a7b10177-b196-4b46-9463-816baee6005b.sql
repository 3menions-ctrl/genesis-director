-- Create storage bucket for thumbnails
INSERT INTO storage.buckets (id, name, public)
VALUES ('thumbnails', 'thumbnails', true);

-- Allow anyone to view thumbnails (public bucket)
CREATE POLICY "Thumbnails are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'thumbnails');

-- Allow uploads to thumbnails bucket
CREATE POLICY "Anyone can upload thumbnails"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'thumbnails');

-- Allow updates to thumbnails
CREATE POLICY "Anyone can update thumbnails"
ON storage.objects FOR UPDATE
USING (bucket_id = 'thumbnails');