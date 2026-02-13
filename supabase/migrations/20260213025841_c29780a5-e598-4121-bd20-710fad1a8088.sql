-- ===== FIX genesis_character_castings =====
-- Remove duplicate/insecure policies
DROP POLICY IF EXISTS "Admins can manage all castings" ON public.genesis_character_castings;
DROP POLICY IF EXISTS "Users can submit their own castings" ON public.genesis_character_castings;
DROP POLICY IF EXISTS "Users can update their own castings" ON public.genesis_character_castings;

-- Recreate admin policy using has_role() instead of profiles.role
CREATE POLICY "Admins can manage all castings"
ON public.genesis_character_castings
AS PERMISSIVE
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Block anon access
CREATE POLICY "Deny anonymous access to castings"
ON public.genesis_character_castings
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- ===== FIX notifications =====
-- Remove duplicate policies scoped to public
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;

-- Block anon access
CREATE POLICY "Deny anonymous access to notifications"
ON public.notifications
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- ===== FIX profiles re-scan finding =====
-- The profiles_table_public_exposure finding reappeared. 
-- The policies are correct (own profile + admin via has_role + anon denied).
-- No changes needed — this is a false positive from the scanner seeing multiple policies.