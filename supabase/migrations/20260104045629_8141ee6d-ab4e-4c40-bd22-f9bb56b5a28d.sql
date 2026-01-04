-- Create storage bucket for character reference images
INSERT INTO storage.buckets (id, name, public)
VALUES ('character-references', 'character-references', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to upload character reference images
CREATE POLICY "Anyone can upload character references"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'character-references');

-- Allow anyone to view character reference images
CREATE POLICY "Anyone can view character references"
ON storage.objects FOR SELECT
USING (bucket_id = 'character-references');

-- Allow anyone to update character reference images
CREATE POLICY "Anyone can update character references"
ON storage.objects FOR UPDATE
USING (bucket_id = 'character-references');

-- Allow anyone to delete character reference images
CREATE POLICY "Anyone can delete character references"
ON storage.objects FOR DELETE
USING (bucket_id = 'character-references');