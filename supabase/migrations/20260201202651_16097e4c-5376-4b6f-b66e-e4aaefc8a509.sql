-- Create gallery showcase table for admin-managed landing page videos
CREATE TABLE public.gallery_showcase (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  category TEXT NOT NULL DEFAULT 'text-to-video' CHECK (category IN ('text-to-video', 'image-to-video', 'avatar')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.gallery_showcase ENABLE ROW LEVEL SECURITY;

-- Public can view active gallery items
CREATE POLICY "Anyone can view active gallery items"
ON public.gallery_showcase
FOR SELECT
USING (is_active = true);

-- Only admins can manage gallery items
CREATE POLICY "Admins can manage gallery items"
ON public.gallery_showcase
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create updated_at trigger
CREATE TRIGGER update_gallery_showcase_updated_at
BEFORE UPDATE ON public.gallery_showcase
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Insert the current hardcoded videos as initial data
INSERT INTO public.gallery_showcase (title, description, video_url, thumbnail_url, category, sort_order) VALUES
('Sunset Dreams on Winding Roads', 'A cinematic journey through golden-hour landscapes and endless horizons', 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_71e83837-9ae4-4e79-a4f2-599163741b03_1768354737035.mp4', NULL, 'text-to-video', 1),
('Soaring Above Snowy Serenity', 'A breathtaking aerial journey through pristine winter landscapes', 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_099597a1-0cbf-4d71-b000-7d140ab896d1_1768171376851.mp4', NULL, 'text-to-video', 2),
('Haunted Whispers of the Past', 'A chilling exploration of forgotten places and lost memories', 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_ed88401a-7a11-404c-acbc-55e375aee05d_1768166059131.mp4', NULL, 'text-to-video', 3),
('Whimsical Chocolate Adventures', 'A delightful journey through a world of sweet confections', 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_1b0ac63f-643a-4d43-b8ed-44b8083257ed_1768157346652.mp4', NULL, 'text-to-video', 4),
('Echoes of Desolation', 'A haunting exploration of abandoned landscapes and forgotten memories', 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_2e3503b6-a687-4d3e-bd97-9a1c264a7af2_1768153499834.mp4', NULL, 'image-to-video', 5),
('Illuminated Conversations', 'Light and shadow dance in meaningful dialogue', 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_56f2b0ca-e570-4ab0-b73d-39318a6c2ea8_1768128683272.mp4', NULL, 'image-to-video', 6),
('Silent Vigil in Ruined Valor', 'An epic tale of courage standing against the test of time', 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_dc255261-7bc3-465f-a9ec-ef2acd47b4fb_1768124786072.mp4', NULL, 'image-to-video', 7),
('Skyward Over Fiery Majesty', 'Drone cinematography capturing volcanic power from above', 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_7434c756-78d3-4f68-8107-b205930027c4_1768120634478.mp4', NULL, 'avatar', 8),
('Editing Dreams in Motion', 'A cinematic ad showcasing creative video editing possibilities', 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_171d8bf6-2911-4c6a-b715-6ed0e93ff226_1768118838934.mp4', NULL, 'avatar', 9),
('Whispers of the Enchanted Jungle', 'Explore the magical depths of an untouched rainforest', 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_9ee134ca-5526-4e7f-9c10-1345f7b7b01f_1768109298602.mp4', NULL, 'avatar', 10),
('Shadows of the Predator', 'A thrilling wildlife documentary capturing nature''s fierce beauty', 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_5d530ba0-a1e7-4954-8d90-05ffb5a346c2_1768108186067.mp4', NULL, 'text-to-video', 11);