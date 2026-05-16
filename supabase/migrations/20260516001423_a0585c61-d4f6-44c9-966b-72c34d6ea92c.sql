CREATE OR REPLACE FUNCTION public.audit_credits_balance_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  delta INTEGER;
  v_match_count INTEGER;
BEGIN
  delta := NEW.credits_balance - OLD.credits_balance;

  -- Only audit increases (decreases are usage and already tracked)
  IF delta <= 0 THEN
    RETURN NEW;
  END IF;

  -- Match a positive credit_transactions row recorded in the same flow.
  -- We use a 60-second window because commit-timestamp tracking is not
  -- available on this cluster (pg_xact_commit_timestamp would raise).
  SELECT COUNT(*) INTO v_match_count
  FROM credit_transactions
  WHERE user_id = NEW.id
    AND amount > 0
    AND created_at >= (now() - interval '60 seconds')
    AND transaction_type IN (
      'welcome_bonus','purchase','refund','referral_bonus',
      'system_grant','admin_grant','bonus','promo','reward'
    );

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