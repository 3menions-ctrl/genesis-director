-- Create profiles table for user data and credits
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  credits_balance INTEGER NOT NULL DEFAULT 50, -- Start with 50 free credits
  total_credits_purchased INTEGER NOT NULL DEFAULT 0,
  total_credits_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Create credit transactions table
CREATE TABLE public.credit_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, -- Positive for purchases, negative for usage
  transaction_type TEXT NOT NULL, -- 'purchase', 'usage', 'refund', 'bonus'
  description TEXT,
  stripe_payment_id TEXT,
  project_id UUID REFERENCES public.movie_projects(id) ON DELETE SET NULL,
  clip_duration_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- Users can view their own transactions
CREATE POLICY "Users can view own transactions" ON public.credit_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- Create credit packages table (for Stripe products)
CREATE TABLE public.credit_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  credits INTEGER NOT NULL,
  price_cents INTEGER NOT NULL, -- Price in cents
  stripe_price_id TEXT,
  is_popular BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS (public read)
ALTER TABLE public.credit_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active packages" ON public.credit_packages
  FOR SELECT USING (is_active = true);

-- Insert default credit packages with fair pricing
-- 1 credit = $0.10, so 100 credits = $10
INSERT INTO public.credit_packages (name, credits, price_cents, is_popular) VALUES
  ('Starter', 50, 499, false),      -- $4.99 for 50 credits (~16 clips)
  ('Creator', 150, 1299, true),     -- $12.99 for 150 credits (~50 clips) - best value
  ('Professional', 500, 3999, false), -- $39.99 for 500 credits (~166 clips)
  ('Studio', 1500, 9999, false);    -- $99.99 for 1500 credits (~500 clips)

-- Create pricing config table
CREATE TABLE public.pricing_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clip_duration_seconds INTEGER NOT NULL,
  credits_cost INTEGER NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS (public read)
ALTER TABLE public.pricing_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view pricing" ON public.pricing_config
  FOR SELECT USING (is_active = true);

-- Insert pricing tiers based on cost analysis
-- 5s clip: $0.25 API + $0.05 overhead = $0.30 + 10% = $0.33 ≈ 3 credits
-- 10s clip: $0.50 API + $0.10 overhead = $0.60 + 10% = $0.66 ≈ 7 credits
INSERT INTO public.pricing_config (clip_duration_seconds, credits_cost, description) VALUES
  (5, 3, '5 second video clip'),
  (10, 7, '10 second video clip');

-- Function to handle new user signup
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
    50 -- Free starter credits
  );
  
  -- Record the bonus credits transaction
  INSERT INTO public.credit_transactions (user_id, amount, transaction_type, description)
  VALUES (NEW.id, 50, 'bonus', 'Welcome bonus credits');
  
  RETURN NEW;
END;
$$;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to deduct credits
CREATE OR REPLACE FUNCTION public.deduct_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_description TEXT,
  p_project_id UUID DEFAULT NULL,
  p_clip_duration INTEGER DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  current_balance INTEGER;
BEGIN
  -- Get current balance with row lock
  SELECT credits_balance INTO current_balance
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;
  
  -- Check if enough credits
  IF current_balance < p_amount THEN
    RETURN FALSE;
  END IF;
  
  -- Deduct credits
  UPDATE profiles
  SET 
    credits_balance = credits_balance - p_amount,
    total_credits_used = total_credits_used + p_amount,
    updated_at = now()
  WHERE id = p_user_id;
  
  -- Record transaction
  INSERT INTO credit_transactions (user_id, amount, transaction_type, description, project_id, clip_duration_seconds)
  VALUES (p_user_id, -p_amount, 'usage', p_description, p_project_id, p_clip_duration);
  
  RETURN TRUE;
END;
$$;

-- Function to add credits (for purchases)
CREATE OR REPLACE FUNCTION public.add_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_stripe_payment_id TEXT,
  p_description TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Add credits
  UPDATE profiles
  SET 
    credits_balance = credits_balance + p_amount,
    total_credits_purchased = total_credits_purchased + p_amount,
    updated_at = now()
  WHERE id = p_user_id;
  
  -- Record transaction
  INSERT INTO credit_transactions (user_id, amount, transaction_type, description, stripe_payment_id)
  VALUES (p_user_id, p_amount, 'purchase', p_description, p_stripe_payment_id);
  
  RETURN TRUE;
END;
$$;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();