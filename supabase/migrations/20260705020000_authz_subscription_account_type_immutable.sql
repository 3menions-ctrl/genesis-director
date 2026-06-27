-- AUTHZ FIX (forward patch): preserve account_type immutability in the
-- subscription sync trigger.
--
-- Bug: public.sync_subscription_to_profile() (originally defined in
-- 20260701000000) unconditionally rewrites profiles.account_type from the
-- subscription price_id on every INSERT/UPDATE. A business owner who downgrades
-- to a personal plan key (e.g. 'sub_creator_monthly') is silently flipped to
-- account_type='personal' while still owning a business org — violating the
-- business/personal mutual-exclusivity invariant.
--
-- That earlier migration is already applied to prod, so editing it is inert.
-- This forward migration CREATE OR REPLACEs the function with the immutability
-- guard, mirroring the C1 guard in consume_onboarding_intent (20260704002000):
-- once onboarding_completed is true, only account_tier is provisioned;
-- account_type is left untouched. Not-yet-onboarded profiles behave as before.
--
-- Verified: profiles.account_type/onboarding_completed columns exist; this is a
-- behavioral no-op for personal-only and not-yet-onboarded users.

CREATE OR REPLACE FUNCTION public.sync_subscription_to_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_active boolean;
  v_type text;
  v_tier text;
  v_onboarded boolean;
  v_current_type text;
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
    -- account_type is immutable once onboarding completes. A subscription change
    -- must NEVER flip a user between personal/business; the tier is still
    -- provisioned regardless.
    SELECT account_type, onboarding_completed
      INTO v_current_type, v_onboarded
      FROM public.profiles WHERE id = NEW.user_id;

    IF COALESCE(v_onboarded, false) AND v_current_type IS NOT NULL THEN
      UPDATE public.profiles
      SET account_tier = v_tier, updated_at = now()
      WHERE id = NEW.user_id;
    ELSE
      UPDATE public.profiles
      SET account_type = v_type, account_tier = v_tier, updated_at = now()
      WHERE id = NEW.user_id;
    END IF;
  ELSIF NOT v_active THEN
    UPDATE public.profiles
    SET account_tier = 'free', updated_at = now()
    WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

-- NOTE (data repair, intentionally NOT run here): any profile already flipped to
-- the wrong account_type by the previous unguarded trigger is a one-off data
-- mutation that needs a targeted, audited backfill (cross-check against
-- organization ownership). Left for human review per the deploy-gating policy.
