-- Bundle 1: Write-side RLS lockdown

-- 1. org_credit_refills — service role only
DROP POLICY IF EXISTS "org_credit_refills_service" ON public.org_credit_refills;
CREATE POLICY "org_credit_refills_service_only"
  ON public.org_credit_refills
  AS PERMISSIVE
  FOR ALL
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 2. subscriptions — service role only for writes; keep any existing read policies
DROP POLICY IF EXISTS "subscriptions_service_all" ON public.subscriptions;
CREATE POLICY "subscriptions_service_writes"
  ON public.subscriptions
  AS PERMISSIVE
  FOR ALL
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 3. onboarding_intents — keep public INSERT but tighten the WITH CHECK
DROP POLICY IF EXISTS "Anyone can create onboarding intent" ON public.onboarding_intents;
CREATE POLICY "Anyone can create onboarding intent"
  ON public.onboarding_intents
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (
    coalesce(length(btrim(coalesce((row_to_json(onboarding_intents.*)::jsonb ->> 'email'), ''))), 0) BETWEEN 5 AND 320
  );

-- 4. sales_inquiries — keep public INSERT but require non-empty email + message + length caps
DROP POLICY IF EXISTS "Anyone can submit a sales inquiry" ON public.sales_inquiries;
CREATE POLICY "Anyone can submit a sales inquiry"
  ON public.sales_inquiries
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (
    coalesce(length(btrim(coalesce((row_to_json(sales_inquiries.*)::jsonb ->> 'email'), ''))), 0) BETWEEN 5 AND 320
    AND coalesce(length(btrim(coalesce((row_to_json(sales_inquiries.*)::jsonb ->> 'message'), ''))), 0) BETWEEN 1 AND 5000
  );