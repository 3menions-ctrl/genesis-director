-- P1-20: business onboarding was fully blocked in production.
--
-- The "Anyone can create onboarding intent" INSERT policy on onboarding_intents
-- validated a column that does not exist — its WITH CHECK read
-- `row_to_json(onboarding_intents.*)->>'email'`, but the table only has
-- `contact_email` / `billing_email`. The JSON lookup returned NULL, so
-- `length(NULL)=0` failed `BETWEEN 5 AND 320` and EVERY insert was rejected —
-- no org could ever be provisioned and account_type never became 'business'.
--
-- Point the check at the real column (contact_email), the value BusinessStart
-- actually writes. Idempotent: ALTER POLICY only rewrites the CHECK expression,
-- preserving the policy's role/command. Verified applied to prod
-- (ywcwaumozoejierlfkgj) via the Management API on 2026-07-01; this migration
-- keeps repo history in sync so a future reconcile can't reintroduce the bug.

ALTER POLICY "Anyone can create onboarding intent"
  ON public.onboarding_intents
  WITH CHECK (
    COALESCE(length(btrim(COALESCE(contact_email, ''))), 0) BETWEEN 5 AND 320
  );
