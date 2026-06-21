
-- Fix support_messages SELECT policy to require authentication
-- Currently 'Users can view own support messages' uses email from JWT which
-- would still return rows for anonymous users if their JWT email matches.
-- Enforce auth.uid() IS NOT NULL as an additional guard.

DROP POLICY IF EXISTS "Users can view own support messages" ON public.support_messages;

CREATE POLICY "Users can view own support messages"
ON public.support_messages
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND email = (auth.jwt() ->> 'email')
);
