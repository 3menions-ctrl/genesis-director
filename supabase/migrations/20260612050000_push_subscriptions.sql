-- ════════════════════════════════════════════════════════════════════════
-- Web Push subscriptions (OSS, no FCM/APNs dependency).
--
-- Each row stores a single browser's subscription (endpoint + keys).
-- The send-push edge function dispatches notifications via the standard
-- web-push protocol with VAPID auth — no Google/Apple intermediary.
-- ════════════════════════════════════════════════════════════════════════

-- The existing `push_subscriptions` table from 20260610051329 may or
-- may not exist on this project. Use CREATE TABLE IF NOT EXISTS to be
-- safe; if the prior schema differs the migration will no-op and the
-- existing schema wins.
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint         text NOT NULL,
  p256dh_key       text NOT NULL,
  auth_key         text NOT NULL,
  user_agent       text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  last_used_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Push subs self-manage" ON public.push_subscriptions;
CREATE POLICY "Push subs self-manage"
  ON public.push_subscriptions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Per-user push preference table (which notification types should push?)
CREATE TABLE IF NOT EXISTS public.push_preferences (
  user_id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  render_complete      boolean NOT NULL DEFAULT true,
  premiere_scheduled   boolean NOT NULL DEFAULT true,
  follower_milestone   boolean NOT NULL DEFAULT true,
  watch_party_starting boolean NOT NULL DEFAULT true,
  tip_received         boolean NOT NULL DEFAULT true,
  updated_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.push_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Push prefs self-manage" ON public.push_preferences;
CREATE POLICY "Push prefs self-manage"
  ON public.push_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
