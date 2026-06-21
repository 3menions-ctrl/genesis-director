-- Block anonymous access to profiles table explicitly
CREATE POLICY "Deny anonymous access to profiles"
ON public.profiles
AS RESTRICTIVE
FOR SELECT
TO anon
USING (false);

-- Block anonymous INSERT/UPDATE/DELETE as well
CREATE POLICY "Deny anonymous writes to profiles"
ON public.profiles
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);