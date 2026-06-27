-- HARDENING (minor): close the concurrent-refill TOCTOU race in
-- monthly_org_credit_refill().
--
-- 20260704001000 correctly funds the org pool via topup_org_credits, but its
-- per-period INSERT into org_credit_refills has no ON CONFLICT clause. The
-- NOT EXISTS guard + UNIQUE(organization_id, refill_period) make repeated/serial
-- runs idempotent, but a CONCURRENT cron + polar-webhook activation for the same
-- org in the same period can both pass NOT EXISTS, then the second INSERT raises
-- a unique violation and aborts that whole function call. polar-webhook treats
-- the refill as non-fatal so it just logs, but the cron run would abort.
--
-- This is identical to 20260704001000 EXCEPT the INSERT adds
-- ON CONFLICT (organization_id, refill_period) DO NOTHING, which closes the race
-- (the loser of the race no-ops instead of erroring). No behavioral change for
-- the non-concurrent path.

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
    -- Fund the ORG POOL (organizations.credits_balance).
    PERFORM public.topup_org_credits(
      r.organization_id,
      r.included_credits_monthly,
      'monthly_allowance'
    );

    INSERT INTO public.org_credit_refills (organization_id, subscription_id, refill_period, credits_added)
    VALUES (r.organization_id, r.sub_id, v_period, r.included_credits_monthly)
    ON CONFLICT (organization_id, refill_period) DO NOTHING;

    v_count := v_count + 1;
    v_total := v_total + r.included_credits_monthly;
  END LOOP;

  RETURN jsonb_build_object('orgs_refilled', v_count, 'credits_added', v_total,
                            'period', v_period, 'target', 'org_pool');
END;
$$;
