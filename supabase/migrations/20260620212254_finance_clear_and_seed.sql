-- DESTRUCTIVE (confirmed): archive + clear legacy finance, re-seed balances via ledger.
-- 1) reverse the ledger core test txn so we start clean
SELECT public.ledger_post('test_reversal',
  '[{"account":"deferred_revenue_credits","amount_usd":100,"amount_credits":-1000},{"account":"stripe_clearing","amount_usd":-100}]'::jsonb,
  '45f0fc04-0224-4564-a77f-f641e4a1b114'::uuid, 'migration','test', 'Reverse ledger smoke-test');

-- 2) archive (reversible — first snapshot wins)
CREATE TABLE IF NOT EXISTS public.credit_transactions_archive AS SELECT *, now() AS archived_at FROM public.credit_transactions;
CREATE TABLE IF NOT EXISTS public.profiles_credit_archive AS SELECT id, credits_balance, total_credits_purchased, total_credits_used, now() AS archived_at FROM public.profiles;
CREATE TABLE IF NOT EXISTS public.patron_subscriptions_archive AS SELECT *, now() AS archived_at FROM public.patron_subscriptions;

-- 3) seed opening balances through the ledger (preserve each user's prior balance)
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT id, coalesce(credits_balance,0) bal FROM public.profiles WHERE coalesce(credits_balance,0) > 0 LOOP
    PERFORM public.ledger_post('opening_balance',
      jsonb_build_array(
        jsonb_build_object('account','opening_equity','amount_usd', round(r.bal*0.10,2)),
        jsonb_build_object('account','deferred_revenue_credits','amount_usd', round(-r.bal*0.10,2), 'amount_credits', r.bal)),
      r.id, 'migration','opening', 'Opening balance from pre-ledger credits');
  END LOOP;
END $$;

-- 4) clear legacy transactional finance + reset cached balances to ledger-derived
TRUNCATE public.credit_transactions;
DELETE FROM public.patron_subscriptions;
UPDATE public.profiles SET total_credits_purchased = 0, total_credits_used = 0;
UPDATE public.profiles p SET credits_balance = public.ledger_user_credit_balance(p.id);
