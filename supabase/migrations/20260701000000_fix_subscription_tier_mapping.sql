-- Fix: paying for a subscription now actually provisions the account tier.
--
-- The live Polar checkout stores subscriptions.price_id as the plan lookup key
-- ('sub_creator_monthly' | 'sub_pro_monthly' | 'sub_studio_monthly'), but the
-- sync trigger only recognized legacy keys ('starter_monthly', 'pro_monthly',
-- 'growth_monthly', …) — so a real subscription never set profiles.account_tier
-- and the customer paid without being provisioned.
--
-- This re-maps the trigger to the real keys (Indie→pro, Pro→growth, Studio→
-- agency — the three valid escalating tiers under the profiles.account_tier
-- CHECK constraint of free|pro|growth|agency) and backfills any currently
-- active subscription that the old trigger missed. Credit grants (220/600/2000)
-- are unaffected — those are already granted correctly via the Polar order.paid
-- webhook from the checkout metadata.

CREATE OR REPLACE FUNCTION public.sync_subscription_to_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_active boolean;
  v_type text;
  v_tier text;
BEGIN
  v_active := NEW.status IN ('active','trialing','past_due')
              AND (NEW.current_period_end IS NULL OR NEW.current_period_end > now());

  -- price_id → account_type
  v_type := CASE NEW.price_id
    -- live Polar personal subscription tiers (Indie / Pro / Studio)
    WHEN 'sub_creator_monthly' THEN 'personal'
    WHEN 'sub_creator_yearly'  THEN 'personal'
    WHEN 'sub_pro_monthly'     THEN 'personal'
    WHEN 'sub_pro_yearly'      THEN 'personal'
    WHEN 'sub_studio_monthly'  THEN 'personal'
    WHEN 'sub_studio_yearly'   THEN 'personal'
    -- legacy keys (kept for back-compat)
    WHEN 'starter_monthly'     THEN 'personal'
    WHEN 'pro_monthly'         THEN 'personal'
    WHEN 'pro_yearly'          THEN 'personal'
    WHEN 'growth_monthly'      THEN 'business'
    WHEN 'growth_yearly'       THEN 'business'
    WHEN 'scale_monthly'       THEN 'business'
    WHEN 'scale_yearly'        THEN 'business'
    WHEN 'enterprise_monthly'  THEN 'business'
    WHEN 'enterprise_yearly'   THEN 'business'
    ELSE NULL
  END;

  -- price_id → account_tier (must be one of free|pro|growth|agency)
  v_tier := CASE NEW.price_id
    WHEN 'sub_creator_monthly' THEN 'pro'
    WHEN 'sub_creator_yearly'  THEN 'pro'
    WHEN 'sub_pro_monthly'     THEN 'growth'
    WHEN 'sub_pro_yearly'      THEN 'growth'
    WHEN 'sub_studio_monthly'  THEN 'agency'
    WHEN 'sub_studio_yearly'   THEN 'agency'
    WHEN 'starter_monthly'     THEN 'free'
    WHEN 'pro_monthly'         THEN 'pro'
    WHEN 'pro_yearly'          THEN 'pro'
    WHEN 'growth_monthly'      THEN 'growth'
    WHEN 'growth_yearly'       THEN 'growth'
    WHEN 'scale_monthly'       THEN 'agency'
    WHEN 'scale_yearly'        THEN 'agency'
    WHEN 'enterprise_monthly'  THEN 'agency'
    WHEN 'enterprise_yearly'   THEN 'agency'
    ELSE NULL
  END;

  IF v_active AND v_type IS NOT NULL THEN
    UPDATE public.profiles
    SET account_type = v_type, account_tier = v_tier, updated_at = now()
    WHERE id = NEW.user_id;
  ELSIF NOT v_active THEN
    UPDATE public.profiles
    SET account_tier = 'free', updated_at = now()
    WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

-- One-time backfill for subscriptions the old trigger failed to provision.
UPDATE public.profiles p
SET account_tier = CASE s.price_id
      WHEN 'sub_creator_monthly' THEN 'pro'
      WHEN 'sub_creator_yearly'  THEN 'pro'
      WHEN 'sub_pro_monthly'     THEN 'growth'
      WHEN 'sub_pro_yearly'      THEN 'growth'
      WHEN 'sub_studio_monthly'  THEN 'agency'
      WHEN 'sub_studio_yearly'   THEN 'agency'
      ELSE p.account_tier
    END,
    account_type = 'personal',
    updated_at = now()
FROM public.subscriptions s
WHERE s.user_id = p.id
  AND s.status IN ('active','trialing','past_due')
  AND (s.current_period_end IS NULL OR s.current_period_end > now())
  AND s.price_id IN (
    'sub_creator_monthly','sub_creator_yearly',
    'sub_pro_monthly','sub_pro_yearly',
    'sub_studio_monthly','sub_studio_yearly'
  );
