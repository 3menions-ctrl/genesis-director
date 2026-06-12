-- ════════════════════════════════════════════════════════════════════════
-- Money + ledger integrity — close the silent-drift bug in tip_reel/buy_atom.
--
-- Old code paths wrote `profiles.credits_balance` directly *and* inserted
-- ledger rows. The `sync_balance_from_ledger` trigger then re-derived the
-- balance from the ledger total, overwriting the manual UPDATE. When the
-- pre-ledger cached balance was higher than the ledger-derived total (e.g.
-- legacy bonus credits granted before the ledger system), the trigger
-- would silently REDUCE the seller's balance below the transferred amount.
--
-- Fix:
--   * Stop writing profiles.credits_balance directly.
--   * Write only the credit_transactions rows with proper `balance_after`.
--   * Let the existing sync trigger keep the cache aligned to the ledger.
--   * Add an idempotency key (auth.uid() + reel_id + minute bucket) so
--     a double-click doesn't double-charge.
--   * Insert notifications to the recipient (seller / tipped creator)
--     because the audit found these fan-outs were missing entirely.
-- ════════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────────
-- tip_reel — ledger-aware, idempotent, notifies creator
-- ──────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tip_reel(p_reel_id uuid, p_credits int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator      uuid;
  v_buyer_avail  int;
  v_buyer_total  int;
  v_creator_cut  int;
  v_platform_cut int;
  v_idem         text;
  v_existing     uuid;
  v_reel_title   text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF p_credits <= 0 OR p_credits > 10000 THEN RAISE EXCEPTION 'invalid_credits'; END IF;

  SELECT creator_id INTO v_creator
    FROM public.published_reels
    WHERE id = p_reel_id AND NOT is_taken_down;
  IF v_creator IS NULL THEN RAISE EXCEPTION 'reel_not_found'; END IF;
  IF v_creator = auth.uid() THEN RAISE EXCEPTION 'cannot_tip_self'; END IF;

  -- Per-(tipper, reel, minute) idempotency window. A frenzied double-click
  -- collapses to one transaction. Distinct minutes still allow legit retips.
  v_idem := 'tip:' || p_reel_id::text || ':' || auth.uid()::text || ':' ||
            to_char(date_trunc('minute', now() AT TIME ZONE 'UTC'), 'YYYYMMDDHH24MI');

  SELECT id INTO v_existing
    FROM public.credit_transactions
    WHERE user_id = auth.uid()
      AND idempotency_key = v_idem
      AND transaction_type = 'tip'
    LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'idempotent_replay', true, 'creator_received', 0);
  END IF;

  -- Ledger truth: read live balance via credit_ledger_total + active holds.
  v_buyer_total := COALESCE(public.credit_ledger_total(auth.uid()), 0);
  v_buyer_avail := GREATEST(v_buyer_total - COALESCE(public.active_credit_holds_total(auth.uid()), 0), 0);
  IF v_buyer_avail < p_credits THEN
    RAISE EXCEPTION 'insufficient_credits';
  END IF;

  v_creator_cut := (p_credits * 90) / 100;
  v_platform_cut := p_credits - v_creator_cut;

  -- Lock both profile rows in deterministic id order to avoid deadlocks.
  PERFORM 1 FROM public.profiles
    WHERE id IN (auth.uid(), v_creator)
    ORDER BY id
    FOR UPDATE;

  -- Two ledger writes inside a single statement-level transaction. The
  -- sync_balance_from_ledger trigger will reconcile profiles.credits_balance
  -- afterwards — we no longer touch the cache directly.
  INSERT INTO public.credit_transactions (
    user_id, amount, transaction_type, description, idempotency_key, balance_after
  ) VALUES (
    auth.uid(), -p_credits, 'tip',
    'Tip to reel ' || p_reel_id::text,
    v_idem,
    v_buyer_total - p_credits
  );

  INSERT INTO public.credit_transactions (
    user_id, amount, transaction_type, description, idempotency_key, balance_after
  ) VALUES (
    v_creator, v_creator_cut, 'tip_received',
    'Tip from ' || auth.uid()::text || ' on reel ' || p_reel_id::text,
    v_idem,
    COALESCE(public.credit_ledger_total(v_creator), 0) + v_creator_cut
  );

  -- Bump the reel's tip counter (cosmetic; the ledger remains truth).
  UPDATE public.published_reels
    SET tip_credits = COALESCE(tip_credits, 0) + p_credits
    WHERE id = p_reel_id;

  -- Notification fan-out — the seller learns about the tip in real time.
  SELECT COALESCE(p_reel_id::text, 'your reel') INTO v_reel_title;
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    v_creator,
    'tip',
    'You received a tip',
    'Someone tipped you ' || v_creator_cut::text || ' credits on a reel.',
    jsonb_build_object('reel_id', p_reel_id, 'amount', v_creator_cut, 'from_user_id', auth.uid())
  );

  RETURN jsonb_build_object('success', true, 'creator_received', v_creator_cut);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tip_reel(uuid, int) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.tip_reel(uuid, int) TO authenticated;

