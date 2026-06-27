-- Close the profiles cross-user PII leak (email/credits readable by any
-- authenticated user via the permissive "Public profile read => true" SELECT
-- policy). Applied to prod via Management API; this file documents it.
--
-- Strategy (no column revokes — RLS row-restriction closes the leak while
-- own/org/admin reads keep their columns):
--   1. profiles_public -> SECURITY DEFINER + add public-safe columns, so public
--      profile/search display survives the policy drop.
--   2. Org co-members can read each other's full profile row (team UI emails).
--   3. Drop the permissive "Public profile read" policy. Remaining SELECT
--      policies: own (id=auth.uid()), admin, org-co-member.

CREATE OR REPLACE VIEW public.profiles_public AS
 SELECT id, username, display_name, avatar_url, cover_url, bio, tagline,
        location, country, interests, profile_view_count, featured_reel_id,
        verified_at, verified_kind, pinned_collections,
        created_at, pinned_reel_ids, is_discoverable
   FROM public.profiles
  WHERE deactivated_at IS NULL;
ALTER VIEW public.profiles_public SET (security_invoker = off);
GRANT SELECT ON public.profiles_public TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.shares_org_with(_target uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members me
    JOIN public.organization_members them ON them.organization_id = me.organization_id
    WHERE me.user_id = auth.uid() AND them.user_id = _target
  );
$fn$;
GRANT EXECUTE ON FUNCTION public.shares_org_with(uuid) TO authenticated;

DROP POLICY IF EXISTS "Org co-members read profile" ON public.profiles;
CREATE POLICY "Org co-members read profile" ON public.profiles FOR SELECT
  USING (public.shares_org_with(id));

DROP POLICY IF EXISTS "Public profile read" ON public.profiles;
