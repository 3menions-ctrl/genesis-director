-- AUTHZ/BILLING FIX (forward patch): monthly_org_credit_refill must fund the
-- ORG POOL, not the owner's personal profile.
--
-- Root cause: org consumption was migrated to the org pool in
-- 20260704000700_org_pool_consumption.sql — reserve_credits / consume_credit_hold
-- / deduct_credits all debit organizations.credits_balance for org-project
-- generations ("org generations must ALWAYS consume the ORG credit pool, not the
-- member's personal credits"). But the monthly refill (20260704000100) was never
-- switched to match: it still credits the OWNER's profile via
-- add_credits(owner_id, ...). So the org pool that generations drain is funded by
-- nobody, and a paid business org hits insufficient_credits.
--
-- This also fixes the activation path: polar-webhook upsertSubscription calls
-- monthly_org_credit_refill() on subscription.active/created, so once the refill
-- funds the pool, a newly-activated org is funded for its current period too.
--
-- Surgical change: the ONLY difference from 20260704000100 is the funding call —
-- add_credits(owner_id, ...)  →  topup_org_credits(organization_id, ...), which
-- does `UPDATE organizations SET credits_balance = credits_balance + p_amount`.
-- The org_credit_refills NOT EXISTS guard + per-period INSERT ... ON CONFLICT
-- (organization_id, refill_period) DO NOTHING provide idempotency across the
-- monthly cron, webhook re-deliveries, AND a concurrent cron+webhook race (the
-- ON CONFLICT closes the TOCTOU window the bare NOT EXISTS left open). Privilege
-- posture (cron/server only) preserved.
--
-- NOTE (intentionally NOT done here): owner profiles already over-credited by the
-- previous wrong-bucket refills are a separate, audited data-repair concern.

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
    -- Fund the ORG POOL (organizations.credits_balance) — the bucket org-project
    -- generations actually consume. The org_credit_refills row below makes the
    -- grant idempotent per org per period.
    PERFORM public.topup_org_credits(
      r.organization_id,
      r.included_credits_monthly,
      'monthly_refill',
      jsonb_build_object(
        'plan', r.plan,
        'period', to_char(v_period, 'YYYY-MM'),
        'subscription_id', r.sub_id
      )
    );

    INSERT INTO public.org_credit_refills (organization_id, subscription_id, refill_period, credits_added)
    VALUES (r.organization_id, r.sub_id, v_period, r.included_credits_monthly)
    ON CONFLICT (organization_id, refill_period) DO NOTHING;

    v_count := v_count + 1;
    v_total := v_total + r.included_credits_monthly;
  END LOOP;

  RETURN jsonb_build_object('orgs_refilled', v_count, 'credits_added', v_total, 'period', v_period);
END;
$$;

-- Preserve the prior privilege posture (server/cron only).
REVOKE EXECUTE ON FUNCTION public.monthly_org_credit_refill() FROM PUBLIC, anon, authenticated;
