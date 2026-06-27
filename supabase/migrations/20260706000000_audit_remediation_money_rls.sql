-- ============================================================================
-- Audit remediation — money RPC hardening + RLS lockdown (Batch 3b)
--
-- 1. tip_in_thread  — add FOR UPDATE row lock + minute-bucket idempotency so a
--    double-click / concurrent tip can't double-charge or overdraft. Switch the
--    balance source from the cached profiles.credits_balance to the canonical
--    credit_ledger_total - active_credit_holds_total. Mirrors public.tip_reel.
-- 2. pledge_patron  — same lock + idempotency hardening (was non-idempotent and
--    unlocked; now cron-renewed, which magnified the exposure).
-- 3. organizations.plan — extend fn_organizations_block_sensitive_self_update to
--    revert client-side plan changes. `plan` is a billing entitlement set only
--    by create_org_for_user (SECURITY DEFINER) at creation or the billing
--    webhook (service_role); a client could previously PATCH it to self-upgrade
--    to a paid tier without paying.
-- 4. patron_subscriptions — drop the "Patron manages own subs" FOR ALL policy
--    that let a user INSERT a subscription row for themselves (free patronage,
--    bypassing pledge_patron's payment). Mutations go through the SECURITY
--    DEFINER RPCs (pledge_patron / cancel_patron); the client needs SELECT only,
--    which "Patron sees own subs" already provides.
--
-- NOTE: the "notifications forge" item from the audit was already fixed — the
-- permissive "Authenticated users can create notifications" INSERT policy was
-- dropped in 20260213025841 and never re-added, so client INSERT is denied. No
-- change needed here.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) tip_in_thread — locked + idempotent
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tip_in_thread(p_recipient uuid, p_amount integer, p_content text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total int; v_avail int; v_creator_cut int; v_platform_cut int; v_msg_id uuid;
  v_idem text; v_existing uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF p_recipient = auth.uid() THEN RAISE EXCEPTION 'cannot_tip_self'; END IF;
  IF p_amount <= 0 OR p_amount > 10000 THEN RAISE EXCEPTION 'invalid_amount'; END IF;

  -- Serialize first: lock both profile rows in deterministic id order. A second
  -- concurrent tip blocks here until the first commits, then re-checks
  -- idempotency below and returns a clean replay instead of double-charging.
  PERFORM 1 FROM public.profiles WHERE id IN (auth.uid(), p_recipient) ORDER BY id FOR UPDATE;

  -- Idempotency: one DM tip per (recipient, tipper, minute). Double-click / retry
  -- protection, mirroring public.tip_reel.
  v_idem := 'dmtip:' || p_recipient::text || ':' || auth.uid()::text || ':' ||
            to_char(date_trunc('minute', now() AT TIME ZONE 'UTC'), 'YYYYMMDDHH24MI');
  SELECT id INTO v_existing
    FROM public.credit_transactions
    WHERE user_id = auth.uid() AND idempotency_key = v_idem AND transaction_type = 'tip_sent'
    LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'idempotent_replay', true, 'creator_cut', 0);
  END IF;

  -- Authoritative spendable balance = ledger total minus active holds.
  v_total := COALESCE(public.credit_ledger_total(auth.uid()), 0);
  v_avail := GREATEST(v_total - COALESCE(public.active_credit_holds_total(auth.uid()), 0), 0);
  IF v_avail < p_amount THEN RAISE EXCEPTION 'insufficient_balance'; END IF;

  v_creator_cut  := (p_amount * 90) / 100;
  v_platform_cut := p_amount - v_creator_cut;

  -- Debit tipper (idempotency_key tags the row so a replay is detected above).
  INSERT INTO public.credit_transactions (user_id, amount, transaction_type, description, idempotency_key)
    VALUES (auth.uid(), -p_amount, 'tip_sent', 'Tip sent to ' || p_recipient::text, v_idem);
  -- Credit creator (projects to the earnings ledger via the existing trigger).
  INSERT INTO public.credit_transactions (user_id, amount, transaction_type, description)
    VALUES (p_recipient, v_creator_cut, 'tip_received',
            'DM tip from ' || auth.uid()::text || ' (gross ' || p_amount::text || ')');

  -- Send the DM with the tip stamped on it.
  INSERT INTO public.direct_messages (sender_id, recipient_id, content, tip_amount)
    VALUES (auth.uid(), p_recipient, COALESCE(NULLIF(trim(p_content), ''), 'Tipped ' || p_amount || ' credits'), p_amount)
    RETURNING id INTO v_msg_id;

  INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      p_recipient, 'tip_received',
      'Tip received · ' || v_creator_cut || ' cr',
      'You got tipped ' || p_amount || ' credits in DMs.',
      jsonb_build_object('amount', p_amount, 'tipper_id', auth.uid(), 'message_id', v_msg_id)
    );
  RETURN jsonb_build_object('ok', true, 'message_id', v_msg_id, 'creator_cut', v_creator_cut);
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) pledge_patron — locked + idempotent
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pledge_patron(p_creator_id uuid, p_monthly_credits integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
DECLARE
  v_buyer_balance int; v_buyer_avail int; v_creator_balance int;
  v_existing public.patron_subscriptions%ROWTYPE;
  v_creator_cut int; v_platform_cut int; v_now timestamptz := now();
  v_idem text; v_dupe uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF p_creator_id = auth.uid() THEN RAISE EXCEPTION 'cannot_pledge_self'; END IF;
  IF p_monthly_credits <= 0 OR p_monthly_credits > 10000 THEN RAISE EXCEPTION 'invalid_credits'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_creator_id) THEN
    RAISE EXCEPTION 'creator_not_found';
  END IF;

  -- Serialize concurrent pledges; lock buyer + creator rows in deterministic
  -- order so two simultaneous pledges can't both pass the balance check.
  PERFORM 1 FROM public.profiles WHERE id IN (auth.uid(), p_creator_id) ORDER BY id FOR UPDATE;

  -- Idempotency: one pledge per (creator, patron, minute).
  v_idem := 'pledge:' || p_creator_id::text || ':' || auth.uid()::text || ':' ||
            to_char(date_trunc('minute', v_now AT TIME ZONE 'UTC'), 'YYYYMMDDHH24MI');
  SELECT id INTO v_dupe FROM public.credit_transactions
    WHERE user_id = auth.uid() AND idempotency_key = v_idem AND transaction_type = 'patron_pledge'
    LIMIT 1;
  IF v_dupe IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'idempotent_replay', true, 'creator_received', 0);
  END IF;

  -- Ledger is the authoritative balance source (minus active holds).
  v_buyer_balance := COALESCE(public.credit_ledger_total(auth.uid()), 0);
  v_buyer_avail   := GREATEST(v_buyer_balance - COALESCE(public.active_credit_holds_total(auth.uid()), 0), 0);
  IF v_buyer_avail < p_monthly_credits THEN RAISE EXCEPTION 'insufficient_credits'; END IF;

  v_creator_cut  := (p_monthly_credits * 90) / 100;
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

  -- Buyer deduction (idempotency_key tags the row). The AFTER-INSERT
  -- sync_balance_from_ledger trigger reconciles profiles.credits_balance.
  INSERT INTO public.credit_transactions
    (user_id, amount, transaction_type, description, idempotency_key, balance_after)
  VALUES
    (auth.uid(), -p_monthly_credits, 'patron_pledge',
     'Pledged ' || p_monthly_credits || ' cr/mo to ' || p_creator_id::text,
     v_idem, v_buyer_balance - p_monthly_credits);

  -- Creator credit (90% cut). Read balance fresh after the buyer-side trigger.
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) organizations.plan — block client-side self-upgrade
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_organizations_block_sensitive_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role text := current_setting('request.jwt.claim.role', true);
BEGIN
  -- Only the service role (Stripe/Polar webhooks, topup_org_credits, the
  -- org-pool consume/deduct RPCs) may mutate the protected columns. Normal users
  -- editing org name/settings via PostgREST are forced back on them.
  IF caller_role IS DISTINCT FROM 'service_role'
     AND current_user IS DISTINCT FROM 'service_role'
     AND NOT pg_has_role(current_user, 'service_role', 'MEMBER')
  THEN
    NEW.credits_balance         := OLD.credits_balance;
    NEW.total_credits_purchased := OLD.total_credits_purchased;
    NEW.total_credits_used      := OLD.total_credits_used;
    -- AUDIT FIX: `plan` is a billing entitlement. It is set by
    -- create_org_for_user (SECURITY DEFINER) at creation and changed only by the
    -- billing webhook (service_role). A client could previously PATCH
    -- organizations.plan directly to self-upgrade to a paid tier without paying.
    NEW.plan := OLD.plan;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_organizations_block_sensitive_self_update IS
  'Reverts protected organization columns (credits_balance, total_credits_*, plan) on any non-service-role UPDATE — prevents client-side org credit self-grant and plan self-upgrade via PATCH.';

-- The trigger binding from 20260704001100 already points at this function; no
-- need to recreate it. (Re-asserted here for safety on fresh DBs.)
DROP TRIGGER IF EXISTS trg_organizations_block_sensitive_self_update ON public.organizations;
CREATE TRIGGER trg_organizations_block_sensitive_self_update
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.fn_organizations_block_sensitive_self_update();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) patron_subscriptions — remove the self-manage write policy
-- ─────────────────────────────────────────────────────────────────────────────
-- "Patron manages own subs" was FOR ALL WITH CHECK (patron_id = auth.uid()),
-- letting a user INSERT/UPDATE their own subscription rows directly via
-- PostgREST — i.e. grant themselves a patronage WITHOUT paying. The paying path
-- (pledge_patron) and cancellation (cancel_patron) are SECURITY DEFINER and
-- bypass RLS, so the client needs SELECT only, which "Patron sees own subs"
-- already provides.
DROP POLICY IF EXISTS "Patron manages own subs" ON public.patron_subscriptions;
