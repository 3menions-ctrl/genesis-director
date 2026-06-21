-- Create stitch_jobs table for tracking stitching attempts and chunk progress
CREATE TABLE public.stitch_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.movie_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  
  -- Job status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'chunking', 'merging', 'completed', 'failed', 'retry_scheduled')),
  
  -- Chunk tracking
  total_clips INTEGER NOT NULL DEFAULT 0,
  total_chunks INTEGER NOT NULL DEFAULT 0,
  completed_chunks INTEGER NOT NULL DEFAULT 0,
  chunk_urls TEXT[] DEFAULT '{}',
  
  -- Retry tracking
  attempt_number INTEGER NOT NULL DEFAULT 1,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  last_error TEXT,
  retry_after TIMESTAMP WITH TIME ZONE,
  
  -- Stitching mode
  mode TEXT NOT NULL DEFAULT 'direct' CHECK (mode IN ('direct', 'chunked', 'manifest')),
  
  -- Progress tracking
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  current_step TEXT,
  
  -- Result
  final_video_url TEXT,
  final_duration_seconds NUMERIC(10, 2),
  file_size_bytes BIGINT,
  
  -- Timestamps
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stitch_jobs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own stitch jobs"
  ON public.stitch_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create stitch jobs for their projects"
  ON public.stitch_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own stitch jobs"
  ON public.stitch_jobs FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role can do everything (for edge functions)
CREATE POLICY "Service role full access to stitch jobs"
  ON public.stitch_jobs FOR ALL
  USING (true)
  WITH CHECK (true);

-- Indexes for efficient queries
CREATE INDEX idx_stitch_jobs_project ON public.stitch_jobs(project_id);
CREATE INDEX idx_stitch_jobs_status ON public.stitch_jobs(status) WHERE status NOT IN ('completed', 'failed');
CREATE INDEX idx_stitch_jobs_retry ON public.stitch_jobs(retry_after) WHERE status = 'retry_scheduled';

-- Trigger for updated_at
CREATE TRIGGER update_stitch_jobs_updated_at
  BEFORE UPDATE ON public.stitch_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add last_checkpoint_at column to movie_projects for watchdog detection
ALTER TABLE public.movie_projects ADD COLUMN IF NOT EXISTS last_checkpoint_at TIMESTAMP WITH TIME ZONE;