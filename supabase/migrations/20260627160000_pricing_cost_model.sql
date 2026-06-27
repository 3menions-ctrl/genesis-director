-- ─────────────────────────────────────────────────────────────────────────
-- pricing_cost_model — single-row JSON store for the admin Pricing/Economics
-- tab's editable cost inputs (every API + DB/infra cost). is_admin read/write.
-- The tab derives credit prices + margins from this; persisting it lets the
-- model survive sessions and (future) feed runtime pricing.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pricing_cost_model (
  id          boolean PRIMARY KEY DEFAULT true,
  model       jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES auth.users(id),
  CONSTRAINT pricing_cost_model_singleton CHECK (id = true)
);

ALTER TABLE public.pricing_cost_model ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin read cost model" ON public.pricing_cost_model;
CREATE POLICY "admin read cost model" ON public.pricing_cost_model
  FOR SELECT USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin write cost model" ON public.pricing_cost_model;
CREATE POLICY "admin write cost model" ON public.pricing_cost_model
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Admin-gated upsert (so the tab can save without RLS gymnastics).
CREATE OR REPLACE FUNCTION public.set_pricing_cost_model(p_model jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;
  INSERT INTO public.pricing_cost_model (id, model, updated_at, updated_by)
  VALUES (true, p_model, now(), auth.uid())
  ON CONFLICT (id) DO UPDATE SET model = excluded.model, updated_at = now(), updated_by = auth.uid();
  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_pricing_cost_model(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_pricing_cost_model(jsonb) TO authenticated, service_role;
