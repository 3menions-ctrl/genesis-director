-- Add multi-angle image columns and character bible to avatar_templates
ALTER TABLE public.avatar_templates
ADD COLUMN IF NOT EXISTS front_image_url text,
ADD COLUMN IF NOT EXISTS side_image_url text,
ADD COLUMN IF NOT EXISTS back_image_url text,
ADD COLUMN IF NOT EXISTS character_bible jsonb DEFAULT '{}'::jsonb;

-- Add comment explaining the character_bible structure
COMMENT ON COLUMN public.avatar_templates.character_bible IS 'Stores full character description with multi-view poses: {front_view, side_view, back_view, silhouette, hair_description, clothing_description, body_type, distinguishing_features, negative_prompts}';

-- Update existing avatars to use face_image_url as front_image_url if not set
UPDATE public.avatar_templates 
SET front_image_url = face_image_url 
WHERE front_image_url IS NULL;