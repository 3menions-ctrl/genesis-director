-- AUDIT FIX H-4 (High): make creator_payouts.stripe_payout_id nullable so the
-- payout row can be created BEFORE the Stripe transfer, enabling an atomic
-- "claim" of the pending earnings rows (UPDATE ... WHERE payout_id IS NULL) that
-- eliminates the double-payout race. The UNIQUE index is retained (multiple
-- NULLs are allowed; the real transfer id is still unique once set).
ALTER TABLE public.creator_payouts ALTER COLUMN stripe_payout_id DROP NOT NULL;
