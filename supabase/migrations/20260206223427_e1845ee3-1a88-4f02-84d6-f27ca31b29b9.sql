-- =============================================
-- SOCIAL FEATURES: Emoji Reactions & World Chat
-- =============================================

-- 1. Video Emoji Reactions (replaces simple likes)
CREATE TABLE IF NOT EXISTS public.video_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES public.movie_projects(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL CHECK (emoji IN ('🔥', '❤️', '😂', '😮', '👏', '😢', '🎬')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, project_id, emoji)
);

-- 2. Comment Emoji Reactions  
CREATE TABLE IF NOT EXISTS public.comment_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  comment_id UUID NOT NULL REFERENCES public.project_comments(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL CHECK (emoji IN ('🔥', '❤️', '😂', '😮', '👏', '😢')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, comment_id, emoji)
);

-- 3. World Chat Messages (public global chat)
CREATE TABLE IF NOT EXISTS public.world_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content TEXT NOT NULL CHECK (char_length(content) >= 1 AND char_length(content) <= 500),
  reply_to_id UUID REFERENCES public.world_chat_messages(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_video_reactions_project ON public.video_reactions(project_id);
CREATE INDEX IF NOT EXISTS idx_video_reactions_user ON public.video_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment ON public.comment_reactions(comment_id);
CREATE INDEX IF NOT EXISTS idx_world_chat_created ON public.world_chat_messages(created_at DESC);

-- Enable RLS on all tables
ALTER TABLE public.video_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.world_chat_messages ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES: Video Reactions
-- =============================================
CREATE POLICY "Anyone can view reactions on public videos"
  ON public.video_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.movie_projects mp 
      WHERE mp.id = video_reactions.project_id AND mp.is_public = true
    )
  );

CREATE POLICY "Users can add reactions"
  ON public.video_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own reactions"
  ON public.video_reactions FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================
-- RLS POLICIES: Comment Reactions
-- =============================================
CREATE POLICY "Anyone can view comment reactions on public videos"
  ON public.comment_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_comments pc
      JOIN public.movie_projects mp ON mp.id = pc.project_id
      WHERE pc.id = comment_reactions.comment_id AND mp.is_public = true
    )
  );

CREATE POLICY "Users can add comment reactions"
  ON public.comment_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own comment reactions"
  ON public.comment_reactions FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================
-- RLS POLICIES: World Chat
-- =============================================
CREATE POLICY "Anyone can view world chat"
  ON public.world_chat_messages FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can send messages"
  ON public.world_chat_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own messages"
  ON public.world_chat_messages FOR DELETE
  USING (auth.uid() = user_id);

-- Enable realtime for world chat
ALTER PUBLICATION supabase_realtime ADD TABLE public.world_chat_messages;