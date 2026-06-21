-- Allow admins to update & insert pricing_config
DROP POLICY IF EXISTS "Block all updates to pricing_config" ON public.pricing_config;
DROP POLICY IF EXISTS "Block all inserts to pricing_config" ON public.pricing_config;

CREATE POLICY "Admins can update pricing_config"
  ON public.pricing_config FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert pricing_config"
  ON public.pricing_config FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can view all pricing_config"
  ON public.pricing_config FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Allow admins to update & insert tier_limits
DROP POLICY IF EXISTS "Block all updates to tier_limits" ON public.tier_limits;
DROP POLICY IF EXISTS "Block all inserts to tier_limits" ON public.tier_limits;

CREATE POLICY "Admins can update tier_limits"
  ON public.tier_limits FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert tier_limits"
  ON public.tier_limits FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));
