-- ════════════════════════════════════════════════════════════════════════
-- Fix signup — auto_follow_admin_on_signup hard-codes an admin user_id
-- that doesn't exist in this Supabase project. Every signup hits a
-- foreign-key violation on user_follows.following_id and rolls back the
-- whole INSERT INTO auth.users, surfacing as "Sign up failed."
--
-- Two-part fix:
--   1. Make the function tolerant: only insert if the configured admin
--      user actually exists in auth.users. This also protects against
--      the admin being deleted later.
--   2. Don't hard-code an id. Read the first admin from `user_roles`
--      (role = 'admin'), if any. If no admin exists yet, do nothing —
--      the signup completes cleanly.
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.auto_follow_admin_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid;
BEGIN
  -- Find the first admin from user_roles. If the role table is missing,
  -- empty, or the looked-up user no longer exists, silently no-op.
  BEGIN
    SELECT user_id INTO v_admin_id
    FROM public.user_roles
    WHERE role = 'admin'
    ORDER BY created_at ASC
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_admin_id := NULL;
  END;

  IF v_admin_id IS NULL OR v_admin_id = NEW.id THEN
    RETURN NEW;
  END IF;

  -- Verify the admin actually exists in auth.users before insert.
  -- Without this the FK check on user_follows.following_id fails and
  -- the whole signup rolls back.
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_admin_id) THEN
    RETURN NEW;
  END IF;

  BEGIN
    INSERT INTO public.user_follows (follower_id, following_id)
    VALUES (NEW.id, v_admin_id)
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Any error here (FK, RLS, table-missing) is non-critical to signup;
    -- swallow so the user can still create their account.
    NULL;
  END;

  RETURN NEW;
END $$;
