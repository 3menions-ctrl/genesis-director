-- ─────────────────────────────────────────────────────────────────────────
-- admin_purchase_insights(p_days) — purchase/revenue analytics for the admin
-- dashboard. SECURITY DEFINER + is_admin gated. Aggregates from:
--   • credit_transactions (purchases/refunds — credits + package parsed from
--     the description "(slug via Polar)"; USD is mapped client-side from the
--     authoritative creditPackages.ts config)
--   • analytics_events (pricing-page visits via $pageview; and the checkout
--     funnel events checkout_started/checkout_aborted/checkout_failed once the
--     client/webhook instrumentation lands — Phase B)
-- Returns a single jsonb blob so the dashboard makes one round-trip.
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
    -- Individual purchase rows in the window (with buyer name; USD mapped client-side)
    'purchases', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'at', ct.created_at,
        'userId', ct.user_id,
        'name', COALESCE(p.display_name, p.username, 'User'),
        'credits', ct.amount,
        'pkg', substring(ct.description from '\(([a-z+]+) via'),
        'orderId', ct.stripe_payment_id
      ) ORDER BY ct.created_at DESC), '[]'::jsonb)
      FROM credit_transactions ct
      LEFT JOIN profiles p ON p.id = ct.user_id
      WHERE ct.transaction_type = 'purchase' AND ct.created_at >= v_since
    ),
    -- Refund rows in the window
    'refunds', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'at', ct.created_at, 'userId', ct.user_id, 'credits', ct.amount,
        'pkg', substring(ct.description from '\(([a-z+]+) via')
      ) ORDER BY ct.created_at DESC), '[]'::jsonb)
      FROM credit_transactions ct
      WHERE ct.transaction_type = 'refund' AND ct.created_at >= v_since
    ),
    -- Pricing/credits page visits per day (for the visits→purchase funnel)
    'pricingVisitsDaily', (
      SELECT COALESCE(jsonb_object_agg(d, c), '{}'::jsonb) FROM (
        SELECT to_char(date_trunc('day', occurred_at), 'YYYY-MM-DD') d, count(*) c
        FROM analytics_events
        WHERE name = '$pageview'
          AND COALESCE(path, '') ~* '(pricing|/credits)'
          AND occurred_at >= v_since
        GROUP BY 1
      ) q
    ),
    -- Unique pricing visitors in the window (by user, then anon fallback)
    'pricingVisitors', (
      SELECT count(DISTINCT COALESCE(user_id::text, anonymous_id, session_id))
      FROM analytics_events
      WHERE name = '$pageview'
        AND COALESCE(path, '') ~* '(pricing|/credits)'
        AND occurred_at >= v_since
    ),
    -- Checkout funnel counts (Phase B events; 0 until instrumented)
    'funnel', (
      SELECT COALESCE(jsonb_object_agg(name, c), '{}'::jsonb) FROM (
        SELECT name, count(*) c
        FROM analytics_events
        WHERE name IN ('checkout_started', 'checkout_aborted', 'checkout_failed', 'buy_credits_opened')
          AND occurred_at >= v_since
        GROUP BY name
      ) q
    ),
    -- All-time totals (purchases + credits sold)
    'lifetime', (
      SELECT jsonb_build_object(
        'purchaseCount', count(*) FILTER (WHERE transaction_type = 'purchase'),
        'creditsSold', COALESCE(sum(amount) FILTER (WHERE transaction_type = 'purchase'), 0),
        'refundCount', count(*) FILTER (WHERE transaction_type = 'refund'),
        'creditsRefunded', COALESCE(sum(amount) FILTER (WHERE transaction_type = 'refund'), 0)
      )
      FROM credit_transactions
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_purchase_insights(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_purchase_insights(integer) TO authenticated, service_role;
