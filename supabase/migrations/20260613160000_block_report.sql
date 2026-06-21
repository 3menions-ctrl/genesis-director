-- ════════════════════════════════════════════════════════════════════════
-- Trust & safety: user blocks + user reports.
--
-- user_blocks: bidirectional hide. When A blocks B, A never sees B in
--   feeds / discover / search; B can't DM A. We don't tell B they were
--   blocked.
--
-- user_reports: typed reports for moderation review. status defaults to
--   "open"; admins resolve via a separate console.
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  reason     text,
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Blocks: owner can read" ON public.user_blocks;
CREATE POLICY "Blocks: owner can read"
  ON public.user_blocks FOR SELECT
  TO authenticated
  USING (blocker_id = auth.uid());

DROP POLICY IF EXISTS "Blocks: owner manages own" ON public.user_blocks;
CREATE POLICY "Blocks: owner manages own"
  ON public.user_blocks FOR ALL
  TO authenticated
  USING (blocker_id = auth.uid())
  WITH CHECK (blocker_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON public.user_blocks(blocked_id);

-- Reports — append-only from the client; resolution is an admin action.
CREATE TABLE IF NOT EXISTS public.user_reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  reported_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason       text NOT NULL CHECK (length(reason) <= 80),
  detail       text CHECK (detail IS NULL OR length(detail) <= 2000),
  created_at   timestamptz NOT NULL DEFAULT now(),
  status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'actioned', 'dismissed')),
  resolved_at  timestamptz
);

ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Reports: anyone authenticated can file" ON public.user_reports;
CREATE POLICY "Reports: anyone authenticated can file"
  ON public.user_reports FOR INSERT
  TO authenticated
  WITH CHECK (reporter_id = auth.uid() AND reported_id <> auth.uid());

DROP POLICY IF EXISTS "Reports: reporter can read own" ON public.user_reports;
CREATE POLICY "Reports: reporter can read own"
  ON public.user_reports FOR SELECT
  TO authenticated
  USING (reporter_id = auth.uid());

-- Toggle block (atomic: insert if missing, delete if present). Returns
-- the new "blocked" boolean.
CREATE OR REPLACE FUNCTION public.toggle_block(p_target uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_existed bool;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF p_target = auth.uid() THEN RAISE EXCEPTION 'cannot_block_self'; END IF;
  DELETE FROM public.user_blocks WHERE blocker_id = auth.uid() AND blocked_id = p_target;
  GET DIAGNOSTICS v_existed = ROW_COUNT;
  IF v_existed = 0 THEN
    INSERT INTO public.user_blocks (blocker_id, blocked_id)
      VALUES (auth.uid(), p_target)
      ON CONFLICT DO NOTHING;
    -- Best-effort: unfollow both directions.
    DELETE FROM public.follows
      WHERE (follower_id = auth.uid() AND followed_id = p_target)
         OR (follower_id = p_target  AND followed_id = auth.uid());
    RETURN jsonb_build_object('blocked', true);
  END IF;
  RETURN jsonb_build_object('blocked', false);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.toggle_block(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.toggle_block(uuid) TO authenticated;

-- Convenience reader: "am I blocking this user?"
CREATE OR REPLACE FUNCTION public.viewer_blocks(p_target uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_blocks
     WHERE blocker_id = auth.uid() AND blocked_id = p_target
  );
$$;

REVOKE EXECUTE ON FUNCTION public.viewer_blocks(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.viewer_blocks(uuid) TO authenticated;
