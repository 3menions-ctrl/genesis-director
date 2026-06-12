-- Support replies inbox — users can read their own support_messages threads.
--
-- The existing policies on public.support_messages allow authenticated users
-- to INSERT, and admins to UPDATE/DELETE/SELECT. Nothing lets a user read
-- back the rows they submitted, which is why Contact.tsx promises a "Track
-- replies" page that has never had data to render. This policy plugs the hole.

DROP POLICY IF EXISTS "Users can view their own support messages" ON public.support_messages;
CREATE POLICY "Users can view their own support messages"
  ON public.support_messages
  FOR SELECT
  USING (auth.uid() = user_id);
