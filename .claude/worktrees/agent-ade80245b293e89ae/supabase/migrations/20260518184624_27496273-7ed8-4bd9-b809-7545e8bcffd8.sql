
-- Allow the ledger-sync trigger to update credits_balance for any user,
-- while still blocking arbitrary tampering. The new balance must equal the
-- authoritative ledger total computed from credit_transactions.
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  ledger_total integer;
BEGIN
  -- Allow service-role / admins to change sensitive fields
  IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Forbidden: cannot modify role';
  END IF;
  IF NEW.account_tier IS DISTINCT FROM OLD.account_tier THEN
    RAISE EXCEPTION 'Forbidden: cannot modify account_tier';
  END IF;
  IF NEW.account_type IS DISTINCT FROM OLD.account_type THEN
    RAISE EXCEPTION 'Forbidden: cannot modify account_type';
  END IF;

  IF NEW.credits_balance IS DISTINCT FROM OLD.credits_balance THEN
    -- Permit balance updates that reflect the authoritative ledger total.
    -- This is what sync_balance_from_ledger() does after every
    -- credit_transactions insert. Any other path is rejected.
    ledger_total := public.credit_ledger_total(NEW.id);
    IF NEW.credits_balance IS DISTINCT FROM ledger_total THEN
      RAISE EXCEPTION 'Forbidden: cannot modify credits_balance';
    END IF;
  END IF;

  IF NEW.suspended_at IS DISTINCT FROM OLD.suspended_at THEN
    RAISE EXCEPTION 'Forbidden: cannot modify suspended_at';
  END IF;

  RETURN NEW;
END;
$function$;

-- Grant 1000 credits to Frank via the ledger (single source of truth).
SELECT public.add_credits(
  '701b5313-fa0e-4caa-8d6a-53422dc0bf93'::uuid,
  1000,
  'Manual admin grant (support)',
  'manual_grant_' || gen_random_uuid()::text
);
