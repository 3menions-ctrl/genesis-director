-- Fix security warnings

-- 1. Fix the leaderboard view security (drop and recreate without security definer)
DROP VIEW IF EXISTS public.leaderboard;

CREATE VIEW public.leaderboard 
WITH (security_invoker = true)
AS
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

-- 2. Fix the calculate_level function search path
CREATE OR REPLACE FUNCTION public.calculate_level(xp INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN GREATEST(1, FLOOR(SQRT(xp / 50.0) + 1)::INTEGER);
END;
$$;

-- 3. Fix the RLS policy for notifications (make it more restrictive)
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;

CREATE POLICY "Authenticated users can create notifications" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);