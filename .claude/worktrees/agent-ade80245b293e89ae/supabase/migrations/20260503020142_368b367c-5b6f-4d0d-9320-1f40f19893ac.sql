CREATE OR REPLACE FUNCTION public.admin_get_email_log(
  _email_filter text DEFAULT NULL,
  _limit int DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  message_id text,
  template_name text,
  recipient_email text,
  status text,
  error_message text,
  metadata jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  RETURN QUERY
  SELECT DISTINCT ON (l.message_id)
    l.id, l.message_id, l.template_name, l.recipient_email,
    l.status, l.error_message, l.metadata, l.created_at
  FROM public.email_send_log l
  WHERE l.message_id IS NOT NULL
    AND (
      _email_filter IS NULL
      OR _email_filter = ''
      OR l.recipient_email ILIKE '%' || _email_filter || '%'
    )
  ORDER BY l.message_id, l.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 500));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_email_log(text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_email_log(text, int) TO authenticated;