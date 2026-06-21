-- Sales inquiries (Enterprise / Business contact form)
CREATE TABLE IF NOT EXISTS public.sales_inquiries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NULL,
  full_name TEXT NOT NULL,
  work_email TEXT NOT NULL,
  company_name TEXT NOT NULL,
  company_size TEXT NULL,
  estimated_seats INT NULL,
  estimated_videos_per_month TEXT NULL,
  use_case TEXT NULL,
  message TEXT NULL,
  tier_interest TEXT NOT NULL DEFAULT 'enterprise', -- 'business' | 'enterprise'
  status TEXT NOT NULL DEFAULT 'new', -- 'new' | 'contacted' | 'qualified' | 'closed'
  source TEXT NULL, -- e.g. 'landing_pricing', 'onboarding', 'footer'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_inquiries_status ON public.sales_inquiries(status);
CREATE INDEX IF NOT EXISTS idx_sales_inquiries_created ON public.sales_inquiries(created_at DESC);

ALTER TABLE public.sales_inquiries ENABLE ROW LEVEL SECURITY;

-- Anyone (incl. anonymous visitors from the landing page) can submit an inquiry
CREATE POLICY "Anyone can submit a sales inquiry"
ON public.sales_inquiries
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Authenticated user can view their OWN submissions only
CREATE POLICY "Users can view their own inquiries"
ON public.sales_inquiries
FOR SELECT
TO authenticated
USING (user_id IS NOT NULL AND auth.uid() = user_id);

-- Admins can view everything (uses existing has_role pattern)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'has_role') THEN
    EXECUTE $POL$
      CREATE POLICY "Admins can view all inquiries"
      ON public.sales_inquiries
      FOR SELECT
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'))
    $POL$;
    EXECUTE $POL$
      CREATE POLICY "Admins can update inquiries"
      ON public.sales_inquiries
      FOR UPDATE
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'))
    $POL$;
  END IF;
END $$;

-- updated_at trigger (reuse existing function if present, else inline)
CREATE OR REPLACE FUNCTION public.touch_sales_inquiries_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sales_inquiries_updated_at ON public.sales_inquiries;
CREATE TRIGGER trg_sales_inquiries_updated_at
BEFORE UPDATE ON public.sales_inquiries
FOR EACH ROW EXECUTE FUNCTION public.touch_sales_inquiries_updated_at();

-- Account type stored on profiles for tier-aware UX (lightweight, no gating)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles') THEN
    BEGIN
      EXECUTE 'ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_type TEXT';
      EXECUTE $C$ALTER TABLE public.profiles ADD CONSTRAINT profiles_account_type_chk CHECK (account_type IS NULL OR account_type IN ('personal','business','enterprise'))$C$;
    EXCEPTION WHEN duplicate_object THEN
      -- constraint already exists; ignore
      NULL;
    END;
  END IF;
END $$;