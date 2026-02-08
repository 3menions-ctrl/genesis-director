-- Create function to auto-follow admin for new users
CREATE OR REPLACE FUNCTION public.auto_follow_admin_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_user_id uuid := 'd600868d-651a-46f6-a621-a727b240ac7c';
BEGIN
  -- Don't make admin follow themselves
  IF NEW.id != admin_user_id THEN
    -- Insert follow relationship (new user follows admin)
    INSERT INTO public.user_follows (follower_id, following_id)
    VALUES (NEW.id, admin_user_id)
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on profiles table
DROP TRIGGER IF EXISTS trigger_auto_follow_admin ON public.profiles;
CREATE TRIGGER trigger_auto_follow_admin
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_follow_admin_on_signup();

-- Also make existing users who don't follow admin start following
INSERT INTO public.user_follows (follower_id, following_id)
SELECT p.id, 'd600868d-651a-46f6-a621-a727b240ac7c'::uuid
FROM public.profiles p
WHERE p.id != 'd600868d-651a-46f6-a621-a727b240ac7c'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_follows uf 
    WHERE uf.follower_id = p.id 
    AND uf.following_id = 'd600868d-651a-46f6-a621-a727b240ac7c'
  )
ON CONFLICT DO NOTHING;