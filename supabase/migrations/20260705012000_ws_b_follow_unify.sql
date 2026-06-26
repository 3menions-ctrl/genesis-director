-- WS-B / audit #24,#26: unify follow onto the canonical `follows` table.
--
-- Context (measured live 2026-06-26): `follows` was empty (every toggle_follow
-- insert had rolled back on the followee_id bug fixed in 20260705010000) while
-- the raw `user_follows` path held all 11 rows. `follows` also carried THREE
-- redundant notify triggers (triple-notify hazard).
--
-- This migration makes `follows` the single source of truth:
--  1. Dedupe the 3 notify triggers down to one — keep trg_notify_eh_follow
--     (uses the fn_notify_safe wrapper + actor name + /c/ deep-link + source tag).
--  2. Migrate the historical user_follows rows into follows WITHOUT firing the
--     surviving notify trigger (don't spam notifications for old follows).
--
-- Idempotent (DROP ... IF EXISTS, ON CONFLICT DO NOTHING). The FE was repointed
-- to write via the gated toggle_follow RPC and read from follows (PR #125).
-- `user_follows` is retained as a backstop and dropped in a follow-up once prod
-- is confirmed. This file matches what was applied via the Management API +
-- recorded in schema_migrations on 2026-06-26.

DROP TRIGGER IF EXISTS trg_fanout_notify_follow ON public.follows;
DROP TRIGGER IF EXISTS trg_notify_follow ON public.follows;

ALTER TABLE public.follows DISABLE TRIGGER trg_notify_eh_follow;

INSERT INTO public.follows (follower_id, followed_id, created_at)
  SELECT follower_id, following_id, created_at
    FROM public.user_follows
  ON CONFLICT (follower_id, followed_id) DO NOTHING;

ALTER TABLE public.follows ENABLE TRIGGER trg_notify_eh_follow;
