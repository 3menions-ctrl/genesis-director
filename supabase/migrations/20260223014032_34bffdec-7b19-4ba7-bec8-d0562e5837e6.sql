
-- Drop the old function signature first
DROP FUNCTION IF EXISTS public.cleanup_old_signup_analytics();

-- Enhanced cleanup: anonymize after 90 days, delete after 1 year
CREATE OR REPLACE FUNCTION public.cleanup_old_signup_analytics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  anonymized_count integer;
  deleted_count integer;
BEGIN
  -- Anonymize PII older than 90 days (keep UTM/country_code for analytics)
  UPDATE signup_analytics
  SET 
    ip_address = 'redacted',
    city = NULL,
    region = NULL,
    user_agent = NULL
  WHERE created_at < now() - interval '90 days'
    AND ip_address != 'redacted';
  GET DIAGNOSTICS anonymized_count = ROW_COUNT;

  -- Hard delete records older than 1 year
  DELETE FROM signup_analytics
  WHERE created_at < now() - interval '1 year';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'anonymized', anonymized_count,
    'deleted', deleted_count,
    'run_at', now()
  );
END;
$$;

-- Add ip_hash column for long-term fraud detection without storing raw IPs
ALTER TABLE public.signup_analytics 
  ADD COLUMN IF NOT EXISTS ip_hash text;

-- Replace overly restrictive policies with admin-only cleanup policies
DROP POLICY IF EXISTS "No updates to signup analytics" ON public.signup_analytics;
DROP POLICY IF EXISTS "No deletes from signup analytics" ON public.signup_analytics;

CREATE POLICY "Admins can update signup analytics for cleanup"
  ON public.signup_analytics
  FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete old signup analytics"
  ON public.signup_analytics
  FOR DELETE
  USING (public.is_admin(auth.uid()));
