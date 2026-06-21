-- Embedded double-entry ledger — immutable, sum-to-zero, balances derived.
CREATE TABLE IF NOT EXISTS public.ledger_accounts (
  code text PRIMARY KEY, name text NOT NULL,
  type text NOT NULL CHECK (type IN ('asset','liability','equity','revenue','cogs','expense')),
  normal text NOT NULL CHECK (normal IN ('debit','credit')));

INSERT INTO public.ledger_accounts(code,name,type,normal) VALUES
  ('cash','Cash','asset','debit'),
  ('stripe_clearing','Stripe clearing','asset','debit'),
  ('deferred_revenue_credits','Deferred revenue — unspent credits','liability','credit'),
  ('api_provider_payable','API provider payable','liability','credit'),
  ('storage_payable','Storage provider payable','liability','credit'),
  ('creator_payouts_liability','Creator payouts payable','liability','credit'),
  ('opening_equity','Opening balance equity','equity','credit'),
  ('revenue_credit_usage','Revenue — credit usage','revenue','credit'),
  ('revenue_storage','Revenue — storage','revenue','credit'),
  ('revenue_subscription','Revenue — subscriptions','revenue','credit'),
  ('cogs_api','COGS — API generation','cogs','debit'),
  ('cogs_storage','COGS — storage','cogs','debit'),
  ('promo_expense','Promotional credits expense','expense','debit')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.ledger_txns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL, user_id uuid, ref_type text, ref_id text, memo text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id bigserial PRIMARY KEY,
  txn_id uuid NOT NULL REFERENCES public.ledger_txns(id),
  account text NOT NULL REFERENCES public.ledger_accounts(code),
  amount_usd numeric(14,4) NOT NULL DEFAULT 0,   -- signed: debit +, credit -
  amount_credits bigint NOT NULL DEFAULT 0,       -- signed credit-unit subledger (on deferred_revenue_credits)
  user_id uuid, occurred_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS ledger_entries_account ON public.ledger_entries(account, occurred_at);
CREATE INDEX IF NOT EXISTS ledger_entries_user ON public.ledger_entries(user_id, occurred_at);
CREATE INDEX IF NOT EXISTS ledger_entries_txn ON public.ledger_entries(txn_id);

-- Append-only: block UPDATE/DELETE.
CREATE OR REPLACE FUNCTION public.ledger_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'ledger is append-only — post a reversing entry instead'; END$$;
DROP TRIGGER IF EXISTS ledger_entries_immutable ON public.ledger_entries;
CREATE TRIGGER ledger_entries_immutable BEFORE UPDATE OR DELETE ON public.ledger_entries FOR EACH ROW EXECUTE FUNCTION public.ledger_immutable();
DROP TRIGGER IF EXISTS ledger_txns_immutable ON public.ledger_txns;
CREATE TRIGGER ledger_txns_immutable BEFORE UPDATE OR DELETE ON public.ledger_txns FOR EACH ROW EXECUTE FUNCTION public.ledger_immutable();

ALTER TABLE public.ledger_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_txns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS la_admin ON public.ledger_accounts; CREATE POLICY la_admin ON public.ledger_accounts FOR SELECT USING (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS lt_admin ON public.ledger_txns; CREATE POLICY lt_admin ON public.ledger_txns FOR SELECT USING (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS le_admin ON public.ledger_entries; CREATE POLICY le_admin ON public.ledger_entries FOR SELECT USING (public.is_admin(auth.uid()));

-- Posting RPC: validates USD sum-to-zero, inserts txn + entries. Service-only.
CREATE OR REPLACE FUNCTION public.ledger_post(_kind text, _lines jsonb, _user_id uuid DEFAULT NULL,
  _ref_type text DEFAULT NULL, _ref_id text DEFAULT NULL, _memo text DEFAULT NULL, _metadata jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE tid uuid; ln jsonb; total numeric := 0;
BEGIN
  IF jsonb_typeof(_lines) <> 'array' OR jsonb_array_length(_lines) < 2 THEN RAISE EXCEPTION 'need >= 2 lines'; END IF;
  FOR ln IN SELECT * FROM jsonb_array_elements(_lines) LOOP total := total + coalesce((ln->>'amount_usd')::numeric, 0); END LOOP;
  IF abs(total) > 0.01 THEN RAISE EXCEPTION 'entries do not balance (sum_usd=%)', total; END IF;
  INSERT INTO public.ledger_txns(kind,user_id,ref_type,ref_id,memo,metadata) VALUES (_kind,_user_id,_ref_type,_ref_id,_memo,coalesce(_metadata,'{}')) RETURNING id INTO tid;
  FOR ln IN SELECT * FROM jsonb_array_elements(_lines) LOOP
    INSERT INTO public.ledger_entries(txn_id,account,amount_usd,amount_credits,user_id)
    VALUES (tid, ln->>'account', coalesce((ln->>'amount_usd')::numeric,0), coalesce((ln->>'amount_credits')::bigint,0),
            coalesce((ln->>'user_id')::uuid, _user_id));
  END LOOP;
  RETURN tid;
END$$;
REVOKE ALL ON FUNCTION public.ledger_post(text,jsonb,uuid,text,text,text,jsonb) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ledger_post(text,jsonb,uuid,text,text,text,jsonb) TO service_role;

-- Derived balances.
CREATE OR REPLACE FUNCTION public.ledger_user_credit_balance(_uid uuid)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(sum(amount_credits),0)::bigint FROM public.ledger_entries WHERE user_id=_uid AND account='deferred_revenue_credits';
$$;
GRANT EXECUTE ON FUNCTION public.ledger_user_credit_balance(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ledger_trial_balance(_since timestamptz DEFAULT '2000-01-01')
RETURNS TABLE(account text, type text, balance_usd numeric) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.code, a.type,
    round(CASE WHEN a.normal='debit' THEN coalesce(sum(e.amount_usd),0) ELSE -coalesce(sum(e.amount_usd),0) END, 2)
  FROM public.ledger_accounts a LEFT JOIN public.ledger_entries e ON e.account=a.code AND e.occurred_at>=_since
  WHERE public.is_admin(auth.uid()) GROUP BY a.code,a.type,a.normal ORDER BY a.type,a.code;
$$;
GRANT EXECUTE ON FUNCTION public.ledger_trial_balance(timestamptz) TO authenticated;
