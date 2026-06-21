-- =====================================================
-- SOCIAL & GAMIFICATION SYSTEM
-- =====================================================

-- 1. USER GAMIFICATION PROFILE
-- =====================================================
CREATE TABLE public.user_gamification (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  xp_total INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_activity_date DATE,
  videos_created INTEGER NOT NULL DEFAULT 0,
  videos_completed INTEGER NOT NULL DEFAULT 0,
  total_views INTEGER NOT NULL DEFAULT 0,
  total_likes_received INTEGER NOT NULL DEFAULT 0,
  characters_created INTEGER NOT NULL DEFAULT 0,
  characters_lent INTEGER NOT NULL DEFAULT 0,
  universes_joined INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_gamification ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all gamification profiles" ON public.user_gamification
  FOR SELECT USING (true);

CREATE POLICY "Users can update their own gamification" ON public.user_gamification
  FOR UPDATE USING (auth.uid() = user_id);

-- 2. ACHIEVEMENTS SYSTEM
-- =====================================================
CREATE TABLE public.achievements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'trophy',
  xp_reward INTEGER NOT NULL DEFAULT 100,
  category TEXT NOT NULL DEFAULT 'general',
  requirement_type TEXT NOT NULL, -- 'count', 'streak', 'first', 'special'
  requirement_value INTEGER NOT NULL DEFAULT 1,
  rarity TEXT NOT NULL DEFAULT 'common', -- common, rare, epic, legendary
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view achievements" ON public.achievements
  FOR SELECT USING (true);

-- Insert default achievements
INSERT INTO public.achievements (code, name, description, icon, xp_reward, category, requirement_type, requirement_value, rarity) VALUES
  ('first_video', 'Director''s Cut', 'Create your first video', 'film', 100, 'creation', 'first', 1, 'common'),
  ('videos_10', 'Prolific Creator', 'Create 10 videos', 'clapperboard', 500, 'creation', 'count', 10, 'rare'),
  ('videos_50', 'Studio Legend', 'Create 50 videos', 'award', 2000, 'creation', 'count', 50, 'epic'),
  ('videos_100', 'Hollywood Elite', 'Create 100 videos', 'crown', 5000, 'creation', 'count', 100, 'legendary'),
  ('first_character', 'Character Designer', 'Create your first character', 'user-plus', 100, 'characters', 'first', 1, 'common'),
  ('characters_10', 'Casting Director', 'Create 10 characters', 'users', 500, 'characters', 'count', 10, 'rare'),
  ('first_universe', 'World Builder', 'Create your first universe', 'globe', 200, 'universes', 'first', 1, 'common'),
  ('universe_collab', 'Team Player', 'Join someone else''s universe', 'handshake', 150, 'social', 'first', 1, 'common'),
  ('lend_character', 'Generous Spirit', 'Lend a character to another creator', 'gift', 200, 'social', 'first', 1, 'rare'),
  ('streak_7', 'Week Warrior', 'Maintain a 7-day streak', 'flame', 300, 'streaks', 'streak', 7, 'common'),
  ('streak_30', 'Monthly Master', 'Maintain a 30-day streak', 'zap', 1000, 'streaks', 'streak', 30, 'epic'),
  ('streak_100', 'Century Club', 'Maintain a 100-day streak', 'star', 5000, 'streaks', 'streak', 100, 'legendary'),
  ('likes_100', 'Rising Star', 'Receive 100 likes on your videos', 'heart', 500, 'engagement', 'count', 100, 'rare'),
  ('likes_1000', 'Fan Favorite', 'Receive 1000 likes on your videos', 'sparkles', 2000, 'engagement', 'count', 1000, 'epic'),
  ('first_comment', 'Conversationalist', 'Leave your first comment', 'message-circle', 50, 'social', 'first', 1, 'common'),
  ('first_follower', 'Influencer', 'Get your first follower', 'user-check', 100, 'social', 'first', 1, 'common'),
  ('followers_100', 'Community Leader', 'Reach 100 followers', 'users', 1000, 'social', 'count', 100, 'epic');

-- 3. USER ACHIEVEMENTS (Unlocked)
-- =====================================================
CREATE TABLE public.user_achievements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all unlocked achievements" ON public.user_achievements
  FOR SELECT USING (true);

CREATE POLICY "System can insert achievements" ON public.user_achievements
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 4. DAILY CHALLENGES
-- =====================================================
CREATE TABLE public.daily_challenges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  challenge_type TEXT NOT NULL, -- 'create_video', 'like_videos', 'comment', 'visit_universe'
  description TEXT NOT NULL,
  xp_reward INTEGER NOT NULL DEFAULT 50,
  target_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view daily challenges" ON public.daily_challenges
  FOR SELECT USING (true);

-- 5. USER CHALLENGE PROGRESS
-- =====================================================
CREATE TABLE public.user_challenge_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES public.daily_challenges(id) ON DELETE CASCADE,
  progress INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, challenge_id)
);

