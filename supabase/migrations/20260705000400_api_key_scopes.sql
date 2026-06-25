-- =====================================================================
-- M6 — per-key scopes for the public API (api-v1)
-- =====================================================================
-- api_keys previously granted blanket access to every endpoint. Add a
-- scopes array so a key can be limited to read-only or generation use.
-- Default preserves prior behaviour (read + generate) for existing keys.
--
-- Scope semantics (enforced in supabase/functions/api-v1/index.ts):
--   'read'     -> GET endpoints (/projects, /clips, /me)
--   'generate' -> POST generation endpoints (/videos, /avatars, /photo-edit)
-- =====================================================================

ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS scopes text[] NOT NULL DEFAULT ARRAY['read','generate'];

-- Expose scopes from the owner-lookup helper so api-v1 can authorize the
-- request without a second round-trip. (Recreated with the same name +
-- arg signature; SECURITY DEFINER / service-role usage is unchanged.)
CREATE OR REPLACE FUNCTION public.find_api_key_owner(p_key_hash text)
RETURNS TABLE(api_key_id uuid, owner_user_id uuid, scopes text[])
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, user_id, scopes
  FROM public.api_keys
  WHERE key_hash = p_key_hash
    AND revoked_at IS NULL
  LIMIT 1;
$$;
