-- Free tier — usage caps + platform daily budget.
--
-- For non-paying users, route generation to LTX-Video (cheap, fast, decent
-- quality) and enforce two layers of cost protection:
--   1) Per-user: 2 free generations per UTC day (configurable)
--   2) Platform-wide: $30 / day across ALL free generations
--
-- Both limits live in system_config so they can be tuned without redeploying.
-- The mode-router checks them inline before submitting a generation.

INSERT INTO public.system_config (key, value, description)
VALUES
  ('free_tier.daily_per_user', '2'::jsonb,
   'Generations a free-tier user can run per UTC day before being prompted to upgrade.'),
  ('free_tier.daily_platform_budget_usd', '30'::jsonb,
   'Hard daily $ ceiling across all free-tier generations. When crossed, free tier returns "platform cap" message until UTC rollover.'),
  ('free_tier.model_cost_usd', '0.05'::jsonb,
   'Estimated cost per LTX-Video generation. Used to decide platform budget threshold.'),
  ('free_tier.model_version', '"by3hnxsapnzj1qzsmm4qm9d4j5p1fqq1pj6q3w89mr04kdb3dpgw"'::jsonb,
   'Replicate model version slug for LTX-Video. Swap to upgrade the free-tier engine.'),
  ('free_tier.output_resolution', '"320x320"'::jsonb,
   'Resolution free-tier renders are produced at.')
ON CONFLICT (key) DO NOTHING;

-- Free-tier attempt log — used for both rate-limiting and observability.
CREATE TABLE IF NOT EXISTS public.free_tier_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.movie_projects(id) ON DELETE SET NULL,
  estimated_cost_usd numeric(8, 4) NOT NULL DEFAULT 0.05,
  status text NOT NULL DEFAULT 'started' CHECK (status IN ('started','succeeded','failed','rate_limit','platform_cap','content')),
  prediction_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fta_user_day ON public.free_tier_attempts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fta_day_cost ON public.free_tier_attempts(created_at) WHERE status IN ('started','succeeded');

ALTER TABLE public.free_tier_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fta_self_read" ON public.free_tier_attempts;
CREATE POLICY "fta_self_read" ON public.free_tier_attempts FOR SELECT
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "fta_admin_all" ON public.free_tier_attempts;
CREATE POLICY "fta_admin_all" ON public.free_tier_attempts FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Helper: report a user's free-tier status. Returns:
--   { allowed: bool, used_today: int, limit: int, reason: text|null,
--     platform_spent_usd: numeric, platform_cap_usd: numeric }
CREATE OR REPLACE FUNCTION public.free_tier_status(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_per_user int;
  v_platform_cap numeric;
  v_model_cost numeric;
  v_used_today int;
  v_platform_spent numeric;
  v_day_start timestamptz := date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_allowed boolean := true;
  v_reason text;
BEGIN
  SELECT (value::text)::int INTO v_per_user
  FROM public.system_config WHERE key = 'free_tier.daily_per_user';
  IF v_per_user IS NULL THEN v_per_user := 2; END IF;

  SELECT (value::text)::numeric INTO v_platform_cap
  FROM public.system_config WHERE key = 'free_tier.daily_platform_budget_usd';
  IF v_platform_cap IS NULL THEN v_platform_cap := 30; END IF;

  SELECT (value::text)::numeric INTO v_model_cost
  FROM public.system_config WHERE key = 'free_tier.model_cost_usd';
  IF v_model_cost IS NULL THEN v_model_cost := 0.05; END IF;

  SELECT count(*) INTO v_used_today
  FROM public.free_tier_attempts
  WHERE user_id = p_user
    AND created_at >= v_day_start
    AND status IN ('started', 'succeeded');

  SELECT COALESCE(sum(estimated_cost_usd), 0) INTO v_platform_spent
  FROM public.free_tier_attempts
  WHERE created_at >= v_day_start
    AND status IN ('started', 'succeeded');

  IF v_platform_spent + v_model_cost > v_platform_cap THEN
    v_allowed := false;
    v_reason := 'platform_cap';
  ELSIF v_used_today >= v_per_user THEN
    v_allowed := false;
    v_reason := 'rate_limit';
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'used_today', v_used_today,
    'limit', v_per_user,
    'reason', v_reason,
    'platform_spent_usd', v_platform_spent,
    'platform_cap_usd', v_platform_cap,
    'next_reset_at', v_day_start + interval '1 day'
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.free_tier_status(uuid) TO authenticated;
