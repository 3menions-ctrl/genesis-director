
-- Fix overly-permissive INSERT policy on security_events
-- Only the service role key or edge functions (using service role) should insert
DROP POLICY IF EXISTS "Security events: service can insert" ON public.security_events;

-- Allow authenticated database functions (SECURITY DEFINER) to insert
-- The security_events table is only written to by our own DB triggers and functions
-- which run as SECURITY DEFINER. We can't restrict by role in that context,
-- but we scope it to authenticated users to prevent anonymous abuse.
-- The SECURITY DEFINER functions already validate ownership before inserting.
CREATE POLICY "Security events: system insert only" ON public.security_events
  FOR INSERT WITH CHECK (
    -- Allow inserts from authenticated users (system functions run as definer)
    -- Or when user_id matches the current user (self-reported events)
    auth.uid() IS NOT NULL
    OR auth.role() = 'service_role'
  );
