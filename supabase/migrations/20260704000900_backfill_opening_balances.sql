-- AUDIT FIX C-1 (completion of the revert): restore opening balances.
--
-- 20260620212254_finance_clear_and_seed.sql TRUNCATEd credit_transactions and
-- seeded each user's opening balance ONLY into ledger_entries. The C-1 revert
-- (20260704000000) repointed credit_ledger_total back to credit_transactions —
-- but that table no longer holds the opening balances, so every pre-2026-06-20
-- user now reads a spendable balance of ~0. The revert restored the *mechanism*
-- but not the *data*.
--
-- This migration re-inserts each archived opening balance as a single
-- credit_transactions row so the revert actually restores balances. It is:
--   * idempotent  — keyed on stripe_payment_id = 'opening_balance:<uid>'
--                   (credit_transactions has a partial UNIQUE on stripe_payment_id),
--                   so re-running is a no-op;
--   * guarded     — only runs when profiles_credit_archive exists and only for
--                   users who have no opening_balance row yet;
--   * fresh-DB safe — no archive table → NOTICE + no-op (so the migration chain
--                     still applies cleanly on a brand-new database / CI).
--
-- transaction_type 'opening_balance' is counted by credit_ledger_total (it is
-- NOT in the excluded set {untracked_increase, audit, security_alert}), so the
-- balance is restored. balance_after on these rows is set to the opening amount;
-- the authoritative balance is always the SUM, which is order-independent.
--
-- !!  MUTATES LIVE BALANCES. Do not auto-apply. A human with DB access must
--     reconcile the result against expected balances before/at deploy. See
--     FINANCE_AUDIT_REPORT.md  ->  "Requires live deploy / data correction".

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles_credit_archive'
  ) THEN
    RAISE NOTICE 'profiles_credit_archive not present — skipping opening-balance backfill (fresh DB).';
    RETURN;
  END IF;

  INSERT INTO public.credit_transactions
    (user_id, amount, transaction_type, description, stripe_payment_id, balance_after)
  SELECT a.id,
         a.credits_balance,
         'opening_balance',
         'Opening balance restored after 2026-06-20 ledger reset (audit fix C-1)',
         'opening_balance:' || a.id::text,
         a.credits_balance
  FROM public.profiles_credit_archive a
  WHERE COALESCE(a.credits_balance, 0) > 0
    AND NOT EXISTS (
      SELECT 1 FROM public.credit_transactions t
      WHERE t.stripe_payment_id = 'opening_balance:' || a.id::text
    );

  -- Re-sync the profiles cache from the restored ledger (display only;
  -- get_credit_state always reads the ledger directly).
  UPDATE public.profiles p
  SET credits_balance = public.credit_ledger_total(p.id),
      updated_at = now()
  WHERE EXISTS (SELECT 1 FROM public.credit_transactions t WHERE t.user_id = p.id);
END $$;
