-- Restore the balance_after column referenced by deduct_credits / refund_credits RPCs.
-- Without this column, every paid pipeline fails at the credit deduction step:
--   column "balance_after" of relation "credit_transactions" does not exist
-- This blocks mode-router, hollywood-pipeline, seedance-pipeline, generate-avatar-direct, etc.

ALTER TABLE public.credit_transactions
  ADD COLUMN IF NOT EXISTS balance_after integer;

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_created
  ON public.credit_transactions (user_id, created_at DESC);

-- Reset Frank's stuck project so he can retry cleanly once the column exists.
UPDATE public.movie_projects
SET status = 'cancelled',
    last_error = 'Auto-cancelled: blocked by missing balance_after column (now fixed). Please start a new generation.'
WHERE id = 'b1850418-7828-4b7b-96c8-7e957c200424'
  AND status = 'payment_failed';