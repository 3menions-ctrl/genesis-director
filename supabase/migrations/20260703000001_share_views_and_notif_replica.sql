-- NOTE: renamed from version 20260703000000 → 20260703000001 to resolve a
-- three-file version collision (all three shared 20260703000000, so the CLI
-- could only record one). All effects here are already live on prod and this
-- migration is idempotent (CREATE OR REPLACE + idempotent ALTER); re-applying
-- is a no-op. See MIGRATION_BACKLOG_AUDIT.md.
--
-- Atomic share view-count increment + notifications realtime DELETE fix.
--
-- 1) PublicShare incremented view_count with a client-side read-modify-write
--    (view_count = shareRow.view_count + 1). That both races (concurrent
--    viewers overwrite each other) AND silently no-ops for non-owners, because
--    the only UPDATE policy on project_shares is owner-only (shares_owner_all).
--    A SECURITY DEFINER RPC performs the increment atomically and lets any
--    visitor (anon/authenticated) bump the counter without a broad UPDATE grant.
CREATE OR REPLACE FUNCTION public.increment_share_view_count(p_share_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.project_shares
  SET view_count = view_count + 1
  WHERE id = p_share_id AND is_public = true;
$$;

GRANT EXECUTE ON FUNCTION public.increment_share_view_count(uuid) TO anon, authenticated;

-- 2) The notifications realtime DELETE handler filters on user_id, but with the
--    default replica identity a DELETE's WAL record carries only the primary
--    key, so the filter never matches and the event is dropped. The client now
--    updates its cache optimistically, but FULL replica identity makes the
--    server-side DELETE event fire correctly too (belt and suspenders).
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
