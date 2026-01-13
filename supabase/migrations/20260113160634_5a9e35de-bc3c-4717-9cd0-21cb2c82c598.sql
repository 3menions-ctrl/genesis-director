-- Update default credits balance to 60 (1 free video worth)
ALTER TABLE public.profiles 
ALTER COLUMN credits_balance SET DEFAULT 60;