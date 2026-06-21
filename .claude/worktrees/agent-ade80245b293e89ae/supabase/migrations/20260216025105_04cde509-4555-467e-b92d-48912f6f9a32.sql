-- Allow all authenticated users to read world chat messages without being a member
DROP POLICY IF EXISTS "Members can view messages" ON public.chat_messages;

CREATE POLICY "Members can view messages" ON public.chat_messages
FOR SELECT USING (
  is_conversation_member(conversation_id, auth.uid())
  OR EXISTS (
    SELECT 1 FROM conversations c 
    WHERE c.id = conversation_id AND c.type = 'world'
  )
);

-- Also allow all authenticated users to send messages to world chat
DROP POLICY IF EXISTS "Members can send messages" ON public.chat_messages;

CREATE POLICY "Members can send messages" ON public.chat_messages
FOR INSERT WITH CHECK (
  auth.uid() = user_id 
  AND (
    is_conversation_member(conversation_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM conversations c 
      WHERE c.id = conversation_id AND c.type = 'world'
    )
  )
);

-- Allow viewing world chat conversation members without being a member
DROP POLICY IF EXISTS "Members can view conversation members" ON public.conversation_members;

CREATE POLICY "Members can view conversation members" ON public.conversation_members
FOR SELECT USING (
  is_conversation_member(conversation_id, auth.uid())
  OR EXISTS (
    SELECT 1 FROM conversations c 
    WHERE c.id = conversation_id AND c.type = 'world'
  )
);