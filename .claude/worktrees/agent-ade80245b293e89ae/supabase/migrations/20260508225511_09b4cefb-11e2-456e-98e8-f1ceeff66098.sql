CREATE OR REPLACE FUNCTION public.admin_bump_security_versions_except(p_except uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  IF NOT public.is_admin(auth.uid()) AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  UPDATE public.profiles
     SET security_version = security_version + 1,
         updated_at = now()
   WHERE id <> p_except;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'affected_users', affected);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_bump_security_versions_except(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_bump_security_versions_except(uuid) TO authenticated, service_role;