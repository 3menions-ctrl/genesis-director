-- Restore the balance_after column referenced by deduct_credits / refund_credits RPCs.
-- Its absence caused all credit-charging edge functions (extract-scene-identity,
-- generate-single-clip, etc.) to fail with: column "balance_after" of relation
-- "credit_transactions" does not exist — blocking script generation end-to-end.
ALTER TABLE public.credit_transactions
  ADD COLUMN IF NOT EXISTS balance_after integer;
