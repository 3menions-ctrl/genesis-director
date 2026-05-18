
ALTER TABLE public.movie_projects
  ADD COLUMN IF NOT EXISTS credit_hold_id uuid REFERENCES public.credit_holds(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS movie_projects_credit_hold_idx
  ON public.movie_projects(credit_hold_id)
  WHERE credit_hold_id IS NOT NULL;

-- Reconciles credit holds against project lifecycle state.
-- Idempotent — relies on the underlying RPCs being idempotent.
--   * Project status = 'completed' & hold status = 'held' => consume
--   * Project status IN ('failed','canceled','deleted','draft') & hold = 'held' => release
--   * Holds past expires_at with no project linkage => mark expired (handled by expire_credit_holds)
CREATE OR REPLACE FUNCTION public.reconcile_pipeline_credit_holds()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r RECORD;
  v_consumed integer := 0;
  v_released integer := 0;
  v_expired integer := 0;
BEGIN
  -- 1) Expire any TTL-aged holds first (uses existing helper).
  SELECT public.expire_credit_holds() INTO v_expired;

  -- 2) Consume holds for projects that have already completed.
  FOR r IN
    SELECT mp.id AS project_id, mp.credit_hold_id, ch.amount
    FROM public.movie_projects mp
    JOIN public.credit_holds ch ON ch.id = mp.credit_hold_id
    WHERE mp.status = 'completed'
      AND ch.status = 'held'
  LOOP
    PERFORM public.consume_credit_hold(
      r.credit_hold_id,
      'Reconciliation: project completed',
      NULL
    );
    v_consumed := v_consumed + 1;
  END LOOP;

  -- 3) Release holds for projects that have terminally failed or been abandoned.
  FOR r IN
    SELECT mp.id AS project_id, mp.credit_hold_id
    FROM public.movie_projects mp
    JOIN public.credit_holds ch ON ch.id = mp.credit_hold_id
    WHERE mp.status IN ('failed','canceled','cancelled','deleted','draft')
      AND ch.status = 'held'
  LOOP
    PERFORM public.release_credit_hold(
      r.credit_hold_id,
      'Reconciliation: project ' || (SELECT status FROM public.movie_projects WHERE id = r.project_id)
    );
    v_released := v_released + 1;
  END LOOP;

  -- 4) Release holds older than 1 hour whose project is still 'generating'
  --    (pipeline-stuck safety net — credits return to user automatically).
  FOR r IN
    SELECT mp.id AS project_id, mp.credit_hold_id
    FROM public.movie_projects mp
    JOIN public.credit_holds ch ON ch.id = mp.credit_hold_id
    WHERE mp.status = 'generating'
      AND ch.status = 'held'
      AND ch.created_at < now() - interval '1 hour'
  LOOP
    PERFORM public.release_credit_hold(
      r.credit_hold_id,
      'Reconciliation: pipeline stuck > 1h'
    );
    v_released := v_released + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'consumed', v_consumed,
    'released', v_released,
    'expired', v_expired,
    'ranAt', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reconcile_pipeline_credit_holds() TO service_role;
