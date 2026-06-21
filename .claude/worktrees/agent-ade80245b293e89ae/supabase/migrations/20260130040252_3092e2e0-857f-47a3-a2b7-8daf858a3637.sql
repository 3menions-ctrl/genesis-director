-- Add avatar_type column to distinguish between realistic and animated avatars
ALTER TABLE public.avatar_templates 
ADD COLUMN IF NOT EXISTS avatar_type text DEFAULT 'animated' CHECK (avatar_type IN ('realistic', 'animated'));

-- Update avatars that were regenerated with photorealistic prompts to 'realistic'
-- These are the ones processed through regenerate-stock-avatars with the new photorealistic prompts
UPDATE public.avatar_templates
SET avatar_type = 'realistic'
WHERE name IN (
  'Sarah Mitchell',
  'Elena Rodriguez', 
  'Alex Turner',
  'Maya Johnson',
  'James Park',
  'Sophia Williams',
  'Dr. Robert Hayes'
);

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_avatar_templates_type ON public.avatar_templates(avatar_type);