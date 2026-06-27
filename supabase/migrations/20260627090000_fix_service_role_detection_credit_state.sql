-- ─────────────────────────────────────────────────────────────────────────
-- FIX (launch-blocker): service-role detection in credit-state RPCs.
--
-- get_credit_state / get_org_credit_state gated service-role callers on
--   current_setting('request.jwt.claim.role', true)
-- but this Supabase instance's PostgREST does NOT populate the SINGULAR
-- `request.jwt.claim.role` GUC (verified: it returns NULL; only the PLURAL
-- `request.jwt.claims` / auth.role() / auth.jwt()->>'role' carry the role).
--
-- Net effect: every internal edge function (hollywood-pipeline,
-- editor-generate-clip, …) that called these RPCs with the service-role key
-- got {"success":false,"error":"forbidden"} → "Failed to fetch user credit
-- state" → ALL credit-gated video generation failed.
--
-- Fix: detect the role via auth.role() (canonical Supabase helper, verified to
-- return 'service_role' in this instance). Behavior is otherwise unchanged.
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_credit_state(p_user_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_requester uuid := auth.uid();
  v_role text := COALESCE(auth.role(), '');
  v_balance integer := 0;
  v_held integer := 0;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  IF v_role <> 'service_role' AND (v_requester IS NULL OR (p_user_id <> v_requester AND NOT public.is_admin(v_requester))) THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'profile_not_found');
  END IF;

  v_balance := public.credit_ledger_total(p_user_id);
  v_held := public.active_credit_holds_total(p_user_id);

  RETURN jsonb_build_object(
    'success', true,
    'balance', v_balance,
    'held', v_held,
    'available', GREATEST(v_balance - v_held, 0),
    'source', 'ledger',
    'totalPurchased', GREATEST(0, (
      SELECT COALESCE(SUM(amount), 0)::integer
      FROM public.credit_transactions
      WHERE user_id = p_user_id
        AND amount > 0
        AND transaction_type NOT IN ('untracked_increase','audit','security_alert')
    )),
    'totalUsed', GREATEST(0, -(
      SELECT COALESCE(SUM(amount), 0)::integer
      FROM public.credit_transactions
      WHERE user_id = p_user_id
        AND amount < 0
        AND transaction_type NOT IN ('untracked_increase','audit','security_alert')
    ))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_org_credit_state(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_role text := COALESCE(auth.role(), '');
  v_balance integer := 0;
  v_held integer := 0;
BEGIN
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
