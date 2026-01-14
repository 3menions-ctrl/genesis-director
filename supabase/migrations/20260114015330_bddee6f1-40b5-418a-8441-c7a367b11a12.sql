-- Add admin bypass policies for cost analysis tables

-- api_cost_logs: Allow admins to view all records
CREATE POLICY "Admins can view all cost logs"
ON public.api_cost_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- video_clips: Allow admins to view all records
CREATE POLICY "Admins can view all video clips"
ON public.video_clips
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- credit_transactions: Allow admins to view all records
CREATE POLICY "Admins can view all transactions"
ON public.credit_transactions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);