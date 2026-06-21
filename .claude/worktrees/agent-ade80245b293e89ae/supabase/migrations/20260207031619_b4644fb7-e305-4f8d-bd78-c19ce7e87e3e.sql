-- Fix the support_messages RLS policy that's causing "permission denied for table users" errors
-- The current policy queries auth.users which is not accessible from RLS policies

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view own support messages" ON public.support_messages;

-- Recreate with auth.jwt() instead of auth.users subquery
-- This uses the JWT claims which includes the user's email
CREATE POLICY "Users can view own support messages" ON public.support_messages
FOR SELECT
USING (
  email = (auth.jwt() ->> 'email')::text
);

-- Also fix the rate limit policy which has a bug (sm.email = sm.email is always true)
DROP POLICY IF EXISTS "Anyone can submit support messages with rate limit" ON public.support_messages;

-- Recreate the rate limit policy properly using the NEW record's email
CREATE POLICY "Anyone can submit support messages with rate limit" ON public.support_messages
FOR INSERT
WITH CHECK (
  check_support_rate_limit(email)
);