
-- ============================================================
-- COMPREHENSIVE SECURITY HARDENING MIGRATION
-- ============================================================

-- 1. FORCE LOGOUT: Add security_version to profiles
--    Incrementing this column invalidates all existing sessions
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS security_version integer NOT NULL DEFAULT 1;

-- Force-logout EVERYONE by bumping their security_version NOW
UPDATE public.profiles SET security_version = security_version + 1;

-- 2. BRUTE FORCE PROTECTION: Track failed login attempts
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  ip_address text,
  attempted_at timestamp with time zone NOT NULL DEFAULT now(),
  success boolean NOT NULL DEFAULT false
);

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Only admins can read login attempts; no user can write directly (edge function only)
CREATE POLICY "Admins can view login attempts"
  ON public.login_attempts FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Rate limit check function: block if > 10 failures in 15 min from same email
CREATE OR REPLACE FUNCTION public.check_login_rate_limit(p_email text)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  recent_failures integer;
BEGIN
  SELECT COUNT(*) INTO recent_failures
  FROM public.login_attempts
  WHERE email = LOWER(p_email)
    AND success = false
    AND attempted_at > now() - interval '15 minutes';
  
  -- Block if more than 10 failures in last 15 minutes
  RETURN recent_failures < 10;
END;
$$;

-- Log login attempt function (callable from edge function / client via RPC)
CREATE OR REPLACE FUNCTION public.log_login_attempt(p_email text, p_success boolean, p_ip text DEFAULT NULL)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO public.login_attempts (email, ip_address, success)
  VALUES (LOWER(p_email), p_ip, p_success);
  
  -- Clean up old records (keep 24 hours)
  DELETE FROM public.login_attempts 
  WHERE attempted_at < now() - interval '24 hours';
END;
$$;

-- 3. SESSION STAMP: Function to validate security_version
--    Called by client on load — returns null if version is stale
CREATE OR REPLACE FUNCTION public.validate_session_stamp(p_user_id uuid, p_client_version integer)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  server_version integer;
BEGIN
  SELECT security_version INTO server_version
  FROM public.profiles
  WHERE id = p_user_id;
  
  IF server_version IS NULL THEN
    RETURN false;
  END IF;
  
  RETURN p_client_version >= server_version;
END;
$$;

-- 4. ADMIN FUNCTION: Force-logout a specific user (bumps their security_version)
CREATE OR REPLACE FUNCTION public.admin_force_logout_user(p_target_user_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;
  
  UPDATE public.profiles
  SET security_version = security_version + 1, updated_at = now()
  WHERE id = p_target_user_id;
  
  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (auth.uid(), 'force_logout', 'user', p_target_user_id::text,
    jsonb_build_object('reason', 'admin_force_logout'));
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- 5. ADMIN FUNCTION: Force-logout ALL users globally
CREATE OR REPLACE FUNCTION public.admin_force_logout_all()
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;
  
  UPDATE public.profiles
  SET security_version = security_version + 1, updated_at = now();
  
  GET DIAGNOSTICS affected = ROW_COUNT;
  
  INSERT INTO public.admin_audit_log (admin_id, action, target_type, details)
  VALUES (auth.uid(), 'force_logout_all', 'system',
    jsonb_build_object('affected_users', affected));
  
  RETURN jsonb_build_object('success', true, 'affected_users', affected);
END;
$$;

-- 6. RLS HARDENING: agent_messages needs DELETE for owners
DROP POLICY IF EXISTS "Users can delete own messages" ON public.agent_messages;
CREATE POLICY "Users can delete own messages"
  ON public.agent_messages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.agent_conversations ac
      WHERE ac.id = agent_messages.conversation_id
        AND ac.user_id = auth.uid()
    )
  );

-- 7. RLS: login_attempts - no anon access (already set above, ensure no holes)
-- Explicitly deny all non-admin authenticated access
CREATE POLICY "No authenticated user access to login attempts"
  ON public.login_attempts FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 8. INDEX for performance on login_attempts lookups
CREATE INDEX IF NOT EXISTS idx_login_attempts_email_time 
  ON public.login_attempts (email, attempted_at DESC);

CREATE INDEX IF NOT EXISTS idx_profiles_security_version
  ON public.profiles (id, security_version);
