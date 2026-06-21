
-- Fix: Recreate view with SECURITY INVOKER (default, safe)
DROP VIEW IF EXISTS public.agent_query_trends;

CREATE OR REPLACE VIEW public.agent_query_trends 
WITH (security_invoker = true)
AS
SELECT 
  query_category,
  DATE_TRUNC('day', created_at) as day,
  COUNT(*) as query_count,
  AVG(credits_spent) as avg_credits
FROM public.agent_query_analytics
GROUP BY query_category, DATE_TRUNC('day', created_at)
ORDER BY day DESC;
