-- NET-NEW org-pool fixes that the parallel remediation on main did NOT cover.
-- (main's 20260705000100 already made deduct_credits hold-aware and
-- 20260705000200 locked down profiles — those are intentionally NOT repeated
-- here. This migration only adds the two genuinely-missing pieces.)
--
--   H1 — refund_credits has no ORG branch, so a failed ORG-project generation's
--        refund neither restores organizations.credits_balance nor the member's
--        personal balance (the org-tagged refund row is excluded from
--        credit_ledger_total) — the credits vanish.
--   H2 — the org pool is DEBITED on spend but never FUNDED at purchase. The
--        monthly cron funds it only if organizations.plan is set, but nothing
--        sets it. This trigger sets the plan from the checkout metadata AND
--        funds the current period at activation, idempotent via
--        org_credit_refills (shared guard with the monthly cron).
--
-- MONEY-PATH. Validate in staging. Runs AFTER main's 20260705000xxx set so it
-- layers on the final function/column definitions.

-- ─────────────────────────────────────────────────────────────────────────────
-- H1) refund_credits — restore the ORG pool when the project is org-owned.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.refund_credits(
  p_user_id uuid,
  p_amount integer,
  p_description text,
  p_project_id uuid DEFAULT NULL::uuid,
  p_idempotency_key text DEFAULT NULL::text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  existing_txn_id uuid;
  v_org uuid;
  v_balance integer;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'refund_credits requires a positive amount (got %).', p_amount;
  END IF;

  v_org := (SELECT organization_id FROM public.movie_projects WHERE id = p_project_id);

  -- Idempotency (both paths): a prior refund row for this (user, project, key)
  -- means we already refunded.
  IF p_idempotency_key IS NOT NULL AND p_project_id IS NOT NULL THEN
    SELECT id INTO existing_txn_id
    FROM public.credit_transactions
    WHERE user_id = p_user_id
      AND project_id = p_project_id
      AND idempotency_key = p_idempotency_key
      AND transaction_type = 'refund'
    LIMIT 1;
    IF existing_txn_id IS NOT NULL THEN
      RETURN TRUE;
    END IF;
  END IF;

  IF v_org IS NOT NULL THEN
    -- ORG POOL PATH: restore the org wallet (mirror of the consume/deduct org
    -- debit) and record an org-tagged refund row (excluded from the member's
    -- personal ledger by credit_ledger_total, so personal credits are untouched).
    SELECT credits_balance INTO v_balance FROM public.organizations WHERE id = v_org FOR UPDATE;
    IF NOT FOUND THEN
      RETURN FALSE;
    END IF;
    v_balance := v_balance + p_amount;

    INSERT INTO public.credit_transactions (
      user_id, amount, transaction_type, description, project_id, idempotency_key, balance_after, organization_id
    ) VALUES (
      p_user_id, p_amount, 'refund', p_description, p_project_id, p_idempotency_key, v_balance, v_org
    );

    UPDATE public.organizations
    SET credits_balance     = credits_balance + p_amount,
        total_credits_used  = GREATEST(total_credits_used - p_amount, 0),
        updated_at          = now()
    WHERE id = v_org;

    RETURN TRUE;
  END IF;

  -- PERSONAL PATH (unchanged behavior)
  PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  v_balance := public.credit_ledger_total(p_user_id) + p_amount;

  INSERT INTO public.credit_transactions (
    user_id, amount, transaction_type, description, project_id, idempotency_key, balance_after
  ) VALUES (
    p_user_id, p_amount, 'refund', p_description, p_project_id, p_idempotency_key, v_balance
  );

  RETURN TRUE;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- H2) Fund the org pool when an org subscription becomes active/trialing.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.activate_org_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text;
  v_included integer := 0;
  v_period date := date_trunc('month', now())::date;
BEGIN
  IF NEW.organization_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('active', 'trialing') THEN RETURN NEW; END IF;

  -- Plan comes from the checkout metadata (create-org-checkout stores
  -- plan = 'growth' | 'scale'). Only update to a recognized org plan.
  v_plan := NULLIF(NEW.metadata ->> 'plan', '');
  IF v_plan IN ('starter', 'growth', 'scale', 'enterprise') THEN
    UPDATE public.organizations
    SET plan = v_plan, updated_at = now()
    WHERE id = NEW.organization_id AND plan IS DISTINCT FROM v_plan;
  ELSE
    -- Unknown/missing metadata plan — fund against the org's current plan.
    SELECT plan INTO v_plan FROM public.organizations WHERE id = NEW.organization_id;
  END IF;

  SELECT included_credits_monthly INTO v_included
  FROM public.org_plan_features WHERE plan = v_plan;

  IF COALESCE(v_included, 0) > 0
     AND NOT EXISTS (
       SELECT 1 FROM public.org_credit_refills r
       WHERE r.organization_id = NEW.organization_id AND r.refill_period = v_period
     ) THEN
    PERFORM public.topup_org_credits(NEW.organization_id, v_included, 'subscription_activation');
    INSERT INTO public.org_credit_refills (organization_id, subscription_id, refill_period, credits_added)
    VALUES (NEW.organization_id, NEW.id, v_period, v_included)
    ON CONFLICT (organization_id, refill_period) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activate_org_subscription ON public.subscriptions;
CREATE TRIGGER trg_activate_org_subscription
  AFTER INSERT OR UPDATE OF status, metadata ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.activate_org_subscription();
