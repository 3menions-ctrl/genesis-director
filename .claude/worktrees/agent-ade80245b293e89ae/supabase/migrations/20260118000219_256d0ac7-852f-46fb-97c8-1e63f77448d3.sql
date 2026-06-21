-- =============================================
-- COMPREHENSIVE SECURITY FIXES MIGRATION (Fixed)
-- =============================================

-- 1. DROP OVERLY PERMISSIVE ADMIN POLICIES
-- =============================================

-- Profiles: Remove broad admin policy, keep user self-access
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Create tighter policies for profiles
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- 2. ADMIN AUDIT LOG: Restrict to service role only
-- =============================================
DROP POLICY IF EXISTS "Admins can view audit log" ON public.admin_audit_log;
DROP POLICY IF EXISTS "Admins can insert audit log" ON public.admin_audit_log;

-- Block all direct access (service role bypasses RLS)
CREATE POLICY "No direct audit log access"
ON public.admin_audit_log FOR SELECT
TO authenticated
USING (false);

CREATE POLICY "No direct audit log insert"
ON public.admin_audit_log FOR INSERT
TO authenticated
WITH CHECK (false);

-- 3. CREDIT TRANSACTIONS: Remove broad admin access
-- =============================================
DROP POLICY IF EXISTS "Admins can view all transactions" ON public.credit_transactions;
DROP POLICY IF EXISTS "Users can view own transactions" ON public.credit_transactions;

CREATE POLICY "Users can view own transactions"
ON public.credit_transactions FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 4. API COST LOGS: Tighten access
-- =============================================
DROP POLICY IF EXISTS "Admins can view all cost logs" ON public.api_cost_logs;
DROP POLICY IF EXISTS "Users can view own cost logs" ON public.api_cost_logs;

CREATE POLICY "Users can view own cost logs"
ON public.api_cost_logs FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 5. DIRECT MESSAGES: Ensure proper sender/recipient only access
-- =============================================
DROP POLICY IF EXISTS "Users can view their messages" ON public.direct_messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.direct_messages;
DROP POLICY IF EXISTS "Users can update own messages" ON public.direct_messages;

CREATE POLICY "Users can view their messages"
ON public.direct_messages FOR SELECT
TO authenticated
USING (sender_id = auth.uid() OR recipient_id = auth.uid());

CREATE POLICY "Users can send messages"
ON public.direct_messages FOR INSERT
TO authenticated
WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Sender can delete own messages"
ON public.direct_messages FOR DELETE
TO authenticated
USING (sender_id = auth.uid());

-- 6. NOTIFICATIONS: Restrict creation to prevent spam
-- =============================================
DROP POLICY IF EXISTS "Users can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;

-- Users can only view/update their own notifications
CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Block direct notification creation (service role bypasses RLS)
CREATE POLICY "Block direct notification insert"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (false);

-- 7. STITCH JOBS: Tighter policies
-- =============================================
DROP POLICY IF EXISTS "Users can view own stitch jobs" ON public.stitch_jobs;
DROP POLICY IF EXISTS "Users can create stitch jobs" ON public.stitch_jobs;
DROP POLICY IF EXISTS "Users can update own stitch jobs" ON public.stitch_jobs;

CREATE POLICY "Users can view own stitch jobs"
ON public.stitch_jobs FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can create stitch jobs"
ON public.stitch_jobs FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own stitch jobs"
ON public.stitch_jobs FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 8. GENESIS CHARACTER CASTINGS: Add consent tracking
-- =============================================
ALTER TABLE public.genesis_character_castings 
ADD COLUMN IF NOT EXISTS image_consent_given boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS consent_given_at timestamp with time zone;

-- Restrict public viewing - only approved castings
DROP POLICY IF EXISTS "Anyone can view castings" ON public.genesis_character_castings;
DROP POLICY IF EXISTS "Users can view own castings" ON public.genesis_character_castings;
DROP POLICY IF EXISTS "Users can create castings" ON public.genesis_character_castings;
DROP POLICY IF EXISTS "Users can view approved castings" ON public.genesis_character_castings;
DROP POLICY IF EXISTS "Users can create own castings" ON public.genesis_character_castings;
DROP POLICY IF EXISTS "Users can update own pending castings" ON public.genesis_character_castings;

CREATE POLICY "Users can view approved or own castings"
ON public.genesis_character_castings FOR SELECT
TO authenticated
USING (status = 'approved' OR user_id = auth.uid());

CREATE POLICY "Users can create own castings with consent"
ON public.genesis_character_castings FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own pending castings"
ON public.genesis_character_castings FOR UPDATE
TO authenticated
USING (user_id = auth.uid() AND status = 'pending')
WITH CHECK (user_id = auth.uid());

-- 9. MOVIE PROJECTS: Create public view with limited fields
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

-- 10. SUPPORT MESSAGES: Add rate limiting metadata
-- =============================================
ALTER TABLE public.support_messages 
ADD COLUMN IF NOT EXISTS client_ip text,
ADD COLUMN IF NOT EXISTS submitted_count integer DEFAULT 1;

-- 11. VIDEO CLIPS: Limit exposed fields
-- =============================================
DROP POLICY IF EXISTS "Users can view own clips" ON public.video_clips;
DROP POLICY IF EXISTS "Project owners can view clips" ON public.video_clips;

CREATE POLICY "Users can view own clips"
ON public.video_clips FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 12. CHARACTER LOANS: Tighter access
-- =============================================
DROP POLICY IF EXISTS "Owners can view loan requests" ON public.character_loans;
DROP POLICY IF EXISTS "Borrowers can view their requests" ON public.character_loans;
DROP POLICY IF EXISTS "Loan participants can view" ON public.character_loans;

CREATE POLICY "Loan participants can view"
ON public.character_loans FOR SELECT
TO authenticated
USING (owner_id = auth.uid() OR borrower_id = auth.uid());

-- 13. UNIVERSE INVITATIONS: Add expiration
-- =============================================
ALTER TABLE public.universe_invitations 
ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone DEFAULT (now() + interval '7 days');

-- 14. Create admin data access function (replaces direct table access)
-- =============================================
CREATE OR REPLACE FUNCTION public.admin_get_aggregated_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  RETURN jsonb_build_object(
    'total_users', (SELECT COUNT(*) FROM profiles),
    'total_projects', (SELECT COUNT(*) FROM movie_projects),
    'total_credits_in_circulation', (SELECT COALESCE(SUM(credits_balance), 0) FROM profiles),
    'total_revenue_cents', (SELECT COALESCE(SUM(amount), 0) FROM credit_transactions WHERE transaction_type = 'purchase' AND amount > 0),
    'active_generations', (SELECT COUNT(*) FROM video_clips WHERE status = 'generating')
  );
END;
$$;

-- 15. Create function for admin to view specific user (with audit)
-- =============================================
CREATE OR REPLACE FUNCTION public.admin_view_user_profile(p_target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  admin_user_id UUID := auth.uid();
  result JSONB;
BEGIN
  IF NOT public.is_admin(admin_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  INSERT INTO admin_audit_log (admin_id, action, target_type, target_id)
  VALUES (admin_user_id, 'view_profile', 'user', p_target_user_id::TEXT);

  SELECT jsonb_build_object(
    'id', p.id,
    'email', p.email,
    'display_name', p.display_name,
    'credits_balance', p.credits_balance,
    'account_tier', p.account_tier,
    'created_at', p.created_at,
    'project_count', (SELECT COUNT(*) FROM movie_projects WHERE user_id = p.id)
  ) INTO result
  FROM profiles p
  WHERE p.id = p_target_user_id;

  RETURN result;
END;
$$;