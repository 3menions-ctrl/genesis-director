-- ─────────────────────────────────────────────────────────────────────────
-- admin_cogs_usage(p_days) — generation usage for the COGS-vs-Revenue pane.
-- Returns completed-clip counts + seconds grouped by NORMALIZED engine (the
-- stored tokens are inconsistent: 'wan'/'kling'/'kling-v3'/'veo'/'sora'/…).
-- The admin client multiplies these by the COST_MODEL (provider $/s + bundled
-- add-on per clip) to get COGS, and compares to revenue. is_admin-gated.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_cogs_usage(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_since timestamptz := now() - (GREATEST(p_days, 1) || ' days')::interval;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'windowDays', p_days,
    'byEngine', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'engine', engine, 'clips', clips, 'seconds', seconds
      ) ORDER BY clips DESC), '[]'::jsonb)
      FROM (
        SELECT
          CASE
            WHEN e ~* 'wan'      THEN 'wan-25'
            WHEN e ~* 'kling'    THEN 'kling-v3'
            WHEN e ~* 'seedance' THEN 'seedance-2'
            WHEN e ~* 'veo'      THEN 'veo-3'
            WHEN e ~* 'runway'   THEN 'runway-gen4'
            WHEN e ~* 'sora'     THEN 'sora-2'
            ELSE 'kling-v3'
          END AS engine,
          count(*) AS clips,
          COALESCE(sum(LEAST(GREATEST(vc.duration_seconds, 1), 60)), 0) AS seconds
        FROM video_clips vc
        JOIN movie_projects mp ON mp.id = vc.project_id
        CROSS JOIN LATERAL (SELECT COALESCE(mp.video_engine, mp.engine, 'kling-v3') AS e) m
        WHERE vc.video_url IS NOT NULL
          AND vc.created_at >= v_since
        GROUP BY 1
      ) q
    ),
    'totalClips', (
      SELECT count(*) FROM video_clips
      WHERE video_url IS NOT NULL AND created_at >= v_since
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_cogs_usage(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_cogs_usage(integer) TO authenticated, service_role;
