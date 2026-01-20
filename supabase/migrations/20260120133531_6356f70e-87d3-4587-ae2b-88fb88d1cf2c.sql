-- Fix the handle_new_user trigger to give 60 credits (not 50)
-- This ensures consistency: 60 credits = 6 clips at 10 credits each

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, credits_balance)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1)),
    60 -- Free starter credits (6 clips × 10 credits per clip)
  );
  
  -- Record the bonus credits transaction
  INSERT INTO public.credit_transactions (user_id, amount, transaction_type, description)
  VALUES (NEW.id, 60, 'bonus', 'Welcome bonus - 6 free video clips');
  
  RETURN NEW;
END;
$$;