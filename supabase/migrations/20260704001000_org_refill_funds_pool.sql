-- AUDIT FIX (Critical regression introduced by the remediation set):
-- 20260704000700_org_pool_consumption.sql made EVERY org-project generation
-- debit organizations.credits_balance (reserve_credits / consume_credit_hold /
-- deduct_credits org paths). But the monthly refill — even after the H-5 fix in
-- 20260704000100 — credits the OWNER'S PERSONAL wallet via add_credits, and the
-- only function that increments organizations.credits_balance (topup_org_credits)
-- has ZERO callers anywhere in the codebase. Net effect once 000700 ships: the
-- org pool is drained but never funded, so business generation fails with
-- 'insufficient_credits' forever while the owner silently accrues personal
-- credits they cannot spend on org projects.
--
-- Fix: the monthly refill must fund the ORG POOL. Credit
-- organizations.credits_balance via the existing service-role topup_org_credits
-- instead of the owner's profile. Idempotency is preserved by the existing
-- org_credit_refills NOT EXISTS guard + UNIQUE(organization_id, refill_period).
--
-- NOTE (flagged for human action): initial provisioning at subscription
-- purchase still needs to fund the pool too (create-org-checkout / the org
-- webhook path must call topup_org_credits on activation). The monthly refill
-- below covers the first period for any active/trialing subscription the next
-- time the cron runs; an immediate top-up on purchase is a separate change.
-- See FINANCE_AUDIT_REPORT.md.

CREATE OR REPLACE FUNCTION public.monthly_org_credit_refill()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period date := date_trunc('month', now())::date;
  v_count integer := 0;
  v_total integer := 0;
  r record;
BEGIN
  FOR r IN
    SELECT s.id AS sub_id,
           s.organization_id,
           s.user_id AS owner_id,
           o.plan,
           f.included_credits_monthly
    FROM public.subscriptions s
    JOIN public.organizations o ON o.id = s.organization_id
    JOIN public.org_plan_features f ON f.plan = o.plan
    WHERE s.organization_id IS NOT NULL
      AND s.status IN ('active', 'trialing')
      AND f.included_credits_monthly > 0
      AND NOT EXISTS (
        SELECT 1 FROM public.org_credit_refills r2
        WHERE r2.organization_id = s.organization_id
          AND r2.refill_period = v_period
      )
  LOOP
    -- Fund the ORG POOL (organizations.credits_balance) — the pool that
    -- reserve_credits / consume_credit_hold / deduct_credits debit for org
    -- projects (20260704000700). topup_org_credits is SECURITY DEFINER and
    -- increments credits_balance + total_credits_purchased atomically.
    PERFORM public.topup_org_credits(
      r.organization_id,
      r.included_credits_monthly,
      'monthly_allowance'
    );

    INSERT INTO public.org_credit_refills (organization_id, subscription_id, refill_period, credits_added)
    VALUES (r.organization_id, r.sub_id, v_period, r.included_credits_monthly);

    v_count := v_count + 1;
    v_total := v_total + r.included_credits_monthly;
  END LOOP;

  RETURN jsonb_build_object('orgs_refilled', v_count, 'credits_added', v_total,
                            'period', v_period, 'target', 'org_pool');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.monthly_org_credit_refill() FROM PUBLIC, anon, authenticated;
