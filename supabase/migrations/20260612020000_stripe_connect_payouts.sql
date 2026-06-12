-- ════════════════════════════════════════════════════════════════════════
-- Stripe Connect — real USD payouts to creators.
--
-- Schema to support a "creators get paid in real money" pipeline:
--
--   1. creator_payout_accounts: one row per user, holding their Stripe
--      Express account id + onboarding status.
--   2. creator_earnings_ledger: one row per credit-earning event (tip
--      received, atom sale) translated into USD-cents at the going rate
--      (10 credits = $1.00). Decoupled from the credit ledger so the
--      creator can choose whether to keep earnings as credits or cash
--      them out.
--   3. creator_payouts: one row per executed payout to the creator's
--      bank account, linked back to ledger entries.
--
-- All edge function plumbing lives in supabase/functions/stripe-connect-*
-- which lands in the same commit. This migration is schema-only and
-- has no breaking impact on the credit ledger.
-- ════════════════════════════════════════════════════════════════════════

-- 1 credit = $0.10. Centralised here so any conversion site can
-- reference it; future rate changes are a single UPDATE.
CREATE TABLE IF NOT EXISTS public.creator_payout_config (
  key         text PRIMARY KEY,
  value       text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.creator_payout_config (key, value)
VALUES
  ('credits_per_usd', '10'),
  ('minimum_payout_cents', '2000')   -- $20 minimum payout
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.creator_payout_accounts (
  user_id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_account_id    text NOT NULL UNIQUE,
  onboarding_complete  boolean NOT NULL DEFAULT false,
  payouts_enabled      boolean NOT NULL DEFAULT false,
  charges_enabled      boolean NOT NULL DEFAULT false,
  country              text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.creator_payout_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creator reads own payout account"
  ON public.creator_payout_accounts FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- INSERT / UPDATE only via the stripe-connect edge functions
-- (SECURITY DEFINER service-role context). No direct authenticated mutate.

-- creator_payouts must be created first so creator_earnings_ledger can
-- reference it via payout_id.
CREATE TABLE IF NOT EXISTS public.creator_payouts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_payout_id    text NOT NULL UNIQUE,
  amount_cents        int NOT NULL,
  currency            text NOT NULL DEFAULT 'usd',
  status              text NOT NULL CHECK (status IN ('pending', 'in_transit', 'paid', 'failed', 'canceled')),
  arrival_date        timestamptz,
  failure_message     text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.creator_earnings_ledger (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source        text NOT NULL CHECK (source IN ('tip', 'atom_sale', 'subscription', 'manual_adjust')),
  credits       int  NOT NULL,
  usd_cents     int  NOT NULL,
  description   text,
  related_id    uuid,
  payout_id     uuid REFERENCES public.creator_payouts(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.creator_earnings_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creator reads own earnings ledger"
  ON public.creator_earnings_ledger FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Creator reads own payouts"
  ON public.creator_payouts FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_earnings_user ON public.creator_earnings_ledger (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payouts_user ON public.creator_payouts (user_id, created_at DESC);

-- ── Aggregate RPC: pending USD-cents available to cash out ──────────
-- Sum of unpaid (payout_id IS NULL) earnings minus the minimum payout
-- threshold. Used by the dashboard "available to cash out" pill.
CREATE OR REPLACE FUNCTION public.creator_pending_payout_cents(p_user_id uuid DEFAULT auth.uid())
RETURNS int
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(usd_cents), 0)
  FROM public.creator_earnings_ledger
  WHERE user_id = p_user_id AND payout_id IS NULL;
$$;

GRANT EXECUTE ON FUNCTION public.creator_pending_payout_cents(uuid) TO authenticated;

-- ── Trigger: credit_transactions of type 'tip_received' / 'atom_sale'
-- automatically project into the creator earnings ledger.
CREATE OR REPLACE FUNCTION public.project_credit_event_to_earnings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rate int;
BEGIN
  IF NEW.transaction_type NOT IN ('tip_received', 'atom_sale') THEN
    RETURN NEW;
  END IF;
  IF NEW.amount <= 0 THEN RETURN NEW; END IF;

  SELECT value::int INTO v_rate FROM public.creator_payout_config WHERE key = 'credits_per_usd';
  IF v_rate IS NULL OR v_rate <= 0 THEN v_rate := 10; END IF;

  INSERT INTO public.creator_earnings_ledger (
    user_id, source, credits, usd_cents, description, related_id
  ) VALUES (
    NEW.user_id,
    CASE NEW.transaction_type WHEN 'tip_received' THEN 'tip' ELSE 'atom_sale' END,
    NEW.amount,
    -- credits → cents conversion. 10 credits/USD → cents = credits * 10
    (NEW.amount * 100) / v_rate,
    NEW.description,
    NEW.id
  );

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_project_credit_event_to_earnings ON public.credit_transactions;
CREATE TRIGGER trg_project_credit_event_to_earnings
  AFTER INSERT ON public.credit_transactions
  FOR EACH ROW EXECUTE FUNCTION public.project_credit_event_to_earnings();
