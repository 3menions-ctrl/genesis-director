-- M20/D20: dispatch_admin_alert hardcoded a stale Supabase project ref
-- (ahlikyhgcqvrdvbtkghh) for the admin-alert-dispatch URL, so every admin
-- alert (signup, purchase, support, inquiry) POSTed to a dead project and
-- was swallowed. Point it at the live project ref.
CREATE OR REPLACE FUNCTION public.dispatch_admin_alert(_kind text, _event_id text, _data jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  fn_url text := 'https://ywcwaumozoejierlfkgj.supabase.co/functions/v1/admin-alert-dispatch';
BEGIN
  PERFORM net.http_post(
    url := fn_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'kind', _kind,
      'eventId', _event_id,
      'data', COALESCE(_data, '{}'::jsonb)
    )
  );
EXCEPTION WHEN OTHERS THEN
  -- never block the originating transaction
  RAISE WARNING 'dispatch_admin_alert(%) failed: %', _kind, SQLERRM;
END;
$function$;
