-- ════════════════════════════════════════════════════════════════════════
-- Watch parties — synchronized group viewing of any reel.
--
-- A host schedules a watch party for a reel; invitees join via the
-- party URL; once started, playback timestamp is synced via realtime
-- broadcast so everyone watches the same frame at the same time. A
-- chat sidebar runs alongside.
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.watch_parties (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reel_id       uuid NOT NULL REFERENCES public.published_reels(id) ON DELETE CASCADE,
  scheduled_at  timestamptz NOT NULL DEFAULT now(),
  status        text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'ended', 'cancelled')),
  title         text,
  is_public     boolean NOT NULL DEFAULT true,
  started_at    timestamptz,
  ended_at      timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_watch_parties_scheduled
  ON public.watch_parties (scheduled_at);

ALTER TABLE public.watch_parties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Watch parties public read"
  ON public.watch_parties FOR SELECT TO anon, authenticated
  USING (is_public = true OR host_id = auth.uid());

CREATE POLICY "Watch parties host writes"
  ON public.watch_parties FOR ALL TO authenticated
  USING (host_id = auth.uid()) WITH CHECK (host_id = auth.uid());

-- Invitees (RSVP-style) — for private parties.
CREATE TABLE IF NOT EXISTS public.watch_party_invites (
  party_id  uuid NOT NULL REFERENCES public.watch_parties(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (party_id, user_id)
);

ALTER TABLE public.watch_party_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Watch party invites self-or-host read"
  ON public.watch_party_invites FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.watch_parties wp
      WHERE wp.id = watch_party_invites.party_id AND wp.host_id = auth.uid()
    )
  );

CREATE POLICY "Watch party invites host writes"
  ON public.watch_party_invites FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.watch_parties wp
      WHERE wp.id = watch_party_invites.party_id AND wp.host_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.watch_parties wp
      WHERE wp.id = watch_party_invites.party_id AND wp.host_id = auth.uid()
    )
  );

-- Chat messages for the party — append-only.
CREATE TABLE IF NOT EXISTS public.watch_party_chat (
  id          bigserial PRIMARY KEY,
  party_id    uuid NOT NULL REFERENCES public.watch_parties(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body        text NOT NULL CHECK (length(body) BETWEEN 1 AND 500),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_watch_party_chat_party
  ON public.watch_party_chat (party_id, created_at DESC);

ALTER TABLE public.watch_party_chat ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Watch party chat public-or-invitee read"
  ON public.watch_party_chat FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.watch_parties wp
      WHERE wp.id = watch_party_chat.party_id
        AND (wp.is_public = true
             OR wp.host_id = auth.uid()
             OR EXISTS (SELECT 1 FROM public.watch_party_invites i
                        WHERE i.party_id = wp.id AND i.user_id = auth.uid()))
    )
  );

CREATE POLICY "Watch party chat auth append"
  ON public.watch_party_chat FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.watch_parties wp
      WHERE wp.id = watch_party_chat.party_id
        AND (wp.is_public = true
             OR wp.host_id = auth.uid()
             OR EXISTS (SELECT 1 FROM public.watch_party_invites i
                        WHERE i.party_id = wp.id AND i.user_id = auth.uid()))
    )
  );

-- ── RPC: schedule a party + invite list ─────────────────────────────
CREATE OR REPLACE FUNCTION public.schedule_watch_party(
  p_reel_id     uuid,
  p_scheduled_at timestamptz,
  p_title       text DEFAULT NULL,
  p_is_public   boolean DEFAULT true,
  p_invitee_ids uuid[] DEFAULT '{}'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_uid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  -- Reel must exist and be public (or owned by the host).
  PERFORM 1 FROM public.published_reels
    WHERE id = p_reel_id
      AND (NOT is_taken_down OR creator_id = auth.uid());
  IF NOT FOUND THEN RAISE EXCEPTION 'reel_not_found'; END IF;

  INSERT INTO public.watch_parties (host_id, reel_id, scheduled_at, title, is_public)
  VALUES (auth.uid(), p_reel_id, p_scheduled_at, p_title, p_is_public)
  RETURNING id INTO v_id;

  -- Invite people (skip self).
  FOREACH v_uid IN ARRAY p_invitee_ids LOOP
    IF v_uid IS NOT NULL AND v_uid <> auth.uid() THEN
      INSERT INTO public.watch_party_invites (party_id, user_id)
      VALUES (v_id, v_uid)
      ON CONFLICT DO NOTHING;
      -- Best-effort notification.
      BEGIN
        INSERT INTO public.notifications (user_id, type, title, body, data)
        VALUES (
          v_uid, 'watch_party_invite', 'Watch party invite',
          'You were invited to a watch party.',
          jsonb_build_object('party_id', v_id, 'reel_id', p_reel_id, 'scheduled_at', p_scheduled_at)
        );
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
  END LOOP;

  RETURN v_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.schedule_watch_party(uuid, timestamptz, text, boolean, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.schedule_watch_party(uuid, timestamptz, text, boolean, uuid[]) TO authenticated;
