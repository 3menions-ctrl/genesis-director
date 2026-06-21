-- ════════════════════════════════════════════════════════════════════════
-- Live co-streaming rooms — an independent module.
--
-- Media is peer-to-peer (WebRTC, signaled over Supabase Realtime); this
-- table is just discovery + room state. A room has ONE host and AT MOST
-- one guest broadcaster (cap = 2 broadcasters). Everyone else is audience.
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.live_rooms (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  guest_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title       text NOT NULL DEFAULT 'Live',
  kind        text NOT NULL DEFAULT 'person' CHECK (kind IN ('person','show','performance')),
  status      text NOT NULL DEFAULT 'live'  CHECK (status IN ('live','ended')),
  started_at  timestamptz NOT NULL DEFAULT now(),
  ended_at    timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_live_rooms_status ON public.live_rooms(status, started_at DESC);

ALTER TABLE public.live_rooms ENABLE ROW LEVEL SECURITY;

-- Anyone can discover/watch a live room.
DROP POLICY IF EXISTS "live_rooms readable" ON public.live_rooms;
CREATE POLICY "live_rooms readable" ON public.live_rooms FOR SELECT USING (true);

-- A host creates their own room.
DROP POLICY IF EXISTS "live_rooms host inserts" ON public.live_rooms;
CREATE POLICY "live_rooms host inserts" ON public.live_rooms
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = host_id);

-- Host or the seated guest can update (retitle / end).
DROP POLICY IF EXISTS "live_rooms participant updates" ON public.live_rooms;
CREATE POLICY "live_rooms participant updates" ON public.live_rooms
  FOR UPDATE TO authenticated
  USING (auth.uid() = host_id OR auth.uid() = guest_id)
  WITH CHECK (auth.uid() = host_id OR auth.uid() = guest_id);

-- Claim the single guest broadcaster seat atomically (a viewer who isn't
-- on the row yet can take the open seat). Caps broadcasters at 2.
CREATE OR REPLACE FUNCTION public.claim_live_guest_seat(p_room_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ok boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  UPDATE public.live_rooms
    SET guest_id = auth.uid()
    WHERE id = p_room_id
      AND status = 'live'
      AND guest_id IS NULL
      AND host_id <> auth.uid()
  RETURNING true INTO v_ok;
  RETURN COALESCE(v_ok, false);
END $$;

-- Vacate the guest seat (guest leaves the stage but room stays live).
CREATE OR REPLACE FUNCTION public.vacate_live_guest_seat(p_room_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.live_rooms SET guest_id = NULL
    WHERE id = p_room_id AND guest_id = auth.uid();
END $$;

-- Host ends the room.
CREATE OR REPLACE FUNCTION public.end_live_room(p_room_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.live_rooms SET status = 'ended', ended_at = now()
    WHERE id = p_room_id AND host_id = auth.uid();
END $$;

-- Realtime so the lobby + rooms react to live/end + guest-seat changes.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'live_rooms'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.live_rooms';
  END IF;
  EXECUTE 'ALTER TABLE public.live_rooms REPLICA IDENTITY FULL';
END $$;
