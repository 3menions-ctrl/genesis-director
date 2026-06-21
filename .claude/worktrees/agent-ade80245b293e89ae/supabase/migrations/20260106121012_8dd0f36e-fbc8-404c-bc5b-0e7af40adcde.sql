-- Create video_clips table for checkpoint recovery and idempotent generation
CREATE TABLE public.video_clips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.movie_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  shot_index INTEGER NOT NULL,
  prompt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
  video_url TEXT,
  last_frame_url TEXT,
  duration_seconds INTEGER DEFAULT 4,
  veo_operation_name TEXT,
  motion_vectors JSONB DEFAULT '{}',
  color_profile JSONB DEFAULT '{}',
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(project_id, shot_index)
);

-- Enable RLS
ALTER TABLE public.video_clips ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own clips"
  ON public.video_clips FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own clips"
  ON public.video_clips FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own clips"
  ON public.video_clips FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own clips"
  ON public.video_clips FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_video_clips_updated_at
  BEFORE UPDATE ON public.video_clips
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for efficient checkpoint queries
CREATE INDEX idx_video_clips_project_status ON public.video_clips(project_id, status);
CREATE INDEX idx_video_clips_project_shot ON public.video_clips(project_id, shot_index);

-- Function to get checkpoint state for a project
CREATE OR REPLACE FUNCTION public.get_generation_checkpoint(p_project_id UUID)
RETURNS TABLE (
  last_completed_index INTEGER,
  last_frame_url TEXT,
  pending_count BIGINT,
  completed_count BIGINT,
  failed_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(MAX(vc.shot_index) FILTER (WHERE vc.status = 'completed'), -1) as last_completed_index,
    (SELECT vc2.last_frame_url 
     FROM video_clips vc2 
     WHERE vc2.project_id = p_project_id AND vc2.status = 'completed' 
     ORDER BY vc2.shot_index DESC LIMIT 1) as last_frame_url,
    COUNT(*) FILTER (WHERE vc.status = 'pending') as pending_count,
    COUNT(*) FILTER (WHERE vc.status = 'completed') as completed_count,
    COUNT(*) FILTER (WHERE vc.status = 'failed') as failed_count
  FROM video_clips vc
  WHERE vc.project_id = p_project_id;
END;
$$;

-- Function to upsert a clip (idempotent)
CREATE OR REPLACE FUNCTION public.upsert_video_clip(
  p_project_id UUID,
  p_user_id UUID,
  p_shot_index INTEGER,
  p_prompt TEXT,
  p_status TEXT DEFAULT 'pending',
  p_video_url TEXT DEFAULT NULL,
  p_last_frame_url TEXT DEFAULT NULL,
  p_veo_operation_name TEXT DEFAULT NULL,
  p_motion_vectors JSONB DEFAULT '{}',
  p_error_message TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  clip_id UUID;
BEGIN
  INSERT INTO video_clips (
    project_id, user_id, shot_index, prompt, status, 
    video_url, last_frame_url, veo_operation_name, motion_vectors, error_message
  )
  VALUES (
    p_project_id, p_user_id, p_shot_index, p_prompt, p_status,
    p_video_url, p_last_frame_url, p_veo_operation_name, p_motion_vectors, p_error_message
  )
  ON CONFLICT (project_id, shot_index) DO UPDATE SET
    status = EXCLUDED.status,
    video_url = COALESCE(EXCLUDED.video_url, video_clips.video_url),
    last_frame_url = COALESCE(EXCLUDED.last_frame_url, video_clips.last_frame_url),
    veo_operation_name = COALESCE(EXCLUDED.veo_operation_name, video_clips.veo_operation_name),
    motion_vectors = COALESCE(EXCLUDED.motion_vectors, video_clips.motion_vectors),
    error_message = EXCLUDED.error_message,
    retry_count = CASE WHEN EXCLUDED.status = 'generating' THEN video_clips.retry_count + 1 ELSE video_clips.retry_count END,
    completed_at = CASE WHEN EXCLUDED.status = 'completed' THEN now() ELSE video_clips.completed_at END,
    updated_at = now()
  RETURNING id INTO clip_id;
  
  RETURN clip_id;
END;
$$;