-- Remove the legacy 60 free credits default from profiles table
-- New users are already set to 0 by the handle_new_user trigger,
-- but the column default was never updated to match.
ALTER TABLE public.profiles 
ALTER COLUMN credits_balance SET DEFAULT 0;