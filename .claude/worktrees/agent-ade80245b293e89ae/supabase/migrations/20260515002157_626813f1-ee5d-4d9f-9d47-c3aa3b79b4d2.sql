
-- Director Canvas persistence
CREATE TABLE IF NOT EXISTS public.creation_canvases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid,
  name text NOT NULL DEFAULT 'Untitled Canvas',
  nodes jsonb NOT NULL DEFAULT '[]'::jsonb,
  edges jsonb NOT NULL DEFAULT '[]'::jsonb,
  viewport jsonb NOT NULL DEFAULT '{"x":0,"y":0,"zoom":1}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creation_canvases_user_idx ON public.creation_canvases(user_id);
CREATE INDEX IF NOT EXISTS creation_canvases_project_idx ON public.creation_canvases(project_id);

ALTER TABLE public.creation_canvases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners view own canvases"
  ON public.creation_canvases FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "owners insert own canvases"
  ON public.creation_canvases FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "owners update own canvases"
  ON public.creation_canvases FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "owners delete own canvases"
  ON public.creation_canvases FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER set_creation_canvases_updated
  BEFORE UPDATE ON public.creation_canvases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
