-- Helper: notify every admin
CREATE OR REPLACE FUNCTION public.notify_admins(
  _type public.notification_type,
  _title text,
  _body text,
  _data jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, data)
  SELECT ur.user_id, _type, _title, _body, COALESCE(_data, '{}'::jsonb)
  FROM public.user_roles ur
  WHERE ur.role = 'admin';
END;
$$;

-- Trigger: credit purchase
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
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_admin_on_purchase ON public.credit_transactions;
CREATE TRIGGER notify_admin_on_purchase
AFTER INSERT ON public.credit_transactions
FOR EACH ROW
EXECUTE FUNCTION public.trg_notify_admin_purchase();

-- Trigger: support message
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
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_admin_on_support ON public.support_messages;
CREATE TRIGGER notify_admin_on_support
AFTER INSERT ON public.support_messages
FOR EACH ROW
EXECUTE FUNCTION public.trg_notify_admin_support();

-- Trigger: sales inquiry
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
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_admin_on_inquiry ON public.sales_inquiries;
CREATE TRIGGER notify_admin_on_inquiry
AFTER INSERT ON public.sales_inquiries
FOR EACH ROW
EXECUTE FUNCTION public.trg_notify_admin_inquiry();

REVOKE EXECUTE ON FUNCTION public.notify_admins(public.notification_type, text, text, jsonb) FROM PUBLIC, anon, authenticated;