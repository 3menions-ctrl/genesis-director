-- Update the upsert_video_clip function to accept and update duration_seconds
CREATE OR REPLACE FUNCTION public.upsert_video_clip(
  p_project_id uuid, 
  p_user_id uuid, 
  p_shot_index integer, 
  p_prompt text, 
  p_status text DEFAULT 'pending'::text, 
  p_video_url text DEFAULT NULL::text, 
  p_last_frame_url text DEFAULT NULL::text, 
  p_veo_operation_name text DEFAULT NULL::text, 
  p_motion_vectors jsonb DEFAULT '{}'::jsonb, 
  p_error_message text DEFAULT NULL::text,
  p_duration_seconds integer DEFAULT 6
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  clip_id UUID;
BEGIN
  INSERT INTO video_clips (
    project_id, user_id, shot_index, prompt, status, 
    video_url, last_frame_url, veo_operation_name, motion_vectors, error_message, duration_seconds
  )
  VALUES (
    p_project_id, p_user_id, p_shot_index, p_prompt, p_status,
    p_video_url, p_last_frame_url, p_veo_operation_name, p_motion_vectors, p_error_message, p_duration_seconds
  )
  ON CONFLICT (project_id, shot_index) DO UPDATE SET
    status = EXCLUDED.status,
    video_url = COALESCE(EXCLUDED.video_url, video_clips.video_url),
    last_frame_url = COALESCE(EXCLUDED.last_frame_url, video_clips.last_frame_url),
    veo_operation_name = COALESCE(EXCLUDED.veo_operation_name, video_clips.veo_operation_name),
    motion_vectors = COALESCE(EXCLUDED.motion_vectors, video_clips.motion_vectors),
    error_message = EXCLUDED.error_message,
    duration_seconds = CASE WHEN EXCLUDED.status = 'completed' THEN EXCLUDED.duration_seconds ELSE video_clips.duration_seconds END,
    retry_count = CASE WHEN EXCLUDED.status = 'generating' THEN video_clips.retry_count + 1 ELSE video_clips.retry_count END,
    completed_at = CASE WHEN EXCLUDED.status = 'completed' THEN now() ELSE video_clips.completed_at END,
    updated_at = now()
  RETURNING id INTO clip_id;
  
  RETURN clip_id;
END;
$$;

-- Also update the default duration in the video_clips table from 4 to 6
ALTER TABLE video_clips ALTER COLUMN duration_seconds SET DEFAULT 6;