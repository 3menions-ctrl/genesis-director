
-- Cinema entitlement RPC
-- Returns the active Studio Cinema entitlement for a user, plus fair-use usage.

CREATE OR REPLACE FUNCTION public.get_cinema_entitlement(_user_id uuid DEFAULT NULL)
RETURNS TABLE (
  has_entitlement boolean,
  tier text,                         -- 'cinema_lite' | 'cinema_pro' | 'cinema_studio' | NULL
  status text,                       -- subscription status (active, trialing, past_due, canceled, ...)
  is_active boolean,                 -- true when status grants access
  cancel_at_period_end boolean,
  price_id text,
  subscription_id uuid,
  period_start timestamptz,
  period_end timestamptz,
  fair_use_seconds integer,          -- monthly fair-use allotment for the tier
  used_seconds integer,              -- summed from cinema_usage_ledger this period
  remaining_seconds integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target uuid;
  v_sub record;
  v_tier text;
  v_fair integer;
  v_used integer;
BEGIN
  -- Resolve target user. Default = caller. Admins may pass any user_id.
  v_target := COALESCE(_user_id, auth.uid());
  IF v_target IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF v_target <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  -- Pick the most-recent Cinema subscription row for this user.
  -- Sandbox + live coexist; restrict to whichever has the latest row.
  SELECT s.id, s.price_id, s.status, s.cancel_at_period_end,
         s.current_period_start, s.current_period_end
    INTO v_sub
    FROM public.subscriptions s
   WHERE s.user_id = v_target
     AND s.price_id IN (
       'cinema_lite_monthly',  'cinema_lite_yearly',
       'cinema_pro_monthly',   'cinema_pro_yearly',
       'cinema_studio_monthly','cinema_studio_yearly'
     )
   ORDER BY s.created_at DESC
   LIMIT 1;

  IF v_sub.id IS NULL THEN
    RETURN QUERY SELECT
      false, NULL::text, NULL::text, false, false,
      NULL::text, NULL::uuid, NULL::timestamptz, NULL::timestamptz,
      0, 0, 0;
    RETURN;
  END IF;

  -- Map price_id -> tier + fair-use seconds.
  v_tier := CASE
    WHEN v_sub.price_id LIKE 'cinema_lite_%'   THEN 'cinema_lite'
    WHEN v_sub.price_id LIKE 'cinema_pro_%'    THEN 'cinema_pro'
    WHEN v_sub.price_id LIKE 'cinema_studio_%' THEN 'cinema_studio'
  END;
  v_fair := CASE v_tier
    WHEN 'cinema_lite'   THEN 600
    WHEN 'cinema_pro'    THEN 2000
    WHEN 'cinema_studio' THEN 6000
    ELSE 0
  END;

  -- Sum fair-use seconds used in the current billing period.
  SELECT COALESCE(SUM(seconds_used), 0)::int
    INTO v_used
    FROM public.cinema_usage_ledger
   WHERE user_id = v_target
     AND period_start = v_sub.current_period_start
     AND period_end   = v_sub.current_period_end;

  RETURN QUERY SELECT
    -- has_entitlement: active/trialing/past_due, OR canceled but still in period
    (v_sub.status IN ('active', 'trialing', 'past_due'))
      OR (v_sub.status = 'canceled' AND v_sub.current_period_end > now()),
    v_tier,
    v_sub.status,
    -- is_active mirrors has_entitlement (kept separate for future divergence)
    (v_sub.status IN ('active', 'trialing', 'past_due'))
      OR (v_sub.status = 'canceled' AND v_sub.current_period_end > now()),
    COALESCE(v_sub.cancel_at_period_end, false),
    v_sub.price_id,
    v_sub.id,
    v_sub.current_period_start,
    v_sub.current_period_end,
    v_fair,
    v_used,
    GREATEST(v_fair - v_used, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.get_cinema_entitlement(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_cinema_entitlement(uuid) TO authenticated;
