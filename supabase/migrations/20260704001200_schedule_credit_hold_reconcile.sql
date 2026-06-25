-- AUDIT FIX (High): the credit-hold safety net was never scheduled.
--
-- reconcile_pipeline_credit_holds() (20260518165621) consumes completed-project
-- holds, releases holds for failed/canceled/deleted projects, and releases
-- stuck 'generating' holds older than 1h. expire_credit_holds() flips aged holds
-- to 'expired'. Neither was ever scheduled — the only runtime trigger for expiry
-- is lazily inside reserve_credits/deduct_credits, and the reconciler had no
-- caller at all. So orphaned/stuck holds (e.g. the null-projectId leak this audit
-- found, and any missed consume/release) were never healed automatically.
--
-- Schedule both via pg_cron (DB-only; both are SQL/plpgsql functions, no HTTP or
-- vault secret needed). Idempotent: unschedule any prior job of the same name
-- first. Guarded so the migration is a no-op where pg_cron is unavailable
-- (e.g. local/CI), keeping the chain applying cleanly everywhere.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron not installed — skipping credit-hold reconcile scheduling.';
    RETURN;
  END IF;

  -- Drop prior jobs if present (re-runnable).
  PERFORM cron.unschedule('reconcile-credit-holds')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reconcile-credit-holds');
  PERFORM cron.unschedule('expire-credit-holds')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-credit-holds');

  -- Reconcile pipeline holds every 5 minutes.
  PERFORM cron.schedule(
    'reconcile-credit-holds',
    '*/5 * * * *',
    $cron$ SELECT public.reconcile_pipeline_credit_holds(); $cron$
  );

  -- Expire aged 'held' holds every 5 minutes (independent backstop).
  PERFORM cron.schedule(
    'expire-credit-holds',
    '*/5 * * * *',
    $cron$ SELECT public.expire_credit_holds(); $cron$
  );
END $$;
