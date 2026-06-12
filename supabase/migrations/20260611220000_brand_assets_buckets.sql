-- Brand-assets + branded-downloads buckets used by the
-- `brand-video-download` edge function.
--
-- brand-assets: public-read so the edge function can fetch intro.mp4
--               quickly. Only service-role can write.
--
-- branded-downloads: private; the edge function uploads here and
--                    returns 24h signed URLs to the user.

INSERT INTO storage.buckets (id, name, public)
VALUES ('brand-assets', 'brand-assets', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('branded-downloads', 'branded-downloads', false)
ON CONFLICT (id) DO NOTHING;

-- Anyone can read brand-assets (so the intro can be referenced from
-- both edge functions and direct <video src> tags).
DROP POLICY IF EXISTS "Brand assets readable" ON storage.objects;
CREATE POLICY "Brand assets readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'brand-assets');

-- branded-downloads — owner reads their own files only.
DROP POLICY IF EXISTS "Owner reads branded downloads" ON storage.objects;
CREATE POLICY "Owner reads branded downloads"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'branded-downloads'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
