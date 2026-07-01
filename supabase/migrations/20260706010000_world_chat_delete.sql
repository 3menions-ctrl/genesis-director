-- ════════════════════════════════════════════════════════════════════════
-- World Chat — authors can delete their own messages.
--
-- Adds a DELETE RLS policy scoped to the author (user_id = auth.uid()), so a
-- user can remove only their own messages and never anyone else's. REPLICA
-- IDENTITY FULL makes the realtime DELETE payload carry the old row (incl. id)
-- so every subscriber can drop the message from their view live.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.world_chat REPLICA IDENTITY FULL;

DROP POLICY IF EXISTS "World chat owner delete" ON public.world_chat;
CREATE POLICY "World chat owner delete"
  ON public.world_chat FOR DELETE TO authenticated
  USING (user_id = auth.uid());