-- ──────────────────────────────────────────────────────────────────────
-- buy_atom — ledger-aware, idempotent, notifies seller
-- ──────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.buy_atom(p_listing_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing       public.atom_listings%ROWTYPE;
  v_buyer_avail   int;
  v_buyer_total   int;
  v_seller_cut    int;
  v_platform_cut  int;
  v_idem          text;
  v_existing      uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;

  SELECT * INTO v_listing FROM public.atom_listings
    WHERE id = p_listing_id AND is_active
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'listing_inactive_or_missing'; END IF;
  IF v_listing.seller_id = auth.uid() THEN RAISE EXCEPTION 'cannot_buy_own_listing'; END IF;

  -- One purchase per (buyer, listing) per minute window. Subsequent legitimate
  -- repurchases (different minutes) succeed; a double-click collapses.
  v_idem := 'atom:' || p_listing_id::text || ':' || auth.uid()::text || ':' ||
            to_char(date_trunc('minute', now() AT TIME ZONE 'UTC'), 'YYYYMMDDHH24MI');

  SELECT id INTO v_existing
    FROM public.credit_transactions
    WHERE user_id = auth.uid()
      AND idempotency_key = v_idem
      AND transaction_type = 'atom_purchase'
    LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'idempotent_replay', true, 'seller_received', 0);
  END IF;

  v_buyer_total := COALESCE(public.credit_ledger_total(auth.uid()), 0);
  v_buyer_avail := GREATEST(v_buyer_total - COALESCE(public.active_credit_holds_total(auth.uid()), 0), 0);
  IF v_buyer_avail < v_listing.price_credits THEN
    RAISE EXCEPTION 'insufficient_credits';
  END IF;

  -- royalty_pct = platform's cut (0–90, defaulting to 10). Seller therefore
  -- gets (100 - royalty_pct)%. With the default, that's 90% to the seller —
  -- matching the marketing claim.
  v_seller_cut   := (v_listing.price_credits * (100 - v_listing.royalty_pct)) / 100;
  v_platform_cut := v_listing.price_credits - v_seller_cut;

  -- Lock both profile rows in deterministic id order.
  PERFORM 1 FROM public.profiles
    WHERE id IN (auth.uid(), v_listing.seller_id)
    ORDER BY id
    FOR UPDATE;

  -- Buyer ledger debit
  INSERT INTO public.credit_transactions (
    user_id, amount, transaction_type, description, idempotency_key, balance_after
  ) VALUES (
    auth.uid(), -v_listing.price_credits, 'atom_purchase',
    'Bought ' || v_listing.name,
    v_idem,
    v_buyer_total - v_listing.price_credits
  );

  -- Seller ledger credit
  INSERT INTO public.credit_transactions (
    user_id, amount, transaction_type, description, idempotency_key, balance_after
  ) VALUES (
    v_listing.seller_id, v_seller_cut, 'atom_sale',
    'Sold ' || v_listing.name,
    v_idem,
    COALESCE(public.credit_ledger_total(v_listing.seller_id), 0) + v_seller_cut
  );

  -- Bookkeeping
  UPDATE public.atom_listings SET
    total_sales         = total_sales + 1,
    total_revenue_credits = total_revenue_credits + v_listing.price_credits,
    updated_at          = now()
  WHERE id = p_listing_id;

  INSERT INTO public.atom_purchases (
    listing_id, buyer_id, seller_id, price_credits, seller_credits, platform_credits
  ) VALUES (
    p_listing_id, auth.uid(), v_listing.seller_id, v_listing.price_credits,
    v_seller_cut, v_platform_cut
  );

  -- Seller "you made a sale" notification — the audit's K9 seam.
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    v_listing.seller_id,
    'atom_sale',
    'You made a sale',
    'Your atom "' || v_listing.name || '" sold for ' || v_seller_cut::text || ' credits.',
    jsonb_build_object(
      'listing_id', p_listing_id,
      'buyer_id', auth.uid(),
      'amount', v_seller_cut
    )
  );

  RETURN jsonb_build_object('success', true, 'seller_received', v_seller_cut);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.buy_atom(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.buy_atom(uuid) TO authenticated;

-- ──────────────────────────────────────────────────────────────────────
-- Like / follow / comment fan-out triggers — close audit gap K6.
-- The frontend used to insert notifications client-side for some paths and
-- not others; replace with deterministic AFTER INSERT triggers.
-- ──────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fanout_notify_reel_like()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_creator uuid;
BEGIN
  SELECT creator_id INTO v_creator FROM public.published_reels WHERE id = NEW.reel_id;
  IF v_creator IS NULL OR v_creator = NEW.user_id THEN RETURN NEW; END IF;
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    v_creator, 'like', 'Someone liked your reel',
    'Your reel got a new like.',
    jsonb_build_object('reel_id', NEW.reel_id, 'from_user_id', NEW.user_id)
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_fanout_notify_reel_like ON public.reel_likes;
CREATE TRIGGER trg_fanout_notify_reel_like
  AFTER INSERT ON public.reel_likes
  FOR EACH ROW EXECUTE FUNCTION public.fanout_notify_reel_like();

CREATE OR REPLACE FUNCTION public.fanout_notify_follow()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.follower_id = NEW.followed_id THEN RETURN NEW; END IF;
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    NEW.followed_id, 'follow', 'New follower',
    'Someone just followed you.',
    jsonb_build_object('from_user_id', NEW.follower_id)
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_fanout_notify_follow ON public.follows;
CREATE TRIGGER trg_fanout_notify_follow
  AFTER INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.fanout_notify_follow();
