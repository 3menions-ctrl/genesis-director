-- =====================================================================
-- M3 — DB-backed rate limiter
-- =====================================================================
-- The edge functions previously relied on in-memory (per-isolate)
-- token buckets. Those are best-effort only: Supabase runs many isolates
-- and recycles them constantly, so a determined caller (or a spoofed IP)
-- could blow past the intended limit. This migration adds a shared,
-- atomic, DB-backed counter so money-spending / abuse-prone endpoints can
-- enforce a real global budget.
--
-- Design:
--   * One row per (key, window_start) bucket.
--   * `rate_limit_hit()` atomically increments the bucket via
--     INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING and reports
--     whether the caller is still within `p_limit`.
--   * Service-role only — no anon/authenticated policies. Callers reach
--     it exclusively through the service client inside edge functions.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.rate_limit_counters (
  key          text        NOT NULL,
  window_start timestamptz NOT NULL,
  count        integer     NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);

-- Old windows are disposable; an existing cleanup cron can prune them by
-- window_start. Index supports both the prune scan and ad-hoc reporting.
CREATE INDEX IF NOT EXISTS idx_rate_limit_counters_window
  ON public.rate_limit_counters (window_start);

ALTER TABLE public.rate_limit_counters ENABLE ROW LEVEL SECURITY;
-- NOTE: intentionally NO policies for anon/authenticated. With RLS enabled
-- and no permissive policies, only the service role (which bypasses RLS)
-- and the SECURITY DEFINER function below can touch this table.

-- ---------------------------------------------------------------------
-- rate_limit_hit(p_key, p_limit, p_window_seconds) -> boolean
--   Returns TRUE  -> request is ALLOWED (count after increment <= limit)
--   Returns FALSE -> request is LIMITED (count after increment >  limit)
-- Atomic: the INSERT ... ON CONFLICT DO UPDATE ... RETURNING runs as a
-- single statement, so concurrent callers cannot race past the limit.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rate_limit_hit(
  p_key            text,
  p_limit          integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window  integer := GREATEST(COALESCE(p_window_seconds, 60), 1);
  v_bucket  timestamptz;
  v_count   integer;
BEGIN
  IF p_key IS NULL OR length(p_key) = 0 THEN
    RAISE EXCEPTION 'rate_limit_hit requires a non-empty key';
  END IF;

  -- Current window bucket: floor(epoch / window) * window, as a timestamptz.
  v_bucket := to_timestamp(
    floor(extract(epoch FROM now()) / v_window) * v_window
  );

  INSERT INTO public.rate_limit_counters (key, window_start, count)
  VALUES (p_key, v_bucket, 1)
  ON CONFLICT (key, window_start)
  DO UPDATE SET count = public.rate_limit_counters.count + 1
  RETURNING count INTO v_count;

  -- Allowed while we are within the limit (inclusive).
  RETURN v_count <= GREATEST(COALESCE(p_limit, 0), 0);
END;
$$;

-- Lock the function down to service-role callers only.
REVOKE EXECUTE ON FUNCTION public.rate_limit_hit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.rate_limit_hit(text, integer, integer) TO service_role;
