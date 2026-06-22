-- Security hardening — clears the Supabase advisor ERROR lints.
--
-- 1) Five public tables shipped with RLS DISABLED (exposed read/write to any
--    client). The most serious was creator_payout_config (payout details).
--    Enable RLS on all five. channel_worlds is public reference data the
--    client reads, so it gets a public SELECT policy (writes are service-role
--    only). The financial archive + payout tables get NO client policy —
--    default-deny for anon/authenticated; the service role (edge functions,
--    cron, triggers) bypasses RLS and keeps working. Nothing client-side
--    reads those four (verified by grep across src/ + supabase/functions/).
--
-- 2) Three public projection views ran with the (postgres) owner's rights
--    (SECURITY DEFINER), bypassing the caller's RLS. Switch them to
--    security_invoker so they respect RLS. profiles is anon-readable for
--    public rows and user_gamification is publicly readable for non-opted-out
--    rows, so logged-out leaderboard/find-friends/profile reads keep working —
--    and public_leaderboard now correctly honours hide_from_leaderboard.

-- ── 1. RLS on the exposed tables ────────────────────────────────────────────
ALTER TABLE public.channel_worlds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "channel_worlds public read" ON public.channel_worlds;
CREATE POLICY "channel_worlds public read" ON public.channel_worlds
  FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.creator_payout_config        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions_archive  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patron_subscriptions_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles_credit_archive       ENABLE ROW LEVEL SECURITY;

-- ── 2. Caller-respecting views ──────────────────────────────────────────────
ALTER VIEW public.profiles_public         SET (security_invoker = on);
ALTER VIEW public.find_friends_directory  SET (security_invoker = on);
ALTER VIEW public.public_leaderboard      SET (security_invoker = on);
