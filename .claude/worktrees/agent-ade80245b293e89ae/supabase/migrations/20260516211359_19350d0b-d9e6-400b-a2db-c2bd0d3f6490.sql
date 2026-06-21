
-- 1. Add severity + dedupe metadata columns to notifications
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS severity text DEFAULT 'info' CHECK (severity IN ('info','warn','critical')),
  ADD COLUMN IF NOT EXISTS dedupe_key text;

CREATE INDEX IF NOT EXISTS idx_notifications_dedupe
  ON public.notifications (user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_severity
  ON public.notifications (user_id, severity, created_at DESC);

-- 2. Enhanced fan-out helper with severity + dedupe support
CREATE OR REPLACE FUNCTION public.notify_admins_v2(
  p_type notification_type,
  p_title text,
  p_body text,
  p_data jsonb,
  p_severity text DEFAULT 'info',
  p_dedupe_key text DEFAULT NULL,
  p_dedupe_window_seconds int DEFAULT 600
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_user record;
  existing_count int;
BEGIN
  FOR admin_user IN
    SELECT user_id FROM public.user_roles WHERE role = 'admin'
  LOOP
    -- Dedupe: skip if same user already has notif with this key within window
    IF p_dedupe_key IS NOT NULL THEN
      SELECT count(*) INTO existing_count
      FROM public.notifications
      WHERE user_id = admin_user.user_id
        AND dedupe_key = p_dedupe_key
        AND created_at > now() - (p_dedupe_window_seconds || ' seconds')::interval;
      IF existing_count > 0 THEN CONTINUE; END IF;
    END IF;

    INSERT INTO public.notifications (user_id, type, title, body, data, severity, dedupe_key)
    VALUES (admin_user.user_id, p_type, p_title, p_body, p_data, p_severity, p_dedupe_key);
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_admins_v2(notification_type, text, text, jsonb, text, text, int) FROM public, anon, authenticated;

-- 3. Public RPC: fire payment/refund/dispute admin alerts (called by Stripe webhook with service role)
CREATE OR REPLACE FUNCTION public.admin_alert_stripe_event(
  p_kind text,
  p_buyer_email text,
  p_amount_cents int,
  p_stripe_id text,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type notification_type;
  v_title text;
  v_body text;
  v_severity text;
  v_amount_usd numeric;
BEGIN
  v_amount_usd := COALESCE(p_amount_cents, 0) / 100.0;
  CASE p_kind
    WHEN 'payment_failed' THEN
      v_type := 'admin_payment_failed';
      v_title := 'Payment failed — $' || to_char(v_amount_usd, 'FM999,990.00');
      v_body := COALESCE(p_buyer_email, 'unknown') || ' — ' || COALESCE(p_reason, 'card declined');
      v_severity := 'warn';
    WHEN 'refund' THEN
      v_type := 'admin_refund';
      v_title := 'Refund issued — $' || to_char(v_amount_usd, 'FM999,990.00');
      v_body := COALESCE(p_buyer_email, 'unknown') || COALESCE(' — ' || p_reason, '');
      v_severity := 'warn';
    WHEN 'dispute' THEN
      v_type := 'admin_dispute';
      v_title := 'CHARGEBACK — $' || to_char(v_amount_usd, 'FM999,990.00');
      v_body := COALESCE(p_buyer_email, 'unknown') || ' filed dispute. Stripe has a deadline — respond in /admin/finance.';
      v_severity := 'critical';
    ELSE RETURN;
  END CASE;

  PERFORM public.notify_admins_v2(
    v_type, v_title, v_body,
    jsonb_build_object(
      'buyer_email', p_buyer_email,
      'amount_usd', v_amount_usd,
      'stripe_id', p_stripe_id,
      'reason', p_reason,
      'href', '/admin/finance'
    ),
    v_severity,
    p_kind || ':' || COALESCE(p_stripe_id, gen_random_uuid()::text),
    3600 -- 1h dedupe window
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_alert_stripe_event(text, text, int, text, text) FROM public, anon, authenticated;

-- 4. High-value purchase upgrade — re-create existing purchase trigger to escalate severity
CREATE OR REPLACE FUNCTION public.trg_notify_admin_purchase()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_usd numeric;
  v_credits int;
  v_severity text := 'info';
  v_type notification_type := 'admin_purchase';
  v_title text;
BEGIN
  IF NEW.transaction_type <> 'purchase' OR COALESCE(NEW.amount, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = NEW.user_id;
  v_credits := NEW.amount;
  v_usd := v_credits * 0.10;

  IF v_usd >= 100 THEN
    v_severity := 'warn';
    v_type := 'admin_high_value_purchase';
    v_title := 'BIG SALE — $' || to_char(v_usd, 'FM999,990.00') || ' (' || v_credits || ' credits)';
  ELSE
    v_title := 'Purchase — $' || to_char(v_usd, 'FM999,990.00') || ' (' || v_credits || ' credits)';
  END IF;

  PERFORM public.notify_admins_v2(
    v_type, v_title,
    COALESCE(v_email, 'unknown buyer'),
    jsonb_build_object(
      'buyer_email', v_email,
      'credits', v_credits,
      'amount_usd', v_usd,
      'stripe_payment_id', NEW.stripe_payment_id,
      'href', '/admin/finance'
    ),
    v_severity,
    'purchase:' || NEW.id::text,
    60
  );

  RETURN NEW;
END;
$$;

-- 5. Stuck-job detector RPC (called from cron)
CREATE OR REPLACE FUNCTION public.detect_stuck_pipeline_jobs()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
  rec record;
BEGIN
  FOR rec IN
    SELECT p.id, p.user_id, p.status, p.created_at, u.email
    FROM public.projects p
    LEFT JOIN auth.users u ON u.id = p.user_id
    WHERE p.status IN ('generating','rendering','processing','queued')
      AND p.created_at < now() - interval '30 minutes'
      AND p.created_at > now() - interval '24 hours'
  LOOP
    PERFORM public.notify_admins_v2(
      'admin_stuck_job',
      'Stuck pipeline job — ' || rec.status,
      'Project ' || substring(rec.id::text, 1, 8) || ' by ' || COALESCE(rec.email, 'unknown') ||
        ' has been ' || rec.status || ' for ' ||
        round(extract(epoch from (now() - rec.created_at)) / 60) || ' minutes.',
      jsonb_build_object(
        'project_id', rec.id,
        'user_email', rec.email,
        'status', rec.status,
        'created_at', rec.created_at,
        'href', '/admin/projects'
      ),
      'warn',
      'stuck:' || rec.id::text,
      86400 -- only notify once per day per stuck project
    );
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.detect_stuck_pipeline_jobs() FROM public, anon, authenticated;

-- 6. Account deletion notifier — fires from delete-user-account edge function via this RPC
CREATE OR REPLACE FUNCTION public.admin_alert_account_deleted(
  p_user_email text,
  p_user_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.notify_admins_v2(
    'admin_account_deleted',
    'Account deleted — ' || COALESCE(p_user_email, 'unknown'),
    COALESCE('Reason: ' || p_reason, 'No reason provided.'),
    jsonb_build_object(
      'user_email', p_user_email,
      'user_id', p_user_id,
      'reason', p_reason,
      'href', '/admin/users'
    ),
    'warn',
    'account_deleted:' || p_user_id::text,
    0
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_alert_account_deleted(text, uuid, text) FROM public, anon, authenticated;

-- 7. First successful video celebration trigger (on videos table completion)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='videos') THEN
    CREATE OR REPLACE FUNCTION public.trg_notify_admin_first_video()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $f$
    DECLARE
      v_count int;
      v_email text;
    BEGIN
      IF NEW.status <> 'completed' THEN RETURN NEW; END IF;
      IF TG_OP = 'UPDATE' AND OLD.status = 'completed' THEN RETURN NEW; END IF;

      SELECT count(*) INTO v_count
      FROM public.videos
      WHERE user_id = NEW.user_id AND status = 'completed' AND id <> NEW.id;

      IF v_count = 0 THEN
        SELECT email INTO v_email FROM auth.users WHERE id = NEW.user_id;
        PERFORM public.notify_admins_v2(
          'admin_first_video',
          'First video shipped — ' || COALESCE(v_email, 'unknown'),
          'New creator completed their first successful generation. Case study candidate.',
          jsonb_build_object('user_email', v_email, 'user_id', NEW.user_id, 'video_id', NEW.id, 'href', '/admin/users'),
          'info',
          'first_video:' || NEW.user_id::text,
          0
        );
      END IF;
      RETURN NEW;
    END;
    $f$;

    DROP TRIGGER IF EXISTS notify_admin_first_video ON public.videos;
    CREATE TRIGGER notify_admin_first_video
    AFTER INSERT OR UPDATE OF status ON public.videos
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_notify_admin_first_video();
  END IF;
END $$;
