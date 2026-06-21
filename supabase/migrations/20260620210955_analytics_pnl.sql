-- Profit & Loss: cash revenue (credit purchases × $0.10) vs API COGS (real_cost_cents).
CREATE OR REPLACE FUNCTION public.analytics_pnl(_since timestamptz DEFAULT now() - interval '90 days')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE rate numeric := 0.10; rev numeric; cogs numeric; res jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'admin only'; END IF;
  rev  := round(coalesce((SELECT sum(amount) FROM public.credit_transactions WHERE transaction_type = 'purchase' AND created_at >= _since), 0) * rate, 2);
  cogs := round(coalesce((SELECT sum(real_cost_cents) FROM public.api_cost_logs WHERE created_at >= _since), 0) / 100.0, 2);
  res := jsonb_build_object(
    'revenue_usd', rev,
    'cogs_usd', cogs,
    'gross_profit_usd', round(rev - cogs, 2),
    'margin_pct', round(100 * (rev - cogs) / greatest(rev, 0.01), 1),
    'generations', (SELECT count(*) FROM public.api_cost_logs WHERE created_at >= _since),
    'credits_charged', coalesce((SELECT sum(credits_charged) FROM public.api_cost_logs WHERE created_at >= _since), 0),
    'avg_cost_usd', round(coalesce((SELECT avg(real_cost_cents) FROM public.api_cost_logs WHERE created_at >= _since), 0) / 100.0, 4),
    'by_service', (SELECT coalesce(jsonb_agg(t), '[]'::jsonb) FROM (
        SELECT service, round(sum(real_cost_cents)/100.0, 2) AS cost_usd, sum(credits_charged) AS credits, count(*) AS ops
        FROM public.api_cost_logs WHERE created_at >= _since GROUP BY service ORDER BY sum(real_cost_cents) DESC) t),
    'daily', (SELECT coalesce(jsonb_agg(t ORDER BY t.day), '[]'::jsonb) FROM (
        SELECT day, round(sum(cost_usd), 2) AS cost_usd, round(sum(revenue_usd), 2) AS revenue_usd FROM (
          SELECT created_at::date AS day, real_cost_cents/100.0 AS cost_usd, 0::numeric AS revenue_usd FROM public.api_cost_logs WHERE created_at >= _since
          UNION ALL
          SELECT created_at::date, 0, amount * rate FROM public.credit_transactions WHERE transaction_type = 'purchase' AND created_at >= _since
        ) u GROUP BY day) t)
  );
  RETURN res;
END$$;
REVOKE ALL ON FUNCTION public.analytics_pnl(timestamptz) FROM public;
GRANT EXECUTE ON FUNCTION public.analytics_pnl(timestamptz) TO authenticated;
