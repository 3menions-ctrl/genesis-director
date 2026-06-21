-- First-party analytics engine — extends the (empty, unused) analytics_events
-- table into a rich product-event store with spoof-proof ingestion + admin read.
-- Uses existing `name` (event) + `payload` (properties); adds session/context cols.

ALTER TABLE public.analytics_events
  ADD COLUMN IF NOT EXISTS anonymous_id text,
  ADD COLUMN IF NOT EXISTS session_id   text,
  ADD COLUMN IF NOT EXISTS occurred_at  timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS path         text,
  ADD COLUMN IF NOT EXISTS referrer     text,
  ADD COLUMN IF NOT EXISTS utm          jsonb,
  ADD COLUMN IF NOT EXISTS context      jsonb;
ALTER TABLE public.analytics_events ALTER COLUMN payload SET DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS analytics_events_name_ts ON public.analytics_events (name, occurred_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_user_ts ON public.analytics_events (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_ts      ON public.analytics_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_session ON public.analytics_events (session_id);
CREATE INDEX IF NOT EXISTS analytics_events_payload ON public.analytics_events USING gin (payload);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS analytics_events_admin_read ON public.analytics_events;
CREATE POLICY analytics_events_admin_read ON public.analytics_events
  FOR SELECT USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.analytics_ingest(_events jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e jsonb; n int := 0;
BEGIN
  IF jsonb_typeof(_events) <> 'array' THEN RAISE EXCEPTION 'events must be a json array'; END IF;
  IF jsonb_array_length(_events) > 100 THEN RAISE EXCEPTION 'batch too large (max 100)'; END IF;
  FOR e IN SELECT * FROM jsonb_array_elements(_events) LOOP
    INSERT INTO public.analytics_events
      (name, user_id, anonymous_id, session_id, occurred_at, payload, path, referrer, utm, context)
    VALUES (
      left(coalesce(e->>'event','$unknown'), 120),
      auth.uid(),                                  -- server-stamped; cannot be spoofed
      left(e->>'anonymous_id', 64),
      left(e->>'session_id', 64),
      coalesce((e->>'occurred_at')::timestamptz, now()),
      coalesce(e->'properties', '{}'::jsonb),
      left(e->>'path', 512),
      left(e->>'referrer', 512),
      e->'utm',
      e->'context'
    );
    n := n + 1;
  END LOOP;
  RETURN n;
END$$;
REVOKE ALL ON FUNCTION public.analytics_ingest(jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.analytics_ingest(jsonb) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.analytics_event_counts(_since timestamptz DEFAULT now() - interval '7 days')
RETURNS TABLE(event text, hits bigint, actors bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT name AS event, count(*)::bigint AS hits,
         count(DISTINCT coalesce(user_id::text, anonymous_id))::bigint AS actors
  FROM public.analytics_events
  WHERE public.is_admin(auth.uid()) AND occurred_at >= _since
  GROUP BY name ORDER BY count(*) DESC
$$;
REVOKE ALL ON FUNCTION public.analytics_event_counts(timestamptz) FROM public;
GRANT EXECUTE ON FUNCTION public.analytics_event_counts(timestamptz) TO authenticated;
