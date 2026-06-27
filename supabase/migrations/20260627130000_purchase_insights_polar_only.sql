-- ─────────────────────────────────────────────────────────────────────────
-- admin_purchase_insights — count ONLY real Polar purchases.
-- Synthetic/seed/admin-grant rows (stripe_payment_id NOT LIKE 'polar_%', e.g.
-- "UIT_corporate_…", "CHK_…") were inflating order counts at ~$0 revenue and
-- (via LiveBuyAlert) spamming the admin with fake "purchase" celebrations.
-- Real Polar orders are recorded with stripe_payment_id = 'polar_<uuid>'.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_purchase_insights(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_since timestamptz := now() - (GREATEST(p_days, 1) || ' days')::interval;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'windowDays', p_days,
    'purchases', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'at', ct.created_at, 'userId', ct.user_id,
        'name', COALESCE(p.display_name, p.username, 'User'),
        'credits', ct.amount,
        'pkg', substring(ct.description from '\(([a-z+]+) via'),
        'orderId', ct.stripe_payment_id
      ) ORDER BY ct.created_at DESC), '[]'::jsonb)
      FROM credit_transactions ct
      LEFT JOIN profiles p ON p.id = ct.user_id
      WHERE ct.transaction_type = 'purchase'
        AND ct.stripe_payment_id LIKE 'polar_%'
        AND ct.created_at >= v_since
    ),
    'refunds', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'at', ct.created_at, 'userId', ct.user_id, 'credits', ct.amount,
        'pkg', substring(ct.description from '\(([a-z+]+) via')
      ) ORDER BY ct.created_at DESC), '[]'::jsonb)
      FROM credit_transactions ct
      WHERE ct.transaction_type = 'refund' AND ct.created_at >= v_since
    ),
    'pricingVisitsDaily', (
      SELECT COALESCE(jsonb_object_agg(d, c), '{}'::jsonb) FROM (
        SELECT to_char(date_trunc('day', occurred_at), 'YYYY-MM-DD') d, count(*) c
        FROM analytics_events
        WHERE name = '$pageview' AND COALESCE(path, '') ~* '(pricing|/credits)' AND occurred_at >= v_since
        GROUP BY 1
      ) q
    ),
    'pricingVisitors', (
      SELECT count(DISTINCT COALESCE(user_id::text, anonymous_id, session_id))
      FROM analytics_events
      WHERE name = '$pageview' AND COALESCE(path, '') ~* '(pricing|/credits)' AND occurred_at >= v_since
    ),
    'funnel', (
      SELECT COALESCE(jsonb_object_agg(name, c), '{}'::jsonb) FROM (
        SELECT name, count(*) c FROM analytics_events
        WHERE name IN ('checkout_started', 'checkout_aborted', 'checkout_failed', 'buy_credits_opened') AND occurred_at >= v_since
        GROUP BY name
      ) q
    ),
    'lifetime', (
      SELECT jsonb_build_object(
        'purchaseCount', count(*) FILTER (WHERE transaction_type = 'purchase' AND stripe_payment_id LIKE 'polar_%'),
        'creditsSold', COALESCE(sum(amount) FILTER (WHERE transaction_type = 'purchase' AND stripe_payment_id LIKE 'polar_%'), 0),
        'refundCount', count(*) FILTER (WHERE transaction_type = 'refund'),
        'creditsRefunded', COALESCE(sum(amount) FILTER (WHERE transaction_type = 'refund'), 0)
      )
      FROM credit_transactions
    )
  );
END;
$$;
