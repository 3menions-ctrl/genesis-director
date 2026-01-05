-- Drop the security definer view and recreate as regular view with RLS function
DROP VIEW IF EXISTS admin_profit_dashboard;

-- Create a secure function for admin dashboard data instead
CREATE OR REPLACE FUNCTION get_admin_profit_dashboard()
RETURNS TABLE (
  date TIMESTAMP WITH TIME ZONE,
  service TEXT,
  total_operations BIGINT,
  total_credits_charged BIGINT,
  total_real_cost_cents BIGINT,
  estimated_revenue_cents BIGINT,
  profit_margin_percent NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE_TRUNC('day', created_at) as date,
    api_cost_logs.service,
    COUNT(*)::BIGINT as total_operations,
    SUM(credits_charged)::BIGINT as total_credits_charged,
    SUM(real_cost_cents)::BIGINT as total_real_cost_cents,
    ROUND(SUM(credits_charged) * 11.6)::BIGINT as estimated_revenue_cents,
    CASE 
      WHEN SUM(real_cost_cents) > 0 THEN
        ROUND(((SUM(credits_charged) * 11.6) - SUM(real_cost_cents)) / (SUM(credits_charged) * 11.6) * 100, 1)
      ELSE 100::NUMERIC
    END as profit_margin_percent
  FROM api_cost_logs
  WHERE api_cost_logs.status = 'completed'
  GROUP BY DATE_TRUNC('day', created_at), api_cost_logs.service
  ORDER BY date DESC, api_cost_logs.service;
END;
$$;