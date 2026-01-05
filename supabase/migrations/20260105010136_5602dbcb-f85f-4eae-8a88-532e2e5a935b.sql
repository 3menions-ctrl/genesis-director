-- Add column to track pending video generation tasks
ALTER TABLE public.movie_projects 
ADD COLUMN IF NOT EXISTS pending_video_tasks jsonb DEFAULT '[]'::jsonb;

-- Add comment explaining the column
COMMENT ON COLUMN public.movie_projects.pending_video_tasks IS 'Stores Replicate task IDs for videos currently being generated';