-- Tighten workspace_audit_events insert policy.
--
-- Current policy 'Service role inserts audit' has WITH CHECK (true), which
-- means any authenticated client can INSERT arbitrary rows into the audit
-- log. Audit logs must be append-only from the service role / DB triggers.
-- Without this fix, any logged-in user can forge audit entries (impersonate
-- other actors, hide their own actions, spam the log).

DROP POLICY IF EXISTS "Service role inserts audit" ON public.workspace_audit_events;

CREATE POLICY "workspace_audit_events_service_only_insert"
ON public.workspace_audit_events
FOR INSERT
TO public
WITH CHECK (auth.role() = 'service_role');

-- Also explicitly block client UPDATE / DELETE on the audit log so a future
-- accidental policy add cannot make it mutable from a user JWT.

DROP POLICY IF EXISTS "workspace_audit_events_block_client_update" ON public.workspace_audit_events;
CREATE POLICY "workspace_audit_events_block_client_update"
ON public.workspace_audit_events
FOR UPDATE
TO public
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS "workspace_audit_events_block_client_delete" ON public.workspace_audit_events;
CREATE POLICY "workspace_audit_events_block_client_delete"
ON public.workspace_audit_events
FOR DELETE
TO public
USING (false);