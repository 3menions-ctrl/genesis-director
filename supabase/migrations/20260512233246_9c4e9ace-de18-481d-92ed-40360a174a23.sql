ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS onboarding_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;

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

  RETURN COALESCE(v_new, '{}'::jsonb);
END
$$;

GRANT EXECUTE ON FUNCTION public.set_org_onboarding_override(uuid, text, boolean) TO authenticated;