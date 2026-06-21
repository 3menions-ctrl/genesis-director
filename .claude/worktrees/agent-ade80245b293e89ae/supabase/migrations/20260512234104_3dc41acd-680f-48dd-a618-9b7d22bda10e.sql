
ALTER TABLE public.onboarding_override_audit
  ADD COLUMN IF NOT EXISTS reason text;

CREATE OR REPLACE FUNCTION public.set_org_onboarding_override(
  p_org uuid,
  p_step text,
  p_done boolean,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new jsonb;
  v_reason text;
BEGIN
  IF NOT public.fn_org_has_min_role(p_org, auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_step NOT IN ('team','brand','credits','project') THEN
    RAISE EXCEPTION 'invalid step: %', p_step;
  END IF;

  v_reason := NULLIF(btrim(COALESCE(p_reason, '')), '');

  IF p_done THEN
    IF v_reason IS NULL OR length(v_reason) < 3 THEN
      RAISE EXCEPTION 'reason required (min 3 chars) when marking step done';
    END IF;
    IF length(v_reason) > 280 THEN
      RAISE EXCEPTION 'reason too long (max 280 chars)';
    END IF;

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

  INSERT INTO public.onboarding_override_audit (org_id, actor_id, step, action, reason)
  VALUES (p_org, auth.uid(), p_step, CASE WHEN p_done THEN 'mark_done' ELSE 'undo' END, v_reason);

  RETURN COALESCE(v_new, '{}'::jsonb);
END
$$;