ALTER TABLE public.user_challenge_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own challenge progress" ON public.user_challenge_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own challenge progress" ON public.user_challenge_progress
  FOR ALL USING (auth.uid() = user_id);

-- 6. FOLLOWERS SYSTEM
-- =====================================================
CREATE TABLE public.user_follows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view follows" ON public.user_follows
  FOR SELECT USING (true);

CREATE POLICY "Users can follow others" ON public.user_follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow" ON public.user_follows
  FOR DELETE USING (auth.uid() = follower_id);

-- 7. DIRECT MESSAGES
-- =====================================================
CREATE TABLE public.direct_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own messages" ON public.direct_messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Users can send messages" ON public.direct_messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update messages they received" ON public.direct_messages
  FOR UPDATE USING (auth.uid() = recipient_id);

-- Enable realtime for DMs
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;

-- 8. UNIVERSE CHAT ROOMS
-- =====================================================
CREATE TABLE public.universe_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  universe_id UUID NOT NULL REFERENCES public.universes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  reply_to_id UUID REFERENCES public.universe_messages(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.universe_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Universe members can view messages" ON public.universe_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.universe_members 
      WHERE universe_id = universe_messages.universe_id 
      AND user_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM public.universes 
      WHERE id = universe_messages.universe_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Universe members can send messages" ON public.universe_messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND (
      EXISTS (
        SELECT 1 FROM public.universe_members 
        WHERE universe_id = universe_messages.universe_id 
        AND user_id = auth.uid()
      ) OR EXISTS (
        SELECT 1 FROM public.universes 
        WHERE id = universe_messages.universe_id 
        AND user_id = auth.uid()
      )
    )
  );

-- Enable realtime for universe chat
ALTER PUBLICATION supabase_realtime ADD TABLE public.universe_messages;

-- 9. PROJECT COMMENTS
-- =====================================================
CREATE TABLE public.project_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.movie_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  reply_to_id UUID REFERENCES public.project_comments(id) ON DELETE SET NULL,
  likes_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.project_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view comments on public projects" ON public.project_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.movie_projects 
      WHERE id = project_comments.project_id 
      AND is_public = true
    ) OR EXISTS (
      SELECT 1 FROM public.movie_projects 
      WHERE id = project_comments.project_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can comment" ON public.project_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can edit their own comments" ON public.project_comments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" ON public.project_comments
  FOR DELETE USING (auth.uid() = user_id);

-- Enable realtime for comments
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_comments;

-- 10. COMMENT LIKES
-- =====================================================
CREATE TABLE public.comment_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id UUID NOT NULL REFERENCES public.project_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(comment_id, user_id)
);

ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view comment likes" ON public.comment_likes
  FOR SELECT USING (true);

CREATE POLICY "Users can like comments" ON public.comment_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike comments" ON public.comment_likes
  FOR DELETE USING (auth.uid() = user_id);

-- 11. NOTIFICATIONS
-- =====================================================
CREATE TYPE public.notification_type AS ENUM (
  'like', 'comment', 'follow', 'achievement', 'challenge_complete',
  'message', 'universe_invite', 'character_borrow_request', 'level_up',
  'streak_milestone', 'video_complete', 'mention'
);

CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.notification_type NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  data JSONB DEFAULT '{}',
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- 12. LEADERBOARD VIEW
-- =====================================================
CREATE OR REPLACE VIEW public.leaderboard AS
SELECT 
  ug.user_id,
  p.display_name,
  p.avatar_url,
  ug.xp_total,
  ug.level,
  ug.current_streak,
  ug.videos_created,
  ug.total_likes_received,
  (SELECT COUNT(*) FROM public.user_follows WHERE following_id = ug.user_id) AS followers_count,
  RANK() OVER (ORDER BY ug.xp_total DESC) AS rank
