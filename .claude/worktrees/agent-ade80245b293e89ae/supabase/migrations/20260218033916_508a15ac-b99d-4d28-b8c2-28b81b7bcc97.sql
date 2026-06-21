-- Reduce stale lock timeout from 600s (10 min) to 180s (3 min)
-- This prevents deadlocks when a clip generation gets stuck
CREATE OR REPLACE FUNCTION public.acquire_generation_lock(p_project_id uuid, p_clip_index integer, p_lock_id uuid DEFAULT gen_random_uuid())
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_lock jsonb;
  lock_age_seconds integer;
BEGIN
  -- Get current lock state with row lock
  SELECT generation_lock INTO current_lock
  FROM movie_projects
  WHERE id = p_project_id
  FOR UPDATE;
  
  -- Check if locked
  IF current_lock IS NOT NULL THEN
    -- Calculate lock age
    lock_age_seconds := EXTRACT(EPOCH FROM (now() - (current_lock->>'locked_at')::timestamptz));
    
    -- If lock is stale (> 3 minutes), force release it
    -- Previously 600s (10 min) which caused long deadlocks
    IF lock_age_seconds > 180 THEN
      -- Stale lock, take over
      UPDATE movie_projects
      SET generation_lock = jsonb_build_object(
        'locked_at', now()::text,
        'locked_by_clip', p_clip_index,
        'lock_id', p_lock_id::text
      )
      WHERE id = p_project_id;
      
      RETURN jsonb_build_object(
        'acquired', true,
        'lock_id', p_lock_id,
        'stale_lock_released', true
      );
    ELSE
      -- Lock is active, blocked
      RETURN jsonb_build_object(
        'acquired', false,
        'blocked_by_clip', current_lock->>'locked_by_clip',
        'lock_age_seconds', lock_age_seconds
      );
    END IF;
  END IF;
  
  -- No lock, acquire it
  UPDATE movie_projects
  SET generation_lock = jsonb_build_object(
    'locked_at', now()::text,
    'locked_by_clip', p_clip_index,
    'lock_id', p_lock_id::text
  )
  WHERE id = p_project_id;
  
  RETURN jsonb_build_object(
    'acquired', true,
    'lock_id', p_lock_id
  );
END;
$function$;