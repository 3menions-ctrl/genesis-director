
-- =========================================================
-- 1. FIX: Users can self-escalate to admin via profiles.role
-- =========================================================

-- Drop the weak update policy and replace with one that locks role + tier fields
DROP POLICY IF EXISTS "Users can update own non-credit profile fields" ON public.profiles;

CREATE POLICY "Users can update own non-credit profile fields"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND credits_balance IS NOT DISTINCT FROM (SELECT credits_balance FROM public.profiles WHERE id = auth.uid())
  AND role IS NOT DISTINCT FROM (SELECT role FROM public.profiles WHERE id = auth.uid())
  AND account_tier IS NOT DISTINCT FROM (SELECT account_tier FROM public.profiles WHERE id = auth.uid())
  AND account_type IS NOT DISTINCT FROM (SELECT account_type FROM public.profiles WHERE id = auth.uid())
  AND suspended_at IS NOT DISTINCT FROM (SELECT suspended_at FROM public.profiles WHERE id = auth.uid())
  AND deactivated_at IS NOT DISTINCT FROM (SELECT deactivated_at FROM public.profiles WHERE id = auth.uid())
  AND security_version IS NOT DISTINCT FROM (SELECT security_version FROM public.profiles WHERE id = auth.uid())
);

-- Belt-and-suspenders: trigger to hard-block role/tier escalation from any non-admin path
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow service-role / admins to change sensitive fields
  IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Forbidden: cannot modify role';
  END IF;
  IF NEW.account_tier IS DISTINCT FROM OLD.account_tier THEN
    RAISE EXCEPTION 'Forbidden: cannot modify account_tier';
  END IF;
  IF NEW.account_type IS DISTINCT FROM OLD.account_type THEN
    RAISE EXCEPTION 'Forbidden: cannot modify account_type';
  END IF;
  IF NEW.credits_balance IS DISTINCT FROM OLD.credits_balance THEN
    RAISE EXCEPTION 'Forbidden: cannot modify credits_balance';
  END IF;
  IF NEW.suspended_at IS DISTINCT FROM OLD.suspended_at THEN
    RAISE EXCEPTION 'Forbidden: cannot modify suspended_at';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_profile_privilege_escalation_trg ON public.profiles;
CREATE TRIGGER prevent_profile_privilege_escalation_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- =========================================================
-- 2. FIX: Genesis tables trust profiles.role for admin check
--    → switch to has_role(auth.uid(), 'admin')
-- =========================================================

DROP POLICY IF EXISTS "Admins can manage scenes" ON public.genesis_scenes;
CREATE POLICY "Admins can manage scenes"
ON public.genesis_scenes
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage screenplays" ON public.genesis_screenplay;
CREATE POLICY "Admins can manage screenplays"
ON public.genesis_screenplay
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage preset characters" ON public.genesis_preset_characters;
CREATE POLICY "Admins can manage preset characters"
ON public.genesis_preset_characters
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage all clips" ON public.genesis_scene_clips;
CREATE POLICY "Admins can manage all clips"
ON public.genesis_scene_clips
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage scene characters" ON public.genesis_scene_characters;
CREATE POLICY "Admins can manage scene characters"
ON public.genesis_scene_characters
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- =========================================================
-- 3. FIX: enterprise-brand-kits bucket publicly readable
-- =========================================================

DROP POLICY IF EXISTS "Brand kits are publicly readable" ON storage.objects;

-- Owner-scoped read is already covered by "enterprise-brand-kits owner read".
-- Add explicit admin read for support purposes.
DROP POLICY IF EXISTS "enterprise-brand-kits admin read" ON storage.objects;
CREATE POLICY "enterprise-brand-kits admin read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'enterprise-brand-kits'
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- =========================================================
-- 4. FIX: banned_accounts — add explicit anon deny
-- =========================================================

DROP POLICY IF EXISTS "Deny anonymous access to banned_accounts" ON public.banned_accounts;
CREATE POLICY "Deny anonymous access to banned_accounts"
ON public.banned_accounts
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);
