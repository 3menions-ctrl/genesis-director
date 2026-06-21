-- Re-point the permanent admin lock from the legacy (non-existent) account
-- d600868d-… to brianbcole74@gmail.com (45f0fc04-0224-4564-a77f-f641e4a1b114).
-- Updates all four hardcoded sites: has_role(), enforce_admin_lock(),
-- admin_manage_role(), and the user_roles CHECK constraint — then grants admin.
-- Idempotent: safe to re-run.

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN _role = 'admin'::public.app_role THEN
      _user_id = '45f0fc04-0224-4564-a77f-f641e4a1b114'::uuid
      AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin'::public.app_role)
    ELSE EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
  END
$$;

CREATE OR REPLACE FUNCTION public.enforce_admin_lock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE locked_admin_id UUID := '45f0fc04-0224-4564-a77f-f641e4a1b114';
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.role = 'admin' AND NEW.user_id != locked_admin_id THEN
      RAISE EXCEPTION 'Admin role is permanently locked to a single account and cannot be granted to other users.';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.role = 'admin' OR NEW.role = 'admin' THEN
      RAISE EXCEPTION 'Admin role assignments cannot be modified.';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.role = 'admin' AND OLD.user_id = locked_admin_id THEN
      RAISE EXCEPTION 'Admin role cannot be revoked from the permanent administrator.';
    END IF;
    IF OLD.role = 'admin' THEN
      RAISE EXCEPTION 'Admin role assignments cannot be deleted.';
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_manage_role(p_target_user_id uuid, p_role app_role, p_action text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  admin_user_id UUID := auth.uid();
  locked_admin_id UUID := '45f0fc04-0224-4564-a77f-f641e4a1b114';
BEGIN
  IF admin_user_id != locked_admin_id THEN
    RAISE EXCEPTION 'Unauthorized: Only the permanent administrator can manage roles.';
  END IF;
  IF p_role = 'admin' THEN
    RAISE EXCEPTION 'Admin role is permanently locked and cannot be granted or revoked.';
  END IF;
  IF p_action = 'grant' THEN
    INSERT INTO user_roles (user_id, role, granted_by) VALUES (p_target_user_id, p_role, admin_user_id) ON CONFLICT (user_id, role) DO NOTHING;
  ELSIF p_action = 'revoke' THEN
    DELETE FROM user_roles WHERE user_id = p_target_user_id AND role = p_role;
  ELSE
    RAISE EXCEPTION 'Invalid action: must be grant or revoke';
  END IF;
  INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (admin_user_id, p_action || '_role', 'user', p_target_user_id::TEXT, jsonb_build_object('role', p_role::TEXT));
  RETURN jsonb_build_object('success', true);
END;
$$;

ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_admin_only_cole;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_admin_only_cole
  CHECK (role <> 'admin'::public.app_role OR user_id = '45f0fc04-0224-4564-a77f-f641e4a1b114'::uuid);

INSERT INTO public.user_roles (user_id, role)
VALUES ('45f0fc04-0224-4564-a77f-f641e4a1b114'::uuid, 'admin'::public.app_role)
ON CONFLICT (user_id, role) DO NOTHING;
