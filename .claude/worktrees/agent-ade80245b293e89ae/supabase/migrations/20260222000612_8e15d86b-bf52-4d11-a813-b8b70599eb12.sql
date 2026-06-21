-- Update stale credit RPCs to match Kling V3 pricing (50/75 per clip)
-- charge_preproduction_credits was hardcoded at 5 credits
-- charge_production_credits was hardcoded at 20 credits
-- These RPCs are used by legacy frontend hooks but should match current pricing

CREATE OR REPLACE FUNCTION public.charge_preproduction_credits(p_user_id uuid, p_project_id uuid, p_shot_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_balance INTEGER;
  pre_prod_credits INTEGER := 10; -- Updated: proportional to Kling V3 pricing
  result JSONB;
BEGIN
  SELECT credits_balance INTO current_balance
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;
  
  IF current_balance < pre_prod_credits THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient credits',
      'required', pre_prod_credits,
      'available', current_balance
    );
  END IF;
  
  UPDATE profiles
  SET 
    credits_balance = credits_balance - pre_prod_credits,
    total_credits_used = total_credits_used + pre_prod_credits,
    updated_at = now()
  WHERE id = p_user_id;
  
  INSERT INTO production_credit_phases (user_id, project_id, shot_id, phase, credits_amount, status)
  VALUES (p_user_id, p_project_id, p_shot_id, 'pre_production', pre_prod_credits, 'charged');
  
  INSERT INTO credit_transactions (user_id, amount, transaction_type, description, project_id)
  VALUES (p_user_id, -pre_prod_credits, 'usage', 'Pre-production: Script & Image Gen for shot ' || p_shot_id, p_project_id);
  
  RETURN jsonb_build_object(
    'success', true,
    'credits_charged', pre_prod_credits,
    'remaining_balance', current_balance - pre_prod_credits
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.charge_production_credits(p_user_id uuid, p_project_id uuid, p_shot_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_balance INTEGER;
  production_credits INTEGER := 40; -- Updated: proportional to Kling V3 pricing (total 50 = 10 pre + 40 prod)
  result JSONB;
BEGIN
  SELECT credits_balance INTO current_balance
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;
  
  IF current_balance < production_credits THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient credits',
      'required', production_credits,
      'available', current_balance
    );
  END IF;
  
  UPDATE profiles
  SET 
    credits_balance = credits_balance - production_credits,
    total_credits_used = total_credits_used + production_credits,
    updated_at = now()
  WHERE id = p_user_id;
  
  INSERT INTO production_credit_phases (user_id, project_id, shot_id, phase, credits_amount, status)
  VALUES (p_user_id, p_project_id, p_shot_id, 'production', production_credits, 'charged');
  
  INSERT INTO credit_transactions (user_id, amount, transaction_type, description, project_id)
  VALUES (p_user_id, -production_credits, 'usage', 'Production: Video & Voice Gen for shot ' || p_shot_id, p_project_id);
  
  RETURN jsonb_build_object(
    'success', true,
    'credits_charged', production_credits,
    'remaining_balance', current_balance - production_credits
  );
END;
$function$;