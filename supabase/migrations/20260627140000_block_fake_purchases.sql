-- ─────────────────────────────────────────────────────────────────────────
-- Block synthetic/seed "purchase" rows at the source.
--
-- Something (a seed/test process using the service-role key) was inserting fake
-- credit_transactions purchase rows with non-Polar references ("UIT_corporate_…",
-- "CHK_…", "A2_…") — uniform 4000 credits — which spammed the live buy alert and
-- polluted revenue. Real purchases are ALWAYS created by add_credits() from the
-- Polar webhook with stripe_payment_id = 'polar_<order id>'. Polar is the only
-- live payments provider (Stripe billing is kill-switched; BTCPay is gated off),
-- so any purchase row whose reference is not 'polar_%' is illegitimate.
--
-- This BEFORE INSERT trigger rejects them at the DB, independent of the caller
-- (covers both direct inserts and add_credits). If a new provider is enabled,
-- extend the allowed-prefix check here.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reject_non_polar_purchases()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.stripe_payment_id IS NULL OR NEW.stripe_payment_id NOT LIKE 'polar_%' THEN
    RAISE EXCEPTION
      'credit purchase rejected: non-Polar payment reference % — synthetic/seed purchase inserts are blocked; real purchases use a polar_<order id> reference',
      COALESCE(NEW.stripe_payment_id, '(null)')
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reject_non_polar_purchases ON public.credit_transactions;
CREATE TRIGGER trg_reject_non_polar_purchases
  BEFORE INSERT ON public.credit_transactions
  FOR EACH ROW
  WHEN (NEW.transaction_type = 'purchase')
  EXECUTE FUNCTION public.reject_non_polar_purchases();
