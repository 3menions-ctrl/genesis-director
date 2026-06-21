
-- ============================================================================
-- Credit Reservation System
-- ============================================================================
-- Solves the "concurrent renders drift past pre-flight check" problem:
--   1. A render reserves N credits up-front. The reservation reduces the
--      EFFECTIVE balance available to subsequent reserve calls, even though
--      the actual `profiles.credits_balance` is only debited on consume.
--   2. On success → consume_credit_hold (atomic debit + ledger entry).
--   3. On failure → release_credit_hold (frees the amount).
--   4. expire_credit_holds() reaps abandoned holds past TTL.
-- ============================================================================

CREATE TYPE public.credit_hold_status AS ENUM ('held', 'consumed', 'released', 'expired');

CREATE TABLE public.credit_holds (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id      uuid REFERENCES public.movie_projects(id) ON DELETE SET NULL,
  amount          integer NOT NULL CHECK (amount > 0),
  status          public.credit_hold_status NOT NULL DEFAULT 'held',
  description     text,
  idempotency_key text,
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  consumed_at     timestamptz,
  released_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_credit_holds_user_status ON public.credit_holds (user_id, status) WHERE status = 'held';
CREATE INDEX idx_credit_holds_expires_at  ON public.credit_holds (expires_at)      WHERE status = 'held';
CREATE UNIQUE INDEX credit_holds_idempotency_unique
  ON public.credit_holds (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.credit_holds ENABLE ROW LEVEL SECURITY;

-- Owner can read their own holds; everything else is service-role only.
CREATE POLICY "Users read own credit holds"
  ON public.credit_holds FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Block client writes to credit_holds"
  ON public.credit_holds FOR INSERT WITH CHECK (false);

CREATE POLICY "Block client updates to credit_holds"
  ON public.credit_holds FOR UPDATE USING (false);

CREATE POLICY "Block client deletes to credit_holds"
  ON public.credit_holds FOR DELETE USING (false);

CREATE TRIGGER trg_credit_holds_touch
  BEFORE UPDATE ON public.credit_holds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- reserve_credits — atomic balance check + insert.
--   Returns the new hold row (or the existing one if idempotency_key matches).
--   Returns NULL on insufficient effective balance.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reserve_credits(
  p_user_id         uuid,
  p_amount          integer,
  p_project_id      uuid    DEFAULT NULL,
  p_description     text    DEFAULT NULL,
  p_idempotency_key text    DEFAULT NULL,
  p_ttl_seconds     integer DEFAULT 900
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing       credit_holds%ROWTYPE;
  v_balance        integer;
  v_held_total     integer;
  v_effective      integer;
  v_hold           credit_holds%ROWTYPE;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'reserve_credits requires positive amount (got %)', p_amount;
  END IF;

  -- Idempotency short-circuit.
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM credit_holds
    WHERE user_id = p_user_id AND idempotency_key = p_idempotency_key
    LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'success',  v_existing.status = 'held',
        'holdId',   v_existing.id,
        'amount',   v_existing.amount,
        'status',   v_existing.status,
        'expiresAt', v_existing.expires_at,
        'reused',   true
      );
    END IF;
  END IF;

  -- Lock profile row to prevent races with concurrent reserves / debits.
  SELECT credits_balance INTO v_balance
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'profile_not_found');
  END IF;

  -- Sum of currently active holds (unexpired + held).
  SELECT COALESCE(SUM(amount), 0) INTO v_held_total
  FROM credit_holds
  WHERE user_id = p_user_id
    AND status = 'held'
    AND expires_at > now();

  v_effective := v_balance - v_held_total;

  IF v_effective < p_amount THEN
    RETURN jsonb_build_object(
      'success',          false,
      'error',            'insufficient_credits',
      'balance',          v_balance,
      'reserved',         v_held_total,
      'effectiveBalance', v_effective,
      'required',         p_amount
    );
  END IF;

  INSERT INTO credit_holds (
    user_id, project_id, amount, description, idempotency_key, expires_at
  ) VALUES (
    p_user_id, p_project_id, p_amount, p_description, p_idempotency_key,
    now() + make_interval(secs => GREATEST(p_ttl_seconds, 60))
  )
  RETURNING * INTO v_hold;

  RETURN jsonb_build_object(
    'success',          true,
    'holdId',           v_hold.id,
    'amount',           v_hold.amount,
    'status',           v_hold.status,
    'expiresAt',        v_hold.expires_at,
    'balance',          v_balance,
    'effectiveBalance', v_effective - p_amount,
    'reused',           false
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reserve_credits FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.reserve_credits TO service_role;

-- ----------------------------------------------------------------------------
-- consume_credit_hold — finalize a hold: debit balance + write transaction.
--   Idempotent: re-calling on an already-consumed hold returns success.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consume_credit_hold(
  p_hold_id        uuid,
  p_description    text    DEFAULT NULL,
  p_clip_duration  integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hold     credit_holds%ROWTYPE;
  v_balance  integer;
BEGIN
  SELECT * INTO v_hold
  FROM credit_holds
  WHERE id = p_hold_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'hold_not_found');
  END IF;

  -- Idempotent: already consumed → success no-op.
  IF v_hold.status = 'consumed' THEN
    RETURN jsonb_build_object('success', true, 'reused', true, 'amount', v_hold.amount);
  END IF;

  IF v_hold.status <> 'held' THEN
    RETURN jsonb_build_object('success', false, 'error', 'hold_not_active', 'status', v_hold.status);
  END IF;

  IF v_hold.expires_at <= now() THEN
    UPDATE credit_holds SET status = 'expired', released_at = now() WHERE id = v_hold.id;
    RETURN jsonb_build_object('success', false, 'error', 'hold_expired');
  END IF;

  -- Lock + debit profile balance atomically.
  SELECT credits_balance INTO v_balance
  FROM profiles WHERE id = v_hold.user_id FOR UPDATE;

  IF v_balance IS NULL OR v_balance < v_hold.amount THEN
    -- Should be impossible if reserve_credits was used, but stay safe.
    UPDATE credit_holds SET status = 'released', released_at = now() WHERE id = v_hold.id;
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_balance', 'balance', v_balance);
  END IF;

  UPDATE profiles
  SET credits_balance = credits_balance - v_hold.amount
  WHERE id = v_hold.user_id;

  INSERT INTO credit_transactions (
    user_id, amount, transaction_type, description, project_id, clip_duration_seconds, idempotency_key
  ) VALUES (
    v_hold.user_id,
    -v_hold.amount,
    'usage',
    COALESCE(p_description, v_hold.description, 'Generation'),
    v_hold.project_id,
    p_clip_duration,
    'hold:' || v_hold.id::text
  )
  ON CONFLICT DO NOTHING;

  UPDATE credit_holds
  SET status = 'consumed', consumed_at = now()
  WHERE id = v_hold.id;

  RETURN jsonb_build_object(
    'success', true,
    'amount',  v_hold.amount,
    'newBalance', v_balance - v_hold.amount
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_credit_hold FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.consume_credit_hold TO service_role;

-- ----------------------------------------------------------------------------
-- release_credit_hold — cancel a held reservation (no balance debit).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.release_credit_hold(
  p_hold_id uuid,
  p_reason  text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hold credit_holds%ROWTYPE;
BEGIN
  SELECT * INTO v_hold FROM credit_holds WHERE id = p_hold_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'hold_not_found');
  END IF;

  IF v_hold.status <> 'held' THEN
    -- Idempotent for released; report current status otherwise.
    RETURN jsonb_build_object(
      'success', v_hold.status IN ('released','expired'),
      'reused',  true,
      'status',  v_hold.status
    );
  END IF;

  UPDATE credit_holds
  SET status = 'released',
      released_at = now(),
      description = COALESCE(p_reason, description)
  WHERE id = v_hold.id;

  RETURN jsonb_build_object('success', true, 'amount', v_hold.amount);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.release_credit_hold FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.release_credit_hold TO service_role;

-- ----------------------------------------------------------------------------
-- expire_credit_holds — sweep abandoned reservations.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expire_credit_holds()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH expired AS (
    UPDATE credit_holds
    SET status = 'expired', released_at = now()
    WHERE status = 'held' AND expires_at <= now()
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM expired;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.expire_credit_holds FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.expire_credit_holds TO service_role;
