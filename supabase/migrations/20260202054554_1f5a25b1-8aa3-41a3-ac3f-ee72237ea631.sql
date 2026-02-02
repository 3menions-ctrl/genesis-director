-- =====================================================
-- SECURITY FIX PART 2: Complete the remaining fixes
-- =====================================================

-- Fix profiles policies - drop existing ones first to avoid conflict
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Create proper profile policies
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles secure"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Ensure direct_messages consolidated policy exists
DROP POLICY IF EXISTS "Users can view their messages" ON public.direct_messages;
CREATE POLICY "Users can view their messages"
ON public.direct_messages
FOR SELECT
TO authenticated
USING ((sender_id = auth.uid()) OR (recipient_id = auth.uid()));

-- Restricted UPDATE - recipients can only mark as read
DROP POLICY IF EXISTS "Recipients can mark messages as read" ON public.direct_messages;
CREATE POLICY "Recipients can mark messages as read"
ON public.direct_messages
FOR UPDATE
TO authenticated
USING (auth.uid() = recipient_id)
WITH CHECK (auth.uid() = recipient_id);

-- Fix stitch_jobs duplicate policies
DROP POLICY IF EXISTS "Users can create stitch jobs" ON public.stitch_jobs;
DROP POLICY IF EXISTS "Users can update own stitch jobs" ON public.stitch_jobs;
DROP POLICY IF EXISTS "Users can view own stitch jobs" ON public.stitch_jobs;

-- Add deprecation comment to profiles.role column
COMMENT ON COLUMN public.profiles.role IS 'DEPRECATED: Do not use for authorization. Use user_roles table via has_role() function instead.';