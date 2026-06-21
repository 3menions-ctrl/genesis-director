-- Fix 1: Leaderboard view exposes too many individual metrics (videos_created, total_likes_received)
-- Restrict to only what's needed for ranking: display_name, avatar, level, xp, rank
DROP VIEW IF EXISTS public.leaderboard;

CREATE VIEW public.leaderboard
WITH (security_invoker = true)
AS
SELECT 
  ug.user_id,
  p.display_name,
  p.avatar_url,
  ug.xp_total,
  ug.level,
  ug.current_streak,
  rank() OVER (ORDER BY ug.xp_total DESC) AS rank
FROM user_gamification ug
JOIN profiles p ON p.id = ug.user_id
WHERE ug.leaderboard_visible = true
ORDER BY ug.xp_total DESC;

GRANT SELECT ON public.leaderboard TO authenticated;
REVOKE SELECT ON public.leaderboard FROM anon;

COMMENT ON VIEW public.leaderboard IS 'Public leaderboard rankings only. Excludes: videos_created, total_likes_received, followers_count, and other individual activity metrics';

-- Fix 2: Tighten user_gamification SELECT policy - non-owners should only see level/xp, not all columns
-- The RLS policy allows SELECT on all columns when leaderboard_visible=true
-- We can't restrict columns via RLS, but the leaderboard view above now handles public access
-- Tighten the base table: only owner can read their full row, others go through the view
DROP POLICY IF EXISTS "Users can view visible gamification profiles" ON public.user_gamification;

CREATE POLICY "Users can view own gamification"
ON public.user_gamification FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Fix 3: Ensure genesis_character_castings consent fields cannot be modified after being set
-- Add immutable consent trigger
CREATE OR REPLACE FUNCTION public.protect_consent_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  -- Once consent is given, it cannot be revoked or changed
  IF OLD.image_consent_given = true AND (
    NEW.image_consent_given IS DISTINCT FROM OLD.image_consent_given OR
    NEW.consent_given_at IS DISTINCT FROM OLD.consent_given_at
  ) THEN
    RAISE EXCEPTION 'Consent records are immutable once given';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_consent_immutability ON public.genesis_character_castings;
CREATE TRIGGER protect_consent_immutability
BEFORE UPDATE ON public.genesis_character_castings
FOR EACH ROW
EXECUTE FUNCTION public.protect_consent_fields();