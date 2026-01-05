-- Create storage bucket for temporary frame images used in video generation
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('temp-frames', 'temp-frames', true, 10485760)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read files (needed for Replicate to fetch images)
CREATE POLICY "Public read access for temp frames"
ON storage.objects FOR SELECT
USING (bucket_id = 'temp-frames');

-- Allow authenticated users to upload frames
CREATE POLICY "Authenticated users can upload frames"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'temp-frames');

-- Allow authenticated users to update their frames
CREATE POLICY "Authenticated users can update frames"
ON storage.objects FOR UPDATE
USING (bucket_id = 'temp-frames');

-- Allow deletion for cleanup
CREATE POLICY "Authenticated users can delete frames"
ON storage.objects FOR DELETE
USING (bucket_id = 'temp-frames');