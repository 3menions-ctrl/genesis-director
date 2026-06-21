-- DB diagnostics: size, connections, per-table rows/size/scan stats.
CREATE OR REPLACE FUNCTION public.admin_db_diagnostics()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE res jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'admin only'; END IF;
  SELECT jsonb_build_object(
    'db_size_bytes', pg_database_size(current_database()),
    'connections', (SELECT count(*) FROM pg_stat_activity),
    'active_queries', (SELECT count(*) FROM pg_stat_activity WHERE state = 'active'),
    'tables', (SELECT coalesce(jsonb_agg(t ORDER BY t.bytes DESC), '[]'::jsonb) FROM (
        SELECT relname AS "table",
               n_live_tup AS rows,
               n_dead_tup AS dead_rows,
               pg_total_relation_size(relid) AS bytes,
               coalesce(seq_scan, 0) AS seq_scans,
               coalesce(idx_scan, 0) AS idx_scans
        FROM pg_stat_user_tables
        ORDER BY pg_total_relation_size(relid) DESC LIMIT 40) t)
  ) INTO res;
  RETURN res;
END$$;
REVOKE ALL ON FUNCTION public.admin_db_diagnostics() FROM public;
GRANT EXECUTE ON FUNCTION public.admin_db_diagnostics() TO authenticated;
