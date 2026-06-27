-- ════════════════════════════════════════════════════════════════════════
-- World Chat — a single global, realtime chat room for every signed-in user,
-- surfaced in the Lobby.
--
-- Append-only. The author's display_name + avatar are SNAPSHOTTED server-side
-- at post time (via the SECURITY DEFINER post_world_chat() RPC) so each realtime
-- INSERT payload already carries everything the client needs to render a row —
-- no per-message profile lookup, and no cross-tenant read of public.profiles.
--
-- Writes go ONLY through post_world_chat(): there is intentionally no INSERT
-- policy, so clients cannot spoof display_name/avatar or bypass the flood guard.
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.world_chat (
  id            bigserial PRIMARY KEY,
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name  text,
  avatar_url    text,
  body          text NOT NULL CHECK (length(body) BETWEEN 1 AND 500),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_world_chat_created
  ON public.world_chat (created_at DESC);

ALTER TABLE public.world_chat ENABLE ROW LEVEL SECURITY;

-- Any signed-in user can read the room.
DROP POLICY IF EXISTS "World chat authenticated read" ON public.world_chat;
CREATE POLICY "World chat authenticated read"
  ON public.world_chat FOR SELECT TO authenticated
  USING (true);

-- ── RPC: post a message ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.post_world_chat(p_body text)
RETURNS public.world_chat
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid         uuid := auth.uid();
  v_body        text := btrim(coalesce(p_body, ''));
  v_name        text;
  v_avatar      text;
  v_suspended   timestamptz;
  v_deactivated timestamptz;
  v_row         public.world_chat;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF length(v_body) = 0 THEN RAISE EXCEPTION 'empty_message'; END IF;
  IF length(v_body) > 500 THEN v_body := left(v_body, 500); END IF;

  -- Identity snapshot + restricted-account gate (function owner bypasses RLS,
  -- so reading the caller's own profile here is safe and intentional).
  SELECT display_name, avatar_url, suspended_at, deactivated_at
    INTO v_name, v_avatar, v_suspended, v_deactivated
    FROM public.profiles WHERE id = v_uid;
  IF v_suspended IS NOT NULL OR v_deactivated IS NOT NULL THEN
    RAISE EXCEPTION 'account_restricted';
  END IF;

  -- Light flood guard: at most one message per ~1.2s per user.
  IF EXISTS (
    SELECT 1 FROM public.world_chat
    WHERE user_id = v_uid AND created_at > now() - interval '1.2 seconds'
  ) THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;

  INSERT INTO public.world_chat (user_id, display_name, avatar_url, body)
  VALUES (v_uid, coalesce(nullif(btrim(v_name), ''), 'Director'), v_avatar, v_body)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.post_world_chat(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.post_world_chat(text) TO authenticated;

-- ── Realtime ─────────────────────────────────────────────────────────────
-- Guarded ADD so re-running is a no-op.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'world_chat'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.world_chat';
  END IF;
END $$;
