
-- Immutable admin lock: Only d600868d-651a-46f6-a621-a727b240ac7c can ever hold the admin role
-- This trigger prevents:
-- 1. Granting admin to any other user
-- 2. Revoking admin from the locked admin
-- 3. Any INSERT/UPDATE/DELETE that would change admin role assignments

CREATE OR REPLACE FUNCTION public.enforce_admin_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  locked_admin_id UUID := 'd600868d-651a-46f6-a621-a727b240ac7c';
BEGIN
  -- On INSERT: only the locked admin can receive the admin role
  IF TG_OP = 'INSERT' THEN
    IF NEW.role = 'admin' AND NEW.user_id != locked_admin_id THEN
      RAISE EXCEPTION 'Admin role is permanently locked to a single account and cannot be granted to other users.';
    END IF;
    RETURN NEW;
  END IF;

  -- On UPDATE: prevent changing any admin role assignment
  IF TG_OP = 'UPDATE' THEN
    IF OLD.role = 'admin' OR NEW.role = 'admin' THEN
      RAISE EXCEPTION 'Admin role assignments cannot be modified.';
    END IF;
    RETURN NEW;
  END IF;

  -- On DELETE: prevent removing the admin role from the locked admin
  IF TG_OP = 'DELETE' THEN
    IF OLD.role = 'admin' AND OLD.user_id = locked_admin_id THEN
      RAISE EXCEPTION 'Admin role cannot be revoked from the permanent administrator.';
    END IF;
    -- Allow deleting admin from non-locked users (cleanup)
    IF OLD.role = 'admin' THEN
      RAISE EXCEPTION 'Admin role assignments cannot be deleted.';
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

-- Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS enforce_admin_lock_trigger ON public.user_roles;
CREATE TRIGGER enforce_admin_lock_trigger
  BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_admin_lock();

-- Also harden the admin_manage_role function to double-check
CREATE OR REPLACE FUNCTION public.admin_manage_role(p_target_user_id uuid, p_role app_role, p_action text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  admin_user_id UUID := auth.uid();
  locked_admin_id UUID := 'd600868d-651a-46f6-a621-a727b240ac7c';
BEGIN
  -- Only the locked admin can manage roles
  IF admin_user_id != locked_admin_id THEN
    RAISE EXCEPTION 'Unauthorized: Only the permanent administrator can manage roles.';
  END IF;

  -- Block any admin role changes entirely
  IF p_role = 'admin' THEN
    RAISE EXCEPTION 'Admin role is permanently locked and cannot be granted or revoked.';
  END IF;

  IF p_action = 'grant' THEN
    INSERT INTO user_roles (user_id, role, granted_by)
    VALUES (p_target_user_id, p_role, admin_user_id)
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSIF p_action = 'revoke' THEN
    DELETE FROM user_roles WHERE user_id = p_target_user_id AND role = p_role;
  ELSE
    RAISE EXCEPTION 'Invalid action: must be grant or revoke';
  END IF;

  INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (admin_user_id, p_action || '_role', 'user', p_target_user_id::TEXT,
    jsonb_build_object('role', p_role::TEXT));

  RETURN jsonb_build_object('success', true);
END;
$$;
