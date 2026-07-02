-- ─────────────────────────────────────────────────────────────────────────
-- FIX: unblock self-serve BUSINESS signup — allow account_type to change
--      DURING onboarding (immutable only AFTER onboarding completes).
--
-- BUG (HIGH severity, live in prod since 2026-06-26):
--   Self-serve business signup at /business/start is dead. Zero business
--   accounts have been created since the account_type hardening landed.
--
--   The flow is:
--     insert onboarding_intents(account_type='business')
--       → auth.signUp
--       → consume_onboarding_intent(token)   -- sets profiles.account_type='business'
--
--   Two things break it:
--     1. handle_new_user (auth→profile trigger) has NO account_type handling,
--        so EVERY new profile is born account_type='personal' (column default).
--        The intended business type only gets applied later, by
--        consume_onboarding_intent, via an UPDATE on profiles.
--     2. prevent_profile_privilege_escalation() (BEFORE UPDATE on profiles,
--        defined in 20260516221858 / rebased in 20260518184624) RAISES
--        'Forbidden: cannot modify account_type' UNCONDITIONALLY whenever
--        NEW.account_type IS DISTINCT FROM OLD.account_type — for every non
--        service-role / non-admin caller. consume_onboarding_intent is
--        SECURITY DEFINER but runs under the signing-up user's JWT
--        (auth.role() = 'authenticated'), so its UPDATE trips this guard and
--        the whole consume aborts.
--
--   Net: a business signup is born 'personal', and NOTHING can move it to
--   'business' → business onboarding can never complete.
--
-- FIX:
--   account_type is meant to be "immutable AFTER onboarding", not before —
--   the sibling guards already encode exactly this rule:
--     * consume_onboarding_intent's C1 guard only rejects a type change when
--       COALESCE(onboarding_completed,false) is true (20260704002000);
--     * sync_subscription_to_profile only pins account_type once
--       onboarding_completed is true (20260705020000).
--   prevent_profile_privilege_escalation() is the odd one out: it blocks the
--   change UNCONDITIONALLY. This migration brings it in line — an account_type
--   transition is permitted while OLD.onboarding_completed = false (i.e. the
--   pre-onboarding window consume_onboarding_intent operates in) and STILL
--   blocked once onboarding is complete.
--
-- SECURITY (unchanged): role, account_tier, credits_balance (ledger-checked)
--   and suspended_at remain fully locked for non-service-role callers, and
--   account_type remains immutable for any already-onboarded profile. The
--   only relaxation is the narrow, one-way pre-onboarding window that the
--   signup flow itself needs. consume_onboarding_intent keeps enforcing the
--   business-email block and email match, so this does not open a new
--   escalation path of substance.
--
-- Idempotent: CREATE OR REPLACE FUNCTION. Rebased on the latest repo
-- definition (20260518184624) so the ledger-aware credits_balance check is
-- preserved. The trigger binding is unchanged and not re-declared here.
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  ledger_total integer;
BEGIN
  -- Allow service-role / admins to change sensitive fields.
  IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Forbidden: cannot modify role';
  END IF;

  IF NEW.account_tier IS DISTINCT FROM OLD.account_tier THEN
    RAISE EXCEPTION 'Forbidden: cannot modify account_tier';
  END IF;

  -- account_type is immutable ONLY AFTER onboarding completes. During
  -- onboarding (OLD.onboarding_completed = false) the signup flow's
  -- consume_onboarding_intent must be able to set the chosen type
  -- (business/enterprise). Once onboarded, any change is an escalation.
  IF NEW.account_type IS DISTINCT FROM OLD.account_type
     AND COALESCE(OLD.onboarding_completed, false) THEN
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
