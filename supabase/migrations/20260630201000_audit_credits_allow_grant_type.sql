-- audit_credits_balance_change: recognize 'grant' as a legitimate credit type.
--
-- The guard raises a bogus "SECURITY ALERT: untracked_increase" whenever
-- credits_balance rises without a matching credit_transactions row whose
-- transaction_type is in an allowlist. That allowlist listed 'admin_grant' but
-- NOT 'grant' — yet admin_grant_credits (and other admin grants) insert type
-- 'grant'. Combined with the ledger-sync trigger that updates credits_balance,
-- every admin grant tripped a false alert. Add 'grant' to the allowlist.
--
-- (admin_grant_credits was also fixed to insert the ledger row BEFORE the
-- balance changes — see 20260630200000 — so the matching row exists by the time
-- this trigger runs.)
CREATE OR REPLACE FUNCTION public.audit_credits_balance_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  delta integer;
  v_match_count integer;
BEGIN
  delta := NEW.credits_balance - OLD.credits_balance;

  IF delta <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_match_count
  FROM public.credit_transactions
  WHERE user_id = NEW.id
    AND amount = delta
    AND amount > 0
    AND created_at >= (now() - interval '2 minutes')
    AND transaction_type IN (
      'welcome_bonus','purchase','refund','referral_bonus',
      'system_grant','admin_grant','grant','bonus','promo','reward'
    );

  IF v_match_count = 0 THEN
    INSERT INTO public.credit_transactions (user_id, amount, transaction_type, description, balance_after)
    VALUES (
      NEW.id,
      delta,
      'untracked_increase',
      'SECURITY ALERT: credits_balance increased by ' || delta || ' without a matching transaction. Possible exploit attempt.',
      NEW.credits_balance
    );
  END IF;

  RETURN NEW;
END;
$function$;
