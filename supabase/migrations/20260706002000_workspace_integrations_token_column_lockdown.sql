-- =====================================================================
-- Audit remediation (high #19): stop OAuth token plaintext exposure
--
-- workspace_integrations stores access_token_encrypted / refresh_token_encrypted
-- as PLAINTEXT (column names aspirational; no encryption wired). The table's
-- RLS policy `wi_org_members` grants org members row access, and the columns are
-- selectable via PostgREST — so any org member could read another member's
-- live OAuth access/refresh tokens.
--
-- Fix (no key provisioning required): column-level REVOKE of SELECT on the two
-- token columns from anon + authenticated. The client (BusinessIntegrations.tsx)
-- only selects id/provider/display_name/external_account_id/status/connected_at/
-- last_synced_at — never the token columns — so nothing breaks. Service-role
-- (the OAuth callback writer + any future posting/distribution function) still
-- reads them (it bypasses column grants).
--
-- NOTE: this closes the read-exposure. True at-rest encryption (AES-GCM via an
-- app-provisioned key, or Supabase Vault) is still recommended as defense in
-- depth — tracked separately; it needs an encryption-key secret to be set.
-- =====================================================================

REVOKE SELECT (access_token_encrypted, refresh_token_encrypted)
  ON public.workspace_integrations FROM anon, authenticated;
