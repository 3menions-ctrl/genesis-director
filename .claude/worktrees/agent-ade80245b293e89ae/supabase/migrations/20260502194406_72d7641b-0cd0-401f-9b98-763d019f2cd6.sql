-- Enterprise leads table
CREATE TABLE public.enterprise_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,

  -- Company profile
  company_name TEXT NOT NULL,
  company_size TEXT,
  industry TEXT,
  website TEXT,
  role TEXT,

  -- Use case & volume
  primary_use_case TEXT,
  expected_videos_per_month TEXT,
  target_launch_date DATE,

  -- Brand kit
  brand_logo_url TEXT,
  brand_color_primary TEXT,
  brand_color_secondary TEXT,
  brand_font TEXT,
  brand_notes TEXT,

  -- Security & compliance
  needs_sso BOOLEAN NOT NULL DEFAULT false,
  needs_dpa BOOLEAN NOT NULL DEFAULT false,
  data_residency TEXT,
  security_questionnaire_requested BOOLEAN NOT NULL DEFAULT false,
  nda_requested BOOLEAN NOT NULL DEFAULT false,

  status TEXT NOT NULL DEFAULT 'new',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_enterprise_leads_user_id ON public.enterprise_leads(user_id);
CREATE INDEX idx_enterprise_leads_status ON public.enterprise_leads(status);
CREATE INDEX idx_enterprise_leads_created_at ON public.enterprise_leads(created_at DESC);

ALTER TABLE public.enterprise_leads ENABLE ROW LEVEL SECURITY;

-- Users: insert their own lead
CREATE POLICY "Users can create their own enterprise lead"
ON public.enterprise_leads
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users: view their own lead
CREATE POLICY "Users can view their own enterprise lead"
ON public.enterprise_leads
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users: update their own lead (e.g., resume the flow)
CREATE POLICY "Users can update their own enterprise lead"
ON public.enterprise_leads
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Admins: full access
CREATE POLICY "Admins can view all enterprise leads"
ON public.enterprise_leads
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update all enterprise leads"
ON public.enterprise_leads
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete enterprise leads"
ON public.enterprise_leads
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- updated_at trigger
CREATE TRIGGER update_enterprise_leads_updated_at
BEFORE UPDATE ON public.enterprise_leads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for brand kit uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('enterprise-brand-kits', 'enterprise-brand-kits', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: users can read/write inside their own folder (named by user id)
CREATE POLICY "Brand kits are publicly readable"
ON storage.objects
FOR SELECT
USING (bucket_id = 'enterprise-brand-kits');

CREATE POLICY "Users can upload to their own brand kit folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'enterprise-brand-kits'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own brand kit files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'enterprise-brand-kits'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own brand kit files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'enterprise-brand-kits'
  AND auth.uid()::text = (storage.foldername(name))[1]
);