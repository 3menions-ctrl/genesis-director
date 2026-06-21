
-- Block anonymous access to api_cost_logs
CREATE POLICY "Deny anonymous access to api_cost_logs"
ON public.api_cost_logs
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);
