-- Allow public (unauthenticated) Enterprise lead capture from /start?type=enterprise.
-- Anonymous submissions must have user_id = NULL. Authenticated users keep their existing policy.
CREATE POLICY "Anyone can submit anonymous enterprise leads"
ON public.enterprise_leads
FOR INSERT
TO anon, authenticated
WITH CHECK (user_id IS NULL);