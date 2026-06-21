-- Web/traffic analytics over the first-party pageview stream.

CREATE OR REPLACE FUNCTION public.analytics_traffic(_since timestamptz DEFAULT now() - interval '30 days')
RETURNS TABLE(visitors bigint, sessions bigint, pageviews bigint, bounce_rate numeric, avg_session_seconds numeric, pages_per_session numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH pv AS (
    SELECT coalesce(user_id::text, anonymous_id) AS actor, session_id, occurred_at
    FROM public.analytics_events
    WHERE public.is_admin(auth.uid()) AND name = '$pageview' AND occurred_at >= _since AND session_id IS NOT NULL
  ), sess AS (
    SELECT session_id, count(*) AS views,
           extract(epoch FROM (max(occurred_at) - min(occurred_at)))::numeric AS secs
    FROM pv GROUP BY session_id
  )
  SELECT (SELECT count(DISTINCT actor) FROM pv)::bigint,
         count(*)::bigint,
         (SELECT count(*) FROM pv)::bigint,
         round(100.0 * count(*) FILTER (WHERE views = 1) / greatest(count(*), 1), 1),
         round(coalesce(avg(secs), 0), 1),
         round((SELECT count(*) FROM pv)::numeric / greatest(count(*), 1), 2)
  FROM sess;
$$;
REVOKE ALL ON FUNCTION public.analytics_traffic(timestamptz) FROM public;
GRANT EXECUTE ON FUNCTION public.analytics_traffic(timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.analytics_visitors_daily(_since timestamptz DEFAULT now() - interval '30 days')
RETURNS TABLE(day date, visitors bigint, sessions bigint, pageviews bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH pv AS (
    SELECT coalesce(user_id::text, anonymous_id) AS actor, session_id, occurred_at::date AS d
    FROM public.analytics_events
    WHERE public.is_admin(auth.uid()) AND name = '$pageview' AND occurred_at >= _since
  )
  SELECT d, count(DISTINCT actor)::bigint, count(DISTINCT session_id)::bigint, count(*)::bigint
  FROM pv GROUP BY d ORDER BY d;
$$;
REVOKE ALL ON FUNCTION public.analytics_visitors_daily(timestamptz) FROM public;
GRANT EXECUTE ON FUNCTION public.analytics_visitors_daily(timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.analytics_top_pages(_since timestamptz DEFAULT now() - interval '30 days', _limit int DEFAULT 20)
RETURNS TABLE(path text, views bigint, visitors bigint, avg_seconds numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH pv AS (
    SELECT coalesce(user_id::text, anonymous_id) AS actor, path, occurred_at,
           lead(occurred_at) OVER (PARTITION BY session_id ORDER BY occurred_at) AS nxt
    FROM public.analytics_events
    WHERE public.is_admin(auth.uid()) AND name = '$pageview' AND occurred_at >= _since
  )
  SELECT path, count(*)::bigint, count(DISTINCT actor)::bigint,
         round(coalesce(avg(extract(epoch FROM (nxt - occurred_at)))
           FILTER (WHERE nxt IS NOT NULL AND (nxt - occurred_at) < interval '30 minutes'), 0)::numeric, 1)
  FROM pv GROUP BY path ORDER BY count(*) DESC LIMIT _limit;
$$;
REVOKE ALL ON FUNCTION public.analytics_top_pages(timestamptz, int) FROM public;
GRANT EXECUTE ON FUNCTION public.analytics_top_pages(timestamptz, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.analytics_top_searches(_since timestamptz DEFAULT now() - interval '30 days', _limit int DEFAULT 25)
RETURNS TABLE(query text, searches bigint, actors bigint, avg_results numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT payload->>'query',
         count(*)::bigint,
         count(DISTINCT coalesce(user_id::text, anonymous_id))::bigint,
         round(avg((coalesce(payload->>'reels','0'))::numeric + (coalesce(payload->>'creators','0'))::numeric), 1)
  FROM public.analytics_events
  WHERE public.is_admin(auth.uid()) AND name = 'search' AND occurred_at >= _since AND payload->>'query' IS NOT NULL
  GROUP BY payload->>'query' ORDER BY count(*) DESC LIMIT _limit;
$$;
REVOKE ALL ON FUNCTION public.analytics_top_searches(timestamptz, int) FROM public;
GRANT EXECUTE ON FUNCTION public.analytics_top_searches(timestamptz, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.analytics_segment(_dim text, _since timestamptz DEFAULT now() - interval '30 days', _limit int DEFAULT 12)
RETURNS TABLE(key text, sessions bigint, visitors bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT context->>_dim,
         count(DISTINCT session_id)::bigint,
         count(DISTINCT coalesce(user_id::text, anonymous_id))::bigint
  FROM public.analytics_events
  WHERE public.is_admin(auth.uid()) AND occurred_at >= _since AND context->>_dim IS NOT NULL AND context->>_dim <> ''
  GROUP BY context->>_dim ORDER BY count(DISTINCT session_id) DESC LIMIT _limit;
$$;
REVOKE ALL ON FUNCTION public.analytics_segment(text, timestamptz, int) FROM public;
GRANT EXECUTE ON FUNCTION public.analytics_segment(text, timestamptz, int) TO authenticated;
