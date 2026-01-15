-- Allow unauthenticated users to submit contact/support messages
-- This is safe because we're only allowing INSERT, and there's no sensitive data exposure
DROP POLICY IF EXISTS "Authenticated users can submit support messages" ON public.support_messages;

CREATE POLICY "Anyone can submit support messages"
  ON public.support_messages
  FOR INSERT
  WITH CHECK (
    -- user_id must be null (anonymous) or match the authenticated user
    (user_id IS NULL) OR (user_id = auth.uid())
  );