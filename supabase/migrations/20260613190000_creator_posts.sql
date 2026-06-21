-- ════════════════════════════════════════════════════════════════════════
-- Creator posts — the channel feed. Posts can be free OR patron-gated
-- (min_monthly_credits > 0 means the viewer must hold an active
-- patron_subscription at >= that amount).
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.creator_posts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind                text NOT NULL DEFAULT 'note' CHECK (kind IN ('note','video','image','link','reel')),
  title               text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  body                text,
  cover_url           text,
  media_url           text,
  reel_id             uuid REFERENCES public.published_reels(id) ON DELETE SET NULL,
  /** 0 = free (visible to everyone). > 0 = patrons at that monthly tier and above. */
  min_monthly_credits int NOT NULL DEFAULT 0 CHECK (min_monthly_credits BETWEEN 0 AND 100000),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  is_taken_down       boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_creator_posts_creator ON public.creator_posts(creator_id, created_at DESC);

ALTER TABLE public.creator_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Creator posts: public read" ON public.creator_posts;
CREATE POLICY "Creator posts: public read"
  ON public.creator_posts FOR SELECT TO anon, authenticated
  USING (NOT is_taken_down);
DROP POLICY IF EXISTS "Creator posts: creator manages" ON public.creator_posts;
CREATE POLICY "Creator posts: creator manages"
  ON public.creator_posts FOR ALL TO authenticated
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

-- list_creator_posts — returns a feed of the creator's posts with the
-- viewer's lock state evaluated. Locked posts still return the meta
-- (title, cover_url, kind, min credits) but body/media_url are stripped.
-- This is the canonical "channel feed" endpoint.
CREATE OR REPLACE FUNCTION public.list_creator_posts(
  p_creator_id uuid,
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer uuid := auth.uid();
  v_viewer_pledge int := 0;
  v_rows jsonb;
BEGIN
  -- Resolve the viewer's active monthly pledge to this creator (if any).
  IF v_viewer IS NOT NULL THEN
    SELECT COALESCE(monthly_credits, 0) INTO v_viewer_pledge
      FROM public.patron_subscriptions
     WHERE creator_id = p_creator_id
       AND patron_id  = v_viewer
       AND cancelled_at IS NULL
     ORDER BY monthly_credits DESC
     LIMIT 1;
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.created_at DESC), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT
      p.id,
      p.kind,
      p.title,
      p.cover_url,
      p.reel_id,
      p.min_monthly_credits,
      p.created_at,
      CASE WHEN p.min_monthly_credits = 0 OR p.creator_id = v_viewer OR v_viewer_pledge >= p.min_monthly_credits
           THEN p.body
           ELSE NULL
      END AS body,
      CASE WHEN p.min_monthly_credits = 0 OR p.creator_id = v_viewer OR v_viewer_pledge >= p.min_monthly_credits
           THEN p.media_url
           ELSE NULL
      END AS media_url,
      (p.min_monthly_credits > 0
        AND p.creator_id IS DISTINCT FROM COALESCE(v_viewer, '00000000-0000-0000-0000-000000000000'::uuid)
        AND v_viewer_pledge < p.min_monthly_credits) AS is_locked
    FROM public.creator_posts p
    WHERE p.creator_id = p_creator_id
      AND NOT p.is_taken_down
    ORDER BY p.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) t;

  RETURN jsonb_build_object(
    'posts', v_rows,
    'viewer_pledge', v_viewer_pledge,
    'is_owner', v_viewer = p_creator_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.list_creator_posts(uuid, int, int) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.list_creator_posts(uuid, int, int) TO anon, authenticated;
