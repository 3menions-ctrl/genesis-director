-- get_daily_challenges — returns today's challenges joined with the
-- caller's progress row. Lobby.tsx already calls this RPC; the
-- function never existed, so the Challenges section silently
-- rendered nothing for every authenticated user. The RLS on both
-- tables already allows the read; we just needed the join surface.
--
-- Returned shape (matches DailyChallengeRow in src/pages/Lobby.tsx:70):
--   id, challenge_type, description, xp_reward, target_count,
--   progress, completed
--
-- SECURITY: SECURITY INVOKER so each user sees only their own
-- progress (the user_challenge_progress RLS policy enforces this).
-- daily_challenges is public-readable so the LEFT JOIN's left side
-- requires no extra grant.

CREATE OR REPLACE FUNCTION public.get_daily_challenges()
RETURNS TABLE (
  id            uuid,
  challenge_type text,
  description    text,
  xp_reward      integer,
  target_count   integer,
  progress       integer,
  completed      boolean
)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT
    dc.id,
    dc.challenge_type,
    dc.description,
    dc.xp_reward,
    dc.target_count,
    COALESCE(ucp.progress, 0) AS progress,
    COALESCE(ucp.completed, false) AS completed
  FROM public.daily_challenges dc
  LEFT JOIN public.user_challenge_progress ucp
    ON ucp.challenge_id = dc.id
   AND ucp.user_id = auth.uid()
  WHERE dc.date = CURRENT_DATE
  ORDER BY dc.created_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_challenges() TO authenticated;
