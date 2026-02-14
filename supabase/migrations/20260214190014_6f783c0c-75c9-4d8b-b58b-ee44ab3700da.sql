
-- Add missing foreign key constraints for referential integrity
ALTER TABLE public.video_reactions 
  ADD CONSTRAINT video_reactions_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.comment_reactions 
  ADD CONSTRAINT comment_reactions_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.world_chat_messages 
  ADD CONSTRAINT world_chat_messages_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add 90-day data retention for signup_analytics IP addresses
-- Hash IP addresses older than 90 days via a function
CREATE OR REPLACE FUNCTION public.cleanup_old_signup_analytics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Anonymize location data older than 90 days
  UPDATE signup_analytics
  SET 
    ip_address = 'redacted',
    city = NULL,
    region = NULL,
    user_agent = NULL
  WHERE created_at < now() - interval '90 days'
    AND ip_address != 'redacted';
END;
$$;
