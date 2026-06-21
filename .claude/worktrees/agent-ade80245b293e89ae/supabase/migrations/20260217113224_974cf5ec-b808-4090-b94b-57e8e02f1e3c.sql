
-- ══════════════════════════════════════════════════════
-- APEX Agent Schema
-- ══════════════════════════════════════════════════════

-- Agent conversations (chat sessions)
CREATE TABLE public.agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT DEFAULT 'New Conversation',
  summary TEXT,
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations"
  ON public.agent_conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own conversations"
  ON public.agent_conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations"
  ON public.agent_conversations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations"
  ON public.agent_conversations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Agent messages
CREATE TABLE public.agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.agent_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL DEFAULT '',
  tool_calls JSONB,
  tool_results JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own messages"
  ON public.agent_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.agent_conversations
      WHERE id = agent_messages.conversation_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own messages"
  ON public.agent_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agent_conversations
      WHERE id = agent_messages.conversation_id AND user_id = auth.uid()
    )
  );

-- Agent preferences (learned user preferences)
CREATE TABLE public.agent_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  preferred_mode TEXT DEFAULT 'text-to-video',
  preferred_style TEXT,
  preferred_aspect_ratio TEXT DEFAULT '16:9',
  preferred_clip_count INTEGER DEFAULT 4,
  preferred_tone TEXT,
  agent_personality TEXT DEFAULT 'professional',
  greeting_name TEXT,
  interaction_count INTEGER DEFAULT 0,
  last_interaction_at TIMESTAMPTZ,
  learned_context JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences"
  ON public.agent_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert own preferences"
  ON public.agent_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON public.agent_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_agent_conversations_user ON public.agent_conversations(user_id, updated_at DESC);
CREATE INDEX idx_agent_messages_conversation ON public.agent_messages(conversation_id, created_at);

-- Auto-update timestamps
CREATE TRIGGER update_agent_conversations_updated_at
  BEFORE UPDATE ON public.agent_conversations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_agent_preferences_updated_at
  BEFORE UPDATE ON public.agent_preferences
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Update message count trigger
CREATE OR REPLACE FUNCTION public.update_agent_message_count()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  UPDATE agent_conversations
  SET message_count = message_count + 1, updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_agent_conversation_message_count
  AFTER INSERT ON public.agent_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_agent_message_count();
