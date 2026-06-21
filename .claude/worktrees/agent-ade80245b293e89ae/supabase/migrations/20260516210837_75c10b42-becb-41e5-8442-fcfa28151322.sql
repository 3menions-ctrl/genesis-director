-- Helper: fire an email alert via pg_net to admin-alert-dispatch
CREATE OR REPLACE FUNCTION public.dispatch_admin_alert(
  _kind text,
  _event_id text,
  _data jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  fn_url text := 'https://ahlikyhgcqvrdvbtkghh.supabase.co/functions/v1/admin-alert-dispatch';
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
$$;

REVOKE EXECUTE ON FUNCTION public.dispatch_admin_alert(text, text, jsonb) FROM PUBLIC, anon, authenticated;

-- Signup trigger (profiles INSERT)
CREATE OR REPLACE FUNCTION public.trg_notify_admin_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.notify_admins(
    'admin_signup'::public.notification_type,
    'New signup',
    COALESCE(NEW.email, 'A user') || ' just created an account',
    jsonb_build_object(
      'new_user_id', NEW.id,
      'email', NEW.email,
      'full_name', NEW.full_name,
      'href', '/admin/users'
    )
  );
  PERFORM public.dispatch_admin_alert('signup', NEW.id::text, jsonb_build_object(
    'email', NEW.email,
    'fullName', NEW.full_name,
    'userId', NEW.id,
    'signedUpAt', to_char(NEW.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'source', 'web'
  ));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_admin_on_signup ON public.profiles;
CREATE TRIGGER notify_admin_on_signup
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.trg_notify_admin_signup();

-- Extend purchase trigger to also email
CREATE OR REPLACE FUNCTION public.trg_notify_admin_purchase()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  buyer_email text;
BEGIN
  IF NEW.transaction_type <> 'purchase' THEN
    RETURN NEW;
  END IF;

  SELECT email INTO buyer_email FROM public.profiles WHERE id = NEW.user_id;

  PERFORM public.notify_admins(
    'admin_purchase'::public.notification_type,
    'New credit purchase',
    COALESCE(buyer_email, 'A user') || ' bought ' || NEW.amount || ' credits ($' || to_char((NEW.amount * 0.10)::numeric, 'FM999990.00') || ')',
    jsonb_build_object(
      'buyer_user_id', NEW.user_id,
      'buyer_email', buyer_email,
      'credits', NEW.amount,
      'usd', NEW.amount * 0.10,
      'stripe_payment_id', NEW.stripe_payment_id,
      'transaction_id', NEW.id,
      'href', '/admin/finance'
    )
  );

  PERFORM public.dispatch_admin_alert('purchase', NEW.id::text, jsonb_build_object(
    'buyerEmail', buyer_email,
    'buyerUserId', NEW.user_id,
    'credits', NEW.amount,
    'usd', NEW.amount * 0.10,
    'stripePaymentId', NEW.stripe_payment_id,
    'purchasedAt', to_char(NEW.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  ));

  RETURN NEW;
END;
$$;

-- Extend support trigger to also email (reuse admin_contact_message template)
CREATE OR REPLACE FUNCTION public.trg_notify_admin_support()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.notify_admins(
    'admin_support_message'::public.notification_type,
    'New support message',
    NEW.name || ' (' || NEW.email || '): ' || NEW.subject,
    jsonb_build_object(
      'support_message_id', NEW.id,
      'email', NEW.email,
      'name', NEW.name,
      'subject', NEW.subject,
      'source', NEW.source,
      'href', '/admin/messages'
    )
  );

  PERFORM public.dispatch_admin_alert('support', NEW.id::text, jsonb_build_object(
    'fromName', NEW.name,
    'fromEmail', NEW.email,
    'subject', NEW.subject,
    'message', NEW.message,
    'source', NEW.source,
    'userId', NEW.user_id,
    'submittedAt', to_char(NEW.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  ));

  RETURN NEW;
END;
$$;

-- Extend inquiry trigger to also email
CREATE OR REPLACE FUNCTION public.trg_notify_admin_inquiry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.notify_admins(
    'admin_inquiry'::public.notification_type,
    'New sales inquiry',
    NEW.full_name || ' from ' || NEW.company_name || ' (' || NEW.work_email || ')',
    jsonb_build_object(
      'inquiry_id', NEW.id,
      'email', NEW.work_email,
      'company', NEW.company_name,
      'tier', NEW.tier_interest,
      'href', '/admin/messages'
    )
  );

  PERFORM public.dispatch_admin_alert('inquiry', NEW.id::text, jsonb_build_object(
    'fullName', NEW.full_name,
    'workEmail', NEW.work_email,
    'companyName', NEW.company_name,
    'companySize', NEW.company_size,
    'estimatedSeats', NEW.estimated_seats,
    'estimatedVideosPerMonth', NEW.estimated_videos_per_month,
    'tierInterest', NEW.tier_interest,
    'useCase', NEW.use_case,
    'message', NEW.message,
    'submittedAt', to_char(NEW.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'inquiryId', NEW.id
  ));

  RETURN NEW;
END;
$$;