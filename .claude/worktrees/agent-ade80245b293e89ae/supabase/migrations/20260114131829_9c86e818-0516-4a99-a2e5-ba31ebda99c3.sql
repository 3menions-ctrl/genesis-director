-- Fix search_path for the new functions to address security linter warnings

-- Recreate get_or_assign_character_voice with search_path set
CREATE OR REPLACE FUNCTION public.get_or_assign_character_voice(
  p_project_id UUID,
  p_character_name TEXT,
  p_character_id UUID DEFAULT NULL,
  p_preferred_voice TEXT DEFAULT NULL
)
RETURNS TABLE(voice_id TEXT, voice_provider TEXT, is_new_assignment BOOLEAN) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Recreate get_project_voice_map with search_path set
CREATE OR REPLACE FUNCTION public.get_project_voice_map(p_project_id UUID)
RETURNS TABLE(character_name TEXT, voice_id TEXT, voice_provider TEXT) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT cva.character_name, cva.voice_id, cva.voice_provider
  FROM character_voice_assignments cva
  WHERE cva.project_id = p_project_id
  ORDER BY cva.created_at;
END;
$$;