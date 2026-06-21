
-- 1. Fix stuck-job detector: real table is movie_projects
CREATE OR REPLACE FUNCTION public.detect_stuck_pipeline_jobs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count int := 0;
  rec record;
BEGIN
  FOR rec IN
    SELECT p.id, p.user_id, p.status, p.created_at, u.email
    FROM public.movie_projects p
    LEFT JOIN auth.users u ON u.id = p.user_id
    WHERE p.status IN ('generating','rendering','processing','queued','pending')
      AND p.created_at < now() - interval '30 minutes'
      AND p.created_at > now() - interval '24 hours'
  LOOP
    PERFORM public.notify_admins_v2(
      'admin_stuck_job',
      'Stuck pipeline job — ' || rec.status,
      'Project ' || substring(rec.id::text, 1, 8) || ' by ' || COALESCE(rec.email, 'unknown') ||
        ' stuck for ' || round(extract(epoch from (now() - rec.created_at)) / 60) || ' minutes.',
      jsonb_build_object('project_id', rec.id, 'user_email', rec.email, 'status', rec.status, 'href', '/admin/projects'),
      'warn',
      'stuck:' || rec.id::text,
      86400
    );
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- 2. First successful video — lifetime per user
CREATE OR REPLACE FUNCTION public.trg_notify_admin_first_video()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_email text;
  v_prior int;
BEGIN
  IF NEW.video_url IS NULL OR (OLD.video_url IS NOT NULL AND OLD.video_url = NEW.video_url) THEN
    RETURN NEW;
  END IF;
  SELECT count(*) INTO v_prior FROM public.movie_projects
    WHERE user_id = NEW.user_id AND id <> NEW.id AND video_url IS NOT NULL;
  IF v_prior > 0 THEN RETURN NEW; END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = NEW.user_id;
  PERFORM public.notify_admins_v2(
    'admin_first_video',
    'First ship — ' || COALESCE(v_email, 'unknown'),
    COALESCE(NEW.title, 'Untitled') || ' just completed their first video.',
    jsonb_build_object('user_email', v_email, 'project_id', NEW.id, 'title', NEW.title, 'href', '/admin/users'),
    'info',
    'first_video:' || NEW.user_id::text,
    0
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_first_video ON public.movie_projects;
CREATE TRIGGER trg_admin_first_video
  AFTER UPDATE OF video_url ON public.movie_projects
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_admin_first_video();

-- 3. Abuse signal — moderation flag
CREATE OR REPLACE FUNCTION public.trg_notify_admin_abuse()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_email text;
BEGIN
  IF NEW.moderation_status IS NULL OR NEW.moderation_status NOT IN ('flagged','blocked','rejected')
     OR (OLD.moderation_status IS NOT DISTINCT FROM NEW.moderation_status) THEN
    RETURN NEW;
  END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = NEW.user_id;
  PERFORM public.notify_admins_v2(
    'admin_abuse_signal',
    'Content flagged — ' || NEW.moderation_status,
    'Project ' || substring(NEW.id::text, 1, 8) || ' by ' || COALESCE(v_email, 'unknown') || ' was ' || NEW.moderation_status || '.',
    jsonb_build_object('project_id', NEW.id, 'user_email', v_email, 'moderation_status', NEW.moderation_status, 'href', '/admin/moderation'),
    'critical',
    'abuse:' || NEW.id::text,
    3600
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_abuse_signal ON public.movie_projects;
CREATE TRIGGER trg_admin_abuse_signal
  AFTER UPDATE OF moderation_status ON public.movie_projects
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_admin_abuse();

-- 4. Error spike — 5+ critical errors in 10min, dedupe 30min
CREATE OR REPLACE FUNCTION public.trg_notify_admin_error_spike()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_count int;
BEGIN
  IF NEW.severity NOT IN ('critical','high','error') THEN RETURN NEW; END IF;
  SELECT count(*) INTO v_count FROM public.error_reports
    WHERE severity IN ('critical','high','error') AND occurred_at > now() - interval '10 minutes';
  IF v_count < 5 THEN RETURN NEW; END IF;
  PERFORM public.notify_admins_v2(
    'admin_error_spike',
    'Error spike — ' || v_count || ' in 10min',
    'Category: ' || COALESCE(NEW.category, 'unknown') || ' · Code: ' || COALESCE(NEW.code, '—'),
    jsonb_build_object('count_10min', v_count, 'latest_code', NEW.code, 'category', NEW.category, 'href', '/admin/failed'),
    'critical',
    'error_spike:' || to_char(now(), 'YYYYMMDDHH24MI'),
    1800
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_error_spike ON public.error_reports;
CREATE TRIGGER trg_admin_error_spike
  AFTER INSERT ON public.error_reports
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_admin_error_spike();
