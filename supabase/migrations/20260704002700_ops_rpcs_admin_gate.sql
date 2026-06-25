-- Gate platform-ops aggregate RPCs to admins (were EXECUTE-able by any
-- authenticated user, leaking platform-wide render failure/success counts).
-- SQL-level is_admin(auth.uid()) gate: non-admins get 0 rows; the admin
-- observability build still works. Applied to prod via Management API;
-- recorded as 20260704002700.
CREATE OR REPLACE FUNCTION public.render_failures_histogram(window_hours integer DEFAULT 24)
 RETURNS TABLE(classification text, n bigint) LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $fn$
  SELECT classification, count(*)::bigint AS n
  FROM public.render_failures
  WHERE created_at > now() - make_interval(hours => window_hours)
    AND public.is_admin(auth.uid())
  GROUP BY classification ORDER BY n DESC;
$fn$;
CREATE OR REPLACE FUNCTION public.render_success_snapshot(window_hours integer DEFAULT 24)
 RETURNS TABLE(failures bigint, projects_updated bigint, success_rate_pct numeric) LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $fn$
  WITH
    f AS (SELECT count(*)::bigint AS n FROM public.render_failures WHERE created_at > now() - make_interval(hours => window_hours)),
    s AS (SELECT count(*)::bigint AS n FROM public.movie_projects WHERE video_url IS NOT NULL AND updated_at > now() - make_interval(hours => window_hours))
  SELECT f.n AS failures, s.n AS projects_updated,
    CASE WHEN (f.n + s.n) = 0 THEN NULL ELSE round(100.0 * s.n / (f.n + s.n), 1) END AS success_rate_pct
  FROM f, s WHERE public.is_admin(auth.uid());
$fn$;
