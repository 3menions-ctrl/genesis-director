-- Going live: no free signup credits. New users start at 0 credits.
-- The only free generation path is the first 10s Wan video (free-tier-generate).
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
    0  -- no free starter credits
  );
  RETURN NEW;
END;
$$;
