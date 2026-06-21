
-- Drop old add_credits so we can recreate with proper return type
DROP FUNCTION IF EXISTS public.add_credits(uuid, integer, text, text);
