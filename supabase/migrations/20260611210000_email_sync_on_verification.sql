-- ════════════════════════════════════════════════════════════════════════
-- Sync profiles.email when auth.users.email rotates (post-verification).
--
-- After the two-step email change flow lands, profiles.email must lag
-- the auth user until the new address is verified. Supabase fires the
-- trigger only after the user clicks the confirmation link in the new
-- inbox, so this trigger is the canonical "now it's safe to update".
--
-- We also bump security_version so all prior sessions get invalidated
-- on next token refresh — defense in depth against session theft.
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.sync_profile_email_on_verify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only act on actual email rotations on a confirmed account.
  IF NEW.email IS DISTINCT FROM OLD.email AND NEW.email_confirmed_at IS NOT NULL THEN
    UPDATE public.profiles
    SET email = NEW.email,
        security_version = EXTRACT(EPOCH FROM now())::int,
        updated_at = now()
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_email_on_verify ON auth.users;
CREATE TRIGGER trg_sync_profile_email_on_verify
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_email_on_verify();
