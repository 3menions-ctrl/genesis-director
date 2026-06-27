-- HARDENING (defense-in-depth, NOT launch-blocking): reject non-http(s) URL
-- schemes when persisting profile social links.
--
-- The render side is already safe — Profile.tsx / ProfileDashboard.tsx wrap every
-- external link in safeHref() (src/lib/safeHref.ts), which blocks javascript:/
-- data:/vbscript: at render. So stored 'javascript:…' values cannot execute today.
-- (The readiness audit flagged the render as unsanitized — that was stale; origin
-- already applies safeHref.)
--
-- Still, update_profile_links previously validated only the key whitelist + length
-- and would PERSIST a 'javascript:…' string. This stops storing those in the first
-- place (so any future/other consumer that forgets safeHref isn't exposed):
-- accept only http(s) URLs; upgrade bare domains ("twitter.com/me") to https;
-- drop anything else (javascript:, data:, mailto:, file:, …).

CREATE OR REPLACE FUNCTION public.update_profile_links(p_links jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed text[] := ARRAY[
    'website','twitter','instagram','youtube','tiktok','github','linkedin','spotify','soundcloud'
  ];
  v_filtered jsonb := '{}'::jsonb;
  v_key text;
  v_val text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF jsonb_typeof(p_links) <> 'object' THEN RAISE EXCEPTION 'links_must_be_object'; END IF;

  FOR v_key, v_val IN SELECT * FROM jsonb_each_text(p_links) LOOP
    IF v_key = ANY(v_allowed) AND v_val IS NOT NULL AND length(v_val) > 0 AND length(v_val) <= 200 THEN
      -- Scheme validation: only http(s) is stored.
      IF v_val ~* '^https?://' THEN
        v_filtered := v_filtered || jsonb_build_object(v_key, v_val);
      ELSIF position(':' IN v_val) = 0 THEN
        -- Bare domain a user typed without a scheme → upgrade to https.
        v_filtered := v_filtered || jsonb_build_object(v_key, 'https://' || v_val);
      END IF;
      -- else: a non-http(s) scheme (javascript:, data:, mailto:, …) → dropped.
    END IF;
  END LOOP;

  UPDATE public.profiles SET
    external_links = v_filtered,
    updated_at = now()
  WHERE id = auth.uid();
  RETURN jsonb_build_object('success', true, 'links', v_filtered);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.update_profile_links(jsonb) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.update_profile_links(jsonb) TO authenticated;
