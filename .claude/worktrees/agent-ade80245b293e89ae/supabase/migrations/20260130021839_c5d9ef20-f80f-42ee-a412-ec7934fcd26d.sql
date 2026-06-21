-- Create avatars storage bucket for AI-generated avatar images
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow public read access to avatars
CREATE POLICY "Public can view avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Allow service role to upload avatars (for edge functions)
CREATE POLICY "Service role can upload avatars"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars');

-- Allow service role to update avatars
CREATE POLICY "Service role can update avatars"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars');