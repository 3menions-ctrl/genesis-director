-- Add account tier system to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS account_tier text NOT NULL DEFAULT 'free' 
CHECK (account_tier IN ('free', 'pro', 'growth', 'agency'));

-- Add tier limits configuration table
CREATE TABLE IF NOT EXISTS public.tier_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier text NOT NULL UNIQUE CHECK (tier IN ('free', 'pro', 'growth', 'agency')),
  max_duration_minutes integer NOT NULL DEFAULT 1,
  max_clips_per_video integer NOT NULL DEFAULT 15,
  max_concurrent_projects integer NOT NULL DEFAULT 3,
  max_retries_per_clip integer NOT NULL DEFAULT 2,
  priority_queue boolean NOT NULL DEFAULT false,
  chunked_stitching boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Insert tier configurations
INSERT INTO public.tier_limits (tier, max_duration_minutes, max_clips_per_video, max_concurrent_projects, max_retries_per_clip, priority_queue, chunked_stitching) VALUES
  ('free', 1, 10, 2, 1, false, false),
  ('pro', 1, 15, 5, 2, false, false),
  ('growth', 2, 30, 10, 3, true, true),
  ('agency', 2, 30, 25, 4, true, true)
ON CONFLICT (tier) DO UPDATE SET
  max_duration_minutes = EXCLUDED.max_duration_minutes,
  max_clips_per_video = EXCLUDED.max_clips_per_video,
  max_concurrent_projects = EXCLUDED.max_concurrent_projects,
  max_retries_per_clip = EXCLUDED.max_retries_per_clip,
  priority_queue = EXCLUDED.priority_queue,
  chunked_stitching = EXCLUDED.chunked_stitching,
  updated_at = now();

-- Add fail-safe tracking to movie_projects
ALTER TABLE public.movie_projects
ADD COLUMN IF NOT EXISTS generation_checkpoint jsonb DEFAULT '{"lastCompletedShot": -1, "totalShots": 0, "failedShots": [], "retryCount": 0}'::jsonb,
ADD COLUMN IF NOT EXISTS stitch_attempts integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_error text,
ADD COLUMN IF NOT EXISTS pipeline_stage text DEFAULT 'draft' CHECK (pipeline_stage IN ('draft', 'script_generating', 'script_ready', 'images_generating', 'images_ready', 'clips_generating', 'clips_ready', 'stitching', 'completed', 'failed'));

-- Add retry tracking to video_clips
ALTER TABLE public.video_clips
ADD COLUMN IF NOT EXISTS max_retries integer DEFAULT 2,
ADD COLUMN IF NOT EXISTS last_error_category text CHECK (last_error_category IN ('timeout', 'api_error', 'validation', 'quota', 'unknown'));

-- RLS for tier_limits (read-only for all authenticated users)
ALTER TABLE public.tier_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tier limits"
ON public.tier_limits FOR SELECT
USING (true);

-- Function to get user's tier limits
CREATE OR REPLACE FUNCTION public.get_user_tier_limits(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_tier text;
  limits_record record;
BEGIN
  -- Get user's tier
  SELECT account_tier INTO user_tier FROM profiles WHERE id = p_user_id;
  
  IF user_tier IS NULL THEN
    user_tier := 'free';
  END IF;
  
  -- Get limits for tier
  SELECT * INTO limits_record FROM tier_limits WHERE tier = user_tier;
  
  RETURN jsonb_build_object(
    'tier', user_tier,
    'max_duration_minutes', limits_record.max_duration_minutes,
    'max_clips_per_video', limits_record.max_clips_per_video,
    'max_concurrent_projects', limits_record.max_concurrent_projects,
    'max_retries_per_clip', limits_record.max_retries_per_clip,
    'priority_queue', limits_record.priority_queue,
    'chunked_stitching', limits_record.chunked_stitching
  );
END;
$$;

-- Function to update generation checkpoint atomically
CREATE OR REPLACE FUNCTION public.update_generation_checkpoint(
  p_project_id uuid,
  p_last_completed_shot integer,
  p_total_shots integer,
  p_failed_shots jsonb DEFAULT '[]'::jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE movie_projects
  SET 
    generation_checkpoint = jsonb_build_object(
      'lastCompletedShot', p_last_completed_shot,
      'totalShots', p_total_shots,
      'failedShots', p_failed_shots,
      'retryCount', COALESCE((generation_checkpoint->>'retryCount')::integer, 0)
    ),
    updated_at = now()
  WHERE id = p_project_id;
  
  RETURN FOUND;
END;
$$;