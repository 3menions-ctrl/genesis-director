-- ════════════════════════════════════════════════════════════════════════
-- profiles.interests — text[] of free-form interest tags.
--
-- Used by the "Discover people" surface to surface creators with
-- overlapping interests. Index for GIN-array containment so
-- `interests && ARRAY['sci-fi']` is fast at scale.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS interests text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_profiles_interests_gin
  ON public.profiles USING GIN (interests);

-- Touch the policy cache so PostgREST re-introspects.
NOTIFY pgrst, 'reload schema';
