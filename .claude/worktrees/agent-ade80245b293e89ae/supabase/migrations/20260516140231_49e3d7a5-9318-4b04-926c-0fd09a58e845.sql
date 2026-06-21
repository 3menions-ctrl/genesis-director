-- ============================================================
-- D-01 PARTIAL: privatize zero-reference sensitive buckets
-- ============================================================
UPDATE storage.buckets SET public = false
WHERE id IN ('enterprise-brand-kits', 'genesis-castings', 'hoppy-uploads');

-- Owner-scoped policies (folder name = user id)
DO $$
DECLARE b text;
BEGIN
  FOREACH b IN ARRAY ARRAY['enterprise-brand-kits','genesis-castings','hoppy-uploads']
  LOOP
    EXECUTE format($f$
      DROP POLICY IF EXISTS "%1$s owner read"   ON storage.objects;
      DROP POLICY IF EXISTS "%1$s owner write"  ON storage.objects;
      DROP POLICY IF EXISTS "%1$s owner update" ON storage.objects;
      DROP POLICY IF EXISTS "%1$s owner delete" ON storage.objects;
    $f$, b);

    EXECUTE format($f$
      CREATE POLICY "%1$s owner read" ON storage.objects FOR SELECT
        USING (bucket_id = %1$L AND auth.uid()::text = (storage.foldername(name))[1]);
      CREATE POLICY "%1$s owner write" ON storage.objects FOR INSERT
        WITH CHECK (bucket_id = %1$L AND auth.uid()::text = (storage.foldername(name))[1]);
      CREATE POLICY "%1$s owner update" ON storage.objects FOR UPDATE
        USING (bucket_id = %1$L AND auth.uid()::text = (storage.foldername(name))[1]);
      CREATE POLICY "%1$s owner delete" ON storage.objects FOR DELETE
        USING (bucket_id = %1$L AND auth.uid()::text = (storage.foldername(name))[1]);
    $f$, b);
  END LOOP;
END $$;

-- ============================================================
-- D-02 PARTIAL: revoke EXECUTE on internal trigger functions
-- These are SECURITY DEFINER but only meant to fire as triggers,
-- never to be invoked over PostgREST/RPC by signed-in users.
-- Triggers ignore EXECUTE grants, so this is safe.
-- ============================================================
DO $$
DECLARE
  fn text;
  sig text;
BEGIN
  FOR fn, sig IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.proname IN (
        'audit_credits_balance_change',
        'auto_follow_admin_on_signup',
        'block_banned_signups',
        'add_org_creator_as_owner'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated', fn, sig);
  END LOOP;
END $$;