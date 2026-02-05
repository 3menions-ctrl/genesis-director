-- Add deactivated_at column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN deactivated_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add deactivation_reason column for tracking
ALTER TABLE public.profiles 
ADD COLUMN deactivation_reason TEXT DEFAULT NULL;

-- Create index for querying active vs deactivated users
CREATE INDEX idx_profiles_deactivated_at ON public.profiles(deactivated_at);

-- Create function to deactivate account (sets deactivated_at)
CREATE OR REPLACE FUNCTION public.deactivate_account(p_reason TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Mark account as deactivated
  UPDATE profiles
  SET 
    deactivated_at = now(),
    deactivation_reason = p_reason,
    updated_at = now()
  WHERE id = v_user_id;
  
  RETURN FOUND;
END;
$$;

-- Create function to reactivate account
CREATE OR REPLACE FUNCTION public.reactivate_account()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Clear deactivation
  UPDATE profiles
  SET 
    deactivated_at = NULL,
    deactivation_reason = NULL,
    updated_at = now()
  WHERE id = v_user_id;
  
  RETURN FOUND;
END;
$$;