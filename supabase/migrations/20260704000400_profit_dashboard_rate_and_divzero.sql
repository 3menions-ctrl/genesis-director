-- AUDIT FIX M-13 + L-18 (Medium/Low): get_admin_profit_dashboard used a
-- hardcoded 11.6¢/credit revenue rate, contradicting the canonical $0.10/credit
-- used by billing, invoices, business billing, analytics_pnl, the ledger, and
-- admin-analytics — so /admin/finance and /admin/pnl reported different revenue
-- for the same period. It also divided by SUM(credits_charged)*11.6 while
-- guarding only on real_cost_cents, so a grouping with cost but zero credits
-- charged divided by zero.
--
-- Fix: use 10¢/credit (the documented canonical price) and guard the margin
-- denominator on SUM(credits_charged) > 0. Function signature unchanged.

CREATE OR REPLACE FUNCTION public.get_admin_profit_dashboard()
RETURNS TABLE(
    date TIMESTAMPTZ,
    service TEXT,
    total_operations BIGINT,
    total_credits_charged BIGINT,
    total_real_cost_cents BIGINT,
    estimated_revenue_cents BIGINT,
    profit_margin_percent NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is admin
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  RETURN QUERY
  SELECT
    DATE_TRUNC('day', api_cost_logs.created_at) as date,
    api_cost_logs.service,
    COUNT(*)::BIGINT as total_operations,
    SUM(api_cost_logs.credits_charged)::BIGINT as total_credits_charged,
    SUM(api_cost_logs.real_cost_cents)::BIGINT as total_real_cost_cents,
    -- Canonical $0.10/credit = 10 cents/credit.
    ROUND(SUM(api_cost_logs.credits_charged) * 10)::BIGINT as estimated_revenue_cents,
    CASE
      WHEN SUM(api_cost_logs.credits_charged) > 0 THEN
        ROUND(((SUM(api_cost_logs.credits_charged) * 10) - SUM(api_cost_logs.real_cost_cents))
              / (SUM(api_cost_logs.credits_charged) * 10) * 100, 1)
      ELSE 0::NUMERIC   -- no revenue recorded for the grouping (avoids /0)
    END as profit_margin_percent
  FROM api_cost_logs
  WHERE api_cost_logs.status = 'completed'
  GROUP BY DATE_TRUNC('day', api_cost_logs.created_at), api_cost_logs.service
  ORDER BY date DESC, api_cost_logs.service;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_admin_profit_dashboard() FROM PUBLIC, anon;
