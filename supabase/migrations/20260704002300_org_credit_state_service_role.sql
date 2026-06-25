-- ─────────────────────────────────────────────────────────────────────────
-- M2 (support): allow service-role callers to read get_org_credit_state.
--
-- editor-generate-clip runs under the service-role key (auth.uid() is NULL), so
-- it previously could not call the membership-gated get_org_credit_state and
-- instead read organizations.credits_balance directly — which ignores active
-- org holds. Mirror get_credit_state's service-role bypass so the edge function
-- can read the authoritative org available (balance − held).
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_org_credit_state(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_role text := COALESCE(current_setting('request.jwt.claim.role', true), '');
  v_balance integer := 0;
  v_held integer := 0;
BEGIN
  -- Service-role (internal edge functions) may read any org pool. End-user
  -- callers must be a member of the org.
  IF v_role <> 'service_role' THEN
    IF auth.uid() IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = p_org_id AND m.user_id = auth.uid()
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'forbidden');
    END IF;
  END IF;

  SELECT credits_balance INTO v_balance FROM public.organizations WHERE id = p_org_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'org_not_found');
  END IF;

  SELECT COALESCE(SUM(h.amount), 0) INTO v_held
  FROM public.credit_holds h
  JOIN public.movie_projects mp ON mp.id = h.project_id
  WHERE mp.organization_id = p_org_id
    AND h.status = 'held'
    AND h.expires_at > now();

  RETURN jsonb_build_object(
    'success', true,
    'balance', COALESCE(v_balance, 0),
    'held', v_held,
    'available', GREATEST(COALESCE(v_balance, 0) - v_held, 0)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_org_credit_state(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_org_credit_state(uuid) TO authenticated, service_role;
