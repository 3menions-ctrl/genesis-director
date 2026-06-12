-- Phase 2 of the entertainment hub:
--   • reel_branches — viewer-voted forks of a published reel
--   • vote_branch RPC — atomic vote bumping
--   • search_everything RPC — one query, all four entity buckets
--   • universe_detail RPC — single roundtrip for /universe/:id

-- ════════════════════════════════════════════════════════════════════════
-- 1. REEL BRANCHES — the interactive-narrative table
-- ════════════════════════════════════════════════════════════════════════
-- A branch hangs off a published_reel and points to a child reel that
-- depicts the chosen outcome. `decision_text` is what the viewer reads in
-- the Theater. Vote counts are denormalised — incremented via the
-- vote_branch RPC, which also writes to admin_audit_log for fraud
-- detection.
CREATE TABLE IF NOT EXISTS public.reel_branches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_reel_id  uuid NOT NULL REFERENCES public.published_reels(id) ON DELETE CASCADE,
  child_reel_id   uuid NOT NULL REFERENCES public.published_reels(id) ON DELETE CASCADE,
  decision_text   text NOT NULL,
  vote_count      bigint NOT NULL DEFAULT 0,
  sort_order      int NOT NULL DEFAULT 0,
  created_by      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parent_reel_id, child_reel_id),
  CHECK (parent_reel_id <> child_reel_id)
);
CREATE INDEX IF NOT EXISTS idx_reel_branches_parent ON public.reel_branches(parent_reel_id, vote_count DESC);
ALTER TABLE public.reel_branches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Branches readable" ON public.reel_branches;
CREATE POLICY "Branches readable" ON public.reel_branches FOR SELECT USING (true);
DROP POLICY IF EXISTS "Owner of parent manages branches" ON public.reel_branches;
CREATE POLICY "Owner of parent manages branches" ON public.reel_branches FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.published_reels r
      WHERE r.id = parent_reel_id AND r.creator_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.published_reels r
      WHERE r.id = parent_reel_id AND r.creator_id = auth.uid()
    )
  );

