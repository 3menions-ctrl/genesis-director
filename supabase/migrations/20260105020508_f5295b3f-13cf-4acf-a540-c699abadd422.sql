-- Update credit packages to new high-profit tiers
UPDATE credit_packages SET is_active = false;

INSERT INTO credit_packages (name, credits, price_cents, is_active, is_popular)
VALUES 
  ('Starter', 250, 2900, true, false),
  ('Growth', 1000, 9900, true, true),
  ('Agency', 3000, 24900, true, false);

-- Create table to track real-world API costs for profit analysis
CREATE TABLE IF NOT EXISTS api_cost_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID REFERENCES public.profiles(id),
  project_id UUID REFERENCES public.movie_projects(id),
  shot_id TEXT,
  service TEXT NOT NULL, -- 'replicate', 'elevenlabs', 'openai'
  operation TEXT NOT NULL, -- 'video_generation', 'voice_generation', 'script_generation'
  credits_charged INTEGER NOT NULL DEFAULT 0,
  real_cost_cents INTEGER NOT NULL DEFAULT 0, -- Actual API cost in cents
  duration_seconds INTEGER,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'refunded'
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE api_cost_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view all cost logs (we'll create a service role function for this)
CREATE POLICY "Users can view own cost logs"
ON api_cost_logs
FOR SELECT
USING (auth.uid() = user_id);

-- Create production_credit_phases table for two-phase billing
CREATE TABLE IF NOT EXISTS production_credit_phases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  project_id UUID REFERENCES public.movie_projects(id),
  shot_id TEXT NOT NULL,
  phase TEXT NOT NULL, -- 'pre_production', 'production'
  credits_amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'charged', -- 'charged', 'refunded'
  refund_reason TEXT,
  api_cost_log_id UUID REFERENCES api_cost_logs(id)
);

-- Enable RLS
ALTER TABLE production_credit_phases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credit phases"
ON production_credit_phases
FOR SELECT
USING (auth.uid() = user_id);

-- Update pricing_config with new Iron-Clad pricing (25 credits per 4-sec clip)
UPDATE pricing_config SET is_active = false WHERE clip_duration_seconds != 4;

INSERT INTO pricing_config (clip_duration_seconds, credits_cost, description, is_active)
VALUES (4, 25, 'Iron-Clad 4-second clip (5 pre-prod + 20 production)', true)
ON CONFLICT DO NOTHING;

-- Create function to charge pre-production credits (5 credits)
CREATE OR REPLACE FUNCTION charge_preproduction_credits(
  p_user_id UUID,
  p_project_id UUID,
  p_shot_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_balance INTEGER;
  pre_prod_credits INTEGER := 5;
  result JSONB;
BEGIN
  -- Get current balance with lock
  SELECT credits_balance INTO current_balance
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;
  
  -- Check if enough credits
  IF current_balance < pre_prod_credits THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient credits',
      'required', pre_prod_credits,
      'available', current_balance
    );
  END IF;
  
  -- Deduct credits
  UPDATE profiles
  SET 
    credits_balance = credits_balance - pre_prod_credits,
    total_credits_used = total_credits_used + pre_prod_credits,
    updated_at = now()
  WHERE id = p_user_id;
  
  -- Record the phase
  INSERT INTO production_credit_phases (user_id, project_id, shot_id, phase, credits_amount, status)
  VALUES (p_user_id, p_project_id, p_shot_id, 'pre_production', pre_prod_credits, 'charged');
  
  -- Record transaction
  INSERT INTO credit_transactions (user_id, amount, transaction_type, description, project_id)
  VALUES (p_user_id, -pre_prod_credits, 'usage', 'Pre-production: Script & Image Gen for shot ' || p_shot_id, p_project_id);
  
  RETURN jsonb_build_object(
    'success', true,
    'credits_charged', pre_prod_credits,
    'remaining_balance', current_balance - pre_prod_credits
  );
END;
$$;

