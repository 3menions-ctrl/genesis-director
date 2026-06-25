-- =====================================================================
-- M7 — free-tier atomic reservation (close the TOCTOU race)
-- =====================================================================
-- free-tier-generate previously did:
--     read free_tier_status   (count today's attempts)
--     ... then later ...
--     insert a 'started' attempt row
-- Two concurrent requests could both pass the read before either insert
-- landed, letting a user exceed their daily free render cap.
--
-- free_tier_try_consume() collapses the check-and-insert into one
-- serialized, atomic operation:
--   * Takes a per-user transaction advisory lock so concurrent calls for
--     the same user run one-at-a-time.
--   * Re-counts today's consuming attempts ('started'|'succeeded') under
--     the lock.
--   * Inserts a fresh 'started' attempt and returns TRUE only if the
--     post-insert total stays within p_daily_limit; otherwise records a
--     'rate_limit' attempt (not counted) and returns FALSE.
--
-- Columns match public.free_tier_attempts as defined in
-- 20260610050316_free_tier_caps.sql.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.free_tier_try_consume(
  p_user_id    uuid,
  p_daily_limit integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_day_start  timestamptz := date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_used       integer;
  v_model_cost numeric;
  v_limit      integer := GREATEST(COALESCE(p_daily_limit, 0), 0);
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'free_tier_try_consume requires a user id';
  END IF;

  -- Serialize concurrent attempts for THIS user (released at txn end).
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  SELECT count(*) INTO v_used
  FROM public.free_tier_attempts
  WHERE user_id = p_user_id
    AND created_at >= v_day_start
    AND status IN ('started', 'succeeded');

  IF v_used >= v_limit THEN
    -- Over cap: log a (non-counted) rate_limit attempt for observability.
    INSERT INTO public.free_tier_attempts (user_id, status)
    VALUES (p_user_id, 'rate_limit');
    RETURN FALSE;
  END IF;

  SELECT (value::text)::numeric INTO v_model_cost
  FROM public.system_config WHERE key = 'free_tier.model_cost_usd';
  IF v_model_cost IS NULL THEN v_model_cost := 0.05; END IF;

  INSERT INTO public.free_tier_attempts (user_id, status, estimated_cost_usd)
  VALUES (p_user_id, 'started', v_model_cost);

  RETURN TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.free_tier_try_consume(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.free_tier_try_consume(uuid, integer) TO service_role;
