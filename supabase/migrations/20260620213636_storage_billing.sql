-- Storage metering + storage->credits billing (tied to the ledger).
CREATE TABLE IF NOT EXISTS public.storage_usage_daily (
  user_id uuid NOT NULL, day date NOT NULL DEFAULT current_date,
  bytes bigint NOT NULL DEFAULT 0, objects int NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day));
ALTER TABLE public.storage_usage_daily ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sud_admin ON public.storage_usage_daily;
CREATE POLICY sud_admin ON public.storage_usage_daily FOR SELECT USING (public.is_admin(auth.uid()));

-- pricing config (priced for ~89% margin: $0.20/GB sell vs ~$0.021/GB cost)
INSERT INTO public.system_config(key,value) VALUES
  ('storage.free_gb','2'::jsonb),
  ('storage.price_credits_per_gb_month','2'::jsonb),
  ('storage.cost_per_gb_month_usd','0.021'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Snapshot per-user storage (owner, else {uuid}/ path prefix).
CREATE OR REPLACE FUNCTION public.compute_storage_usage()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, storage AS $$
DECLARE n int;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'admin only'; END IF;
  DELETE FROM public.storage_usage_daily WHERE day = current_date;
  INSERT INTO public.storage_usage_daily(user_id, day, bytes, objects)
  SELECT uid, current_date, sum(sz)::bigint, count(*)
  FROM (
    SELECT CASE WHEN owner IS NOT NULL THEN owner
                WHEN split_part(name,'/',1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-' THEN split_part(name,'/',1)::uuid
                ELSE NULL END AS uid,
           coalesce((metadata->>'size')::bigint, 0) AS sz
    FROM storage.objects
  ) s WHERE uid IS NOT NULL GROUP BY uid;
  GET DIAGNOSTICS n = ROW_COUNT; RETURN n;
END$$;
REVOKE ALL ON FUNCTION public.compute_storage_usage() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.compute_storage_usage() TO authenticated, service_role;

-- Bill storage overage in credits → ledger (revenue + COGS), balance-safe.
CREATE OR REPLACE FUNCTION public.bill_storage(_period text DEFAULT to_char(now(),'YYYY-MM'))
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE free_gb numeric; price numeric; cost numeric; r RECORD;
        gb numeric; billable numeric; charge bigint; bal bigint; actual bigint; line_cost numeric;
        users int := 0; charged_total bigint := 0; rev numeric := 0; cogs_t numeric := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'admin only'; END IF;
  SELECT coalesce((value)::numeric,2) INTO free_gb FROM public.system_config WHERE key='storage.free_gb';
  SELECT coalesce((value)::numeric,2) INTO price   FROM public.system_config WHERE key='storage.price_credits_per_gb_month';
  SELECT coalesce((value)::numeric,0.021) INTO cost FROM public.system_config WHERE key='storage.cost_per_gb_month_usd';
  FOR r IN SELECT user_id, bytes FROM public.storage_usage_daily
           WHERE day = (SELECT max(day) FROM public.storage_usage_daily) AND user_id IS NOT NULL LOOP
    gb := r.bytes / 1e9; billable := greatest(0, gb - free_gb); charge := ceil(billable * price);
    IF charge <= 0 THEN CONTINUE; END IF;
    IF EXISTS (SELECT 1 FROM public.ledger_txns WHERE kind='storage_billing' AND user_id=r.user_id AND ref_id=_period) THEN CONTINUE; END IF;
    bal := public.ledger_user_credit_balance(r.user_id);
    actual := least(charge, greatest(bal, 0));
    IF actual <= 0 THEN CONTINUE; END IF;
    line_cost := round(gb * cost, 4);
    PERFORM public.ledger_post('storage_billing',
      jsonb_build_array(
        jsonb_build_object('account','deferred_revenue_credits','amount_usd', round(actual*0.10,4), 'amount_credits', -actual),
        jsonb_build_object('account','revenue_storage','amount_usd', round(-actual*0.10,4)),
        jsonb_build_object('account','cogs_storage','amount_usd', line_cost),
        jsonb_build_object('account','storage_payable','amount_usd', -line_cost)),
      r.user_id, 'storage', _period, 'Storage billing '||_period,
      jsonb_build_object('gb',round(gb,3),'charge',charge,'actual',actual,'shortfall',charge-actual));
    UPDATE public.profiles SET credits_balance = public.ledger_user_credit_balance(r.user_id) WHERE id = r.user_id;
    users := users+1; charged_total := charged_total+actual; rev := rev+actual*0.10; cogs_t := cogs_t+line_cost;
  END LOOP;
  RETURN jsonb_build_object('period',_period,'users_billed',users,'credits_charged',charged_total,'revenue_usd',round(rev,2),'cogs_usd',round(cogs_t,2));
END$$;
REVOKE ALL ON FUNCTION public.bill_storage(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.bill_storage(text) TO authenticated, service_role;

-- Admin storage overview (per-user usage + billing projection).
CREATE OR REPLACE FUNCTION public.storage_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE free_gb numeric; price numeric; cost numeric; res jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'admin only'; END IF;
  SELECT coalesce((value)::numeric,2) INTO free_gb FROM public.system_config WHERE key='storage.free_gb';
  SELECT coalesce((value)::numeric,2) INTO price   FROM public.system_config WHERE key='storage.price_credits_per_gb_month';
  SELECT coalesce((value)::numeric,0.021) INTO cost FROM public.system_config WHERE key='storage.cost_per_gb_month_usd';
  SELECT jsonb_build_object(
    'free_gb', free_gb, 'price_credits_per_gb', price, 'cost_per_gb_usd', cost,
    'snapshot_day', (SELECT max(day) FROM public.storage_usage_daily),
    'total_gb', round(coalesce((SELECT sum(bytes) FROM public.storage_usage_daily WHERE day=(SELECT max(day) FROM public.storage_usage_daily)),0)/1e9,3),
    'attributed_users', (SELECT count(*) FROM public.storage_usage_daily WHERE day=(SELECT max(day) FROM public.storage_usage_daily)),
    'monthly_cogs_usd', round(coalesce((SELECT sum(bytes) FROM public.storage_usage_daily WHERE day=(SELECT max(day) FROM public.storage_usage_daily)),0)/1e9*cost,2),
    'users', (SELECT coalesce(jsonb_agg(t ORDER BY t.gb DESC),'[]'::jsonb) FROM (
        SELECT u.user_id, round(u.bytes/1e9,3) gb, u.objects,
               greatest(0, round(u.bytes/1e9 - free_gb,3)) billable_gb,
               ceil(greatest(0, u.bytes/1e9 - free_gb)*price)::bigint est_charge_credits,
               coalesce(p.display_name,'') name
        FROM public.storage_usage_daily u LEFT JOIN public.profiles p ON p.id=u.user_id
        WHERE u.day=(SELECT max(day) FROM public.storage_usage_daily) LIMIT 100) t)
  ) INTO res; RETURN res;
END$$;
REVOKE ALL ON FUNCTION public.storage_overview() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.storage_overview() TO authenticated;
