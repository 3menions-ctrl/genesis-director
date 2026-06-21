-- Drop the blocking policy that prevents notification inserts
DROP POLICY IF EXISTS "Block direct notification insert" ON public.notifications;

-- Keep only the proper policy that allows authenticated users to create notifications
-- The existing "Authenticated users can create notifications" policy is correct