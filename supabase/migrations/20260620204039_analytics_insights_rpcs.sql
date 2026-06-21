-- Insights engine: lifecycle funnel (source-of-truth tables, backfilled),
-- flexible sequential event funnel (over analytics_events), and journey paths.

-- 1) Lifecycle funnel — the core product funnel, computed from authoritative tables.
CREATE OR REPLACE FUNCTION public.analytics_lifecycle_funnel(_since timestamptz DEFAULT now() - interval '365 days')
RETURNS TABLE(step text, step_order int, users bigint, pct numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE base numeric;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'admin only'; END IF;
  SELECT count(*)::numeric INTO base FROM public.profiles WHERE created_at >= _since;
  base := greatest(base, 1);
  RETURN QUERY
  WITH cohort AS (SELECT id AS uid, onboarding_completed FROM public.profiles WHERE created_at >= _since)
  SELECT s.st, s.ord, s.u::bigint, round(100.0 * s.u / base, 1)
  FROM (
    SELECT 1 ord, 'Signed up'::text st, (SELECT count(*) FROM cohort) u
    UNION ALL SELECT 2, 'Onboarded', (SELECT count(*) FROM cohort WHERE onboarding_completed)
    UNION ALL SELECT 3, 'Created a project', (SELECT count(*) FROM cohort c WHERE EXISTS (SELECT 1 FROM public.movie_projects m WHERE m.user_id = c.uid))
    UNION ALL SELECT 4, 'Completed a render', (SELECT count(*) FROM cohort c WHERE EXISTS (SELECT 1 FROM public.movie_projects m WHERE m.user_id = c.uid AND m.status = 'completed'))
    UNION ALL SELECT 5, 'Published a film', (SELECT count(*) FROM cohort c WHERE EXISTS (SELECT 1 FROM public.published_reels r WHERE r.creator_id = c.uid))
    UNION ALL SELECT 6, 'Paid', (SELECT count(*) FROM cohort c WHERE EXISTS (SELECT 1 FROM public.credit_transactions t WHERE t.user_id = c.uid AND (t.transaction_type = 'purchase' OR t.stripe_payment_id IS NOT NULL)))
  ) s ORDER BY s.ord;
END$$;
REVOKE ALL ON FUNCTION public.analytics_lifecycle_funnel(timestamptz) FROM public;
GRANT EXECUTE ON FUNCTION public.analytics_lifecycle_funnel(timestamptz) TO authenticated;

-- 2) Flexible sequential funnel over arbitrary tracked events (ordered, time-respecting).
CREATE OR REPLACE FUNCTION public.analytics_funnel(_steps text[], _since timestamptz DEFAULT now() - interval '30 days')
RETURNS TABLE(step text, step_order int, users bigint, pct numeric)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE i int; base numeric; cur bigint;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'admin only'; END IF;
  IF array_length(_steps, 1) IS NULL THEN RETURN; END IF;
  CREATE TEMP TABLE _f (actor text, t timestamptz) ON COMMIT DROP;
  INSERT INTO _f
    SELECT coalesce(user_id::text, anonymous_id) AS actor, min(occurred_at)
    FROM public.analytics_events WHERE occurred_at >= _since AND name = _steps[1]
    GROUP BY coalesce(user_id::text, anonymous_id);
  base := greatest((SELECT count(*) FROM _f), 1);
  step := _steps[1]; step_order := 1; users := (SELECT count(*) FROM _f); pct := 100.0; RETURN NEXT;
  FOR i IN 2 .. array_length(_steps, 1) LOOP
    CREATE TEMP TABLE _n (actor text, t timestamptz) ON COMMIT DROP;
    INSERT INTO _n
      SELECT f.actor, min(e.occurred_at)
      FROM _f f JOIN public.analytics_events e
        ON coalesce(e.user_id::text, e.anonymous_id) = f.actor
       AND e.name = _steps[i] AND e.occurred_at >= f.t
      GROUP BY f.actor;
    DROP TABLE _f; ALTER TABLE _n RENAME TO _f;
    cur := (SELECT count(*) FROM _f);
    step := _steps[i]; step_order := i; users := cur; pct := round(100.0 * cur / base, 1); RETURN NEXT;
  END LOOP;
END$$;
REVOKE ALL ON FUNCTION public.analytics_funnel(text[], timestamptz) FROM public;
GRANT EXECUTE ON FUNCTION public.analytics_funnel(text[], timestamptz) TO authenticated;

-- 3) Journey paths — most common pageview transitions within sessions.
CREATE OR REPLACE FUNCTION public.analytics_paths(_since timestamptz DEFAULT now() - interval '30 days', _limit int DEFAULT 25)
RETURNS TABLE(from_path text, to_path text, transitions bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH pv AS (
    SELECT session_id, path,
           lead(path) OVER (PARTITION BY session_id ORDER BY occurred_at) AS nxt
    FROM public.analytics_events
    WHERE public.is_admin(auth.uid()) AND name = '$pageview' AND occurred_at >= _since AND session_id IS NOT NULL
  )
  SELECT path, nxt, count(*)::bigint
  FROM pv WHERE nxt IS NOT NULL AND nxt <> path
  GROUP BY path, nxt ORDER BY count(*) DESC LIMIT _limit
$$;
REVOKE ALL ON FUNCTION public.analytics_paths(timestamptz, int) FROM public;
GRANT EXECUTE ON FUNCTION public.analytics_paths(timestamptz, int) TO authenticated;
