
-- Add low_credits notification type to the enum
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'low_credits';

-- Create a function that checks credit balance after deduction and inserts a notification
CREATE OR REPLACE FUNCTION public.check_low_credits_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_balance INTEGER;
  v_recent_notif BOOLEAN;
BEGIN
  -- Only trigger on credit usage (negative amounts)
  IF NEW.amount >= 0 OR NEW.transaction_type NOT IN ('usage') THEN
    RETURN NEW;
  END IF;

  -- Get current balance
  SELECT credits_balance INTO v_balance
  FROM profiles
  WHERE id = NEW.user_id;

  -- Check if we already sent a low-credit notification in the last 24 hours
  SELECT EXISTS(
    SELECT 1 FROM notifications
    WHERE user_id = NEW.user_id
      AND type = 'low_credits'
      AND created_at > now() - interval '24 hours'
  ) INTO v_recent_notif;

  IF v_recent_notif THEN
    RETURN NEW;
  END IF;

  -- Insert notification based on threshold
  IF v_balance = 0 THEN
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      NEW.user_id,
      'low_credits',
      'You''re out of credits',
      'Purchase more credits to continue creating videos.',
      jsonb_build_object('level', 'empty', 'balance', v_balance)
    );
  ELSIF v_balance <= 5 THEN
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      NEW.user_id,
      'low_credits',
      'Credits running low ⚠️',
      'You have ' || v_balance || ' credits remaining. Top up to avoid interruptions.',
      jsonb_build_object('level', 'critical', 'balance', v_balance)
    );
  ELSIF v_balance <= 20 THEN
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      NEW.user_id,
      'low_credits',
      'Credits getting low',
      'You have ' || v_balance || ' credits remaining.',
      jsonb_build_object('level', 'low', 'balance', v_balance)
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- Attach trigger to credit_transactions table
CREATE TRIGGER check_low_credits_after_usage
AFTER INSERT ON public.credit_transactions
FOR EACH ROW
EXECUTE FUNCTION public.check_low_credits_notification();
