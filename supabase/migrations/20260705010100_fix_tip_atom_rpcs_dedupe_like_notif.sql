-- M2 / audit D2,D3,#1,D40: restore tip/atom RPCs + de-dupe like notifications.
--
-- D2: tip_reel's NOTIFICATION insert used type='tip' (not a notification_type
--     enum value) → unguarded → every reel tip rolled back. Use 'tip_received'.
-- D3: buy_atom's notification insert uses type='atom_sale', never added to the
--     enum → every atom purchase rolled back. Add the enum value.
-- #1: tip_in_thread (the wired DM tip) inserts credit_transactions(kind, meta)
--     — neither column exists (real: transaction_type NOT NULL; no metadata col)
--     → every DM tip threw. Fix columns; fold meta into description. The
--     trg_sync_balance_from_ledger trigger reconciles profiles.credits_balance,
--     so the corrected direct inserts move money correctly.
-- D40: reel_likes had two AFTER INSERT notify triggers → two notifications per
--     like. Drop the older fanout trigger; keep the unified-inbox one.
--
-- NOTE: the ALTER TYPE ... ADD VALUE is applied as its own statement (cannot
-- share a transaction with usage). transaction_type is a free-text column.

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'atom_sale';

-- ── D2: tip_reel notification 'tip' -> 'tip_received' (body otherwise identical to live) ──
CREATE OR REPLACE FUNCTION public.tip_reel(p_reel_id uuid, p_credits integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  v_buyer_total := COALESCE(public.credit_ledger_total(auth.uid()), 0);
  v_buyer_avail := GREATEST(v_buyer_total - COALESCE(public.active_credit_holds_total(auth.uid()), 0), 0);
  IF v_buyer_avail < p_credits THEN
    RAISE EXCEPTION 'insufficient_credits';
  END IF;

  v_creator_cut := (p_credits * 90) / 100;
  v_platform_cut := p_credits - v_creator_cut;

  PERFORM 1 FROM public.profiles
    WHERE id IN (auth.uid(), v_creator)
    ORDER BY id
    FOR UPDATE;

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

  UPDATE public.published_reels
    SET tip_credits = COALESCE(tip_credits, 0) + p_credits
    WHERE id = p_reel_id;

  SELECT COALESCE(p_reel_id::text, 'your reel') INTO v_reel_title;
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    v_creator,
    'tip_received',
    'You received a tip',
    'Someone tipped you ' || v_creator_cut::text || ' credits on a reel.',
    jsonb_build_object('reel_id', p_reel_id, 'amount', v_creator_cut, 'from_user_id', auth.uid())
  );

  RETURN jsonb_build_object('success', true, 'creator_received', v_creator_cut);
END;
$function$;

-- ── #1: tip_in_thread credit_transactions columns (kind,meta -> transaction_type,description) ──
CREATE OR REPLACE FUNCTION public.tip_in_thread(p_recipient uuid, p_amount integer, p_content text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_balance int; v_creator_cut int; v_platform_cut int; v_msg_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF p_recipient = auth.uid() THEN RAISE EXCEPTION 'cannot_tip_self'; END IF;
  IF p_amount <= 0 OR p_amount > 10000 THEN RAISE EXCEPTION 'invalid_amount'; END IF;

  SELECT credits_balance INTO v_balance FROM public.profiles WHERE id = auth.uid();
  IF v_balance IS NULL OR v_balance < p_amount THEN RAISE EXCEPTION 'insufficient_balance'; END IF;

  v_creator_cut  := (p_amount * 90) / 100;
  v_platform_cut := p_amount - v_creator_cut;

  -- Debit tipper (sync_balance_from_ledger reconciles the cached balance).
  INSERT INTO public.credit_transactions (user_id, amount, transaction_type, description)
    VALUES (auth.uid(), -p_amount, 'tip_sent', 'Tip sent to ' || p_recipient::text);
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

-- ── D40: drop the duplicate reel-like notify trigger (keep trg_notify_reel_like) ──
DROP TRIGGER IF EXISTS trg_fanout_notify_reel_like ON public.reel_likes;
DROP FUNCTION IF EXISTS public.fanout_notify_reel_like() CASCADE;
