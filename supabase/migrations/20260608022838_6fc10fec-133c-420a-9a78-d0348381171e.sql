
CREATE OR REPLACE FUNCTION public.admin_list_sessions(p_limit integer DEFAULT 200)
RETURNS TABLE (
  user_id uuid, email text, display_name text, account_tier text,
  last_sign_in_at timestamptz, created_at timestamptz, confirmed_at timestamptz,
  is_active_24h boolean, is_idle_24h boolean
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;
  RETURN QUERY
  SELECT u.id, u.email::text, p.display_name, p.account_tier,
    u.last_sign_in_at, u.created_at, u.confirmed_at,
    (u.last_sign_in_at >= now() - interval '24 hours'),
    (u.last_sign_in_at IS NOT NULL AND u.last_sign_in_at < now() - interval '24 hours')
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.last_sign_in_at IS NOT NULL
  ORDER BY u.last_sign_in_at DESC NULLS LAST
  LIMIT p_limit;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_list_sessions(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_referrals(p_limit integer DEFAULT 200)
RETURNS TABLE (
  code_id uuid, code text, referrer_id uuid, referrer_email text,
  created_at timestamptz, total_redemptions bigint,
  credited_redemptions bigint, pending_redemptions bigint
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;
  RETURN QUERY
  SELECT rc.id, rc.code, rc.user_id, p.email, rc.created_at,
    COALESCE(COUNT(rr.id), 0)::bigint,
    COALESCE(SUM(CASE WHEN rr.referrer_credited THEN 1 ELSE 0 END), 0)::bigint,
    COALESCE(SUM(CASE WHEN NOT rr.referrer_credited THEN 1 ELSE 0 END), 0)::bigint
  FROM public.referral_codes rc
  LEFT JOIN public.referral_redemptions rr ON rr.referral_code_id = rc.id
  LEFT JOIN public.profiles p ON p.id = rc.user_id
  GROUP BY rc.id, rc.code, rc.user_id, p.email, rc.created_at
  ORDER BY rc.created_at DESC
  LIMIT p_limit;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_list_referrals(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_onboarding_intents(p_limit integer DEFAULT 500)
RETURNS TABLE (
  id uuid, account_type text, selected_plan_id text, selected_plan_kind text,
  primary_use_case text, monthly_volume text, contact_email text,
  consumed_by_user_id uuid, consumed_at timestamptz, created_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;
  RETURN QUERY
  SELECT oi.id, oi.account_type, oi.selected_plan_id, oi.selected_plan_kind,
    oi.primary_use_case, oi.monthly_volume, oi.contact_email,
    oi.consumed_by_user_id, oi.consumed_at, oi.created_at
  FROM public.onboarding_intents oi
  ORDER BY oi.created_at DESC
  LIMIT p_limit;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_list_onboarding_intents(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_storage_overview()
RETURNS TABLE (
  bucket_id text, is_public boolean, file_size_limit bigint,
  object_count bigint, total_bytes bigint, latest_upload timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;
  RETURN QUERY
  SELECT b.id, b.public, b.file_size_limit,
    COALESCE(COUNT(o.id), 0)::bigint,
    COALESCE(SUM((o.metadata->>'size')::bigint), 0)::bigint,
    MAX(o.created_at)
  FROM storage.buckets b
  LEFT JOIN storage.objects o ON o.bucket_id = b.id
  GROUP BY b.id, b.public, b.file_size_limit
  ORDER BY 5 DESC NULLS LAST;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_storage_overview() TO authenticated;
