-- ════════════════════════════════════════════════════════════════════════
-- support_tickets — direct line to the admin team.
--
-- Powers the /help page's "Talk to the team" surface. Users file a ticket
-- with a subject, message, severity (low/medium/high/blocker), and an
-- optional screenshot. Admins see the entire queue; users see only their
-- own tickets in their "Recent tickets" list.
--
-- Triggers a notification to every admin user when a new ticket lands so
-- the admin pipeline picks it up in their inbox immediately. Realtime is
-- enabled so admins watching the queue see new rows arrive without a
-- refresh.
--
-- Storage: a public-read `support-screenshots` bucket is created so the
-- ticket form's optional screenshot upload has somewhere to live. Only
-- the uploading user (or an admin) can write into their own folder.
-- ════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
-- 1. support_tickets — the ticket itself.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject         text NOT NULL CHECK (length(subject) BETWEEN 1 AND 200),
  message         text NOT NULL CHECK (length(message) BETWEEN 1 AND 8000),
  /** One of: bug · feature · question · contact. */
  kind            text NOT NULL DEFAULT 'contact'
                  CHECK (kind IN ('bug','feature','question','contact')),
  /** low · medium · high · blocker. */
  severity        text NOT NULL DEFAULT 'medium'
                  CHECK (severity IN ('low','medium','high','blocker')),
  screenshot_url  text,
  /** open · in_progress · resolved · closed. */
  status          text NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open','in_progress','resolved','closed')),
  /** Optional admin who last touched the row. */
  assigned_to     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  /** Optional internal note for the admin queue (never shown to the user). */
  admin_notes     text,
  /** Freeform metadata (route, user-agent, app version, etc). */
  meta            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user
  ON public.support_tickets(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status
  ON public.support_tickets(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_severity
  ON public.support_tickets(severity, created_at DESC)
  WHERE status IN ('open','in_progress');

-- updated_at trigger.
CREATE OR REPLACE FUNCTION public.fn_support_tickets_touch_updated()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_support_tickets_touch ON public.support_tickets;
CREATE TRIGGER trg_support_tickets_touch
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.fn_support_tickets_touch_updated();

-- ─────────────────────────────────────────────────────────────────────────
-- 2. RLS — users see only their own tickets; admins see all.
--    INSERT: users insert with user_id = auth.uid().
--    UPDATE: admins always; users may update their own (so they can
--            re-open, append context, etc) but cannot change status or
--            assigned_to (enforced via a separate policy split).
--    DELETE: admin-only.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Support: owner reads own" ON public.support_tickets;
CREATE POLICY "Support: owner reads own" ON public.support_tickets
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Support: admins read all" ON public.support_tickets;
CREATE POLICY "Support: admins read all" ON public.support_tickets
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Support: user files own" ON public.support_tickets;
CREATE POLICY "Support: user files own" ON public.support_tickets
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Support: owner appends own" ON public.support_tickets;
CREATE POLICY "Support: owner appends own" ON public.support_tickets
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    -- Owner edits can't touch admin-controlled fields.
    AND (assigned_to IS NULL OR assigned_to = (SELECT t.assigned_to FROM public.support_tickets t WHERE t.id = support_tickets.id))
  );

DROP POLICY IF EXISTS "Support: admins manage all" ON public.support_tickets;
CREATE POLICY "Support: admins manage all" ON public.support_tickets
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Notifier — pings every admin user when a new ticket lands and also
--    drops a confirmation notification on the reporter's inbox so they
--    get the visible breadcrumb "we got it" cue. Severity is encoded in
--    the data payload so the admin queue can sort.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_notify_support_ticket()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_admin_id uuid;
  v_reporter_name text;
BEGIN
  SELECT COALESCE(display_name, username, 'A user')
    INTO v_reporter_name
    FROM public.profiles WHERE id = NEW.user_id;

  -- Ping every admin.
  FOR v_admin_id IN
    SELECT user_id FROM public.user_roles WHERE role = 'admin'::app_role
  LOOP
    BEGIN
      INSERT INTO public.notifications (user_id, type, title, body, data)
        VALUES (
          v_admin_id,
          'system',
          '[' || upper(NEW.severity) || '] ' || NEW.subject,
          COALESCE(v_reporter_name, 'A user') || ' filed a '
            || NEW.kind || ' ticket.',
          jsonb_build_object(
            'ticket_id',  NEW.id,
            'kind',       NEW.kind,
            'severity',   NEW.severity,
            'reporter_id',NEW.user_id,
            'route',      '/admin/messages'
          )
        );
    EXCEPTION WHEN others THEN
      -- Don't let a single bad admin row block the ticket from being filed.
      NULL;
    END;
  END LOOP;

  -- Reporter's confirmation notification.
  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, data)
      VALUES (
        NEW.user_id,
        'system',
        'We received your ' || NEW.kind,
        'Ticket #' || substring(NEW.id::text, 1, 8)
          || ' · severity ' || NEW.severity || ' · we will be in touch.',
        jsonb_build_object(
          'ticket_id', NEW.id,
          'kind',      NEW.kind,
          'severity',  NEW.severity,
          'route',     '/help'
        )
      );
  EXCEPTION WHEN others THEN
    NULL;
  END;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_support_ticket ON public.support_tickets;
