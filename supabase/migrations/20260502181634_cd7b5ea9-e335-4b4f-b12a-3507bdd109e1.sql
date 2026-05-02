ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS brand_primary_color TEXT,
  ADD COLUMN IF NOT EXISTS brand_accent_color TEXT,
  ADD COLUMN IF NOT EXISTS team_size TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false;