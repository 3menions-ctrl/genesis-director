-- AUDIT FIX M31 + M32 — server-side aggregates for "lifetime" creator totals.
--
-- Both surfaces previously summed a CLIENT-CAPPED slice and presented it as a
-- grand total, undercounting for any creator past the cap:
--   • M31: ProfileDashboard summed plays/likes/remixes/tips over the top-24
--          published reels — disagreeing with the true totals visitors see and
--          potentially leaving high-tier achievements permanently locked.
--   • M32: CreatorEarnings summed lifetime USD over a .limit(1000) ledger slice.
--
-- These RPCs compute the totals over the FULL set in the database.

-- ── M32: lifetime creator earnings (own data only) ───────────────────────────
-- No parameter — always scoped to auth.uid(), so it can't be used to read
-- another creator's private earnings (unlike the sibling pending-payout RPC,
-- which accepts an arbitrary p_user_id).
-- RETURNS int (not bigint) to match the sibling creator_pending_payout_cents
-- and guarantee a JS number client-side. Lifetime earnings in cents stay well
-- within int range for an individual creator.
CREATE OR REPLACE FUNCTION public.creator_lifetime_earnings_cents()
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(usd_cents), 0)::int
  FROM public.creator_earnings_ledger
  WHERE user_id = auth.uid();
$$;
REVOKE EXECUTE ON FUNCTION public.creator_lifetime_earnings_cents() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.creator_lifetime_earnings_cents() TO authenticated;

-- ── M31: lifetime public-reel engagement totals for a creator ────────────────
-- published_reels is public-readable, so these aggregates are safe to expose
-- for any creator (mirrors what profile_overview already returns to visitors).
CREATE OR REPLACE FUNCTION public.creator_reel_totals(p_creator_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'reels',   COALESCE(COUNT(*), 0),
    'plays',   COALESCE(SUM(play_count), 0),
    'likes',   COALESCE(SUM(like_count), 0),
    'remixes', COALESCE(SUM(remix_count), 0),
    'tips',    COALESCE(SUM(tip_credits), 0)
  )
  FROM public.published_reels
  WHERE creator_id = p_creator_id AND NOT is_taken_down;
$$;
REVOKE EXECUTE ON FUNCTION public.creator_reel_totals(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.creator_reel_totals(uuid) TO authenticated, anon;