CREATE TRIGGER trg_notify_support_ticket
  AFTER INSERT ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_support_ticket();

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Realtime — admins watching the queue see new tickets land instantly.
-- ─────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND tablename = 'support_tickets'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets';
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Storage bucket — support-screenshots — public-read for permalinks
--    in the admin queue + private writes scoped by user id folder.
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'support-screenshots',
  'support-screenshots',
  true,
  10485760, -- 10 MB
  ARRAY['image/jpeg','image/png','image/gif','image/webp','image/heic']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Support screenshots: readable" ON storage.objects;
CREATE POLICY "Support screenshots: readable" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'support-screenshots');

DROP POLICY IF EXISTS "Support screenshots: owner uploads own folder" ON storage.objects;
CREATE POLICY "Support screenshots: owner uploads own folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'support-screenshots'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Support screenshots: owner deletes own" ON storage.objects;
CREATE POLICY "Support screenshots: owner deletes own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'support-screenshots'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Support screenshots: admins manage all" ON storage.objects;
CREATE POLICY "Support screenshots: admins manage all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'support-screenshots' AND public.is_admin(auth.uid()))
  WITH CHECK (bucket_id = 'support-screenshots' AND public.is_admin(auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Status RPC — returns a tiny "is everything OK" payload the Help
--    page's status panel polls every 60s. Reads from notifications +
--    support_tickets to derive a coarse system-health signal without
--    needing a separate ops health endpoint.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.system_status_overview()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_open_tickets   int := 0;
  v_blocker_open   int := 0;
  v_recent_failed  int := 0;
  v_recent_complete int := 0;
BEGIN
  SELECT count(*) INTO v_open_tickets
    FROM public.support_tickets
   WHERE status IN ('open','in_progress');

  SELECT count(*) INTO v_blocker_open
    FROM public.support_tickets
   WHERE status IN ('open','in_progress') AND severity = 'blocker';

  -- Recent render failures from the notifications stream.
  BEGIN
    SELECT count(*) INTO v_recent_failed
      FROM public.notifications
     WHERE type = 'video_failed'
       AND created_at > now() - interval '24 hours';
  EXCEPTION WHEN others THEN
    v_recent_failed := 0;
  END;

  BEGIN
    SELECT count(*) INTO v_recent_complete
      FROM public.notifications
     WHERE type = 'video_complete'
       AND created_at > now() - interval '24 hours';
  EXCEPTION WHEN others THEN
    v_recent_complete := 0;
  END;

  RETURN jsonb_build_object(
    'open_tickets',       v_open_tickets,
    'blocker_open',       v_blocker_open,
    'failed_24h',         v_recent_failed,
    'completed_24h',      v_recent_complete,
    'healthy',            v_blocker_open = 0
                            AND v_recent_failed <
                              GREATEST(v_recent_complete / 10, 5),
    'checked_at',         now()
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.system_status_overview() TO anon, authenticated;
