-- ════════════════════════════════════════════════════════════════════════
-- Realtime publication additions.
--
-- The realtime audit found subscriptions on tables that were never added
-- to the `supabase_realtime` publication, so their channels subscribed
-- successfully but no postgres_changes events ever fired — the live
-- features (premiere reaction strip, reel comment threads) silently
-- never updated.
--
-- Adding the confirmed tables. Each ADD is guarded so re-running is a
-- no-op. REPLICA IDENTITY FULL ensures DELETE/UPDATE payloads carry the
-- old row so client-side filters work.
-- ════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  -- premiere_reactions — drives PremiereLiveStrip's live reaction feed.
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'premiere_reactions'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.premiere_reactions';
  END IF;
  EXECUTE 'ALTER TABLE public.premiere_reactions REPLICA IDENTITY FULL';

  -- reel_comments — drives ImmersiveTheater's live comment thread.
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'reel_comments'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.reel_comments';
  END IF;
  EXECUTE 'ALTER TABLE public.reel_comments REPLICA IDENTITY FULL';
END $$;
