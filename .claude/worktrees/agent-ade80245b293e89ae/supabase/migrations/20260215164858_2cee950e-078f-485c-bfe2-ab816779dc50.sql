
-- Add has_seen_welcome_offer column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS has_seen_welcome_offer boolean DEFAULT false;
