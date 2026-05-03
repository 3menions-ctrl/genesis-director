
DROP VIEW IF EXISTS public.org_billing_summary;

CREATE VIEW public.org_billing_summary
WITH (security_invoker = true)
AS
SELECT
  o.id                          AS organization_id,
  o.name                        AS organization_name,
  o.plan                        AS plan,
  f.max_seats                   AS max_seats,
  f.included_credits_monthly    AS monthly_credit_allowance,
  COALESCE((SELECT count(*) FROM public.org_seats s
            WHERE s.organization_id = o.id AND s.revoked_at IS NULL), 0) AS active_seats,
  s.id                          AS subscription_id,
  s.status                      AS subscription_status,
  s.seats                       AS billed_seats,
  s.current_period_end          AS renews_at,
  s.cancel_at_period_end        AS cancel_pending,
  s.environment                 AS environment
FROM public.organizations o
LEFT JOIN public.org_plan_features f ON f.plan = o.plan
LEFT JOIN LATERAL (
  SELECT * FROM public.subscriptions sub
  WHERE sub.organization_id = o.id
  ORDER BY created_at DESC
  LIMIT 1
) s ON true;

GRANT SELECT ON public.org_billing_summary TO authenticated;
