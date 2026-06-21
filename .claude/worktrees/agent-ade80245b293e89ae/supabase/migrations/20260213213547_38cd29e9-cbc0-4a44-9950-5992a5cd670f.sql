
-- Edit Sessions table for the video editor
CREATE TABLE public.edit_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID REFERENCES public.movie_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Edit',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'rendering', 'completed', 'failed')),
  timeline_data JSONB NOT NULL DEFAULT '{"tracks": [], "duration": 0}'::jsonb,
  render_settings JSONB DEFAULT '{"resolution": "1080p", "fps": 30, "format": "mp4"}'::jsonb,
  render_url TEXT,
  render_progress INTEGER DEFAULT 0,
  render_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.edit_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only access their own edit sessions
CREATE POLICY "Users can view own edit sessions"
  ON public.edit_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own edit sessions"
  ON public.edit_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own edit sessions"
  ON public.edit_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own edit sessions"
  ON public.edit_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-update timestamp
CREATE TRIGGER update_edit_sessions_updated_at
  BEFORE UPDATE ON public.edit_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Index for fast lookups
CREATE INDEX idx_edit_sessions_user ON public.edit_sessions(user_id);
CREATE INDEX idx_edit_sessions_project ON public.edit_sessions(project_id);
