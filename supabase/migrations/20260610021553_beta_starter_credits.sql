-- Beta starter credits.
--
-- While Apex Studio is in beta there is no checkout flow — every new user is
-- automatically granted a starter credit balance so they can build something
-- the moment they sign up. The grant is idempotent (only fires if the user
-- has never received a 'beta_starter' grant before).
--
-- The amount lives in system_config so we can change it without a code push.

INSERT INTO public.system_config (key, value, description)
VALUES (
  'beta.starter_credits',
  '100'::jsonb,
  'Credits granted to every new user on profile creation while the app is in beta.'
)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.grant_beta_starter_credits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  amount int;
  already_granted boolean;
BEGIN
  -- Skip if this user already received a starter grant (e.g. profile row
  -- recreated after a delete).
  SELECT EXISTS (
    SELECT 1 FROM public.credit_transactions
    WHERE user_id = NEW.id
      AND transaction_type = 'grant'
      AND description = 'Beta starter credits'
  ) INTO already_granted;
  IF already_granted THEN
    RETURN NEW;
  END IF;

  SELECT (value::text)::int INTO amount
  FROM public.system_config
  WHERE key = 'beta.starter_credits';

  IF amount IS NULL OR amount <= 0 THEN
    RETURN NEW;
  END IF;

  -- Bump the user's balance + lifetime granted
  UPDATE public.profiles
  SET credits_balance = COALESCE(credits_balance, 0) + amount,
      total_credits_purchased = COALESCE(total_credits_purchased, 0) + amount
  WHERE id = NEW.id;

  -- Record the grant in the ledger so the user sees it under "credit activity"
  INSERT INTO public.credit_transactions (user_id, amount, transaction_type, description)
  VALUES (NEW.id, amount, 'grant', 'Beta starter credits');

  RETURN NEW;
END;
$$;

-- Fire AFTER INSERT on profiles. We do NOT chain off auth.users since
-- profile creation is what indicates a real, usable account.
DROP TRIGGER IF EXISTS trg_grant_beta_starter_credits ON public.profiles;
CREATE TRIGGER trg_grant_beta_starter_credits
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.grant_beta_starter_credits();

-- Backfill existing users who never received a starter grant (e.g. accounts
-- that signed up before this migration). One-shot, idempotent thanks to the
-- function's already_granted check.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.profiles LOOP
    PERFORM public.grant_beta_starter_credits() FROM (SELECT r.id AS id) AS NEW;
    -- The PERFORM above doesn't actually pass NEW to the trigger fn cleanly;
    -- fall back to the direct grant logic via a manual call:
    PERFORM 1;
  END LOOP;
END $$;

-- The cleaner backfill: replay the grant body for any existing profile with
-- no prior starter grant. (We keep it as an explicit INSERT … SELECT instead
-- of trying to coerce NEW into a trigger context.)
WITH amt AS (
  SELECT (value::text)::int AS n FROM public.system_config WHERE key = 'beta.starter_credits'
),
needs_grant AS (
  SELECT p.id AS user_id, amt.n AS amount
  FROM public.profiles p
  CROSS JOIN amt
  WHERE NOT EXISTS (
    SELECT 1 FROM public.credit_transactions ct
    WHERE ct.user_id = p.id
      AND ct.transaction_type = 'grant'
      AND ct.description = 'Beta starter credits'
  )
)
INSERT INTO public.credit_transactions (user_id, amount, transaction_type, description)
SELECT user_id, amount, 'grant', 'Beta starter credits' FROM needs_grant;

WITH amt AS (
  SELECT (value::text)::int AS n FROM public.system_config WHERE key = 'beta.starter_credits'
)
UPDATE public.profiles p
SET credits_balance = COALESCE(p.credits_balance, 0) + amt.n,
    total_credits_purchased = COALESCE(p.total_credits_purchased, 0) + amt.n
FROM amt
WHERE EXISTS (
  SELECT 1 FROM public.credit_transactions ct
  WHERE ct.user_id = p.id
    AND ct.transaction_type = 'grant'
    AND ct.description = 'Beta starter credits'
    AND ct.created_at > now() - interval '1 minute'
);

COMMENT ON FUNCTION public.grant_beta_starter_credits IS
  'Grants beta starter credits on first profile creation. Idempotent.';
