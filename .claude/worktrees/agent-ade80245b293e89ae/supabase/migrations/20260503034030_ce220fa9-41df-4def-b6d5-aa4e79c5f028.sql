
-- Brand assets table
CREATE TABLE IF NOT EXISTS public.organization_brand_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('logo','reference','font','document','other')),
  name text NOT NULL,
  storage_path text NOT NULL,
  public_url text NOT NULL,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_brand_assets_org ON public.organization_brand_assets(organization_id);

ALTER TABLE public.organization_brand_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view org brand assets"
  ON public.organization_brand_assets FOR SELECT
  TO authenticated
  USING (public.has_org_permission(organization_id, auth.uid(), 'viewer'::org_role));

CREATE POLICY "Producers create org brand assets"
  ON public.organization_brand_assets FOR INSERT
  TO authenticated
  WITH CHECK (public.has_org_permission(organization_id, auth.uid(), 'producer'::org_role) AND uploaded_by = auth.uid());

CREATE POLICY "Producers update org brand assets"
  ON public.organization_brand_assets FOR UPDATE
  TO authenticated
  USING (public.has_org_permission(organization_id, auth.uid(), 'producer'::org_role));

CREATE POLICY "Admins delete org brand assets"
  ON public.organization_brand_assets FOR DELETE
  TO authenticated
  USING (public.has_org_permission(organization_id, auth.uid(), 'admin'::org_role));

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('brand-assets','brand-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Brand assets publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'brand-assets');

CREATE POLICY "Org members upload to their brand folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'brand-assets'
    AND public.has_org_permission(((storage.foldername(name))[1])::uuid, auth.uid(), 'producer'::org_role)
  );

CREATE POLICY "Org admins delete from their brand folder"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'brand-assets'
    AND public.has_org_permission(((storage.foldername(name))[1])::uuid, auth.uid(), 'admin'::org_role)
  );
