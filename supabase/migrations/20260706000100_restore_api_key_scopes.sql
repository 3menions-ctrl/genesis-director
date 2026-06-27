-- ============================================================================
-- Audit remediation — restore per-key scope enforcement for the public API.
--
-- 20260705000400_api_key_scopes added a `scopes text[]` column to api_keys and
-- redefined find_api_key_owner to RETURN it, so api-v1 could authorize each key
-- per-endpoint (read vs generate). The later 20260705010300 migration redefined
-- find_api_key_owner to add org_api_keys support but DROPPED `scopes` from the
-- return signature. As a result api-v1 (index.ts) reads `ownerRow[0].scopes` as
-- undefined and falls back to ['read','generate'] — i.e. EVERY key, especially
-- org/business keys, silently gets full read+generate access regardless of its
-- configured scopes.
--
-- Fix: redefine find_api_key_owner to return scopes for BOTH personal api_keys
-- and org_api_keys (both already have a `scopes text[]` column). A return-type
-- (TABLE columns) change requires dropping the function first.
-- ============================================================================

DROP FUNCTION IF EXISTS public.find_api_key_owner(text);

CREATE OR REPLACE FUNCTION public.find_api_key_owner(p_key_hash text)
 RETURNS TABLE(api_key_id uuid, owner_user_id uuid, scopes text[])
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id, user_id, scopes
  FROM public.api_keys
  WHERE key_hash = p_key_hash
    AND revoked_at IS NULL
  UNION ALL
  SELECT id, created_by, scopes
  FROM public.org_api_keys
  WHERE key_hash = p_key_hash
    AND revoked_at IS NULL
  LIMIT 1;
$function$;

COMMENT ON FUNCTION public.find_api_key_owner(text) IS
  'Resolves a public-API key hash to (api_key_id, owner_user_id, scopes) across personal api_keys and org_api_keys. Returning scopes lets api-v1 enforce per-key read/generate authorization — without it, keys default to full access.';
