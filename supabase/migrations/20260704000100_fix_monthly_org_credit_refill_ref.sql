-- AUDIT FIX H-5 (High): monthly_org_credit_refill passed NULL as the 4th
-- positional arg to add_credits(p_user_id, p_amount, p_description,
-- p_stripe_payment_id). The current add_credits raises
-- 'Invalid Stripe payment reference' when that arg is NULL or shorter than 5
-- chars, so the whole refill RPC aborted and NO org was ever refilled.
--
-- Fix: pass a stable, unique idempotency reference of the form
-- 'org_refill_<org_id>_<YYYY-MM>'. This both satisfies the guard and makes the
-- per-org/per-period grant idempotent inside add_credits (complementing the
-- existing org_credit_refills NOT EXISTS guard). Function body is otherwise
-- identical to 20260503044426.
--
-- NOTE: spendable balances depend on AUDIT FIX C-1 (credit_ledger_total reads
-- credit_transactions again); add_credits writes to credit_transactions, so
-- once C-1 is applied these refilled credits are spendable.

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
    -- Credit the org owner's profile (idempotency ref satisfies add_credits'
    -- non-null/length>=5 guard and dedupes per org per period).
    PERFORM public.add_credits(
      r.owner_id,
      r.included_credits_monthly,
      format('Monthly %s plan allowance (%s)', r.plan, to_char(v_period, 'YYYY-MM')),
      format('org_refill_%s_%s', r.organization_id, to_char(v_period, 'YYYY-MM'))
    );

    INSERT INTO public.org_credit_refills (organization_id, subscription_id, refill_period, credits_added)
    VALUES (r.organization_id, r.sub_id, v_period, r.included_credits_monthly);

    v_count := v_count + 1;
    v_total := v_total + r.included_credits_monthly;
  END LOOP;

  RETURN jsonb_build_object('orgs_refilled', v_count, 'credits_added', v_total, 'period', v_period);
END;
$$;

-- Preserve the prior privilege posture (server/cron only).
REVOKE EXECUTE ON FUNCTION public.monthly_org_credit_refill() FROM PUBLIC, anon, authenticated;
