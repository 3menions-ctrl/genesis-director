-- Fix: search_everything (and any crews/crew_members query) 500s with
--   42P17: infinite recursion detected in policy for relation "crews"
--
-- The two SELECT policies reference each other's table inside their USING
-- clause, so evaluating either one re-triggers the other (and
-- crew_members' policy also sub-selects crew_members itself):
--
--   crews."Public crews readable"        -> sub-selects crew_members
--   crew_members."Members visible..."    -> sub-selects crews AND crew_members
--
-- Break the cycle with SECURITY DEFINER helpers: the function owner bypasses
-- RLS when reading the tables, so the policy no longer sub-selects a
-- protected relation directly. auth.uid() still resolves the caller because
-- it reads the request JWT GUC, not the session user.

CREATE OR REPLACE FUNCTION public.is_crew_member(p_crew_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.crew_members
    WHERE crew_id = p_crew_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_public_crew(p_crew_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.crews
    WHERE id = p_crew_id AND is_public
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_crew_member(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_public_crew(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_crew_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_public_crew(uuid) TO authenticated, service_role;

-- crews: a crew is readable if it is public or the caller is a member.
DROP POLICY IF EXISTS "Public crews readable" ON public.crews;
CREATE POLICY "Public crews readable" ON public.crews
  FOR SELECT USING (is_public OR public.is_crew_member(id));

-- crew_members: a membership row is readable if its crew is public or the
-- caller is a member of that crew. (The separate "Self reads own memberships"
-- policy still covers the caller's own rows.)
DROP POLICY IF EXISTS "Members visible to members" ON public.crew_members;
CREATE POLICY "Members visible to members" ON public.crew_members
  FOR SELECT USING (public.is_public_crew(crew_id) OR public.is_crew_member(crew_id));
