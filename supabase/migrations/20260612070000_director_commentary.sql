-- ════════════════════════════════════════════════════════════════════════
-- Director's commentary — opt-in audio overlay for any reel.
--
-- A creator records a voice track that plays alongside their reel as
-- a togglable second audio track. Stored as a file in the
-- `director-commentary` storage bucket; the row references it + the
-- target reel and exposes a duration.
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.director_commentary (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id           uuid NOT NULL REFERENCES public.published_reels(id) ON DELETE CASCADE,
  director_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  audio_url         text NOT NULL,
  duration_seconds  numeric(6, 2),
  transcript        text,
  language          text NOT NULL DEFAULT 'en-US',
  -- Volume normalization hint so the player can blend cleanly with the
  -- reel's own audio. Range -24..0 dB.
  gain_db           numeric(4, 1) DEFAULT -4,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reel_id, director_id)
);

CREATE INDEX IF NOT EXISTS idx_director_commentary_reel
  ON public.director_commentary (reel_id);

ALTER TABLE public.director_commentary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Commentary public read" ON public.director_commentary;
CREATE POLICY "Commentary public read"
  ON public.director_commentary FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Commentary director writes" ON public.director_commentary;
CREATE POLICY "Commentary director writes"
  ON public.director_commentary FOR ALL TO authenticated
  USING (director_id = auth.uid())
  WITH CHECK (director_id = auth.uid());

-- ── Storage bucket — small files, public-read, user-scoped writes ──
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'director-commentary', 'director-commentary', true, 50 * 1024 * 1024,
  ARRAY['audio/webm', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/mpeg']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Commentary public read storage" ON storage.objects;
CREATE POLICY "Commentary public read storage"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'director-commentary');

DROP POLICY IF EXISTS "Commentary self-write storage" ON storage.objects;
CREATE POLICY "Commentary self-write storage"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'director-commentary'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Commentary self-update storage" ON storage.objects;
CREATE POLICY "Commentary self-update storage"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'director-commentary'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'director-commentary'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Commentary self-delete storage" ON storage.objects;
CREATE POLICY "Commentary self-delete storage"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'director-commentary'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
