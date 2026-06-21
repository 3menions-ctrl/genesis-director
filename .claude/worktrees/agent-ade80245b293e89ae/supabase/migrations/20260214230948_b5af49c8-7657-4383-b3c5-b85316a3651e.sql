
-- Update charge_preproduction_credits to accept dynamic credit amount
CREATE OR REPLACE FUNCTION public.charge_preproduction_credits(p_project_id uuid, p_shot_id text, p_credits_amount integer DEFAULT 2)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  current_balance INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT credits_balance INTO current_balance
  FROM profiles
  WHERE id = v_user_id
  FOR UPDATE;
  
  IF current_balance < p_credits_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient credits',
      'required', p_credits_amount,
      'available', current_balance
    );
  END IF;
  
  UPDATE profiles
  SET 
    credits_balance = credits_balance - p_credits_amount,
    total_credits_used = total_credits_used + p_credits_amount,
    updated_at = now()
  WHERE id = v_user_id;
  
  INSERT INTO production_credit_phases (user_id, project_id, shot_id, phase, credits_amount, status)
  VALUES (v_user_id, p_project_id, p_shot_id, 'pre_production', p_credits_amount, 'charged');
  
  INSERT INTO credit_transactions (user_id, amount, transaction_type, description, project_id)
  VALUES (v_user_id, -p_credits_amount, 'usage', 'Pre-production: Script & Image Gen for shot ' || p_shot_id, p_project_id);
  
  RETURN jsonb_build_object(
    'success', true,
    'credits_charged', p_credits_amount,
    'remaining_balance', current_balance - p_credits_amount
  );
END;
$function$;

-- Update charge_production_credits to accept dynamic credit amount
CREATE OR REPLACE FUNCTION public.charge_production_credits(p_project_id uuid, p_shot_id text, p_credits_amount integer DEFAULT 6)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  current_balance INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT credits_balance INTO current_balance
  FROM profiles
  WHERE id = v_user_id
  FOR UPDATE;
  
  IF current_balance < p_credits_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient credits',
      'required', p_credits_amount,
      'available', current_balance
    );
  END IF;
  
  UPDATE profiles
  SET 
    credits_balance = credits_balance - p_credits_amount,
    total_credits_used = total_credits_used + p_credits_amount,
    updated_at = now()
  WHERE id = v_user_id;
  
  INSERT INTO production_credit_phases (user_id, project_id, shot_id, phase, credits_amount, status)
  VALUES (v_user_id, p_project_id, p_shot_id, 'production', p_credits_amount, 'charged');
  
  INSERT INTO credit_transactions (user_id, amount, transaction_type, description, project_id)
  VALUES (v_user_id, -p_credits_amount, 'usage', 'Production: Video & Voice Gen for shot ' || p_shot_id, p_project_id);
  
  RETURN jsonb_build_object(
    'success', true,
    'credits_charged', p_credits_amount,
    'remaining_balance', current_balance - p_credits_amount
  );
END;
$function$;
