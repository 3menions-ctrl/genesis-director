-- ============================================================
-- CLIP-TO-CLIP FAILSAFE INFRASTRUCTURE
-- Adds generation mutex, strict sequential enforcement, and context persistence
-- ============================================================

-- 1. Add generation lock column to movie_projects for mutex control
ALTER TABLE public.movie_projects 
ADD COLUMN IF NOT EXISTS generation_lock jsonb DEFAULT NULL;

-- Add comment explaining the lock structure
COMMENT ON COLUMN public.movie_projects.generation_lock IS 
'Generation mutex: { "locked_at": timestamp, "locked_by_clip": number, "lock_id": uuid }. NULL = unlocked.';

-- 2. Add context_snapshot column to persist full pipeline context between clips
ALTER TABLE public.movie_projects
ADD COLUMN IF NOT EXISTS pipeline_context_snapshot jsonb DEFAULT NULL;

COMMENT ON COLUMN public.movie_projects.pipeline_context_snapshot IS
'Full pipeline context persisted after each clip for reliable resume/retry.';

-- 3. Add frame_extraction_status to video_clips for retry tracking
ALTER TABLE public.video_clips
ADD COLUMN IF NOT EXISTS frame_extraction_status text DEFAULT 'pending';

ALTER TABLE public.video_clips
ADD COLUMN IF NOT EXISTS frame_extraction_attempts integer DEFAULT 0;

COMMENT ON COLUMN public.video_clips.frame_extraction_status IS
'Frame extraction status: pending, success, failed, fallback_used';

-- 4. Create function to acquire generation lock (returns true if acquired, false if blocked)
CREATE OR REPLACE FUNCTION public.acquire_generation_lock(
  p_project_id uuid,
  p_clip_index integer,
  p_lock_id uuid DEFAULT gen_random_uuid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    
    -- If lock is stale (> 10 minutes), force release it
    IF lock_age_seconds > 600 THEN
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
$$;

-- 5. Create function to release generation lock
CREATE OR REPLACE FUNCTION public.release_generation_lock(
  p_project_id uuid,
  p_lock_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE movie_projects
  SET generation_lock = NULL
  WHERE id = p_project_id
    AND generation_lock->>'lock_id' = p_lock_id::text;
  
  RETURN FOUND;
END;
$$;

-- 6. Create function to check if previous clip is ready (strict sequential enforcement)
CREATE OR REPLACE FUNCTION public.check_clip_continuity_ready(
  p_project_id uuid,
  p_clip_index integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prev_clip RECORD;
BEGIN
  -- Clip 0 is always ready (no predecessor)
  IF p_clip_index = 0 THEN
    RETURN jsonb_build_object(
      'ready', true,
      'reason', 'first_clip'
    );
  END IF;
  
  -- Check previous clip status
  SELECT id, status, last_frame_url, frame_extraction_status
  INTO prev_clip
  FROM video_clips
  WHERE project_id = p_project_id
    AND shot_index = p_clip_index - 1;
  
  -- Previous clip doesn't exist
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ready', false,
      'reason', 'previous_clip_missing',
      'required_clip', p_clip_index - 1
    );
  END IF;
  
  -- Previous clip not completed
  IF prev_clip.status != 'completed' THEN
    RETURN jsonb_build_object(
      'ready', false,
      'reason', 'previous_clip_not_completed',
      'previous_status', prev_clip.status
    );
  END IF;
  
  -- Previous clip has no frame (critical for continuity)
  IF prev_clip.last_frame_url IS NULL THEN
    RETURN jsonb_build_object(
      'ready', false,
      'reason', 'previous_clip_missing_frame',
      'frame_extraction_status', prev_clip.frame_extraction_status
    );
  END IF;
  
  -- All good
  RETURN jsonb_build_object(
    'ready', true,
    'last_frame_url', prev_clip.last_frame_url
  );
END;
$$;

-- 7. Create function to persist pipeline context after clip completion
CREATE OR REPLACE FUNCTION public.persist_pipeline_context(
  p_project_id uuid,
  p_context jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE movie_projects
  SET 
    pipeline_context_snapshot = p_context,
    updated_at = now()
  WHERE id = p_project_id;
  
  RETURN FOUND;
END;
$$;

-- 8. Create function to get full pipeline context for a clip
CREATE OR REPLACE FUNCTION public.get_pipeline_context(
  p_project_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  project RECORD;
  context jsonb;
BEGIN
  SELECT 
    pipeline_context_snapshot,
    pro_features_data,
    generated_script,
    scene_images,
    quality_tier,
    aspect_ratio
  INTO project
  FROM movie_projects
  WHERE id = p_project_id;
  
  -- Start with persisted context
  context := COALESCE(project.pipeline_context_snapshot, '{}'::jsonb);
  
  -- Merge with pro_features_data if context is sparse
  IF (context->>'identityBible') IS NULL AND (project.pro_features_data->>'identityBible') IS NOT NULL THEN
    context := context || jsonb_build_object('identityBible', project.pro_features_data->'identityBible');
  END IF;
  
  IF (context->>'extractedCharacters') IS NULL AND (project.pro_features_data->>'extractedCharacters') IS NOT NULL THEN
    context := context || jsonb_build_object('extractedCharacters', project.pro_features_data->'extractedCharacters');
  END IF;
  
  IF (context->>'masterSceneAnchor') IS NULL AND (project.pro_features_data->>'masterSceneAnchor') IS NOT NULL THEN
    context := context || jsonb_build_object('masterSceneAnchor', project.pro_features_data->'masterSceneAnchor');
  END IF;
  
  IF (context->>'goldenFrameData') IS NULL AND (project.pro_features_data->>'goldenFrameData') IS NOT NULL THEN
    context := context || jsonb_build_object('goldenFrameData', project.pro_features_data->'goldenFrameData');
  END IF;
  
  -- Add project-level settings
  context := context || jsonb_build_object(
    'qualityTier', COALESCE(project.quality_tier, 'standard'),
    'aspectRatio', COALESCE(project.aspect_ratio, '16:9')
  );
  
  RETURN context;
END;
$$;