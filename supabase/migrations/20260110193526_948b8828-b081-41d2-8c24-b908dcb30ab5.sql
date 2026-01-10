-- Project Templates System
-- Allows users to save and reuse project configurations

CREATE TABLE IF NOT EXISTS public.project_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  
  -- Template metadata
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general', -- 'commercial', 'cinematic', 'social', 'educational', etc.
  thumbnail_url TEXT,
  is_public BOOLEAN DEFAULT false, -- Allow sharing templates
  use_count INTEGER DEFAULT 0,
  
  -- Project configuration
  genre TEXT,
  mood TEXT,
  quality_tier TEXT DEFAULT 'standard',
  target_duration_minutes INTEGER DEFAULT 1,
  clip_count INTEGER DEFAULT 6,
  
  -- Style settings
  color_grading TEXT DEFAULT 'cinematic',
  pacing_style TEXT DEFAULT 'moderate', -- 'fast', 'moderate', 'slow', 'dynamic'
  aspect_ratio TEXT DEFAULT '16:9',
  
  -- Shot sequence template (reusable shot patterns)
  shot_sequence JSONB DEFAULT '[]', -- Array of { sceneType, cameraScale, cameraAngle, movementType, transitionOut }
  
  -- Style anchor (visual consistency reference)
  style_anchor JSONB DEFAULT '{}', -- { consistencyPrompt, colorPalette, lighting, anchors[] }
  
  -- Environment lock (scene consistency)
  environment_lock JSONB DEFAULT '{}', -- { lighting, colorPalette, timeOfDay, weather }
  
  -- Voice/Audio settings
  voice_id TEXT,
  music_mood TEXT,
  include_sfx BOOLEAN DEFAULT true,
  
  -- Character templates (reusable character definitions)
  character_templates JSONB DEFAULT '[]', -- Array of character definitions
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_templates ENABLE ROW LEVEL SECURITY;

-- Users can view their own templates and public templates
CREATE POLICY "Users can view own and public templates"
  ON public.project_templates
  FOR SELECT
  USING (user_id = auth.uid() OR is_public = true);

-- Users can create their own templates
CREATE POLICY "Users can create own templates"
  ON public.project_templates
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own templates
CREATE POLICY "Users can update own templates"
  ON public.project_templates
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own templates
CREATE POLICY "Users can delete own templates"
  ON public.project_templates
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_project_templates_updated_at
  BEFORE UPDATE ON public.project_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster queries
CREATE INDEX idx_project_templates_user_id ON public.project_templates(user_id);
CREATE INDEX idx_project_templates_category ON public.project_templates(category);
CREATE INDEX idx_project_templates_is_public ON public.project_templates(is_public) WHERE is_public = true;