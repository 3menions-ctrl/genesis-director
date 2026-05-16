CREATE OR REPLACE FUNCTION public.notify_admins_v2(
  p_type notification_type, p_title text, p_body text, p_data jsonb,
  p_severity text DEFAULT 'info', p_dedupe_key text DEFAULT NULL,
  p_dedupe_window_seconds integer DEFAULT 600
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  admin_user record;
  existing_count int;
  v_inserted_any boolean := false;
  v_kind text;
  v_payload jsonb;
BEGIN
  FOR admin_user IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    IF p_dedupe_key IS NOT NULL THEN
      SELECT count(*) INTO existing_count
      FROM public.notifications
      WHERE user_id = admin_user.user_id
        AND dedupe_key = p_dedupe_key
        AND created_at > now() - (p_dedupe_window_seconds || ' seconds')::interval;
      IF existing_count > 0 THEN CONTINUE; END IF;
    END IF;

    INSERT INTO public.notifications (user_id, type, title, body, data, severity, dedupe_key)
    VALUES (admin_user.user_id, p_type, p_title, p_body, p_data, p_severity, p_dedupe_key);
    v_inserted_any := true;
  END LOOP;

  -- Forward to email/Slack/Discord dispatcher (once per event, not per admin)
  IF v_inserted_any THEN
    v_kind := regexp_replace(p_type::text, '^admin_', '');
    v_payload := COALESCE(p_data, '{}'::jsonb)
      || jsonb_build_object('title', p_title, 'body', p_body, 'severity', p_severity);
    PERFORM public.dispatch_admin_alert(v_kind, COALESCE(p_dedupe_key, gen_random_uuid()::text), v_payload);
  END IF;
END;
$function$;