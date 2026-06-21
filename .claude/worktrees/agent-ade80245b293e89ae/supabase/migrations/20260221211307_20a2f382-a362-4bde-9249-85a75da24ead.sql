
-- Atomic clip claim function: prevents TOCTOU race condition
-- Returns true ONLY if this caller successfully claimed the clip (no prior claim exists)
CREATE OR REPLACE FUNCTION public.atomic_claim_clip(
  p_project_id uuid,
  p_clip_index integer,
  p_claim_token text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tasks JSONB;
  v_predictions JSONB;
  v_pred JSONB;
  v_pred_index INTEGER;
  v_found BOOLEAN := false;
BEGIN
  -- Lock the row to prevent concurrent reads
  SELECT pending_video_tasks INTO v_tasks
  FROM movie_projects
  WHERE id = p_project_id
  FOR UPDATE;

  IF v_tasks IS NULL THEN
    RETURN false;
  END IF;

  v_predictions := v_tasks->'predictions';
  IF v_predictions IS NULL THEN
    RETURN false;
  END IF;

  -- Find the prediction for this clip index
  FOR v_pred_index IN 0..jsonb_array_length(v_predictions) - 1 LOOP
    v_pred := v_predictions->v_pred_index;
    IF (v_pred->>'clipIndex')::integer = p_clip_index THEN
      v_found := true;
      
      -- REJECT if already claimed or already has a predictionId
      IF v_pred->>'predictionId' IS NOT NULL 
         OR v_pred->>'claimToken' IS NOT NULL 
         OR v_pred->>'status' = 'processing' THEN
        RETURN false;
      END IF;
      
      -- Set the claim token atomically
      v_pred := v_pred || jsonb_build_object('claimToken', p_claim_token);
      v_predictions := jsonb_set(v_predictions, ARRAY[v_pred_index::text], v_pred);
      EXIT;
    END IF;
  END LOOP;

  IF NOT v_found THEN
    RETURN false;
  END IF;

  -- Write back the updated predictions with claim token
  UPDATE movie_projects
  SET pending_video_tasks = jsonb_set(
    v_tasks, 
    '{predictions}', 
    v_predictions
  ) || jsonb_build_object('lastProgressAt', now()::text)
  WHERE id = p_project_id;

  RETURN true;
END;
$function$;
