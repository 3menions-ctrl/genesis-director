DO $$
DECLARE
  cole_user_id uuid := 'd600868d-651a-46f6-a621-a727b240ac7c';
BEGIN
  DELETE FROM public.user_roles
  WHERE role = 'admin'::public.app_role
    AND user_id <> cole_user_id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (cole_user_id, 'admin'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_roles_admin_only_cole'
      AND conrelid = 'public.user_roles'::regclass
  ) THEN
    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_admin_only_cole
      CHECK (role <> 'admin'::public.app_role OR user_id = 'd600868d-651a-46f6-a621-a727b240ac7c'::uuid);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS user_roles_single_admin_idx
ON public.user_roles (role)
WHERE role = 'admin'::public.app_role;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _role = 'admin'::public.app_role THEN
      _user_id = 'd600868d-651a-46f6-a621-a727b240ac7c'::uuid
      AND EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role = 'admin'::public.app_role
      )
    ELSE EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id
        AND role = _role
    )
  END
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::public.app_role)
$$;