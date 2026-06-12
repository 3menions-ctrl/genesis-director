-- Low-credits notification + email trigger.
--
-- When a user's credit balance falls below the configurable threshold (default
-- 25 credits) we insert one in-app notification and call the
-- send-transactional-email edge function so a `low_credits` email goes out.
-- Idempotent: only fires once per descent below the threshold (the trigger
-- looks for any existing low_credits notification newer than the user's most
-- recent credit grant).

-- Add the enum value if it isn't already present.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'notification_type' AND e.enumlabel = 'low_credits'
  ) THEN
    ALTER TYPE public.notification_type ADD VALUE 'low_credits';
  END IF;
END $$;

INSERT INTO public.system_config (key, value, description)
VALUES (
  'beta.low_credits_threshold',
  '25'::jsonb,
  'Credit balance threshold at or below which a one-time low_credits notification + email fires.'
)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.fire_low_credits_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  threshold int;
  last_grant timestamptz;
  has_recent_notice boolean;
  user_email text;
BEGIN
  -- Only act on descents (balance went down to or below the threshold).
  IF NEW.credits_balance IS NULL OR OLD.credits_balance IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.credits_balance >= OLD.credits_balance THEN
    RETURN NEW;
  END IF;

  SELECT (value::text)::int INTO threshold
  FROM public.system_config
  WHERE key = 'beta.low_credits_threshold';
  IF threshold IS NULL THEN threshold := 25; END IF;

  IF NEW.credits_balance > threshold THEN
    RETURN NEW;
  END IF;

  -- Find the most recent grant so we can rate-limit: one notification per
  -- "descent" (between grants). If the user got more credits since the last
  -- low_credits notification, they're eligible to be notified again.
  SELECT MAX(created_at) INTO last_grant
  FROM public.credit_transactions
  WHERE user_id = NEW.id
    AND transaction_type = 'grant';

  SELECT EXISTS (
    SELECT 1 FROM public.notifications
    WHERE user_id = NEW.id
      AND type = 'low_credits'
      AND (last_grant IS NULL OR created_at > last_grant)
  ) INTO has_recent_notice;
  IF has_recent_notice THEN
    RETURN NEW;
  END IF;

  -- 1. In-app notification
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    NEW.id,
    'low_credits',
    'Your credit balance is getting low',
    'You have ' || NEW.credits_balance || ' credits left. Request more from /credits.',
    jsonb_build_object('balance', NEW.credits_balance, 'action_url', '/credits')
  );

  -- 2. Email — best-effort via pg_net to the edge function. We don't fail the
  -- credit-update transaction if the HTTP call fails.
  SELECT email INTO user_email FROM public.profiles WHERE id = NEW.id;
  IF user_email IS NOT NULL THEN
    BEGIN
      PERFORM net.http_post(
        url := current_setting('app.supabase_url', true) || '/functions/v1/send-transactional-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
        ),
        body := jsonb_build_object(
          'template', 'low_credits',
          'recipientEmail', user_email,
          'templateData', jsonb_build_object(
            'balance', NEW.credits_balance,
            'topUpUrl', 'https://apex-studio.ai/credits'
          )
        )
      );
    EXCEPTION WHEN OTHERS THEN
      -- Silently swallow — the in-app notification still fired and the
      -- balance update should always succeed.
      NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fire_low_credits ON public.profiles;
CREATE TRIGGER trg_fire_low_credits
AFTER UPDATE OF credits_balance ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.fire_low_credits_notification();

COMMENT ON FUNCTION public.fire_low_credits_notification IS
  'Fires a one-time low_credits in-app notification + email when a user crosses below the configured balance threshold. Rate-limited to one event per credit-grant cycle.';
