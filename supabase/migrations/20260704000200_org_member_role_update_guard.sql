-- AUDIT FIX H-1 (High): the "Admins can update member roles" policy on
-- organization_members had only USING (caller is org admin) and NO WITH CHECK.
-- Postgres then reuses USING as the check, which only verifies the caller is
-- still an admin — it does NOT constrain the new `role`. So an admin could
-- UPDATE any member row (including their own) and set role='owner',
-- self-escalating to owner (then transfer/delete the workspace). The only
-- existing guard, protect_last_owner, blocks demoting/removing the LAST owner,
-- not adding owners.
--
-- Fix: ownership changes are owner-only. Admins may update only non-owner rows,
-- and only to non-owner roles. Owners retain full control (has_org_permission
-- is hierarchical: owner rank 5 >= admin rank 4; the 'owner' check is true only
-- for owners). protect_last_owner still applies on top.
--
-- In USING, `role` is the EXISTING row's role; in WITH CHECK it is the NEW row's
-- role. Both branches must be guarded to block (a) promoting anyone to owner and
-- (b) an admin modifying an existing owner's row.

DROP POLICY IF EXISTS "Admins can update member roles" ON public.organization_members;

CREATE POLICY "Admins can update member roles"
ON public.organization_members FOR UPDATE TO authenticated
USING (
  public.has_org_permission(organization_id, auth.uid(), 'admin')
  AND (
    role <> 'owner'
    OR public.has_org_permission(organization_id, auth.uid(), 'owner')
  )
)
WITH CHECK (
  public.has_org_permission(organization_id, auth.uid(), 'admin')
  AND (
    role <> 'owner'
    OR public.has_org_permission(organization_id, auth.uid(), 'owner')
  )
);
