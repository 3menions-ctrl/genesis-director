-- published-renders bucket: canonical stitched outputs of the
-- seamless-stitcher edge function. Private; downloads go via signed URLs
-- with a 24h TTL.
INSERT INTO storage.buckets (id, name, public)
VALUES ('published-renders', 'published-renders', false)
ON CONFLICT (id) DO NOTHING;

-- Owner can read their own renders.
DROP POLICY IF EXISTS "Owner reads published renders" ON storage.objects;
CREATE POLICY "Owner reads published renders"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'published-renders'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.movie_projects WHERE user_id = auth.uid()
  )
);

-- Admins can read anyone's renders (for support / moderation).
DROP POLICY IF EXISTS "Admins read all published renders" ON storage.objects;
CREATE POLICY "Admins read all published renders"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'published-renders'
  AND public.is_admin(auth.uid())
);

-- Add a movie_projects.stitched_at column the stitcher writes to so the UI
-- can show "Stitched on …" and we can detect stale renders.
ALTER TABLE public.movie_projects
  ADD COLUMN IF NOT EXISTS stitched_at timestamptz;

COMMENT ON COLUMN public.movie_projects.stitched_at IS
  'Last successful seamless-stitcher run for this project.';
