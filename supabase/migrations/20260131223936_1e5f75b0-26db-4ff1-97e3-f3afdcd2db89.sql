-- FIX: genesis_character_castings - approved face URLs should NOT be public
-- Only owners and admins should see casting face images

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view approved or own castings" ON public.genesis_character_castings;

-- Create stricter policy - only owner or admin can see castings
CREATE POLICY "Users can view own or admin can view all castings"
ON public.genesis_character_castings FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() 
  OR public.has_role(auth.uid(), 'admin')
);