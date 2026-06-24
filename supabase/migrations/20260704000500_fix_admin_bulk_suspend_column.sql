-- LOGIC FIX (admin): admin_bulk_suspend / admin_bulk_restore wrote to a column
-- named `suspended_reason`, but the real profiles column is `suspension_reason`
-- (added 20260503043837). Every call raised
--   42703 column "suspended_reason" does not exist
-- so the Users roster's bulk Suspend and Restore actions never worked. Redefine
-- both with the correct column name (bodies otherwise identical).

CREATE OR REPLACE FUNCTION public.admin_bulk_suspend(
  p_user_ids uuid[], p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_count int := 0;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF array_length(p_user_ids, 1) IS NULL OR array_length(p_user_ids, 1) > 200 THEN
    RAISE EXCEPTION 'p_user_ids must be 1-200 entries';
  END IF;

  -- Protect: never suspend an admin or yourself in bulk. Filter them out.
  FOREACH v_uid IN ARRAY p_user_ids LOOP
    CONTINUE WHEN v_uid = auth.uid();
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = v_uid AND role::text = 'admin'
    );
    UPDATE public.profiles
    SET suspended_at = now(),
        suspension_reason = COALESCE(p_reason, suspension_reason),
        updated_at = now()
    WHERE id = v_uid;
    v_count := v_count + 1;
  END LOOP;

  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (auth.uid(), 'bulk_suspend', 'user_set', 'bulk',
    jsonb_build_object('count', v_count, 'reason', p_reason));

  RETURN jsonb_build_object('success', true, 'count', v_count);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_bulk_suspend(uuid[], text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_bulk_suspend(uuid[], text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_bulk_restore(p_user_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF array_length(p_user_ids, 1) IS NULL OR array_length(p_user_ids, 1) > 500 THEN
    RAISE EXCEPTION 'p_user_ids must be 1-500 entries';
  END IF;

  WITH upd AS (
    UPDATE public.profiles
    SET suspended_at = NULL,
        suspension_reason = NULL,
        updated_at = now()
    WHERE id = ANY(p_user_ids)
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM upd;

  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (auth.uid(), 'bulk_restore', 'user_set', 'bulk',
    jsonb_build_object('count', v_count));

  RETURN jsonb_build_object('success', true, 'count', v_count);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_bulk_restore(uuid[]) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_bulk_restore(uuid[]) TO authenticated;
