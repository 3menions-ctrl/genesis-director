-- Create a public view that excludes sensitive Stripe price IDs
CREATE VIEW public.credit_packages_public
WITH (security_invoker = on) AS
SELECT 
  id,
  name,
  credits,
  price_cents,
  is_active,
  is_popular,
  created_at
FROM public.credit_packages
WHERE is_active = true;

-- Add comment explaining the view's purpose
COMMENT ON VIEW public.credit_packages_public IS 'Public-safe view of credit packages that excludes Stripe price IDs';

-- Drop the existing permissive SELECT policy
DROP POLICY IF EXISTS "Anyone can view active packages" ON public.credit_packages;

-- Create a restrictive policy that only allows access via edge functions (service role)
-- Regular users must use the credit_packages_public view
CREATE POLICY "No direct public access to credit_packages"
  ON public.credit_packages
  FOR SELECT
  USING (false);

-- Allow admins to still see full table for management
CREATE POLICY "Admins can view all credit packages"
  ON public.credit_packages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );