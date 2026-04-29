-- 1) Update the new-user trigger to grant 10 welcome credits + log the transaction
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_welcome_credits INTEGER := 10;
BEGIN
  INSERT INTO public.profiles (id, email, display_name, credits_balance, total_credits_purchased)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    v_welcome_credits,
    0
  )
  ON CONFLICT (id) DO NOTHING;

  -- Log the welcome bonus so the audit trigger doesn't flag it as untracked
  INSERT INTO public.credit_transactions (user_id, amount, transaction_type, description)
  VALUES (NEW.id, v_welcome_credits, 'welcome_bonus', 'Welcome bonus: 10 free credits to try your first clip');

  RETURN NEW;
END;
$function$;

-- 2) Backfill: grant welcome credits to existing users who never received one and currently have 0 balance
DO $$
DECLARE
  v_user RECORD;
BEGIN
  FOR v_user IN
    SELECT p.id
    FROM public.profiles p
    WHERE COALESCE(p.credits_balance, 0) = 0
      AND NOT EXISTS (
        SELECT 1 FROM public.credit_transactions ct
        WHERE ct.user_id = p.id
          AND ct.transaction_type = 'welcome_bonus'
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.credit_transactions ct
        WHERE ct.user_id = p.id
          AND ct.transaction_type IN ('purchase', 'admin_grant')
      )
  LOOP
    UPDATE public.profiles
    SET credits_balance = credits_balance + 10,
        updated_at = now()
    WHERE id = v_user.id;

    INSERT INTO public.credit_transactions (user_id, amount, transaction_type, description)
    VALUES (v_user.id, 10, 'welcome_bonus', 'Welcome bonus (backfill): 10 free credits to try your first clip');
  END LOOP;
END $$;