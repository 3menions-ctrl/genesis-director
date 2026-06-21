-- Create storage bucket for scene reference images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'scene-images',
  'scene-images',
  true,
  10485760, -- 10MB limit
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to scene images
CREATE POLICY "Scene images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'scene-images');

-- Allow authenticated users to upload scene images
CREATE POLICY "Authenticated users can upload scene images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'scene-images');

-- Allow users to update their own scene images
CREATE POLICY "Users can update scene images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'scene-images');

-- Allow users to delete scene images
CREATE POLICY "Users can delete scene images"
ON storage.objects FOR DELETE
USING (bucket_id = 'scene-images');

-- Add scene_images column to movie_projects to store generated image references
ALTER TABLE public.movie_projects
ADD COLUMN IF NOT EXISTS scene_images jsonb DEFAULT '[]'::jsonb;