-- Rewrite pledge_patron to use the ledger as source of truth. The previous
-- version updated profiles.credits_balance directly, which is blocked by
-- prevent_profile_privilege_escalation (any direct write that doesn't
-- already equal credit_ledger_total(NEW.id) is rejected). The fix:
-- only insert into credit_transactions; let trg_sync_balance_from_ledger
-- reconcile profiles.credits_balance for both buyer and creator.
CREATE OR REPLACE FUNCTION public.pledge_patron(p_creator_id uuid, p_monthly_credits integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
DECLARE
  v_buyer_balance int;
  v_creator_balance int;
  v_existing public.patron_subscriptions%ROWTYPE;
  v_creator_cut int;
  v_platform_cut int;
  v_now timestamptz := now();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF p_creator_id = auth.uid() THEN RAISE EXCEPTION 'cannot_pledge_self'; END IF;
  IF p_monthly_credits <= 0 OR p_monthly_credits > 10000 THEN
    RAISE EXCEPTION 'invalid_credits';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_creator_id) THEN
    RAISE EXCEPTION 'creator_not_found';
  END IF;

  -- Ledger is the authoritative balance source.
  v_buyer_balance := public.credit_ledger_total(auth.uid());
  IF v_buyer_balance < p_monthly_credits THEN
    RAISE EXCEPTION 'insufficient_credits';
  END IF;

  v_creator_cut := (p_monthly_credits * 90) / 100;
  v_platform_cut := p_monthly_credits - v_creator_cut;

  -- Upsert the subscription (allows re-pledge / amount change).
  SELECT * INTO v_existing FROM public.patron_subscriptions
    WHERE creator_id = p_creator_id AND patron_id = auth.uid();

  IF v_existing.id IS NOT NULL THEN
    UPDATE public.patron_subscriptions SET
      monthly_credits = p_monthly_credits,
      renewal_due_at  = v_now + interval '30 days',
      cancelled_at    = NULL
    WHERE id = v_existing.id;
  ELSE
    INSERT INTO public.patron_subscriptions
      (creator_id, patron_id, monthly_credits, started_at, renewal_due_at)
    VALUES
      (p_creator_id, auth.uid(), p_monthly_credits, v_now, v_now + interval '30 days');
  END IF;

  -- Buyer deduction. The AFTER-INSERT sync_balance_from_ledger trigger
  -- updates profiles.credits_balance to match the ledger.
  INSERT INTO public.credit_transactions
    (user_id, amount, transaction_type, description, balance_after)
  VALUES
    (auth.uid(), -p_monthly_credits, 'patron_pledge',
     'Pledged ' || p_monthly_credits || ' cr/mo to ' || p_creator_id::text,
     v_buyer_balance - p_monthly_credits);

  -- Creator credit (90% cut). Read the balance fresh because the buyer-side
  -- trigger may have already fired and rewritten dependent state.
  v_creator_balance := public.credit_ledger_total(p_creator_id);
  INSERT INTO public.credit_transactions
    (user_id, amount, transaction_type, description, balance_after)
  VALUES
    (p_creator_id, v_creator_cut, 'patron_received',
     'Patron payment from ' || auth.uid()::text,
     v_creator_balance + v_creator_cut);

  RETURN jsonb_build_object(
    'success', true,
    'creator_received', v_creator_cut,
    'next_charge_at', v_now + interval '30 days'
  );
END;
$func$;
