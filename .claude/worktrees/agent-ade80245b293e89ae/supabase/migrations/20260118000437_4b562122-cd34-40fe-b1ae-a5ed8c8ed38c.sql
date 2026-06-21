-- =============================================
-- PHASE 2 SECURITY FIXES (Fixed)
-- =============================================

-- 1. SUPPORT MESSAGES: Fix policies to prevent enumeration
-- =============================================
DROP POLICY IF EXISTS "Anyone can submit support messages" ON public.support_messages;
DROP POLICY IF EXISTS "Users can view own support messages" ON public.support_messages;
DROP POLICY IF EXISTS "Admins can view all support messages" ON public.support_messages;

-- Allow unauthenticated submissions but restrict viewing
CREATE POLICY "Anyone can submit support messages"
ON public.support_messages FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Users can view own support messages"
ON public.support_messages FOR SELECT
TO authenticated
USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- 2. MOVIE PROJECTS PUBLIC VIEW: Exclude internal fields
-- =============================================
DROP VIEW IF EXISTS public.movie_projects_public;
CREATE VIEW public.movie_projects_public
WITH (security_invoker = true) AS
SELECT 
  id,
  title,
  genre,
  mood,
  setting,
  thumbnail_url,
  video_url,
  likes_count,
  user_id,
  is_public,
  created_at
FROM public.movie_projects
WHERE is_public = true AND video_url IS NOT NULL;

-- 3. USER GAMIFICATION: Add opt-out capability
-- =============================================
ALTER TABLE public.user_gamification 
ADD COLUMN IF NOT EXISTS leaderboard_visible boolean DEFAULT true;

-- Update policy to respect visibility preference
DROP POLICY IF EXISTS "Users can view all gamification profiles" ON public.user_gamification;

CREATE POLICY "Users can view visible gamification profiles"
ON public.user_gamification FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR leaderboard_visible = true);

-- 4. PROFILES: Add policy for public profile viewing (display_name, avatar only)
-- =============================================
DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public
WITH (security_invoker = true) AS
SELECT 
  id,
  display_name,
  avatar_url
FROM public.profiles;

-- 5. ADMIN AUDIT LOG: Create proper admin access via function
-- =============================================
CREATE OR REPLACE FUNCTION public.admin_get_audit_logs(
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  admin_id uuid,
  action text,
  target_type text,
  target_id text,
  details jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  -- Log this access attempt
  INSERT INTO admin_audit_log (admin_id, action, target_type, details)
  VALUES (auth.uid(), 'view_audit_logs', 'system', jsonb_build_object('limit', p_limit, 'offset', p_offset));

  RETURN QUERY
  SELECT 
    a.id,
    a.admin_id,
    a.action,
    a.target_type,
    a.target_id,
    a.details,
    a.created_at
  FROM admin_audit_log a
  ORDER BY a.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- 6. Add rate limiting function for support messages
-- =============================================
CREATE OR REPLACE FUNCTION public.check_support_rate_limit(p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  recent_count INTEGER;
BEGIN
  -- Check messages in last hour from this email
  SELECT COUNT(*) INTO recent_count
  FROM support_messages
  WHERE email = p_email
    AND created_at > now() - interval '1 hour';
  
  -- Allow max 5 messages per hour
  RETURN recent_count < 5;
END;
$$;