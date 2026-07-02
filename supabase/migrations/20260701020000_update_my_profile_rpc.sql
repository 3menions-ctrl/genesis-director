-- update_my_profile — SECURITY DEFINER self-profile update.
--
-- BUG: the settings page saved profile fields via a direct
--   supabase.from('profiles').update({...}).eq('id', auth.uid())
-- but `authenticated` was REVOKED SELECT on public.profiles (to close the
-- cross-org email/credits leak). A filtered UPDATE (`WHERE id = auth.uid()`)
-- needs SELECT to evaluate the WHERE/RLS, so every profile self-update failed
-- with "42501 permission denied for table profiles" — no user could save their
-- display name, bio, socials, prefs, etc. Reads still worked (they go through
-- the get_my_profile SECURITY DEFINER RPC).
--
-- Fix: mirror the read path — a SECURITY DEFINER RPC that updates ONLY the
-- caller's own row and ONLY a whitelist of non-sensitive editable columns
-- (never credits_balance/role/account_tier/account_type/suspended_at/
-- deactivated_at/security_version/email — matching the existing RLS WITH CHECK).
-- Each column is written only when its key is PRESENT in the patch (so callers
-- can clear a field with null without wiping untouched fields).
CREATE OR REPLACE FUNCTION public.update_my_profile(p_patch jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;
  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN
    RAISE EXCEPTION 'invalid_patch';
  END IF;

  UPDATE public.profiles SET
    display_name = CASE WHEN p_patch ? 'display_name' THEN p_patch->>'display_name' ELSE display_name END,
    full_name    = CASE WHEN p_patch ? 'full_name'    THEN p_patch->>'full_name'    ELSE full_name    END,
    username     = CASE WHEN p_patch ? 'username'     THEN p_patch->>'username'     ELSE username     END,
    tagline      = CASE WHEN p_patch ? 'tagline'      THEN p_patch->>'tagline'      ELSE tagline      END,
    bio          = CASE WHEN p_patch ? 'bio'          THEN p_patch->>'bio'          ELSE bio          END,
    location     = CASE WHEN p_patch ? 'location'     THEN p_patch->>'location'     ELSE location     END,
    country      = CASE WHEN p_patch ? 'country'      THEN p_patch->>'country'      ELSE country      END,
    company      = CASE WHEN p_patch ? 'company'      THEN p_patch->>'company'      ELSE company      END,
    external_links        = CASE WHEN p_patch ? 'external_links'        THEN p_patch->'external_links'        ELSE external_links        END,
    preferences           = CASE WHEN p_patch ? 'preferences'           THEN p_patch->'preferences'           ELSE preferences           END,
    notification_settings = CASE WHEN p_patch ? 'notification_settings' THEN p_patch->'notification_settings' ELSE notification_settings END,
    auto_recharge_enabled = CASE WHEN p_patch ? 'auto_recharge_enabled' THEN (p_patch->>'auto_recharge_enabled')::boolean ELSE auto_recharge_enabled END,
    hide_from_leaderboard = CASE WHEN p_patch ? 'hide_from_leaderboard' THEN (p_patch->>'hide_from_leaderboard')::boolean ELSE hide_from_leaderboard END,
    is_discoverable       = CASE WHEN p_patch ? 'is_discoverable'       THEN (p_patch->>'is_discoverable')::boolean       ELSE is_discoverable       END,
    interests = CASE WHEN p_patch ? 'interests'
                     THEN (SELECT COALESCE(array_agg(x), ARRAY[]::text[])
                             FROM jsonb_array_elements_text(COALESCE(p_patch->'interests', '[]'::jsonb)) x)
                     ELSE interests END,
    updated_at = now()
  WHERE id = auth.uid();

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_my_profile(jsonb) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.update_my_profile(jsonb) TO authenticated;

COMMENT ON FUNCTION public.update_my_profile IS
  'Self-service profile update. SECURITY DEFINER (authenticated lacks SELECT on profiles, so a direct filtered UPDATE 42501s). Whitelists non-sensitive editable columns only; never credits/role/tier/type/suspension/security_version. Writes a column only when its key is present in the patch.';
