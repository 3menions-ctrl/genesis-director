-- Fix the conversation_members INSERT policy to allow self-joining world chat
-- The existing policy has a broken subquery (self-referencing alias)

DROP POLICY IF EXISTS "Users can join/be added" ON public.conversation_members;

CREATE POLICY "Users can join/be added" ON public.conversation_members
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    -- Users can add themselves to world chat
    (user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM conversations c WHERE c.id = conversation_id AND c.type = 'world'
    ))
    -- Or users can add themselves if they're owner/admin of the conversation
    OR (EXISTS (
      SELECT 1 FROM conversation_members cm
      WHERE cm.conversation_id = conversation_members.conversation_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
    ))
    -- Or being added via RPC (get_or_create_dm, create_group) which uses SECURITY DEFINER
  )
);