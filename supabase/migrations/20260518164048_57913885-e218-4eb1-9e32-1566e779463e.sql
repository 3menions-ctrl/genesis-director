ALTER TABLE public.video_clips
  ADD COLUMN IF NOT EXISTS replicate_prediction_id text,
  ADD COLUMN IF NOT EXISTS video_engine text,
  ADD COLUMN IF NOT EXISTS generation_mode text,
  ADD COLUMN IF NOT EXISTS start_image_url text,
  ADD COLUMN IF NOT EXISTS end_image_url text;

UPDATE public.video_clips
SET replicate_prediction_id = veo_operation_name
WHERE replicate_prediction_id IS NULL AND veo_operation_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS video_clips_replicate_prediction_id_idx
  ON public.video_clips (replicate_prediction_id);

CREATE INDEX IF NOT EXISTS video_clips_project_mode_idx
  ON public.video_clips (project_id, generation_mode);

CREATE OR REPLACE FUNCTION public.video_clips_sync_prediction_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.replicate_prediction_id IS NULL AND NEW.veo_operation_name IS NOT NULL THEN
    NEW.replicate_prediction_id := NEW.veo_operation_name;
  ELSIF NEW.veo_operation_name IS NULL AND NEW.replicate_prediction_id IS NOT NULL THEN
    NEW.veo_operation_name := NEW.replicate_prediction_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS video_clips_sync_prediction_id_trg ON public.video_clips;
CREATE TRIGGER video_clips_sync_prediction_id_trg
BEFORE INSERT OR UPDATE ON public.video_clips
FOR EACH ROW EXECUTE FUNCTION public.video_clips_sync_prediction_id();