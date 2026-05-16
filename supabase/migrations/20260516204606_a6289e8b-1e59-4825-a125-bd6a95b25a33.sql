-- Admins can read every credit transaction (Finance / Treasury dashboards).
CREATE POLICY "Admins can view all credit transactions"
  ON public.credit_transactions
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Admins can read every API cost log row (Dashboard waste-ratio + Cost Analysis).
CREATE POLICY "Admins can view all api cost logs"
  ON public.api_cost_logs
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));