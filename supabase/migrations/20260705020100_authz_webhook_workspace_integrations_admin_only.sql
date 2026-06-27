-- AUTHZ FIX (forward patch): restrict webhook_endpoints and
-- workspace_integrations mutations to org admins/owners.
--
-- Bug: the 'wh_org_members' and 'wi_org_members' RLS policies (defined in
-- 20260610011412) gate FOR ALL on bare organization membership, so ANY member
-- — regardless of role — can read/insert/update/delete webhook endpoints
-- (incl. secrets) and revoke OAuth tokens (Google Drive / Notion). The UI gates
-- these to admins (BusinessApi.tsx / BusinessIntegrations.tsx canManage='admin'),
-- but a non-admin can call the table directly via the client SDK.
--
-- 20260610011412 is already applied to prod, so this forward migration replaces
-- the two policies in place, swapping the membership subquery for an admin-role
-- check via public.fn_org_has_min_role(org_id, user_id, 'admin'). Owner(>=admin)
-- still passes; the separate is_admin FOR ALL platform-admin policies are
-- untouched. Verified: fn_org_has_min_role exists (20260503063540) with this
-- exact signature.

DROP POLICY IF EXISTS "wh_org_members" ON public.webhook_endpoints;
CREATE POLICY "wh_org_members" ON public.webhook_endpoints FOR ALL
  USING (public.fn_org_has_min_role(organization_id, auth.uid(), 'admin'))
  WITH CHECK (public.fn_org_has_min_role(organization_id, auth.uid(), 'admin'));

DROP POLICY IF EXISTS "wi_org_members" ON public.workspace_integrations;
CREATE POLICY "wi_org_members" ON public.workspace_integrations FOR ALL
  USING (public.fn_org_has_min_role(organization_id, auth.uid(), 'admin'))
  WITH CHECK (public.fn_org_has_min_role(organization_id, auth.uid(), 'admin'));
