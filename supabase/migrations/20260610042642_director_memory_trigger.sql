-- Director Memory writer — silent personalization triggered on every
-- successful movie_projects completion. Reads mode / style / aspect /
-- duration from the project row and folds them into the user's
-- director_memory rolling-counts. Picks the highest-count value as the
-- "preferred X" for the user so the Library Signature card surfaces a
-- meaningful preference without polling.

CREATE OR REPLACE FUNCTION public.fold_director_memory()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_modes jsonb;
  v_styles jsonb;
  v_aspects jsonb;
  v_pref_mode text;
  v_pref_style text;
  v_pref_aspect text;
  v_clip_dur int;
BEGIN
  -- Only fold on a clean transition into "completed".
  IF NEW.status IS DISTINCT FROM 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Ensure a row exists.
  INSERT INTO public.director_memory (user_id)
  VALUES (NEW.user_id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Increment the rolling counts.
  SELECT COALESCE(mode_counts, '{}'::jsonb), COALESCE(style_counts, '{}'::jsonb), COALESCE(aspect_counts, '{}'::jsonb)
  INTO v_modes, v_styles, v_aspects
  FROM public.director_memory WHERE user_id = NEW.user_id;

  IF NEW.mode IS NOT NULL THEN
    v_modes := jsonb_set(
      v_modes,
      ARRAY[NEW.mode],
      to_jsonb(COALESCE((v_modes ->> NEW.mode)::int, 0) + 1)
    );
  END IF;

  IF (NEW.pending_video_tasks ->> 'style') IS NOT NULL THEN
    v_styles := jsonb_set(
      v_styles,
      ARRAY[NEW.pending_video_tasks ->> 'style'],
      to_jsonb(COALESCE((v_styles ->> (NEW.pending_video_tasks ->> 'style'))::int, 0) + 1)
    );
  END IF;

  IF NEW.aspect_ratio IS NOT NULL THEN
    v_aspects := jsonb_set(
      v_aspects,
      ARRAY[NEW.aspect_ratio],
      to_jsonb(COALESCE((v_aspects ->> NEW.aspect_ratio)::int, 0) + 1)
    );
  END IF;

  -- Pick the highest-count value for each preference.
  SELECT key INTO v_pref_mode
  FROM jsonb_each_text(v_modes)
  ORDER BY (value::int) DESC NULLS LAST
  LIMIT 1;

  SELECT key INTO v_pref_style
  FROM jsonb_each_text(v_styles)
  ORDER BY (value::int) DESC NULLS LAST
  LIMIT 1;

  SELECT key INTO v_pref_aspect
  FROM jsonb_each_text(v_aspects)
  ORDER BY (value::int) DESC NULLS LAST
  LIMIT 1;

  v_clip_dur := COALESCE(
    (NEW.pending_video_tasks ->> 'clipDuration')::int,
    (NEW.pending_video_tasks ->> 'duration')::int,
    NULL
  );

  UPDATE public.director_memory
  SET
    preferred_mode = COALESCE(v_pref_mode, preferred_mode),
    preferred_style = COALESCE(v_pref_style, preferred_style),
    preferred_aspect_ratio = COALESCE(v_pref_aspect, preferred_aspect_ratio),
    preferred_clip_duration = COALESCE(v_clip_dur, preferred_clip_duration),
    mode_counts = v_modes,
    style_counts = v_styles,
    aspect_counts = v_aspects,
    total_projects = total_projects + 1,
    last_active_at = now(),
    updated_at = now()
  WHERE user_id = NEW.user_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fold_director_memory ON public.movie_projects;
CREATE TRIGGER trg_fold_director_memory
AFTER UPDATE OF status ON public.movie_projects
FOR EACH ROW
EXECUTE FUNCTION public.fold_director_memory();

COMMENT ON FUNCTION public.fold_director_memory IS
  'Silently personalize director_memory after every successful project. Rolling counts + top-preference snapshot.';
