-- ─────────────────────────────────────────────────────────────────────────
-- H1: the storage "gate" was toothless — bill_storage() was admin-only, never
-- scheduled, only charged what a user could afford, and there was NO ceiling
-- and NO pre-upload gate. This adds:
--   1. A per-user hard storage CEILING (plan-aware), enforced server-side via a
--      RESTRICTIVE RLS policy on storage.objects INSERT (un-bypassable by the
--      client). Policy: "Block new actions, keep data" — once a user is over the
--      ceiling, further user-initiated uploads are blocked; nothing is deleted.
--   2. storage_quota_status() for the client/edge to pre-check + show usage.
--   3. Cron scheduling of compute_storage_usage (daily) + bill_storage (monthly)
--      so metering/billing actually run.
-- Service-role (pipeline) writes bypass RLS, so generated outputs are never
-- blocked; only end-user direct uploads are gated.
-- ─────────────────────────────────────────────────────────────────────────

INSERT INTO public.system_config(key, value) VALUES
  ('storage.ceiling_free_gb', '5'::jsonb),     -- hard cap for users with no active subscription
  ('storage.ceiling_paid_gb', '200'::jsonb)    -- hard cap for active subscribers
ON CONFLICT (key) DO NOTHING;

-- Bytes currently attributed to a user (owner, else {uuid}/ path prefix) —
-- mirrors compute_storage_usage's attribution.
CREATE OR REPLACE FUNCTION public.storage_user_bytes(p_user_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, storage
AS $$
  SELECT COALESCE(SUM(coalesce((metadata->>'size')::bigint, 0)), 0)::bigint
  FROM storage.objects
  WHERE CASE
          WHEN owner IS NOT NULL THEN owner = p_user_id
          WHEN split_part(name,'/',1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-' THEN split_part(name,'/',1)::uuid = p_user_id
          ELSE false
        END;
$$;
REVOKE ALL ON FUNCTION public.storage_user_bytes(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.storage_user_bytes(uuid) TO authenticated, service_role;

-- Plan-aware ceiling in bytes.
CREATE OR REPLACE FUNCTION public.storage_ceiling_bytes(p_user_id uuid)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE gb numeric;
BEGIN
  IF public.has_active_subscription(p_user_id) THEN
    SELECT coalesce((value)::numeric, 200) INTO gb FROM public.system_config WHERE key = 'storage.ceiling_paid_gb';
  ELSE
    SELECT coalesce((value)::numeric, 5)   INTO gb FROM public.system_config WHERE key = 'storage.ceiling_free_gb';
  END IF;
  RETURN (coalesce(gb, 5) * 1e9)::bigint;
END;
$$;
REVOKE ALL ON FUNCTION public.storage_ceiling_bytes(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.storage_ceiling_bytes(uuid) TO authenticated, service_role;

-- Boolean used by the RLS gate: is the user still under their ceiling?
-- NULL caller (no auth.uid) → true so service-role / internal paths are unaffected.
CREATE OR REPLACE FUNCTION public.storage_under_ceiling(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_user_id IS NULL
      OR public.storage_user_bytes(p_user_id) < public.storage_ceiling_bytes(p_user_id);
$$;
REVOKE ALL ON FUNCTION public.storage_under_ceiling(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.storage_under_ceiling(uuid) TO authenticated, service_role;

-- Self-or-admin usage snapshot for the client/edge pre-check.
CREATE OR REPLACE FUNCTION public.storage_quota_status(p_user_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE used bigint; ceiling bigint;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;
  IF p_user_id <> auth.uid() AND NOT public.is_admin(auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  used := public.storage_user_bytes(p_user_id);
  ceiling := public.storage_ceiling_bytes(p_user_id);
  RETURN jsonb_build_object(
    'ok', true,
    'used_bytes', used,
    'ceiling_bytes', ceiling,
    'over', used >= ceiling
  );
END;
$$;
REVOKE ALL ON FUNCTION public.storage_quota_status(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.storage_quota_status(uuid) TO authenticated;

-- Server-side ceiling gate. RESTRICTIVE → AND-combined with the existing
-- owner-scoped permissive INSERT policies. Applies only to user-content buckets;
-- everything else (avatars, thumbnails, system buckets) and all service-role
-- writes are unaffected.
DROP POLICY IF EXISTS storage_quota_ceiling ON storage.objects;
CREATE POLICY storage_quota_ceiling ON storage.objects
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id NOT IN ('user-uploads','video-clips','voice-tracks','videos','genesis-castings')
    OR public.storage_under_ceiling(auth.uid())
  );

-- Schedule metering + billing (idempotent; no-op where pg_cron is unavailable).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron not installed — skipping storage metering/billing scheduling.';
    RETURN;
  END IF;

  PERFORM cron.unschedule('storage-meter-daily')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'storage-meter-daily');
  PERFORM cron.unschedule('storage-bill-monthly')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'storage-bill-monthly');

  -- Snapshot per-user usage daily at 04:17 UTC.
  PERFORM cron.schedule(
    'storage-meter-daily',
    '17 4 * * *',
    $cron$ SELECT public.compute_storage_usage(); $cron$
  );

  -- Bill storage overage on the 1st of each month at 06:00 UTC.
  PERFORM cron.schedule(
    'storage-bill-monthly',
    '0 6 1 * *',
    $cron$ SELECT public.bill_storage(); $cron$
  );
END $$;
