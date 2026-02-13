-- 1. Block anon access to credit_transactions
CREATE POLICY "Deny anonymous access to credit_transactions"
ON public.credit_transactions
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- 2. Fix direct_messages: remove duplicate/overly permissive policies
DROP POLICY IF EXISTS "Users can view their own messages" ON public.direct_messages;
DROP POLICY IF EXISTS "Users can update messages they received" ON public.direct_messages;

-- Block anon access to direct_messages
CREATE POLICY "Deny anonymous access to direct_messages"
ON public.direct_messages
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Fix: scope send messages policy properly
DROP POLICY IF EXISTS "Users can send messages" ON public.direct_messages;
CREATE POLICY "Users can send messages"
ON public.direct_messages
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = sender_id);