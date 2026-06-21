-- Create final-videos storage bucket for stitched output
INSERT INTO storage.buckets (id, name, public)
VALUES ('final-videos', 'final-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policy for public read access
CREATE POLICY "Final videos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'final-videos');

-- Create storage policy for service role uploads
CREATE POLICY "Service role can upload final videos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'final-videos');