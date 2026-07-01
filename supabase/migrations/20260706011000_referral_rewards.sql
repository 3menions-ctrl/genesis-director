-- ============================================================================
-- Referral rewards — complete the half-built referral feature.
--
-- The UI (ReferralsSettings.tsx) and admin RPC (admin_list_referrals) already
-- reference `referral_codes` + `referral_redemptions`, but the tables never
-- existed, and signup ignored the ?ref= param — so the feature silently
-- promised rewards that never arrived. This creates the tables + the two
-- SECURITY DEFINER RPCs that make it real:
--
--   attribute_referral(code)  — called right after a new user signs up via a
--     /auth?ref=CODE link. Records a PENDING redemption. No credits yet.
--   try_credit_referral(uid)  — fired by a trigger when a user completes their
--     FIRST render (movie_projects.video_url null -> set). Pays 50 credits to
--     BOTH the referrer and the new user, idempotently, capping the referrer at
--     20 rewarded referrals. Paying on first render (not signup) makes throwaway-
--     email farming worthless: a bot must actually render a video to pay out.
--
-- Economics chosen by the owner: double-sided, 50 credits each, cap 20/referrer.
-- ============================================================================

-- ── Tables ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.referral_codes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  code       text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.referral_redemptions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code_id  uuid NOT NULL REFERENCES public.referral_codes(id) ON DELETE CASCADE,
  referrer_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_user_id  uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  status            text NOT NULL DEFAULT 'pending',   -- pending | credited | capped
  referrer_credited boolean NOT NULL DEFAULT false,
  referee_credited  boolean NOT NULL DEFAULT false,
  bonus_amount      integer NOT NULL DEFAULT 50,
  created_at        timestamptz NOT NULL DEFAULT now(),
  credited_at       timestamptz
);
CREATE INDEX IF NOT EXISTS referral_redemptions_referrer_idx ON public.referral_redemptions (referrer_id);
CREATE INDEX IF NOT EXISTS referral_redemptions_referred_idx ON public.referral_redemptions (referred_user_id);

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.referral_codes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_redemptions ENABLE ROW LEVEL SECURITY;

-- A user reads + creates only their own code (the UI get-or-creates client-side).
DROP POLICY IF EXISTS referral_codes_select_own ON public.referral_codes;
CREATE POLICY referral_codes_select_own ON public.referral_codes
  FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS referral_codes_insert_own ON public.referral_codes;
CREATE POLICY referral_codes_insert_own ON public.referral_codes
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Redemptions are readable by the referrer (their dashboard) or the referred
-- user. All WRITES go through the SECURITY DEFINER RPCs below — no client insert
-- policy, so the ledger can't be gamed from the client.
DROP POLICY IF EXISTS referral_redemptions_select_party ON public.referral_redemptions;
CREATE POLICY referral_redemptions_select_party ON public.referral_redemptions
  FOR SELECT USING (referrer_id = auth.uid() OR referred_user_id = auth.uid());

-- ── attribute_referral: record a pending redemption at signup ────────────────
CREATE OR REPLACE FUNCTION public.attribute_referral(p_code text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_code    public.referral_codes%ROWTYPE;
  v_created timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  END IF;
  IF p_code IS NULL OR length(btrim(p_code)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_code');
  END IF;

  SELECT * INTO v_code FROM public.referral_codes WHERE code = upper(btrim(p_code));
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad_code');
  END IF;
  IF v_code.user_id = v_uid THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'self_referral');
  END IF;

  -- Only freshly-created accounts can be attributed — stops an existing user
  -- from retroactively assigning themselves a referrer.
  SELECT created_at INTO v_created FROM public.profiles WHERE id = v_uid;
  IF v_created IS NULL OR v_created < now() - interval '7 days' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'account_too_old');
  END IF;

  -- One referrer per user, ever (UNIQUE on referred_user_id).
  INSERT INTO public.referral_redemptions (referral_code_id, referrer_id, referred_user_id)
  VALUES (v_code.id, v_code.user_id, v_uid)
  ON CONFLICT (referred_user_id) DO NOTHING;

  RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.attribute_referral(text) TO authenticated;

-- ── try_credit_referral: pay out on the referee's first render ───────────────
CREATE OR REPLACE FUNCTION public.try_credit_referral(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cap  constant integer := 20;     -- max rewarded referrals per referrer
  v_red  public.referral_redemptions%ROWTYPE;
  v_bonus integer;
  v_cnt  integer;
  v_bal  integer;
BEGIN
  -- A pending redemption where this user is the REFERRED (new) user. The status
  -- guard + row lock make this idempotent: once processed it leaves 'pending',
  -- so re-firing on a later render is a no-op.
  SELECT * INTO v_red
  FROM public.referral_redemptions
  WHERE referred_user_id = p_user_id AND status = 'pending'
  FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN RETURN; END IF;

  v_bonus := COALESCE(v_red.bonus_amount, 50);

  -- Credit the referee (they did the qualifying render). Insert the ledger row
  -- BEFORE bumping the cached balance so the anomaly detector sees the match.
  SELECT credits_balance INTO v_bal FROM public.profiles WHERE id = v_red.referred_user_id FOR UPDATE;
  INSERT INTO public.credit_transactions (user_id, amount, transaction_type, description, balance_after, idempotency_key)
  VALUES (v_red.referred_user_id, v_bonus, 'referral_bonus', 'Referral welcome bonus', v_bal + v_bonus, 'ref:'||v_red.id||':referee');
  UPDATE public.profiles SET credits_balance = v_bal + v_bonus WHERE id = v_red.referred_user_id;

  -- Credit the referrer only if under their cap.
  SELECT COUNT(*) INTO v_cnt FROM public.referral_redemptions
  WHERE referrer_id = v_red.referrer_id AND referrer_credited = true;

  IF v_cnt < v_cap THEN
    SELECT credits_balance INTO v_bal FROM public.profiles WHERE id = v_red.referrer_id FOR UPDATE;
    INSERT INTO public.credit_transactions (user_id, amount, transaction_type, description, balance_after, idempotency_key)
    VALUES (v_red.referrer_id, v_bonus, 'referral_bonus', 'Referral reward — an invited friend made their first film', v_bal + v_bonus, 'ref:'||v_red.id||':referrer');
    UPDATE public.profiles SET credits_balance = v_bal + v_bonus WHERE id = v_red.referrer_id;
    UPDATE public.referral_redemptions
      SET status='credited', referrer_credited=true, referee_credited=true, credited_at=now()
      WHERE id = v_red.id;
  ELSE
    -- Referrer at cap: referee still keeps their bonus; referrer not paid.
    UPDATE public.referral_redemptions
      SET status='capped', referee_credited=true, credited_at=now()
      WHERE id = v_red.id;
  END IF;
END;
$$;
-- Not granted to authenticated: only the trigger (definer) and service_role call it.
REVOKE ALL ON FUNCTION public.try_credit_referral(uuid) FROM PUBLIC;

-- ── Trigger: first render completion pays any pending referral ───────────────
CREATE OR REPLACE FUNCTION public.referral_on_render_complete()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (COALESCE(OLD.video_url, '') = '') AND COALESCE(NEW.video_url, '') <> '' THEN
    PERFORM public.try_credit_referral(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS referral_on_render_complete_trg ON public.movie_projects;
CREATE TRIGGER referral_on_render_complete_trg
  AFTER UPDATE OF video_url ON public.movie_projects
  FOR EACH ROW EXECUTE FUNCTION public.referral_on_render_complete();
