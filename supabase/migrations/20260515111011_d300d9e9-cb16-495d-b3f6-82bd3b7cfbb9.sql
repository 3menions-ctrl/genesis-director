
-- Add reply columns
ALTER TABLE public.support_messages
  ADD COLUMN IF NOT EXISTS admin_reply text,
  ADD COLUMN IF NOT EXISTS replied_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_reply_by uuid;

CREATE INDEX IF NOT EXISTS support_messages_user_id_idx
  ON public.support_messages(user_id);

CREATE INDEX IF NOT EXISTS support_messages_email_idx
  ON public.support_messages(email);

-- Allow signed-in users to view their own messages by user_id (in addition to existing email match)
DROP POLICY IF EXISTS "Users can view own support messages by user_id"
  ON public.support_messages;

CREATE POLICY "Users can view own support messages by user_id"
  ON public.support_messages
  FOR SELECT
  TO authenticated
  USING (user_id IS NOT NULL AND user_id = auth.uid());
