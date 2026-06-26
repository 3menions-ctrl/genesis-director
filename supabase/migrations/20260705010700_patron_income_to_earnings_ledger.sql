-- M9 (partial) / audit #5: patron pledge income reaches the creator USD ledger.
-- The earnings-projection trigger fired only for tip_received/atom_sale, so
-- pledge_patron's 'patron_received' credits never landed in
-- creator_earnings_ledger (the payout ledger) despite the UI promising it.
-- Add patron_received -> 'subscription' (allowed by the source CHECK).
-- (The Withdraw button wiring to stripe-connect-payout remains a FE/edge follow-up.)
CREATE OR REPLACE FUNCTION public.project_credit_event_to_earnings()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rate int;
BEGIN
  IF NEW.transaction_type NOT IN ('tip_received', 'atom_sale', 'patron_received') THEN
    RETURN NEW;
  END IF;
  IF NEW.amount <= 0 THEN RETURN NEW; END IF;

  SELECT value::int INTO v_rate FROM public.creator_payout_config WHERE key = 'credits_per_usd';
  IF v_rate IS NULL OR v_rate <= 0 THEN v_rate := 10; END IF;

  INSERT INTO public.creator_earnings_ledger (
    user_id, source, credits, usd_cents, description, related_id
  ) VALUES (
    NEW.user_id,
    CASE NEW.transaction_type
      WHEN 'tip_received'    THEN 'tip'
      WHEN 'patron_received' THEN 'subscription'
      ELSE 'atom_sale'
    END,
    NEW.amount,
    (NEW.amount * 100) / v_rate,
    NEW.description,
    NEW.id
  );

  RETURN NEW;
END $function$;
