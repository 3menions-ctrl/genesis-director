-- Create a trigger to ensure each character can only be cast once per screenplay
-- and automatically update the character when a casting is approved

CREATE OR REPLACE FUNCTION public.handle_casting_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- When a casting is approved
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    -- Check if character is already cast by someone else
    IF EXISTS (
      SELECT 1 FROM public.genesis_preset_characters 
      WHERE id = NEW.character_id 
      AND is_cast = true 
      AND cast_by != NEW.user_id
    ) THEN
      RAISE EXCEPTION 'Character is already cast by another user';
    END IF;
    
    -- Update the character as cast
    UPDATE public.genesis_preset_characters
    SET 
      is_cast = true,
      cast_by = NEW.user_id,
      cast_at = now(),
      reference_image_url = NEW.face_image_url
    WHERE id = NEW.character_id;
    
    -- Reject all other pending castings for this character
    UPDATE public.genesis_character_castings
    SET status = 'rejected',
        admin_notes = 'Character was cast to another user'
    WHERE character_id = NEW.character_id 
    AND id != NEW.id 
    AND status = 'pending';
  END IF;
  
  -- When a casting is replaced or rejected after being approved
  IF NEW.status IN ('replaced', 'rejected') AND OLD.status = 'approved' THEN
    -- Reset the character's cast status
    UPDATE public.genesis_preset_characters
    SET 
      is_cast = false,
      cast_by = NULL,
      cast_at = NULL
    WHERE id = NEW.character_id AND cast_by = OLD.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop if exists and recreate
DROP TRIGGER IF EXISTS on_casting_status_change ON public.genesis_character_castings;

CREATE TRIGGER on_casting_status_change
  AFTER UPDATE ON public.genesis_character_castings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_casting_approval();

-- Also handle initial approval on insert (for admin direct approvals)
DROP TRIGGER IF EXISTS on_casting_insert ON public.genesis_character_castings;

CREATE TRIGGER on_casting_insert
  AFTER INSERT ON public.genesis_character_castings
  FOR EACH ROW
  WHEN (NEW.status = 'approved')
  EXECUTE FUNCTION public.handle_casting_approval();

-- Prevent duplicate pending castings for the same character
CREATE OR REPLACE FUNCTION public.check_casting_eligibility()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if character is already cast
  IF EXISTS (
    SELECT 1 FROM public.genesis_preset_characters 
    WHERE id = NEW.character_id AND is_cast = true
  ) THEN
    RAISE EXCEPTION 'This character has already been cast';
  END IF;
  
  -- Check if user already has a pending casting for this character
  IF EXISTS (
    SELECT 1 FROM public.genesis_character_castings 
    WHERE character_id = NEW.character_id 
    AND user_id = NEW.user_id 
    AND status = 'pending'
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) THEN
    RAISE EXCEPTION 'You already have a pending casting for this character';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS check_casting_before_insert ON public.genesis_character_castings;

CREATE TRIGGER check_casting_before_insert
  BEFORE INSERT ON public.genesis_character_castings
  FOR EACH ROW
  EXECUTE FUNCTION public.check_casting_eligibility();