-- M12 / audit #11,#10: editor org-role authz + business API-key authentication.
--
-- #11: 'editor' is a valid org_role and assignable in the roster, but
--   has_org_permission + fn_org_has_min_role omit it from their rank CASE, so
--   an editor member gets a NULL/0 rank and is denied every RLS/RPC check.
--   Add editor (rank 3, between producer and reviewer). Ranks are relative —
--   both the role side and the min side use the same map, so shifting the
--   higher roles up by one preserves every existing comparison.
-- #10: business API keys are minted into org_api_keys, but the api-v1 gateway
--   authenticates only via find_api_key_owner -> api_keys, so every business
--   key returns 401. UNION org_api_keys so business keys authenticate. Billing
--   currently goes to the key creator's wallet (owner = created_by); routing
--   org-key spend to the org credit pool is tracked under M8.

CREATE OR REPLACE FUNCTION public.has_org_permission(p_org_id uuid, p_user_id uuid, p_min_role org_role)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role public.org_role;
  v_rank INT;
  v_min_rank INT;
BEGIN
  SELECT role INTO v_role FROM public.organization_members
  WHERE organization_id = p_org_id AND user_id = p_user_id;
  IF v_role IS NULL THEN RETURN false; END IF;

  v_rank := CASE v_role
    WHEN 'owner' THEN 6 WHEN 'admin' THEN 5 WHEN 'producer' THEN 4
    WHEN 'editor' THEN 3 WHEN 'reviewer' THEN 2 WHEN 'viewer' THEN 1 ELSE 0 END;
  v_min_rank := CASE p_min_role
    WHEN 'owner' THEN 6 WHEN 'admin' THEN 5 WHEN 'producer' THEN 4
    WHEN 'editor' THEN 3 WHEN 'reviewer' THEN 2 WHEN 'viewer' THEN 1 ELSE 0 END;

  RETURN v_rank >= v_min_rank;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_org_has_min_role(_org_id uuid, _user_id uuid, _min text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org_id AND user_id = _user_id
      AND CASE role::text
            WHEN 'owner'    THEN 6
            WHEN 'admin'    THEN 5
            WHEN 'producer' THEN 4
            WHEN 'editor'   THEN 3
            WHEN 'reviewer' THEN 2
            WHEN 'viewer'   THEN 1
            ELSE 0
          END >= CASE _min
            WHEN 'owner'    THEN 6
            WHEN 'admin'    THEN 5
            WHEN 'producer' THEN 4
            WHEN 'editor'   THEN 3
            WHEN 'reviewer' THEN 2
            WHEN 'viewer'   THEN 1
            ELSE 0
          END
  );
$function$;

CREATE OR REPLACE FUNCTION public.find_api_key_owner(p_key_hash text)
 RETURNS TABLE(api_key_id uuid, owner_user_id uuid)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id, user_id
  FROM public.api_keys
  WHERE key_hash = p_key_hash
    AND revoked_at IS NULL
  UNION ALL
  SELECT id, created_by
  FROM public.org_api_keys
  WHERE key_hash = p_key_hash
    AND revoked_at IS NULL
  LIMIT 1;
$function$;
