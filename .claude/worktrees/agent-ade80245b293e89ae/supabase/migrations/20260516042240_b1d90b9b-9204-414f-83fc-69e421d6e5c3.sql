-- Scene chain queue: parks chained-scene generate-single-clip requests whose
-- predecessor clip isn't done yet. When the predecessor completes and its
-- last_frame_url is persisted, generate-single-clip drains this queue and
-- re-fires the parked request with the real tail frame as startImageUrl.
-- This is what makes server-enforced ordering work regardless of UI timing.

CREATE TABLE IF NOT EXISTS public.scene_chain_queue (
  project_id uuid NOT NULL REFERENCES public.movie_projects(id) ON DELETE CASCADE,
  shot_index integer NOT NULL,
  user_id uuid NOT NULL,
  payload jsonb NOT NULL,
  hold_id text,
  status text NOT NULL DEFAULT 'waiting',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, shot_index)
);

CREATE INDEX IF NOT EXISTS idx_scene_chain_queue_status
  ON public.scene_chain_queue (status, created_at);

ALTER TABLE public.scene_chain_queue ENABLE ROW LEVEL SECURITY;

-- Owners can read their own queued chain entries (debugging / UI visibility).
CREATE POLICY "Users view own chain queue"
  ON public.scene_chain_queue FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Writes are reserved for service-role (the edge function). Clients must not
-- be able to inject queue rows directly — that would let them bypass the
-- predecessor check.
CREATE POLICY "Block client chain queue writes"
  ON public.scene_chain_queue FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY "Block client chain queue updates"
  ON public.scene_chain_queue FOR UPDATE
  TO authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "Block client chain queue deletes"
  ON public.scene_chain_queue FOR DELETE
  TO authenticated
  USING (false);

CREATE POLICY "Deny anon access to chain queue"
  ON public.scene_chain_queue AS RESTRICTIVE
  TO anon
  USING (false) WITH CHECK (false);

-- Touch updated_at automatically
CREATE OR REPLACE FUNCTION public.touch_scene_chain_queue()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS scene_chain_queue_touch ON public.scene_chain_queue;
CREATE TRIGGER scene_chain_queue_touch
  BEFORE UPDATE ON public.scene_chain_queue
  FOR EACH ROW EXECUTE FUNCTION public.touch_scene_chain_queue();