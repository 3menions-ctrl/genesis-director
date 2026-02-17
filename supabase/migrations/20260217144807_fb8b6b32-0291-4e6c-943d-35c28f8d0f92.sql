
-- Table to track user queries and usage patterns for app improvement
CREATE TABLE public.agent_query_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  query_text TEXT NOT NULL,
  query_category TEXT DEFAULT 'general',
  tools_used TEXT[] DEFAULT '{}',
  credits_spent INTEGER DEFAULT 0,
  response_quality TEXT DEFAULT NULL,
  session_page TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.agent_query_analytics ENABLE ROW LEVEL SECURITY;

-- Only the system (service role) can insert/read — users cannot access other users' data
-- Admin can read all for analytics
CREATE POLICY "Service role full access" ON public.agent_query_analytics
  FOR ALL USING (public.is_admin(auth.uid()));

-- Users can only see their own queries
CREATE POLICY "Users see own queries" ON public.agent_query_analytics
  FOR SELECT USING (auth.uid() = user_id);

-- Index for analytics queries
CREATE INDEX idx_agent_query_analytics_category ON public.agent_query_analytics (query_category, created_at DESC);
CREATE INDEX idx_agent_query_analytics_user ON public.agent_query_analytics (user_id, created_at DESC);

-- Aggregation view for admin dashboard (no PII)
CREATE OR REPLACE VIEW public.agent_query_trends AS
SELECT 
  query_category,
  DATE_TRUNC('day', created_at) as day,
  COUNT(*) as query_count,
  AVG(credits_spent) as avg_credits,
  array_agg(DISTINCT unnest_tools) as unique_tools_used
FROM public.agent_query_analytics,
  LATERAL unnest(COALESCE(tools_used, ARRAY[]::TEXT[])) AS unnest_tools
GROUP BY query_category, DATE_TRUNC('day', created_at)
ORDER BY day DESC;
