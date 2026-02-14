
-- Remove foreign key constraint on chat_messages.user_id to allow anonymous/mock users
ALTER TABLE public.chat_messages DROP CONSTRAINT IF EXISTS chat_messages_user_id_fkey;
