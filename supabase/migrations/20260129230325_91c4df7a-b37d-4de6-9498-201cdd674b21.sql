-- Create avatar_templates table for premade avatars
CREATE TABLE public.avatar_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  personality TEXT,
  gender TEXT NOT NULL DEFAULT 'neutral',
  age_range TEXT,
  ethnicity TEXT,
  style TEXT DEFAULT 'professional',
  face_image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  voice_id TEXT NOT NULL,
  voice_provider TEXT NOT NULL DEFAULT 'openai',
  voice_name TEXT,
  voice_description TEXT,
  sample_audio_url TEXT,
  tags TEXT[] DEFAULT '{}',
  use_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_premium BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.avatar_templates ENABLE ROW LEVEL SECURITY;

-- Everyone can view active avatar templates
CREATE POLICY "Anyone can view active avatar templates"
ON public.avatar_templates
FOR SELECT
USING (is_active = true);

-- Admins can manage avatar templates
CREATE POLICY "Admins can manage avatar templates"
ON public.avatar_templates
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'::app_role
  )
);

-- Create index for fast lookups
CREATE INDEX idx_avatar_templates_active ON public.avatar_templates(is_active, sort_order);
CREATE INDEX idx_avatar_templates_gender ON public.avatar_templates(gender) WHERE is_active = true;
CREATE INDEX idx_avatar_templates_style ON public.avatar_templates(style) WHERE is_active = true;

-- Add trigger for updated_at
CREATE TRIGGER update_avatar_templates_updated_at
BEFORE UPDATE ON public.avatar_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();