-- Create function to charge production credits (20 credits)
CREATE OR REPLACE FUNCTION charge_production_credits(
  p_user_id UUID,
  p_project_id UUID,
  p_shot_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_balance INTEGER;
  production_credits INTEGER := 20;
  result JSONB;
BEGIN
  -- Get current balance with lock
  SELECT credits_balance INTO current_balance
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;
  
  -- Check if enough credits
  IF current_balance < production_credits THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient credits',
      'required', production_credits,
      'available', current_balance
    );
  END IF;
  
  -- Deduct credits
  UPDATE profiles
  SET 
    credits_balance = credits_balance - production_credits,
    total_credits_used = total_credits_used + production_credits,
    updated_at = now()
  WHERE id = p_user_id;
  
  -- Record the phase
  INSERT INTO production_credit_phases (user_id, project_id, shot_id, phase, credits_amount, status)
  VALUES (p_user_id, p_project_id, p_shot_id, 'production', production_credits, 'charged');
  
  -- Record transaction
  INSERT INTO credit_transactions (user_id, amount, transaction_type, description, project_id)
  VALUES (p_user_id, -production_credits, 'usage', 'Production: Video & Voice Gen for shot ' || p_shot_id, p_project_id);
  
  RETURN jsonb_build_object(
    'success', true,
    'credits_charged', production_credits,
    'remaining_balance', current_balance - production_credits
  );
END;
$$;

-- Create function to refund production credits on failure
CREATE OR REPLACE FUNCTION refund_production_credits(
  p_user_id UUID,
  p_project_id UUID,
  p_shot_id TEXT,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  total_refund INTEGER := 0;
  phase_record RECORD;
BEGIN
  -- Find all charged phases for this shot
  FOR phase_record IN 
    SELECT id, credits_amount, phase 
    FROM production_credit_phases 
    WHERE user_id = p_user_id 
      AND shot_id = p_shot_id 
      AND status = 'charged'
  LOOP
    total_refund := total_refund + phase_record.credits_amount;
    
    -- Mark as refunded
    UPDATE production_credit_phases
    SET status = 'refunded', refund_reason = p_reason
    WHERE id = phase_record.id;
  END LOOP;
  
  IF total_refund > 0 THEN
    -- Restore credits
    UPDATE profiles
    SET 
      credits_balance = credits_balance + total_refund,
      total_credits_used = total_credits_used - total_refund,
      updated_at = now()
    WHERE id = p_user_id;
    
    -- Record refund transaction
    INSERT INTO credit_transactions (user_id, amount, transaction_type, description, project_id)
    VALUES (p_user_id, total_refund, 'refund', 'Refund for shot ' || p_shot_id || ': ' || p_reason, p_project_id);
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'credits_refunded', total_refund
  );
END;
$$;

-- Create function to log API costs (for profit tracking)
CREATE OR REPLACE FUNCTION log_api_cost(
  p_user_id UUID,
  p_project_id UUID,
  p_shot_id TEXT,
  p_service TEXT,
  p_operation TEXT,
  p_credits_charged INTEGER,
  p_real_cost_cents INTEGER,
  p_duration_seconds INTEGER DEFAULT NULL,
  p_status TEXT DEFAULT 'completed',
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO api_cost_logs (
    user_id, project_id, shot_id, service, operation, 
    credits_charged, real_cost_cents, duration_seconds, status, metadata
  )
  VALUES (
    p_user_id, p_project_id, p_shot_id, p_service, p_operation,
    p_credits_charged, p_real_cost_cents, p_duration_seconds, p_status, p_metadata
  )
  RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;

-- Create admin view for cost dashboard (profit tracking)
CREATE OR REPLACE VIEW admin_profit_dashboard AS
SELECT 
  DATE_TRUNC('day', created_at) as date,
  service,
  COUNT(*) as total_operations,
  SUM(credits_charged) as total_credits_charged,
  SUM(real_cost_cents) as total_real_cost_cents,
  -- Revenue calculation (assuming $29/250 credits = $0.116 per credit)
  ROUND(SUM(credits_charged) * 11.6) as estimated_revenue_cents,
  -- Profit margin
  CASE 
    WHEN SUM(real_cost_cents) > 0 THEN
      ROUND(((SUM(credits_charged) * 11.6) - SUM(real_cost_cents)) / (SUM(credits_charged) * 11.6) * 100, 1)
    ELSE 100
  END as profit_margin_percent
FROM api_cost_logs
WHERE status = 'completed'
GROUP BY DATE_TRUNC('day', created_at), service
ORDER BY date DESC, service;