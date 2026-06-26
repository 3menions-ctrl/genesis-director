-- M7 / audit D16: make tip_reel idempotent at the DB level. The existence
-- check ran before the FOR UPDATE lock (TOCTOU), and no unique index covered
-- the project-less 'tip:%' idempotency keys, so two concurrent identical tips
-- could both pass the check and double-charge. A partial unique on
-- (user_id, idempotency_key) lets the debit (tipper) and credit (creator) rows
-- coexist (distinct user_id) while a concurrent duplicate tip fails the second
-- insert -> the whole RPC rolls back instead of double-charging.
CREATE UNIQUE INDEX IF NOT EXISTS credit_transactions_tip_idem_unique
  ON public.credit_transactions (user_id, idempotency_key)
  WHERE idempotency_key LIKE 'tip:%';
