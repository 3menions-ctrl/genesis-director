-- Enable realtime for support_messages table to allow live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;