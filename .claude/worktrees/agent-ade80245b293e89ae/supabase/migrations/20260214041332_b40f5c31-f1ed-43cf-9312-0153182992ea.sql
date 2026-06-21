
-- ═══════════════════════════════════════════════════════
-- PREMIUM CHAT SYSTEM - Conversations, Groups, Reactions, Presence
-- ═══════════════════════════════════════════════════════

-- Conversations table (unified: DM or group)
CREATE TABLE public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'dm' CHECK (type IN ('dm', 'group', 'world')),
  name TEXT, -- NULL for DMs, name for groups
  avatar_url TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ DEFAULT now(),
  last_message_preview TEXT
);

-- Conversation members
CREATE TABLE public.conversation_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_at TIMESTAMPTZ DEFAULT now(),
  is_muted BOOLEAN DEFAULT false,
  UNIQUE(conversation_id, user_id)
);

-- Chat messages (unified for DM, group, and world)
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  reply_to_id UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video', 'system')),
  media_url TEXT,
  media_thumbnail_url TEXT,
  is_edited BOOLEAN DEFAULT false,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Message reactions
CREATE TABLE public.chat_message_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

-- User presence (online/typing)
CREATE TABLE public.user_presence (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'away', 'offline')),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  typing_in_conversation UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_conversation_members_user ON public.conversation_members(user_id);
CREATE INDEX idx_conversation_members_conv ON public.conversation_members(conversation_id);
CREATE INDEX idx_chat_messages_conv ON public.chat_messages(conversation_id, created_at DESC);
CREATE INDEX idx_chat_messages_user ON public.chat_messages(user_id);
CREATE INDEX idx_chat_message_reactions_msg ON public.chat_message_reactions(message_id);
CREATE INDEX idx_user_presence_status ON public.user_presence(status);
CREATE INDEX idx_conversations_last_msg ON public.conversations(last_message_at DESC);

-- Enable RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

-- Helper function: is user member of conversation
CREATE OR REPLACE FUNCTION public.is_conversation_member(p_conversation_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = p_conversation_id AND user_id = p_user_id
  )
$$;

-- RLS: conversations - members can see their conversations
CREATE POLICY "Members can view conversations" ON public.conversations
  FOR SELECT USING (
    public.is_conversation_member(id, auth.uid()) OR type = 'world'
  );

CREATE POLICY "Auth users can create conversations" ON public.conversations
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Owners can update conversations" ON public.conversations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members
      WHERE conversation_id = id AND user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- RLS: conversation_members
CREATE POLICY "Members can view conversation members" ON public.conversation_members
  FOR SELECT USING (
    public.is_conversation_member(conversation_id, auth.uid())
  );

CREATE POLICY "Users can join/be added" ON public.conversation_members
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND (
      user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.conversation_members
        WHERE conversation_id = conversation_members.conversation_id
          AND user_id = auth.uid()
          AND role IN ('owner', 'admin')
      )
    )
  );

CREATE POLICY "Users can update own membership" ON public.conversation_members
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Owners can remove members" ON public.conversation_members
  FOR DELETE USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.conversation_members cm
      WHERE cm.conversation_id = conversation_members.conversation_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
    )
  );

-- RLS: chat_messages
CREATE POLICY "Members can view messages" ON public.chat_messages
  FOR SELECT USING (
    public.is_conversation_member(conversation_id, auth.uid())
  );

CREATE POLICY "Members can send messages" ON public.chat_messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    public.is_conversation_member(conversation_id, auth.uid())
  );

CREATE POLICY "Users can delete own messages" ON public.chat_messages
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can edit own messages" ON public.chat_messages
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS: reactions
CREATE POLICY "Members can view reactions" ON public.chat_message_reactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chat_messages cm
      WHERE cm.id = message_id
        AND public.is_conversation_member(cm.conversation_id, auth.uid())
    )
  );

CREATE POLICY "Users can add reactions" ON public.chat_message_reactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own reactions" ON public.chat_message_reactions
  FOR DELETE USING (auth.uid() = user_id);

-- RLS: presence
CREATE POLICY "Anyone authenticated can view presence" ON public.user_presence
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own presence" ON public.user_presence
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can modify own presence" ON public.user_presence
  FOR UPDATE USING (auth.uid() = user_id);

-- Trigger: update conversation last_message
CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversations
  SET 
    last_message_at = NEW.created_at,
    last_message_preview = LEFT(NEW.content, 100),
    updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_conversation_last_message
AFTER INSERT ON public.chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_conversation_last_message();

-- Enable realtime for chat
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_message_reactions;

-- Create the world chat conversation (singleton)
INSERT INTO public.conversations (id, type, name, created_at)
VALUES ('00000000-0000-0000-0000-000000000001', 'world', 'World Chat', now());

-- Function to get or create DM conversation
CREATE OR REPLACE FUNCTION public.get_or_create_dm_conversation(p_other_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_conv_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Find existing DM conversation between these two users
  SELECT cm1.conversation_id INTO v_conv_id
  FROM conversation_members cm1
  JOIN conversation_members cm2 ON cm1.conversation_id = cm2.conversation_id
  JOIN conversations c ON c.id = cm1.conversation_id
  WHERE cm1.user_id = v_user_id
    AND cm2.user_id = p_other_user_id
    AND c.type = 'dm'
  LIMIT 1;

  IF v_conv_id IS NOT NULL THEN
    RETURN v_conv_id;
  END IF;

  -- Create new DM conversation
  INSERT INTO conversations (type, created_by)
  VALUES ('dm', v_user_id)
  RETURNING id INTO v_conv_id;

  -- Add both users
  INSERT INTO conversation_members (conversation_id, user_id, role)
  VALUES 
    (v_conv_id, v_user_id, 'owner'),
    (v_conv_id, p_other_user_id, 'member');

  RETURN v_conv_id;
END;
$$;

-- Function to create group conversation
CREATE OR REPLACE FUNCTION public.create_group_conversation(p_name TEXT, p_member_ids UUID[])
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_conv_id UUID;
  v_member_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Create group conversation
  INSERT INTO conversations (type, name, created_by)
  VALUES ('group', p_name, v_user_id)
  RETURNING id INTO v_conv_id;

  -- Add creator as owner
  INSERT INTO conversation_members (conversation_id, user_id, role)
  VALUES (v_conv_id, v_user_id, 'owner');

  -- Add other members
  FOREACH v_member_id IN ARRAY p_member_ids LOOP
    IF v_member_id != v_user_id THEN
      INSERT INTO conversation_members (conversation_id, user_id, role)
      VALUES (v_conv_id, v_member_id, 'member')
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  RETURN v_conv_id;
END;
$$;
