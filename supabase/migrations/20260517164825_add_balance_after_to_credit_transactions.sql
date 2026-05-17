-- Fix: deduct_credits / refund RPCs write balance_after but column was missing,
-- causing every generation to fail at the credit deduction step (frank's avatar stuck loading).
ALTER TABLE public.credit_transactions
  ADD COLUMN IF NOT EXISTS balance_after integer;

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_created
  ON public.credit_transactions (user_id, created_at DESC);
