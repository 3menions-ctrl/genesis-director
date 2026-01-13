-- Create support messages table for contact forms and help requests
CREATE TABLE public.support_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'contact', -- 'contact', 'help', 'feedback'
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'new', -- 'new', 'read', 'replied', 'resolved'
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Anyone can create a support message (no auth required for contact form)
CREATE POLICY "Anyone can submit support messages"
ON public.support_messages
FOR INSERT
WITH CHECK (true);

-- Only admins can view all messages
CREATE POLICY "Admins can view all support messages"
ON public.support_messages
FOR SELECT
USING (is_admin(auth.uid()));

-- Only admins can update messages (change status, add notes)
CREATE POLICY "Admins can update support messages"
ON public.support_messages
FOR UPDATE
USING (is_admin(auth.uid()));

-- Only admins can delete messages
CREATE POLICY "Admins can delete support messages"
ON public.support_messages
FOR DELETE
USING (is_admin(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_support_messages_updated_at
BEFORE UPDATE ON public.support_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();