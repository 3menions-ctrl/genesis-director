-- Org analog of get_credit_state: the spendable state of an org's credit pool
-- (balance − active org holds), gated on caller membership. Powers the org-aware
-- credit display + pre-flight affordability check in the editor/top-bar.
-- UN-DEPLOYED (ships with the org-pool-consumption set).
CREATE OR REPLACE FUNCTION public.get_org_credit_state(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_balance integer := 0;
  v_held integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = p_org_id AND m.user_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
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
GRANT  EXECUTE ON FUNCTION public.get_org_credit_state(uuid) TO authenticated;
