-- Ledger-backed financial reporting: P&L, balance sheet, daily, reconciliation.
CREATE OR REPLACE FUNCTION public.ledger_pnl(_since timestamptz DEFAULT '2000-01-01')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE bal jsonb; rev numeric; cogs numeric; opex numeric;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'admin only'; END IF;
  SELECT jsonb_object_agg(account, amt) INTO bal FROM (
    SELECT account, round(sum(amount_usd),2) amt FROM public.ledger_entries WHERE occurred_at>=_since GROUP BY account) s;
  rev  := -coalesce((bal->>'revenue_credit_usage')::numeric,0) - coalesce((bal->>'revenue_storage')::numeric,0) - coalesce((bal->>'revenue_subscription')::numeric,0);
  cogs := coalesce((bal->>'cogs_api')::numeric,0) + coalesce((bal->>'cogs_storage')::numeric,0);
  opex := coalesce((bal->>'promo_expense')::numeric,0);
  RETURN jsonb_build_object(
    'revenue', jsonb_build_object('credit_usage', -coalesce((bal->>'revenue_credit_usage')::numeric,0), 'storage', -coalesce((bal->>'revenue_storage')::numeric,0), 'subscription', -coalesce((bal->>'revenue_subscription')::numeric,0), 'total', round(rev,2)),
    'cogs', jsonb_build_object('api', coalesce((bal->>'cogs_api')::numeric,0), 'storage', coalesce((bal->>'cogs_storage')::numeric,0), 'total', round(cogs,2)),
    'gross_profit', round(rev - cogs, 2),
    'gross_margin_pct', round(100*(rev-cogs)/greatest(rev,0.01),1),
    'opex', round(opex,2),
    'net_profit', round(rev - cogs - opex, 2));
END$$;
REVOKE ALL ON FUNCTION public.ledger_pnl(timestamptz) FROM public, anon; GRANT EXECUTE ON FUNCTION public.ledger_pnl(timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.ledger_balance_sheet()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE b jsonb; assets numeric; liab numeric; eq numeric; ni numeric;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'admin only'; END IF;
  SELECT jsonb_object_agg(account, amt) INTO b FROM (SELECT account, round(sum(amount_usd),2) amt FROM public.ledger_entries GROUP BY account) s;
  assets := coalesce((b->>'cash')::numeric,0) + coalesce((b->>'stripe_clearing')::numeric,0);
  liab := -coalesce((b->>'deferred_revenue_credits')::numeric,0) - coalesce((b->>'api_provider_payable')::numeric,0) - coalesce((b->>'storage_payable')::numeric,0) - coalesce((b->>'creator_payouts_liability')::numeric,0);
  ni := (-coalesce((b->>'revenue_credit_usage')::numeric,0)-coalesce((b->>'revenue_storage')::numeric,0)-coalesce((b->>'revenue_subscription')::numeric,0)) - (coalesce((b->>'cogs_api')::numeric,0)+coalesce((b->>'cogs_storage')::numeric,0)) - coalesce((b->>'promo_expense')::numeric,0);
  eq := -coalesce((b->>'opening_equity')::numeric,0) + ni;
  RETURN jsonb_build_object(
    'assets', jsonb_build_object('cash', coalesce((b->>'cash')::numeric,0), 'stripe_clearing', coalesce((b->>'stripe_clearing')::numeric,0), 'total', round(assets,2)),
    'liabilities', jsonb_build_object('deferred_credits', -coalesce((b->>'deferred_revenue_credits')::numeric,0), 'api_payable', -coalesce((b->>'api_provider_payable')::numeric,0), 'storage_payable', -coalesce((b->>'storage_payable')::numeric,0), 'creator_payouts', -coalesce((b->>'creator_payouts_liability')::numeric,0), 'total', round(liab,2)),
    'equity', jsonb_build_object('opening', -coalesce((b->>'opening_equity')::numeric,0), 'retained', round(ni,2), 'total', round(eq,2)));
END$$;
REVOKE ALL ON FUNCTION public.ledger_balance_sheet() FROM public, anon; GRANT EXECUTE ON FUNCTION public.ledger_balance_sheet() TO authenticated;

-- Reconciliation: cached profiles.credits_balance vs ledger truth.
CREATE OR REPLACE FUNCTION public.ledger_reconcile()
RETURNS TABLE(user_id uuid, cached bigint, ledger bigint, drift bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, coalesce(p.credits_balance,0)::bigint, public.ledger_user_credit_balance(p.id),
         (coalesce(p.credits_balance,0) - public.ledger_user_credit_balance(p.id))::bigint
  FROM public.profiles p
  WHERE public.is_admin(auth.uid()) AND coalesce(p.credits_balance,0) <> public.ledger_user_credit_balance(p.id);
$$;
REVOKE ALL ON FUNCTION public.ledger_reconcile() FROM public, anon; GRANT EXECUTE ON FUNCTION public.ledger_reconcile() TO authenticated;
