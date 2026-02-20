
-- Create a banned emails/accounts table for blocking users
CREATE TABLE IF NOT EXISTS public.banned_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  display_name text,
  user_id uuid, -- original user id for reference
  reason text,
  banned_by uuid,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.banned_accounts ENABLE ROW LEVEL SECURITY;

-- Only admins can read the banned list
CREATE POLICY "Admins can manage banned accounts"
ON public.banned_accounts
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Insert Fyre into the banned list
INSERT INTO public.banned_accounts (email, display_name, user_id, reason, banned_by)
VALUES (
  'fyrebella1@gmail.com',
  'Fyre',
  'a80a5a0e-41db-41ad-b745-54d655830ea5',
  'Unauthorized credit exploitation - exploited increment_credits RPC to gain 500 credits illegally',
  'd600868d-651a-46f6-a621-a727b240ac7c'
);

-- Create a function to check if an email is banned (used during signup hooks)
CREATE OR REPLACE FUNCTION public.is_email_banned(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.banned_accounts WHERE LOWER(email) = LOWER(p_email)
  )
$$;

-- Create a trigger function that blocks banned emails from creating profiles
CREATE OR REPLACE FUNCTION public.block_banned_signups()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_email_banned(NEW.email) THEN
    RAISE EXCEPTION 'Account banned: This email address has been banned from this platform.';
  END IF;
  RETURN NEW;
END;
$$;

-- Attach trigger to profiles table so banned users can't create a profile
DROP TRIGGER IF EXISTS trg_block_banned_signups ON public.profiles;
CREATE TRIGGER trg_block_banned_signups
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.block_banned_signups();
