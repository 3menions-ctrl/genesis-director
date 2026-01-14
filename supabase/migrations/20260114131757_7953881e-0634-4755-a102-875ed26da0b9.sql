-- Character Voice Consistency System
-- Ensures each character has a persistent voice assignment

-- 1. Add voice assignment fields to characters table
ALTER TABLE public.characters 
ADD COLUMN IF NOT EXISTS voice_assigned_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS voice_locked BOOLEAN DEFAULT false;

-- 2. Create voice_assignments table for project-level voice consistency
-- This tracks which voice each character uses within a specific project
CREATE TABLE IF NOT EXISTS public.character_voice_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.movie_projects(id) ON DELETE CASCADE,
  character_id UUID REFERENCES public.characters(id) ON DELETE SET NULL,
  character_name TEXT NOT NULL,
  voice_id TEXT NOT NULL,
  voice_provider TEXT DEFAULT 'openai',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Ensure one voice per character per project
  UNIQUE(project_id, character_name)
);

-- Enable RLS
ALTER TABLE public.character_voice_assignments ENABLE ROW LEVEL SECURITY;

-- Users can manage their own project voice assignments
CREATE POLICY "Users can view their own voice assignments"
ON public.character_voice_assignments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM movie_projects mp 
    WHERE mp.id = project_id AND mp.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create voice assignments for their projects"
ON public.character_voice_assignments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM movie_projects mp 
    WHERE mp.id = project_id AND mp.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own voice assignments"
ON public.character_voice_assignments
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM movie_projects mp 
    WHERE mp.id = project_id AND mp.user_id = auth.uid()
  )
);

-- Admins can view all voice assignments
CREATE POLICY "Admins can view all voice assignments"
ON public.character_voice_assignments
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.role = 'admin'::app_role
));

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_voice_assignments_project 
ON public.character_voice_assignments(project_id);

CREATE INDEX IF NOT EXISTS idx_voice_assignments_character_name 
ON public.character_voice_assignments(project_id, character_name);

-- 3. Create function to get or assign a voice for a character
-- This ensures consistent voice assignment across the entire project
CREATE OR REPLACE FUNCTION public.get_or_assign_character_voice(
  p_project_id UUID,
  p_character_name TEXT,
  p_character_id UUID DEFAULT NULL,
  p_preferred_voice TEXT DEFAULT NULL
)
RETURNS TABLE(voice_id TEXT, voice_provider TEXT, is_new_assignment BOOLEAN) AS $$
DECLARE
  v_existing_assignment RECORD;
  v_new_voice_id TEXT;
  v_voice_pool TEXT[] := ARRAY['onyx', 'echo', 'fable', 'nova', 'shimmer', 'alloy'];
  v_used_voices TEXT[];
BEGIN
  -- Check for existing assignment
  SELECT cva.voice_id, cva.voice_provider INTO v_existing_assignment
  FROM character_voice_assignments cva
  WHERE cva.project_id = p_project_id 
    AND LOWER(cva.character_name) = LOWER(p_character_name);
  
  IF FOUND THEN
    -- Return existing assignment
    RETURN QUERY SELECT v_existing_assignment.voice_id, v_existing_assignment.voice_provider, false;
    RETURN;
  END IF;
  
  -- Check if character has a locked voice in characters table
  IF p_character_id IS NOT NULL THEN
    SELECT c.voice_id INTO v_new_voice_id
    FROM characters c
    WHERE c.id = p_character_id AND c.voice_id IS NOT NULL AND c.voice_locked = true;
    
    IF v_new_voice_id IS NOT NULL THEN
      -- Use character's locked voice
      INSERT INTO character_voice_assignments (project_id, character_id, character_name, voice_id, voice_provider)
      VALUES (p_project_id, p_character_id, p_character_name, v_new_voice_id, 'openai');
      
      RETURN QUERY SELECT v_new_voice_id, 'openai'::TEXT, true;
      RETURN;
    END IF;
  END IF;
  
  -- Use preferred voice if provided
  IF p_preferred_voice IS NOT NULL THEN
    v_new_voice_id := p_preferred_voice;
  ELSE
    -- Get voices already used in this project to avoid duplicates when possible
    SELECT ARRAY_AGG(cva.voice_id) INTO v_used_voices
    FROM character_voice_assignments cva
    WHERE cva.project_id = p_project_id;
    
    -- Pick the first unused voice, or fallback to 'nova'
    v_new_voice_id := 'nova'; -- Default
    FOR i IN 1..array_length(v_voice_pool, 1) LOOP
      IF v_voice_pool[i] != ALL(COALESCE(v_used_voices, ARRAY[]::TEXT[])) THEN
        v_new_voice_id := v_voice_pool[i];
        EXIT;
      END IF;
    END LOOP;
  END IF;
  
  -- Create new assignment
  INSERT INTO character_voice_assignments (project_id, character_id, character_name, voice_id, voice_provider)
  VALUES (p_project_id, p_character_id, p_character_name, v_new_voice_id, 'openai');
  
  -- Also update character's voice_id if character_id provided
  IF p_character_id IS NOT NULL THEN
    UPDATE characters 
    SET voice_id = v_new_voice_id, voice_assigned_at = now()
    WHERE id = p_character_id AND voice_id IS NULL;
  END IF;
  
  RETURN QUERY SELECT v_new_voice_id, 'openai'::TEXT, true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create function to get all voice assignments for a project
CREATE OR REPLACE FUNCTION public.get_project_voice_map(p_project_id UUID)
RETURNS TABLE(character_name TEXT, voice_id TEXT, voice_provider TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT cva.character_name, cva.voice_id, cva.voice_provider
  FROM character_voice_assignments cva
  WHERE cva.project_id = p_project_id
  ORDER BY cva.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments for documentation
COMMENT ON TABLE public.character_voice_assignments IS 'Tracks voice assignments per character per project for consistent audio generation';
COMMENT ON FUNCTION public.get_or_assign_character_voice IS 'Gets existing or creates new consistent voice assignment for a character in a project';
COMMENT ON FUNCTION public.get_project_voice_map IS 'Returns all character-voice mappings for a project';