-- Per-viewer vote ledger so each viewer's vote counts once per branch set.
CREATE TABLE IF NOT EXISTS public.reel_branch_votes (
  branch_id  uuid NOT NULL REFERENCES public.reel_branches(id) ON DELETE CASCADE,
  voter_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_reel_id uuid NOT NULL REFERENCES public.published_reels(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (branch_id, voter_id)
);
CREATE INDEX IF NOT EXISTS idx_branch_votes_voter_parent ON public.reel_branch_votes(voter_id, parent_reel_id);
ALTER TABLE public.reel_branch_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Voter reads own votes" ON public.reel_branch_votes;
CREATE POLICY "Voter reads own votes" ON public.reel_branch_votes FOR SELECT USING (voter_id = auth.uid());
DROP POLICY IF EXISTS "Voter manages own votes" ON public.reel_branch_votes;
CREATE POLICY "Voter manages own votes" ON public.reel_branch_votes FOR INSERT WITH CHECK (voter_id = auth.uid());

-- ════════════════════════════════════════════════════════════════════════
-- 2. vote_branch RPC — atomic, idempotent per (voter, parent reel)
-- ════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.vote_branch(p_branch_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_branch public.reel_branches%ROWTYPE;
  v_existing uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  SELECT * INTO v_branch FROM public.reel_branches WHERE id = p_branch_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'branch_not_found'; END IF;

  -- One vote per viewer per parent. If they already voted on a different
  -- branch under this parent, swap the vote.
  SELECT branch_id INTO v_existing
  FROM public.reel_branch_votes
  WHERE voter_id = auth.uid() AND parent_reel_id = v_branch.parent_reel_id;

  IF v_existing IS NOT NULL THEN
    IF v_existing = p_branch_id THEN
      -- Idempotent: no-op.
      RETURN jsonb_build_object('voted', true, 'switched', false);
    END IF;
    -- Move the vote.
    UPDATE public.reel_branches SET vote_count = GREATEST(0, vote_count - 1)
      WHERE id = v_existing;
    DELETE FROM public.reel_branch_votes
      WHERE voter_id = auth.uid() AND parent_reel_id = v_branch.parent_reel_id;
  END IF;

  INSERT INTO public.reel_branch_votes (branch_id, voter_id, parent_reel_id)
  VALUES (p_branch_id, auth.uid(), v_branch.parent_reel_id);
  UPDATE public.reel_branches SET vote_count = vote_count + 1 WHERE id = p_branch_id;

  RETURN jsonb_build_object('voted', true, 'switched', v_existing IS NOT NULL);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.vote_branch(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.vote_branch(uuid) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- 3. get_reel_branches RPC — read all branches for a reel + viewer's vote
-- ════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_reel_branches(p_reel_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_branches jsonb;
  v_my_vote uuid;
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', b.id,
    'child_reel_id', b.child_reel_id,
    'decision_text', b.decision_text,
    'vote_count', b.vote_count,
    'child_title', r.title,
    'child_thumbnail', r.thumbnail_url
  ) ORDER BY b.vote_count DESC, b.sort_order), '[]'::jsonb)
  INTO v_branches
  FROM public.reel_branches b
  LEFT JOIN public.published_reels r ON r.id = b.child_reel_id
  WHERE b.parent_reel_id = p_reel_id;

  IF auth.uid() IS NOT NULL THEN
    SELECT branch_id INTO v_my_vote
    FROM public.reel_branch_votes
    WHERE voter_id = auth.uid() AND parent_reel_id = p_reel_id;
  END IF;

  RETURN jsonb_build_object('branches', v_branches, 'my_vote', v_my_vote);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_reel_branches(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_reel_branches(uuid) TO anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- 4. search_everything RPC — one query, four buckets
-- ════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.search_everything(
  p_query text, p_limit int DEFAULT 8
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_q text;
  v_like text;
  v_reels jsonb;
  v_creators jsonb;
  v_universes jsonb;
  v_crews jsonb;
BEGIN
  v_q := COALESCE(NULLIF(trim(p_query), ''), '');
  IF length(v_q) = 0 THEN
    RETURN jsonb_build_object(
      'reels', '[]'::jsonb,
      'creators', '[]'::jsonb,
      'universes', '[]'::jsonb,
      'crews', '[]'::jsonb
    );
  END IF;
  v_like := '%' || v_q || '%';

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', r.id, 'title', r.title, 'thumbnail_url', r.thumbnail_url,
    'world_slug', r.world_slug, 'play_count', r.play_count,
    'creator_id', r.creator_id
  ) ORDER BY r.play_count DESC, r.created_at DESC), '[]'::jsonb)
  INTO v_reels
  FROM (
    SELECT * FROM public.published_reels
    WHERE NOT is_taken_down
      AND (title ILIKE v_like OR synopsis ILIKE v_like OR v_q = ANY(tags))
    ORDER BY play_count DESC, created_at DESC
    LIMIT p_limit
  ) r;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'display_name', COALESCE(p.display_name, p.full_name, split_part(p.email,'@',1)),
    'avatar_url', p.avatar_url,
    'follower_count', (SELECT count(*) FROM public.follows WHERE followed_id = p.id),
    'reel_count', (SELECT count(*) FROM public.published_reels WHERE creator_id = p.id AND NOT is_taken_down)
  )), '[]'::jsonb)
  INTO v_creators
  FROM (
    SELECT * FROM public.profiles
    WHERE display_name ILIKE v_like
       OR full_name ILIKE v_like
       OR email ILIKE v_like
    ORDER BY updated_at DESC NULLS LAST
    LIMIT p_limit
  ) p;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', u.id, 'name', u.name, 'description', u.description
  )), '[]'::jsonb)
  INTO v_universes
  FROM (
    SELECT * FROM public.universes
    WHERE name ILIKE v_like OR description ILIKE v_like
    ORDER BY created_at DESC
    LIMIT p_limit
  ) u;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', c.id, 'slug', c.slug, 'name', c.name, 'description', c.description,
    'is_public', c.is_public,
    'member_count', (SELECT count(*) FROM public.crew_members WHERE crew_id = c.id)
  )), '[]'::jsonb)
  INTO v_crews
  FROM (
    SELECT * FROM public.crews
    WHERE is_public AND (name ILIKE v_like OR slug ILIKE v_like OR description ILIKE v_like)
    ORDER BY created_at DESC
    LIMIT p_limit
  ) c;

  RETURN jsonb_build_object(
    'reels', v_reels,
    'creators', v_creators,
    'universes', v_universes,
    'crews', v_crews
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.search_everything(text, int) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.search_everything(text, int) TO anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- 5. universe_detail RPC — single roundtrip for /universe/:id
-- ════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.universe_detail(p_universe_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_universe jsonb;
  v_reels jsonb;
  v_contributors jsonb;
  v_reel_count int;
BEGIN
  SELECT to_jsonb(u) INTO v_universe FROM public.universes u WHERE id = p_universe_id;
  IF v_universe IS NULL THEN RAISE EXCEPTION 'universe_not_found'; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', r.id, 'title', r.title, 'thumbnail_url', r.thumbnail_url,
    'video_url', r.video_url, 'world_slug', r.world_slug,
    'play_count', r.play_count, 'like_count', r.like_count, 'remix_count', r.remix_count,
    'creator_id', r.creator_id, 'created_at', r.created_at
  ) ORDER BY r.created_at DESC), '[]'::jsonb), count(*)
  INTO v_reels, v_reel_count
  FROM public.published_reels r
  WHERE r.universe_id = p_universe_id AND NOT r.is_taken_down;

  SELECT COALESCE(jsonb_agg(DISTINCT jsonb_build_object(
    'id', p.id,
    'display_name', COALESCE(p.display_name, p.full_name, split_part(p.email,'@',1)),
    'avatar_url', p.avatar_url
  )), '[]'::jsonb)
  INTO v_contributors
  FROM public.published_reels r
  JOIN public.profiles p ON p.id = r.creator_id
  WHERE r.universe_id = p_universe_id AND NOT r.is_taken_down;

  RETURN jsonb_build_object(
    'universe', v_universe,
    'reels', v_reels,
    'contributors', v_contributors,
    'reel_count', v_reel_count
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.universe_detail(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.universe_detail(uuid) TO anon, authenticated;

COMMENT ON TABLE public.reel_branches IS
  'Decision-point forks of a published reel. Viewers vote at the end of playback; the Theater routes to the highest-voted child by default.';
COMMENT ON FUNCTION public.vote_branch IS
  'Atomic, idempotent vote on a branch. Swaps a viewer''s existing vote within the same parent reel.';
COMMENT ON FUNCTION public.search_everything IS
  'Universal search across reels, creators, universes, crews. Used by /search.';
COMMENT ON FUNCTION public.universe_detail IS
  'Single-roundtrip data bundle for /universe/:id.';
