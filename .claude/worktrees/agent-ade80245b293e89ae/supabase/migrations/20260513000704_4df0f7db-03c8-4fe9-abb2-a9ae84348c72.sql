
-- Phase 1 — Step 2: Cinema engine schema (retargeted to movie_projects + video_clips)

CREATE OR REPLACE FUNCTION public.validate_engine_id(_engine text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT _engine IS NULL OR _engine IN (
    'kling-v3', 'seedance-2', 'veo-3', 'runway-gen4', 'sora-2'
  );
$$;

CREATE OR REPLACE FUNCTION public.validate_final_resolution(_res text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT _res IS NULL OR _res IN ('1080p', '4k');
$$;

CREATE OR REPLACE FUNCTION public.validate_final_fps(_fps integer)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT _fps IS NULL OR _fps IN (24, 30, 60);
$$;

-- ---- movie_projects ----
ALTER TABLE public.movie_projects
  ADD COLUMN IF NOT EXISTS engine text NOT NULL DEFAULT 'kling-v3',
  ADD COLUMN IF NOT EXISTS quality_options jsonb NOT NULL
    DEFAULT '{"upscale4k": false, "fps60": false, "autoRetake": true}'::jsonb,
  ADD COLUMN IF NOT EXISTS continuity_manifest_v2 jsonb;

CREATE OR REPLACE FUNCTION public.tg_movie_projects_validate_engine()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT public.validate_engine_id(NEW.engine) THEN
    RAISE EXCEPTION 'Invalid engine id: %', NEW.engine;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS movie_projects_validate_engine ON public.movie_projects;
CREATE TRIGGER movie_projects_validate_engine
  BEFORE INSERT OR UPDATE OF engine ON public.movie_projects
  FOR EACH ROW EXECUTE FUNCTION public.tg_movie_projects_validate_engine();

-- ---- video_clips ----
ALTER TABLE public.video_clips
  ADD COLUMN IF NOT EXISTS engine text,
  ADD COLUMN IF NOT EXISTS final_resolution text,
  ADD COLUMN IF NOT EXISTS final_fps integer;

CREATE OR REPLACE FUNCTION public.tg_video_clips_validate_engine()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT public.validate_engine_id(NEW.engine) THEN
    RAISE EXCEPTION 'Invalid engine id: %', NEW.engine;
  END IF;
  IF NOT public.validate_final_resolution(NEW.final_resolution) THEN
    RAISE EXCEPTION 'Invalid final_resolution: %', NEW.final_resolution;
  END IF;
  IF NOT public.validate_final_fps(NEW.final_fps) THEN
    RAISE EXCEPTION 'Invalid final_fps: %', NEW.final_fps;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS video_clips_validate_engine ON public.video_clips;
CREATE TRIGGER video_clips_validate_engine
  BEFORE INSERT OR UPDATE OF engine, final_resolution, final_fps ON public.video_clips
  FOR EACH ROW EXECUTE FUNCTION public.tg_video_clips_validate_engine();

-- ---- cinema_usage_ledger ----
CREATE TABLE IF NOT EXISTS public.cinema_usage_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subscription_id uuid,
  project_id uuid,
  clip_id text,
  engine text NOT NULL,
  seconds_used integer NOT NULL CHECK (seconds_used > 0),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  overage_credits_charged integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.tg_cinema_usage_ledger_validate()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT public.validate_engine_id(NEW.engine) THEN
    RAISE EXCEPTION 'Invalid engine id: %', NEW.engine;
  END IF;
  IF NEW.period_end <= NEW.period_start THEN
    RAISE EXCEPTION 'period_end must be greater than period_start';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cinema_usage_ledger_validate ON public.cinema_usage_ledger;
CREATE TRIGGER cinema_usage_ledger_validate
  BEFORE INSERT OR UPDATE ON public.cinema_usage_ledger
  FOR EACH ROW EXECUTE FUNCTION public.tg_cinema_usage_ledger_validate();

CREATE INDEX IF NOT EXISTS cinema_usage_ledger_user_period_idx
  ON public.cinema_usage_ledger (user_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS cinema_usage_ledger_subscription_idx
  ON public.cinema_usage_ledger (subscription_id);
CREATE INDEX IF NOT EXISTS cinema_usage_ledger_project_idx
  ON public.cinema_usage_ledger (project_id);

ALTER TABLE public.cinema_usage_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own cinema usage" ON public.cinema_usage_ledger;
CREATE POLICY "Users view own cinema usage"
  ON public.cinema_usage_ledger FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins view all cinema usage" ON public.cinema_usage_ledger;
CREATE POLICY "Admins view all cinema usage"
  ON public.cinema_usage_ledger FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
