-- AUDIT FIX C-1 (Critical): revert the accidental 2026-06-20 ledger repoint.
--
-- 20260620214321_repoint_credit_ledger_total.sql changed credit_ledger_total()
-- to read from the embedded double-entry ledger (ledger_entries /
-- ledger_user_credit_balance). But NOTHING at runtime ever posts to
-- ledger_entries — add_credits/deduct_credits/consume_credit_hold/refund_credits
-- all write only to credit_transactions, and ledger_post is called only from
-- migrations (seed/storage). Net effect: get_credit_state() (the authoritative
-- balance RPC consumed by CreditsContext) returned the frozen 2026-06-20 seed
-- snapshot — paid purchases granted no spendable credits and usage never
-- decremented the balance.
--
-- Decision (confirmed with product): the cutover was accidental. Revert
-- credit_ledger_total to its pre-repoint definition so credit reads go back to
-- the credit_transactions ledger, which IS the table every runtime money
-- mutation writes to. This restores working balances without guessing on any
-- other money path. The double-entry ledger_* objects are left intact for the
-- admin reporting layer (separately tracked), but are no longer the spendable
-- balance source.
--
-- This is the EXACT body from 20260518175601 (the last definition before the
-- repoint), restored verbatim.

CREATE OR REPLACE FUNCTION public.credit_ledger_total(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(SUM(amount), 0)::integer
  FROM public.credit_transactions
  WHERE user_id = p_user_id
    AND transaction_type NOT IN ('untracked_increase','audit','security_alert');
$$;
