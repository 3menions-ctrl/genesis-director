
CREATE TABLE IF NOT EXISTS public.onboarding_override_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL,
  step text NOT NULL,
  action text NOT NULL CHECK (action IN ('mark_done','undo')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_override_audit_org_created
  ON public.onboarding_override_audit (org_id, created_at DESC);

ALTER TABLE public.onboarding_override_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org admins read override audit" ON public.onboarding_override_audit;
CREATE POLICY "org admins read override audit"
  ON public.onboarding_override_audit
  FOR SELECT
  TO authenticated
  USING (public.fn_org_has_min_role(org_id, auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.set_org_onboarding_override(
  p_org uuid,
  p_step text,
  p_done boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new jsonb;
BEGIN
  IF NOT public.fn_org_has_min_role(p_org, auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_step NOT IN ('team','brand','credits','project') THEN
    RAISE EXCEPTION 'invalid step: %', p_step;
  END IF;

  IF p_done THEN
    UPDATE public.organizations
       SET onboarding_overrides = COALESCE(onboarding_overrides, '{}'::jsonb)
                                  || jsonb_build_object(p_step, true),
           updated_at = now()
     WHERE id = p_org
     RETURNING onboarding_overrides INTO v_new;
  ELSE
    UPDATE public.organizations
       SET onboarding_overrides = COALESCE(onboarding_overrides, '{}'::jsonb) - p_step,
           updated_at = now()
     WHERE id = p_org
     RETURNING onboarding_overrides INTO v_new;
  END IF;

  INSERT INTO public.onboarding_override_audit (org_id, actor_id, step, action)
  VALUES (p_org, auth.uid(), p_step, CASE WHEN p_done THEN 'mark_done' ELSE 'undo' END);

  RETURN COALESCE(v_new, '{}'::jsonb);
END
$$;
