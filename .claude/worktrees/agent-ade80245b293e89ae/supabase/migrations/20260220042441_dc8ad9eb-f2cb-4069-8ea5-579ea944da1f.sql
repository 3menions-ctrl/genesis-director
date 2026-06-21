
-- ============================================================
-- COMPREHENSIVE SECURITY HARDENING MIGRATION v2
-- ============================================================

-- 1. FIX: chat_messages publicly readable — restrict to conversation members only
DROP POLICY IF EXISTS "Anyone can view messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Public can read chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Chat messages are viewable by conversation members" ON public.chat_messages;

CREATE POLICY "Chat messages: members only" ON public.chat_messages
  FOR SELECT USING (
    public.is_conversation_member(conversation_id, auth.uid())
  );

CREATE POLICY "Chat messages: insert by members" ON public.chat_messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND public.is_conversation_member(conversation_id, auth.uid())
  );

CREATE POLICY "Chat messages: update own" ON public.chat_messages
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Chat messages: delete own" ON public.chat_messages
  FOR DELETE USING (auth.uid() = user_id);

-- 2. FIX: avatar_templates face images publicly exposed — require auth
DROP POLICY IF EXISTS "Anyone can view avatar templates" ON public.avatar_templates;
DROP POLICY IF EXISTS "Public can view avatar templates" ON public.avatar_templates;

CREATE POLICY "Avatar templates: auth users only" ON public.avatar_templates
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 3. FIX: genesis_preset_characters publicly readable — restrict to authenticated
DROP POLICY IF EXISTS "Anyone can view preset characters" ON public.genesis_preset_characters;
DROP POLICY IF EXISTS "Public can view preset characters" ON public.genesis_preset_characters;

CREATE POLICY "Genesis preset characters: auth only" ON public.genesis_preset_characters
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 4. FIX: genesis_scenes, genesis_screenplay publicly readable — require auth
DROP POLICY IF EXISTS "Anyone can view scenes" ON public.genesis_scenes;
DROP POLICY IF EXISTS "Public can view scenes" ON public.genesis_scenes;
DROP POLICY IF EXISTS "Anyone can view screenplay" ON public.genesis_screenplay;

CREATE POLICY "Genesis scenes: auth only" ON public.genesis_scenes
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Genesis screenplay: auth only" ON public.genesis_screenplay
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 5. FIX: Remove Stripe price IDs from public credit_packages view
DROP VIEW IF EXISTS public.credit_packages_public;

CREATE VIEW public.credit_packages_public
WITH (security_invoker = on) AS
  SELECT id, name, credits, price_cents, is_active, is_popular
  FROM public.credit_packages
  WHERE is_active = true;

-- 6. Genesis locations: require auth (prevent bulk scraping)
DROP POLICY IF EXISTS "Anyone can view locations" ON public.genesis_locations;
DROP POLICY IF EXISTS "Public can view locations" ON public.genesis_locations;

CREATE POLICY "Genesis locations: auth only" ON public.genesis_locations
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 7. Security events table
CREATE TABLE IF NOT EXISTS public.security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warn', 'critical')),
  ip_address TEXT,
  user_agent TEXT,
  details JSONB,
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Security events: admin only" ON public.security_events
  FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY "Security events: service can insert" ON public.security_events
  FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_security_events_user ON public.security_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON public.security_events(event_type, severity, created_at DESC);

