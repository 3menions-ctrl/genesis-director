-- Create storage bucket for voice tracks
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'voice-tracks',
  'voice-tracks',
  true,
  52428800, -- 50MB limit
  ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav']
)
ON CONFLICT (id) DO NOTHING;

-- Create policies for voice-tracks bucket
CREATE POLICY "Anyone can view voice tracks"
ON storage.objects
FOR SELECT
USING (bucket_id = 'voice-tracks');

CREATE POLICY "Authenticated users can upload voice tracks"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'voice-tracks' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own voice tracks"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'voice-tracks' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own voice tracks"
ON storage.objects
FOR DELETE
USING (bucket_id = 'voice-tracks' AND auth.uid()::text = (storage.foldername(name))[1]);