-- Reliability hardening for video pipeline failure detection and expired URL prevention

CREATE OR REPLACE FUNCTION public.video_url_is_temporary(_url text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(_url, '') ILIKE '%replicate.delivery%'
     OR COALESCE(_url, '') ILIKE '%replicate.com%/api/models/%/predictions/%/output%'
$$;

CREATE OR REPLACE FUNCTION public.mark_temporary_video_url_risk()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state jsonb;
BEGIN
  IF TG_TABLE_NAME = 'movie_projects' THEN
    IF public.video_url_is_temporary(NEW.video_url) THEN
      NEW.status := CASE WHEN NEW.status = 'completed' THEN 'generating' ELSE NEW.status END;
      NEW.last_error := COALESCE(NEW.last_error, 'Permanent video storage pending; provider URL is temporary');
      v_state := COALESCE(NEW.pipeline_state, '{}'::jsonb);
      NEW.pipeline_state := v_state || jsonb_build_object(
        'assetPersistenceRisk', true,
        'temporaryVideoUrlDetectedAt', now(),
        'temporaryVideoUrlSource', 'movie_projects.video_url'
      );
    END IF;
  ELSIF TG_TABLE_NAME = 'video_clips' THEN
    IF public.video_url_is_temporary(NEW.video_url) THEN
      NEW.error_message := COALESCE(NEW.error_message, 'Permanent clip storage pending; provider URL is temporary');
      NEW.frame_extraction_status := COALESCE(NEW.frame_extraction_status, 'pending_storage');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_movie_projects_temp_video_url_risk ON public.movie_projects;
CREATE TRIGGER trg_movie_projects_temp_video_url_risk
BEFORE INSERT OR UPDATE OF video_url, status ON public.movie_projects
FOR EACH ROW
EXECUTE FUNCTION public.mark_temporary_video_url_risk();

DROP TRIGGER IF EXISTS trg_video_clips_temp_video_url_risk ON public.video_clips;
CREATE TRIGGER trg_video_clips_temp_video_url_risk
BEFORE INSERT OR UPDATE OF video_url, status ON public.video_clips
FOR EACH ROW
EXECUTE FUNCTION public.mark_temporary_video_url_risk();

CREATE OR REPLACE FUNCTION public.detect_stuck_pipeline_jobs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
  rec record;
  v_last_progress timestamptz;
BEGIN
  FOR rec IN
    SELECT
      p.id,
      p.user_id,
      p.status,
      p.created_at,
      p.updated_at,
      p.pipeline_stage,
      p.pending_video_tasks,
      p.pipeline_state,
      u.email
    FROM public.movie_projects p
    LEFT JOIN auth.users u ON u.id = p.user_id
    WHERE p.status IN ('generating','rendering','processing','queued','pending','stitching')
      AND p.created_at > now() - interval '24 hours'
  LOOP
    v_last_progress := GREATEST(
      rec.updated_at,
      COALESCE((rec.pending_video_tasks->>'lastProgressAt')::timestamptz, rec.updated_at),
      COALESCE((rec.pending_video_tasks->>'lastErrorAt')::timestamptz, rec.updated_at),
      COALESCE((rec.pipeline_state->>'lastProgressAt')::timestamptz, rec.updated_at)
    );

    IF v_last_progress < now() - interval '20 minutes' THEN
      PERFORM public.notify_admins_v2(
        'admin_stuck_job',
        'Stuck pipeline job — ' || rec.status,
        'Project ' || substring(rec.id::text, 1, 8) || ' by ' || COALESCE(rec.email, 'unknown') ||
          ' has had no recorded progress for ' || round(extract(epoch from (now() - v_last_progress)) / 60) || ' minutes.',
        jsonb_build_object(
          'project_id', rec.id,
          'user_email', rec.email,
          'status', rec.status,
          'pipeline_stage', rec.pipeline_stage,
          'last_progress_at', v_last_progress,
          'href', '/admin/projects'
        ),
        'warn',
        'stuck:' || rec.id::text || ':' || to_char(v_last_progress, 'YYYYMMDDHH24MI'),
        3600
      );
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.video_url_is_temporary(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_temporary_video_url_risk() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.detect_stuck_pipeline_jobs() FROM PUBLIC, anon, authenticated;