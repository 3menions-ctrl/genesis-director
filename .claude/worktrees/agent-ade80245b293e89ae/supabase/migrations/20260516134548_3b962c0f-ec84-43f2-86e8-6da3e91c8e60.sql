
-- SEV-1 S1: Remove publicly-readable lead PII on onboarding_intents.
-- The previous policy used USING (true) which exposed every row to anonymous
-- and authenticated callers. Reads now go through service-role edge functions
-- (e.g. resume-onboarding) using the intent_token.
DROP POLICY IF EXISTS "Anyone can read onboarding intent by token" ON public.onboarding_intents;

-- SEV-2 H2: Lock down workspace audit log writes to service role only so
-- low-privilege org members can no longer fabricate audit entries.
DROP POLICY IF EXISTS "Admins insert audit" ON public.workspace_audit_events;

CREATE POLICY "Service role inserts audit"
ON public.workspace_audit_events
FOR INSERT
TO service_role
WITH CHECK (true);
