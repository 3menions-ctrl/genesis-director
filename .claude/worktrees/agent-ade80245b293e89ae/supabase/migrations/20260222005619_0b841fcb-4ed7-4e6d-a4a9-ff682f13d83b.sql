
-- Admin function to manage credit packages (CRUD)
CREATE OR REPLACE FUNCTION public.admin_manage_credit_package(
  p_action text,
  p_package_id uuid DEFAULT NULL,
  p_name text DEFAULT NULL,
  p_credits integer DEFAULT NULL,
  p_price_cents integer DEFAULT NULL,
  p_is_active boolean DEFAULT true,
  p_is_popular boolean DEFAULT false,
  p_stripe_price_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result_id uuid;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  IF p_action = 'create' THEN
    INSERT INTO credit_packages (name, credits, price_cents, is_active, is_popular, stripe_price_id)
    VALUES (p_name, p_credits, p_price_cents, p_is_active, p_is_popular, p_stripe_price_id)
    RETURNING id INTO result_id;

    INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details)
    VALUES (auth.uid(), 'create_package', 'credit_package', result_id::text,
      jsonb_build_object('name', p_name, 'credits', p_credits, 'price_cents', p_price_cents));

    RETURN jsonb_build_object('success', true, 'id', result_id);

  ELSIF p_action = 'update' THEN
    IF p_package_id IS NULL THEN
      RAISE EXCEPTION 'package_id required for update';
    END IF;

    UPDATE credit_packages SET
      name = COALESCE(p_name, name),
      credits = COALESCE(p_credits, credits),
      price_cents = COALESCE(p_price_cents, price_cents),
      is_active = p_is_active,
      is_popular = p_is_popular,
      stripe_price_id = p_stripe_price_id
    WHERE id = p_package_id;

    INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details)
    VALUES (auth.uid(), 'update_package', 'credit_package', p_package_id::text,
      jsonb_build_object('name', p_name, 'credits', p_credits, 'price_cents', p_price_cents));

    RETURN jsonb_build_object('success', true);

  ELSIF p_action = 'delete' THEN
    IF p_package_id IS NULL THEN
      RAISE EXCEPTION 'package_id required for delete';
    END IF;

    DELETE FROM credit_packages WHERE id = p_package_id;

    INSERT INTO admin_audit_log (admin_id, action, target_type, target_id)
    VALUES (auth.uid(), 'delete_package', 'credit_package', p_package_id::text);

    RETURN jsonb_build_object('success', true);

  ELSE
    RAISE EXCEPTION 'Invalid action: %', p_action;
  END IF;
END;
$$;

-- Admin function for content moderation actions
CREATE OR REPLACE FUNCTION public.admin_moderate_content(
  p_project_id uuid,
  p_action text,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  IF p_action = 'approve' THEN
    UPDATE movie_projects SET moderation_status = 'approved' WHERE id = p_project_id;
  ELSIF p_action = 'hide' THEN
    UPDATE movie_projects SET is_public = false WHERE id = p_project_id;
  ELSIF p_action = 'delete' THEN
    DELETE FROM video_clips WHERE project_id = p_project_id;
    DELETE FROM movie_projects WHERE id = p_project_id;
  ELSE
    RAISE EXCEPTION 'Invalid action: %', p_action;
  END IF;

  INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (auth.uid(), 'moderate_' || p_action, 'project', p_project_id::text,
    jsonb_build_object('reason', p_reason));

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Add moderation_status column to movie_projects if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'movie_projects' AND column_name = 'moderation_status') THEN
    ALTER TABLE public.movie_projects ADD COLUMN moderation_status text DEFAULT 'unreviewed';
  END IF;
END $$;

-- System config table for persisted admin settings
CREATE TABLE IF NOT EXISTS public.system_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- Only admins can read/write system config
CREATE POLICY "Admins can read system_config"
ON public.system_config FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert system_config"
ON public.system_config FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update system_config"
ON public.system_config FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Seed default config values
INSERT INTO public.system_config (key, value) VALUES
  ('maintenance_mode', '{"enabled": false, "message": ""}'::jsonb),
  ('announcement_banner', '{"enabled": false, "message": "", "type": "info"}'::jsonb),
  ('feature_flags', '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;
