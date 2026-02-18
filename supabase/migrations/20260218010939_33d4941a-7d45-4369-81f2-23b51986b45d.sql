
-- Create a public bucket for Hoppy image uploads (reference images users send in chat)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'hoppy-uploads',
  'hoppy-uploads',
  true,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to hoppy-uploads
CREATE POLICY "Authenticated users can upload hoppy images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'hoppy-uploads');

-- Allow public read access
CREATE POLICY "Public can view hoppy images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'hoppy-uploads');

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete their own hoppy images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'hoppy-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
