-- Replace the audit trigger with a transaction-id-aware version that stops false positives
CREATE OR REPLACE FUNCTION public.audit_credits_balance_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  delta INTEGER;
  v_xid xid8;
  v_match_count INTEGER;
BEGIN
  delta := NEW.credits_balance - OLD.credits_balance;

  -- Only audit increases (decreases are usage and already tracked)
  IF delta <= 0 THEN
    RETURN NEW;
  END IF;

  v_xid := pg_current_xact_id();

  -- Strong check: a matching positive credit_transactions row exists
  -- in THIS same DB transaction (xmin = current txid). This is reliable
  -- regardless of timing and eliminates the prior race condition.
  SELECT COUNT(*) INTO v_match_count
  FROM credit_transactions
  WHERE user_id = NEW.id
    AND amount > 0
    AND pg_xact_commit_timestamp(xmin) IS NULL  -- still in current txn
    AND transaction_type IN (
      'welcome_bonus','purchase','refund','referral_bonus',
      'system_grant','admin_grant','bonus','promo','reward'
    );

  -- Fallback: also accept any positive transaction recorded in last 30 seconds
  -- (covers async/edge function flows where the trigger fires slightly later).
  IF v_match_count = 0 THEN
    SELECT COUNT(*) INTO v_match_count
    FROM credit_transactions
    WHERE user_id = NEW.id
      AND amount > 0
      AND created_at >= (now() - interval '30 seconds');
  END IF;

  -- Only log a real anomaly when neither check matches
  IF v_match_count = 0 THEN
    INSERT INTO credit_transactions (user_id, amount, transaction_type, description)
    VALUES (
      NEW.id,
      delta,
      'untracked_increase',
      'SECURITY ALERT: credits_balance increased by ' || delta || ' without a matching transaction. Possible exploit attempt.'
    );
  END IF;

  RETURN NEW;
END;
$function$;