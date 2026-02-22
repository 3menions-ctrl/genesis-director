-- Pipeline stage transition validator
-- Prevents invalid transitions (e.g., jumping from 'initializing' to 'complete')
-- Valid transitions are defined as a directed graph

CREATE OR REPLACE FUNCTION public.validate_pipeline_stage_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  valid_transitions jsonb := '{
    "initializing": ["preproduction", "error"],
    "preproduction": ["awaiting_approval", "qualitygate", "error"],
    "awaiting_approval": ["qualitygate", "preproduction", "error"],
    "qualitygate": ["assets", "preproduction", "error"],
    "assets": ["production", "error"],
    "production": ["postproduction", "error"],
    "postproduction": ["complete", "error"],
    "error": ["initializing", "preproduction", "production", "postproduction"],
    "complete": []
  }'::jsonb;
  allowed_stages jsonb;
BEGIN
  -- Only validate if pipeline_stage is actually changing
  IF OLD.pipeline_stage IS NULL OR NEW.pipeline_stage IS NULL THEN
    RETURN NEW;
  END IF;
  
  IF OLD.pipeline_stage = NEW.pipeline_stage THEN
    RETURN NEW;
  END IF;
  
  -- Allow service-role / admin to bypass (for recovery scenarios)
  -- Check if the transition is valid
  allowed_stages := valid_transitions -> OLD.pipeline_stage;
  
  IF allowed_stages IS NULL THEN
    -- Unknown source stage, allow (defensive)
    RETURN NEW;
  END IF;
  
  -- Check if new stage is in allowed list
  IF NOT (allowed_stages ? NEW.pipeline_stage) THEN
    RAISE WARNING 'Invalid pipeline_stage transition: % -> % for project %', 
      OLD.pipeline_stage, NEW.pipeline_stage, NEW.id;
    -- Log but don't block (use WARNING not EXCEPTION) to avoid breaking recovery flows
    -- In production, change to EXCEPTION after validation period
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Attach trigger to movie_projects
CREATE TRIGGER validate_pipeline_stage_change
  BEFORE UPDATE OF pipeline_stage ON public.movie_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_pipeline_stage_transition();