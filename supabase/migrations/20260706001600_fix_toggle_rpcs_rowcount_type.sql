-- =====================================================================
-- Audit remediation (phase 2): fix dead social toggle RPCs (type error)
--
-- BLOCKER fixed (full-platform audit 2026-06-27):
--   toggle_like_reel, toggle_like_reel_comment and toggle_block each
--   declare `v_existed bool` and then run
--       GET DIAGNOSTICS v_existed = ROW_COUNT;   -- ROW_COUNT is integer
--       IF v_existed = 0 THEN ...
--   Assigning the integer ROW_COUNT into a boolean variable (and the
--   `boolean = integer` comparison) raises a runtime error, surfacing to
--   the client as a failed RPC. Result: liking reels/comments and blocking
--   users silently no-op in production (block-not-persisting is a safety
--   gap). toggle_follow carries the identical latent bug and is fixed too.
--
-- Fix: declare v_existed as integer. Bodies are otherwise unchanged.
--
-- NOTE: these RPCs exist in APPLIED prod migrations; this corrective
-- migration must be applied to prod (it is a pure CREATE OR REPLACE, safe).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.toggle_like_reel(p_reel_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_existed integer; v_count bigint;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  DELETE FROM public.reel_likes WHERE reel_id = p_reel_id AND user_id = auth.uid();
  GET DIAGNOSTICS v_existed = ROW_COUNT;
  IF v_existed = 0 THEN
    INSERT INTO public.reel_likes (reel_id, user_id) VALUES (p_reel_id, auth.uid())
      ON CONFLICT DO NOTHING;
    UPDATE public.published_reels SET like_count = like_count + 1 WHERE id = p_reel_id
      RETURNING like_count INTO v_count;
    RETURN jsonb_build_object('liked', true, 'like_count', v_count);
  ELSE
    UPDATE public.published_reels SET like_count = GREATEST(0, like_count - 1) WHERE id = p_reel_id
      RETURNING like_count INTO v_count;
    RETURN jsonb_build_object('liked', false, 'like_count', v_count);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.toggle_follow(p_target uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_existed integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_target = auth.uid() THEN RAISE EXCEPTION 'cannot_follow_self'; END IF;
  DELETE FROM public.follows WHERE follower_id = auth.uid() AND followed_id = p_target;
  GET DIAGNOSTICS v_existed = ROW_COUNT;
  IF v_existed = 0 THEN
    INSERT INTO public.follows (follower_id, followed_id) VALUES (auth.uid(), p_target)
      ON CONFLICT DO NOTHING;
    RETURN jsonb_build_object('following', true);
  END IF;
  RETURN jsonb_build_object('following', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.toggle_like_reel_comment(p_comment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existed integer;
  v_count bigint;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  DELETE FROM public.reel_comment_likes WHERE comment_id = p_comment_id AND user_id = auth.uid();
  GET DIAGNOSTICS v_existed = ROW_COUNT;
  IF v_existed = 0 THEN
    INSERT INTO public.reel_comment_likes (comment_id, user_id) VALUES (p_comment_id, auth.uid())
      ON CONFLICT DO NOTHING;
    UPDATE public.reel_comments SET like_count = like_count + 1 WHERE id = p_comment_id
      RETURNING like_count INTO v_count;
    RETURN jsonb_build_object('liked', true, 'like_count', v_count);
  ELSE
    UPDATE public.reel_comments SET like_count = GREATEST(0, like_count - 1) WHERE id = p_comment_id
      RETURNING like_count INTO v_count;
    RETURN jsonb_build_object('liked', false, 'like_count', v_count);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.toggle_block(p_target uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_existed integer;
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
