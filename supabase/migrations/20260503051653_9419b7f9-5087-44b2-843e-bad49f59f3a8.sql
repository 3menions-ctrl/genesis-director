
-- consume_org_credits: atomic, member-gated debit
CREATE OR REPLACE FUNCTION public.consume_org_credits(
  p_org_id uuid,
  p_amount integer,
  p_reason text DEFAULT 'generation',
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance integer;
  v_user_id uuid := auth.uid();
  v_is_member boolean;
BEGIN
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'amount_must_be_positive');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM organization_members
    WHERE organization_id = p_org_id AND user_id = v_user_id
  ) INTO v_is_member;

  IF NOT v_is_member THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_a_member');
  END IF;

  UPDATE organizations
  SET credits_balance = credits_balance - p_amount,
      total_credits_used = total_credits_used + p_amount,
      updated_at = now()
  WHERE id = p_org_id
    AND credits_balance >= p_amount
  RETURNING credits_balance INTO v_balance;

  IF v_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_credits');
  END IF;

  BEGIN
    INSERT INTO credit_transactions (user_id, amount, transaction_type, description, metadata)
    VALUES (
      v_user_id, -p_amount, 'consumption',
      COALESCE(p_reason, 'org_generation'),
      p_metadata || jsonb_build_object('organization_id', p_org_id, 'org_consumption', true)
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('success', true, 'balance', v_balance);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_org_credits(uuid, integer, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_org_credits(uuid, integer, text, jsonb) TO authenticated;

-- topup_org_credits: service-role only
CREATE OR REPLACE FUNCTION public.topup_org_credits(
  p_org_id uuid,
  p_amount integer,
  p_source text DEFAULT 'purchase',
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_balance integer;
BEGIN
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'amount_must_be_positive');
  END IF;
  UPDATE organizations
  SET credits_balance = credits_balance + p_amount,
      total_credits_purchased = total_credits_purchased + p_amount,
      updated_at = now()
  WHERE id = p_org_id
  RETURNING credits_balance INTO v_balance;
  IF v_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'org_not_found');
  END IF;
  RETURN jsonb_build_object('success', true, 'balance', v_balance);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.topup_org_credits(uuid, integer, text, jsonb) FROM PUBLIC, anon, authenticated;

-- Member joined trigger
CREATE OR REPLACE FUNCTION public.notify_org_member_joined()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_name text;
  v_member_name text;
BEGIN
  SELECT name INTO v_org_name FROM organizations WHERE id = NEW.organization_id;
  SELECT COALESCE(display_name, full_name, email) INTO v_member_name FROM profiles WHERE id = NEW.user_id;

  IF NEW.invited_by IS NOT NULL AND NEW.invited_by <> NEW.user_id THEN
    BEGIN
      INSERT INTO notifications (user_id, type, title, body, data)
      VALUES (
        NEW.invited_by, 'org_member_joined',
        'New member joined ' || COALESCE(v_org_name, 'your workspace'),
        COALESCE(v_member_name, 'A new member') || ' accepted your invite.',
        jsonb_build_object('link', '/workspace/team', 'organization_id', NEW.organization_id, 'member_id', NEW.user_id)
      );
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;

  BEGIN
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      NEW.user_id, 'org_welcome',
      'Welcome to ' || COALESCE(v_org_name, 'the workspace'),
      'You now have ' || NEW.role::text || ' access. Switch from the sidebar.',
      jsonb_build_object('link', '/workspace', 'organization_id', NEW.organization_id, 'role', NEW.role)
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_org_member_joined ON public.organization_members;
CREATE TRIGGER trg_notify_org_member_joined
AFTER INSERT ON public.organization_members
FOR EACH ROW EXECUTE FUNCTION public.notify_org_member_joined();

-- Role change trigger
CREATE OR REPLACE FUNCTION public.notify_org_role_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_org_name text;
BEGIN
  IF OLD.role = NEW.role THEN RETURN NEW; END IF;
  SELECT name INTO v_org_name FROM organizations WHERE id = NEW.organization_id;
  BEGIN
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      NEW.user_id, 'org_role_changed',
      'Your role changed in ' || COALESCE(v_org_name, 'the workspace'),
      'You are now a ' || NEW.role::text || '.',
      jsonb_build_object('link', '/workspace/team', 'organization_id', NEW.organization_id,
                         'old_role', OLD.role, 'new_role', NEW.role)
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_org_role_changed ON public.organization_members;
CREATE TRIGGER trg_notify_org_role_changed
AFTER UPDATE OF role ON public.organization_members
FOR EACH ROW EXECUTE FUNCTION public.notify_org_role_changed();

-- Low credits trigger (fires on threshold crossing)
CREATE OR REPLACE FUNCTION public.notify_org_credits_low()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_threshold integer;
  v_admin_id uuid;
BEGIN
  SELECT included_credits_monthly INTO v_threshold
  FROM org_plan_features WHERE plan = NEW.plan;
  v_threshold := COALESCE(v_threshold, 0) / 10;

  IF v_threshold <= 0 THEN RETURN NEW; END IF;
  IF NEW.credits_balance >= v_threshold THEN RETURN NEW; END IF;
  IF OLD.credits_balance < v_threshold THEN RETURN NEW; END IF;

  FOR v_admin_id IN
    SELECT user_id FROM organization_members
    WHERE organization_id = NEW.id AND role IN ('owner', 'admin')
  LOOP
    BEGIN
      INSERT INTO notifications (user_id, type, title, body, data)
      VALUES (
        v_admin_id, 'org_credits_low',
        'Low credits in ' || NEW.name,
        'Your workspace has ' || NEW.credits_balance || ' credits remaining. Top up to keep generating.',
        jsonb_build_object('link', '/workspace/billing', 'organization_id', NEW.id, 'balance', NEW.credits_balance)
      );
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_org_credits_low ON public.organizations;
CREATE TRIGGER trg_notify_org_credits_low
AFTER UPDATE OF credits_balance ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.notify_org_credits_low();
