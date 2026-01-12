-- Fix: Replace overly permissive service role policy with proper role-based check
DROP POLICY IF EXISTS "Service role full access to stitch jobs" ON public.stitch_jobs;

-- Edge functions use service role which bypasses RLS anyway, so this policy was unnecessary
-- The user-specific policies are sufficient