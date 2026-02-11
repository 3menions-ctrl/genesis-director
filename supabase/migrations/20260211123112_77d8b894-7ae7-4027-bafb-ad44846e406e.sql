
-- Signup analytics table for geo tracking (admin-only)
CREATE TABLE public.signup_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ip_address text,
  country text,
  country_code text,
  region text,
  city text,
  timezone text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  referrer text,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.signup_analytics ENABLE ROW LEVEL SECURITY;

-- Only admins can view
CREATE POLICY "Only admins can view signup analytics"
  ON public.signup_analytics
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- Edge functions can insert (block client inserts)
CREATE POLICY "Block client inserts to signup analytics"
  ON public.signup_analytics
  FOR INSERT
  WITH CHECK (false);

-- No updates or deletes
CREATE POLICY "No updates to signup analytics"
  ON public.signup_analytics
  FOR UPDATE
  USING (false);

CREATE POLICY "No deletes from signup analytics"
  ON public.signup_analytics
  FOR DELETE
  USING (false);
