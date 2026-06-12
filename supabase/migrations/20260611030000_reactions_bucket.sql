-- Storage bucket for reaction reels (5-second video replies).
-- Public-read because reactions are surfaced inline on the Theater page;
-- authenticated insert so only signed-in users can post.

INSERT INTO storage.buckets (id, name, public)
VALUES ('reactions', 'reactions', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can read reaction videos.
DROP POLICY IF EXISTS "Reactions readable" ON storage.objects;
CREATE POLICY "Reactions readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'reactions');

-- Authenticated users can insert reaction videos into their own folder.
DROP POLICY IF EXISTS "Users post own reactions" ON storage.objects;
CREATE POLICY "Users post own reactions"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'reactions'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own reaction videos.
DROP POLICY IF EXISTS "Users delete own reactions" ON storage.objects;
CREATE POLICY "Users delete own reactions"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'reactions'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