FROM public.user_gamification ug
JOIN public.profiles p ON p.id = ug.user_id
ORDER BY ug.xp_total DESC;

-- 13. XP CALCULATION FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION public.calculate_level(xp INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Level formula: Each level requires level * 100 XP
  -- Level 1: 0-99, Level 2: 100-299, Level 3: 300-599, etc.
  RETURN GREATEST(1, FLOOR(SQRT(xp / 50.0) + 1)::INTEGER);
END;
$$;

-- 14. ADD XP FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION public.add_user_xp(
  p_user_id UUID,
  p_xp_amount INTEGER,
  p_reason TEXT DEFAULT 'activity'
)
RETURNS TABLE(new_xp INTEGER, new_level INTEGER, leveled_up BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_level INTEGER;
  v_new_xp INTEGER;
  v_new_level INTEGER;
BEGIN
  -- Ensure user has gamification record
  INSERT INTO public.user_gamification (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Get current level
  SELECT level INTO v_old_level
  FROM public.user_gamification
  WHERE user_id = p_user_id;

  -- Add XP and update
  UPDATE public.user_gamification
  SET 
    xp_total = xp_total + p_xp_amount,
    level = calculate_level(xp_total + p_xp_amount),
    updated_at = now()
  WHERE user_id = p_user_id
  RETURNING xp_total, level INTO v_new_xp, v_new_level;

  -- Check if leveled up
  IF v_new_level > v_old_level THEN
    -- Create level up notification
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      p_user_id, 
      'level_up', 
      'Level Up!', 
      'Congratulations! You reached level ' || v_new_level,
      jsonb_build_object('new_level', v_new_level, 'old_level', v_old_level)
    );
  END IF;

  RETURN QUERY SELECT v_new_xp, v_new_level, (v_new_level > v_old_level);
END;
$$;

-- 15. UPDATE STREAK FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_user_streak(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_date DATE;
  v_current_streak INTEGER;
  v_longest_streak INTEGER;
BEGIN
  -- Get current data
  SELECT last_activity_date, current_streak, longest_streak
  INTO v_last_date, v_current_streak, v_longest_streak
  FROM public.user_gamification
  WHERE user_id = p_user_id;

  -- Calculate new streak
  IF v_last_date IS NULL OR v_last_date < CURRENT_DATE - INTERVAL '1 day' THEN
    -- Streak broken or first activity
    v_current_streak := 1;
  ELSIF v_last_date = CURRENT_DATE - INTERVAL '1 day' THEN
    -- Consecutive day
    v_current_streak := v_current_streak + 1;
  END IF;
  -- If same day, don't change streak

  -- Update longest streak if needed
  IF v_current_streak > v_longest_streak THEN
    v_longest_streak := v_current_streak;
  END IF;

  -- Update record
  UPDATE public.user_gamification
  SET 
    current_streak = v_current_streak,
    longest_streak = v_longest_streak,
    last_activity_date = CURRENT_DATE,
    updated_at = now()
  WHERE user_id = p_user_id;

  -- Check streak achievements
  IF v_current_streak = 7 THEN
    PERFORM add_user_xp(p_user_id, 300, 'streak_7');
  ELSIF v_current_streak = 30 THEN
    PERFORM add_user_xp(p_user_id, 1000, 'streak_30');
  ELSIF v_current_streak = 100 THEN
    PERFORM add_user_xp(p_user_id, 5000, 'streak_100');
  END IF;

  RETURN v_current_streak;
END;
$$;

-- 16. TRIGGER FOR NEW USER GAMIFICATION PROFILE
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user_gamification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_gamification (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_gamification
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_gamification();

-- Add indexes for performance
CREATE INDEX idx_user_gamification_xp ON public.user_gamification(xp_total DESC);
CREATE INDEX idx_user_gamification_level ON public.user_gamification(level DESC);
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, read) WHERE read = false;
CREATE INDEX idx_direct_messages_recipient ON public.direct_messages(recipient_id, created_at DESC);
CREATE INDEX idx_universe_messages_universe ON public.universe_messages(universe_id, created_at DESC);
CREATE INDEX idx_project_comments_project ON public.project_comments(project_id, created_at DESC);
CREATE INDEX idx_user_follows_following ON public.user_follows(following_id);
CREATE INDEX idx_user_follows_follower ON public.user_follows(follower_id);