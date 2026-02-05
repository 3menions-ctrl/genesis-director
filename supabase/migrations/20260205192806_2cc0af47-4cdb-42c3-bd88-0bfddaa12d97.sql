-- Add admin SELECT policy for support_messages
-- Currently admins can update/delete but not view all messages

CREATE POLICY "Admins can view all support messages"
ON public.support_messages
FOR SELECT
USING (is_admin(auth.uid()));