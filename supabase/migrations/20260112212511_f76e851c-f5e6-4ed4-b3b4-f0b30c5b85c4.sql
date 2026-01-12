-- 1. Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- 2. Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    granted_by UUID REFERENCES auth.users(id),
    granted_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Create has_role function (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 4. Create is_admin helper function
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::app_role)
$$;

-- 5. RLS policies for user_roles (only admins can manage)
CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete roles"
ON public.user_roles FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- 6. Create admin audit log table
CREATE TABLE public.admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES auth.users(id) NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    details JSONB DEFAULT '{}',
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit log"
ON public.admin_audit_log FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert audit log"
ON public.admin_audit_log FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

-- 7. Secure the get_admin_profit_dashboard function
CREATE OR REPLACE FUNCTION public.get_admin_profit_dashboard()
RETURNS TABLE(
    date TIMESTAMPTZ,
    service TEXT,
    total_operations BIGINT,
    total_credits_charged BIGINT,
    total_real_cost_cents BIGINT,
    estimated_revenue_cents BIGINT,
    profit_margin_percent NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is admin
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  RETURN QUERY
  SELECT 
    DATE_TRUNC('day', api_cost_logs.created_at) as date,
    api_cost_logs.service,
    COUNT(*)::BIGINT as total_operations,
    SUM(api_cost_logs.credits_charged)::BIGINT as total_credits_charged,
    SUM(api_cost_logs.real_cost_cents)::BIGINT as total_real_cost_cents,
    ROUND(SUM(api_cost_logs.credits_charged) * 11.6)::BIGINT as estimated_revenue_cents,
    CASE 
      WHEN SUM(api_cost_logs.real_cost_cents) > 0 THEN
        ROUND(((SUM(api_cost_logs.credits_charged) * 11.6) - SUM(api_cost_logs.real_cost_cents)) / (SUM(api_cost_logs.credits_charged) * 11.6) * 100, 1)
      ELSE 100::NUMERIC
    END as profit_margin_percent
  FROM api_cost_logs
  WHERE api_cost_logs.status = 'completed'
  GROUP BY DATE_TRUNC('day', api_cost_logs.created_at), api_cost_logs.service
  ORDER BY date DESC, api_cost_logs.service;
END;
$$;

-- 8. Create admin stats function
CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  -- Check if user is admin
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  SELECT jsonb_build_object(
    'total_users', (SELECT COUNT(*) FROM profiles),
    'users_today', (SELECT COUNT(*) FROM profiles WHERE created_at >= CURRENT_DATE),
    'total_projects', (SELECT COUNT(*) FROM movie_projects),
    'projects_today', (SELECT COUNT(*) FROM movie_projects WHERE created_at >= CURRENT_DATE),
    'total_credits_sold', (SELECT COALESCE(SUM(total_credits_purchased), 0) FROM profiles),
    'total_credits_used', (SELECT COALESCE(SUM(total_credits_used), 0) FROM profiles),
    'active_generations', (SELECT COUNT(*) FROM video_clips WHERE status = 'generating'),
    'completed_videos', (SELECT COUNT(*) FROM movie_projects WHERE video_url IS NOT NULL)
  ) INTO result;

  RETURN result;
END;
$$;

-- 9. Create function to list users for admin
CREATE OR REPLACE FUNCTION public.admin_list_users(
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  p_search TEXT DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  email TEXT,
  display_name TEXT,
  full_name TEXT,
  credits_balance INTEGER,
  total_credits_purchased INTEGER,
  total_credits_used INTEGER,
  account_tier TEXT,
  created_at TIMESTAMPTZ,
  project_count BIGINT,
  roles app_role[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is admin
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  RETURN QUERY
  SELECT 
    p.id,
    p.email,
    p.display_name,
    p.full_name,
    p.credits_balance,
    p.total_credits_purchased,
    p.total_credits_used,
    p.account_tier,
    p.created_at,
    (SELECT COUNT(*) FROM movie_projects mp WHERE mp.user_id = p.id) as project_count,
    ARRAY(SELECT ur.role FROM user_roles ur WHERE ur.user_id = p.id) as roles
  FROM profiles p
  WHERE (p_search IS NULL OR 
         p.email ILIKE '%' || p_search || '%' OR 
         p.display_name ILIKE '%' || p_search || '%' OR
         p.full_name ILIKE '%' || p_search || '%')
  ORDER BY p.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- 10. Create function to adjust user credits (admin only)
CREATE OR REPLACE FUNCTION public.admin_adjust_credits(
  p_target_user_id UUID,
  p_amount INTEGER,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_user_id UUID := auth.uid();
  new_balance INTEGER;
BEGIN
  -- Check if user is admin
  IF NOT public.is_admin(admin_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  -- Update credits
  UPDATE profiles
  SET 
    credits_balance = credits_balance + p_amount,
    updated_at = now()
  WHERE id = p_target_user_id
  RETURNING credits_balance INTO new_balance;

  -- Record transaction
  INSERT INTO credit_transactions (user_id, amount, transaction_type, description)
  VALUES (p_target_user_id, p_amount, 
    CASE WHEN p_amount >= 0 THEN 'admin_grant' ELSE 'admin_deduct' END,
    p_reason);

  -- Log admin action
  INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (admin_user_id, 'adjust_credits', 'user', p_target_user_id::TEXT,
    jsonb_build_object('amount', p_amount, 'reason', p_reason, 'new_balance', new_balance));

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', new_balance
  );
END;
$$;

-- 11. Create function to grant/revoke roles (admin only)
CREATE OR REPLACE FUNCTION public.admin_manage_role(
  p_target_user_id UUID,
  p_role app_role,
  p_action TEXT -- 'grant' or 'revoke'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_user_id UUID := auth.uid();
BEGIN
  -- Check if user is admin
  IF NOT public.is_admin(admin_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  IF p_action = 'grant' THEN
    INSERT INTO user_roles (user_id, role, granted_by)
    VALUES (p_target_user_id, p_role, admin_user_id)
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSIF p_action = 'revoke' THEN
    DELETE FROM user_roles WHERE user_id = p_target_user_id AND role = p_role;
  ELSE
    RAISE EXCEPTION 'Invalid action: must be grant or revoke';
  END IF;

  -- Log admin action
  INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (admin_user_id, p_action || '_role', 'user', p_target_user_id::TEXT,
    jsonb_build_object('role', p_role::TEXT));

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 12. Insert the first admin user (by email lookup)
INSERT INTO user_roles (user_id, role, granted_by)
SELECT p.id, 'admin'::app_role, p.id
FROM profiles p
WHERE p.email = '3menions@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;