-- 8. Credit anomaly detection function
CREATE OR REPLACE FUNCTION public.detect_credit_anomaly(p_user_id UUID, p_amount INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_credits INTEGER;
  rapid_purchase_count INTEGER;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO recent_credits
  FROM credit_transactions
  WHERE user_id = p_user_id
    AND transaction_type = 'purchase'
    AND amount > 0
    AND created_at > now() - interval '1 hour';

  IF recent_credits + p_amount > 10000 THEN
    INSERT INTO security_events (user_id, event_type, severity, details)
    VALUES (p_user_id, 'credit_anomaly_high_volume', 'critical',
      jsonb_build_object('amount_requested', p_amount, 'recent_total', recent_credits, 'threshold', 10000));
    RETURN true;
  END IF;

  SELECT COUNT(*) INTO rapid_purchase_count
  FROM credit_transactions
  WHERE user_id = p_user_id
    AND transaction_type = 'purchase'
    AND created_at > now() - interval '10 minutes';

  IF rapid_purchase_count >= 5 THEN
    INSERT INTO security_events (user_id, event_type, severity, details)
    VALUES (p_user_id, 'credit_rapid_transactions', 'warn',
      jsonb_build_object('count_in_10min', rapid_purchase_count));
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- 9. Hardened add_credits with anomaly detection + idempotency
CREATE OR REPLACE FUNCTION public.add_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_description TEXT,
  p_stripe_payment_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_duplicate BOOLEAN;
  anomaly BOOLEAN;
BEGIN
  -- Validate inputs
  IF p_amount <= 0 OR p_amount > 100000 THEN
    RAISE EXCEPTION 'Invalid credit amount: %', p_amount;
  END IF;

  IF p_stripe_payment_id IS NULL OR length(p_stripe_payment_id) < 5 THEN
    RAISE EXCEPTION 'Invalid Stripe payment reference';
  END IF;

  -- Idempotency check
  SELECT EXISTS(
    SELECT 1 FROM credit_transactions
    WHERE stripe_payment_id = p_stripe_payment_id
  ) INTO is_duplicate;

  IF is_duplicate THEN
    RETURN jsonb_build_object('success', false, 'reason', 'duplicate_payment');
  END IF;

  -- Anomaly detection (log, but don't block legit payments)
  anomaly := public.detect_credit_anomaly(p_user_id, p_amount);

  -- Apply credits
  UPDATE profiles
  SET
    credits_balance = credits_balance + p_amount,
    total_credits_purchased = COALESCE(total_credits_purchased, 0) + p_amount,
    updated_at = now()
  WHERE id = p_user_id;

  -- Immutable transaction record
  INSERT INTO credit_transactions (user_id, amount, transaction_type, description, stripe_payment_id)
  VALUES (p_user_id, p_amount, 'purchase', p_description, p_stripe_payment_id);

  RETURN jsonb_build_object('success', true, 'credits_added', p_amount, 'flagged', anomaly);
END;
$$;

-- 10. Prevent negative credit balance
CREATE OR REPLACE FUNCTION public.prevent_negative_credits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.credits_balance < 0 THEN
    INSERT INTO security_events (user_id, event_type, severity, details)
    VALUES (NEW.id, 'negative_balance_attempt', 'critical',
      jsonb_build_object('attempted_balance', NEW.credits_balance, 'previous_balance', OLD.credits_balance));
    NEW.credits_balance := 0;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_non_negative_credits ON public.profiles;
CREATE TRIGGER enforce_non_negative_credits
  BEFORE UPDATE OF credits_balance ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_negative_credits();

-- 11. Refund eligibility guard (prevent duplicate refunds)
CREATE OR REPLACE FUNCTION public.check_refund_eligibility(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  already_refunded BOOLEAN;
  project_owner UUID;
BEGIN
  SELECT user_id INTO project_owner
  FROM movie_projects WHERE id = p_project_id;

  IF project_owner IS NULL OR project_owner != p_user_id THEN
    INSERT INTO security_events (user_id, event_type, severity, details)
    VALUES (p_user_id, 'unauthorized_refund_attempt', 'critical',
      jsonb_build_object('project_id', p_project_id, 'project_owner', project_owner));
    RETURN false;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM credit_transactions
    WHERE project_id = p_project_id
      AND transaction_type = 'refund'
  ) INTO already_refunded;

  RETURN NOT already_refunded;
END;
$$;

-- 12. Log that security hardening was applied
INSERT INTO security_events (event_type, severity, details)
VALUES ('security_hardening_applied', 'info',
  jsonb_build_object('version', '2.0', 'timestamp', now(), 'changes', ARRAY[
    'chat_messages_rls_restricted_to_members',
    'avatar_templates_requires_auth',
    'genesis_preset_characters_requires_auth',
    'genesis_scenes_requires_auth',
    'genesis_screenplay_requires_auth',
    'genesis_locations_requires_auth',
    'credit_packages_stripe_ids_hidden',
    'security_events_table_created',
    'credit_anomaly_detection_active',
    'negative_balance_trigger_active',
    'refund_eligibility_guard_active',
    'add_credits_idempotency_hardened'
  ]));
