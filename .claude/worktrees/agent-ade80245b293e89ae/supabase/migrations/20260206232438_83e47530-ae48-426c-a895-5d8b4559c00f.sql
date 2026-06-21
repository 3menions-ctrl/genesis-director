-- ============================================================
-- SECURITY HARDENING: Hide Private Information
-- ============================================================

-- 1. RECREATE profiles_public view with security_invoker
-- This view only exposes public-safe fields for social features
DROP VIEW IF EXISTS public.profiles_public;

CREATE VIEW public.profiles_public
WITH (security_invoker = on) AS
SELECT 
  id,
  display_name,
  avatar_url,
  created_at
FROM public.profiles;

-- Grant access to the view
GRANT SELECT ON public.profiles_public TO authenticated, anon;

-- 2. CREATE credit_transactions_safe view (hides stripe_payment_id)
CREATE OR REPLACE VIEW public.credit_transactions_safe
WITH (security_invoker = on) AS
SELECT 
  id,
  user_id,
  amount,
  transaction_type,
  description,
  project_id,
  clip_duration_seconds,
  created_at
  -- Explicitly excludes: stripe_payment_id
FROM public.credit_transactions;

GRANT SELECT ON public.credit_transactions_safe TO authenticated;

-- 3. CREATE user_gamification_public view (aggregated, no individual metrics)
CREATE OR REPLACE VIEW public.user_gamification_public
WITH (security_invoker = on) AS
SELECT 
  ug.user_id,
  ug.level,
  ug.xp_total,
  p.display_name,
  p.avatar_url
  -- Excludes: videos_created, total_views, total_likes_received, current_streak, etc.
FROM public.user_gamification ug
JOIN public.profiles p ON p.id = ug.user_id
WHERE ug.leaderboard_visible = true;

GRANT SELECT ON public.user_gamification_public TO authenticated, anon;

-- 4. CREATE api_cost_logs_safe view (hides cost details)
CREATE OR REPLACE VIEW public.api_cost_logs_safe  
WITH (security_invoker = on) AS
SELECT 
  id,
  user_id,
  project_id,
  service,
  operation,
  status,
  duration_seconds,
  created_at
  -- Excludes: real_cost_cents, credits_charged, metadata
FROM public.api_cost_logs;

GRANT SELECT ON public.api_cost_logs_safe TO authenticated;

-- 5. Add RLS policy comments for documentation
COMMENT ON VIEW public.profiles_public IS 'Public-safe profile data for social features. Excludes: email, full_name, company, use_case, credits_balance, financial data, preferences, notification_settings';
COMMENT ON VIEW public.credit_transactions_safe IS 'User transaction history without payment IDs. Excludes: stripe_payment_id';
COMMENT ON VIEW public.user_gamification_public IS 'Leaderboard data for visible users only. Excludes: detailed activity metrics';
COMMENT ON VIEW public.api_cost_logs_safe IS 'API usage logs without cost information. Excludes: real_cost_cents, credits_charged, metadata';