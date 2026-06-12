-- Reusable creative atoms — Cast / Locations / Looks / Voices / Pins / Director Memory.
--
-- Everything a director would compose with — characters they've created,
-- locations they've shot in, looks (style presets) they've dialed in, voices
-- they trust, and the projects they've pinned to their focus tray — lives in
-- per-user libraries so the work compounds project to project.

-- ── Director's Library: Cast ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.director_cast (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  -- The reference image / hero image. Used to lock visual consistency.
  reference_image_url text,
  preview_video_url text,
  -- The provider-level identity token (e.g. a Replicate trained LoRA id, an
  -- avatar id from the source generation, a face embedding) so future
  -- generations can call this character consistently.
  identity_token text,
  -- Free-form attributes — wardrobe, traits, age, archetype.
  attributes jsonb DEFAULT '{}'::jsonb,
  tags text[] DEFAULT '{}'::text[],
  appearance_count int NOT NULL DEFAULT 0,
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dcast_user ON public.director_cast(user_id, updated_at DESC);
ALTER TABLE public.director_cast ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dcast_self_all" ON public.director_cast;
CREATE POLICY "dcast_self_all" ON public.director_cast FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── Director's Library: Locations ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.director_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  reference_image_url text,
  -- Time of day / weather defaults to apply when reused.
  time_of_day text CHECK (time_of_day IS NULL OR time_of_day IN ('day','night','dusk','dawn','golden','blue_hour','overcast')),
  int_ext text CHECK (int_ext IS NULL OR int_ext IN ('INT','EXT','INT_EXT')),
  vibe text,
  attributes jsonb DEFAULT '{}'::jsonb,
  tags text[] DEFAULT '{}'::text[],
  use_count int NOT NULL DEFAULT 0,
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dlocs_user ON public.director_locations(user_id, updated_at DESC);
ALTER TABLE public.director_locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dlocs_self_all" ON public.director_locations;
CREATE POLICY "dlocs_self_all" ON public.director_locations FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── Director's Library: Looks (style presets) ────────────────────────────
CREATE TABLE IF NOT EXISTS public.director_looks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  reference_image_url text,
  -- The core grading payload — palette, LUT pointer, contrast, exposure, etc.
  palette jsonb DEFAULT '{}'::jsonb,
  -- Lens behavior — depth-of-field, focal length, motion.
  lens jsonb DEFAULT '{}'::jsonb,
  -- Free-form style prompt that gets appended to generation calls.
  prompt_suffix text,
  signature_score int,                     -- 0–100 how strongly this matches user's taste
  use_count int NOT NULL DEFAULT 0,
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dlooks_user ON public.director_looks(user_id, updated_at DESC);
ALTER TABLE public.director_looks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dlooks_self_all" ON public.director_looks;
CREATE POLICY "dlooks_self_all" ON public.director_looks FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── Director's Library: Voices ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.director_voices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  preview_audio_url text,
  -- ElevenLabs / provider voice id.
  external_voice_id text,
  provider text NOT NULL DEFAULT 'elevenlabs',
  language text DEFAULT 'en',
  attributes jsonb DEFAULT '{}'::jsonb,
  tags text[] DEFAULT '{}'::text[],
  use_count int NOT NULL DEFAULT 0,
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dvoices_user ON public.director_voices(user_id, updated_at DESC);
ALTER TABLE public.director_voices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dvoices_self_all" ON public.director_voices;
CREATE POLICY "dvoices_self_all" ON public.director_voices FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── Project pins (focus tray) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.director_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.movie_projects(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  pinned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, project_id)
);
CREATE INDEX IF NOT EXISTS idx_dpins_user ON public.director_pins(user_id, position);
ALTER TABLE public.director_pins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dpins_self_all" ON public.director_pins;
CREATE POLICY "dpins_self_all" ON public.director_pins FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── Director Memory (silent personalization) ───────────────────────────
CREATE TABLE IF NOT EXISTS public.director_memory (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_mode text,
  preferred_style text,
  preferred_aspect_ratio text,
  preferred_clip_count int,
  preferred_clip_duration int,
  preferred_voice_id uuid REFERENCES public.director_voices(id) ON DELETE SET NULL,
  -- Rolling counts so we can build a signature without re-querying.
  mode_counts jsonb DEFAULT '{}'::jsonb,
  style_counts jsonb DEFAULT '{}'::jsonb,
  aspect_counts jsonb DEFAULT '{}'::jsonb,
  last_active_at timestamptz,
  total_projects int NOT NULL DEFAULT 0,
  total_credits_spent int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.director_memory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dmem_self_all" ON public.director_memory;
CREATE POLICY "dmem_self_all" ON public.director_memory FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── Per-shot Takes (variations browser) ────────────────────────────────
-- For a given video_clips row, a "take" is one alternate generation. Users
-- request "three more takes" of any clip and review them like dailies.
CREATE TABLE IF NOT EXISTS public.shot_takes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.movie_projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shot_index int NOT NULL,
  take_number int NOT NULL,
  video_url text,
  thumbnail_url text,
  status text NOT NULL DEFAULT 'generating' CHECK (status IN ('generating','ready','failed','selected')),
  prediction_id text,
  prompt_used text,
  credit_cost int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  ready_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_takes_project ON public.shot_takes(project_id, shot_index, take_number);
CREATE INDEX IF NOT EXISTS idx_takes_user ON public.shot_takes(user_id);
ALTER TABLE public.shot_takes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "takes_self_all" ON public.shot_takes;
CREATE POLICY "takes_self_all" ON public.shot_takes FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── Project public share slugs ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL UNIQUE REFERENCES public.movie_projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  is_public boolean NOT NULL DEFAULT true,
  show_credits boolean NOT NULL DEFAULT true,
  show_replay boolean NOT NULL DEFAULT true,
  view_count int NOT NULL DEFAULT 0,
  remix_count int NOT NULL DEFAULT 0,
  -- Auto-generated trailer + making-of artifacts.
  trailer_url text,
  trailer_generated_at timestamptz,
  making_of_url text,
  making_of_generated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_shares_slug ON public.project_shares(slug);
ALTER TABLE public.project_shares ENABLE ROW LEVEL SECURITY;
-- Owner can do anything to their own share record.
DROP POLICY IF EXISTS "shares_owner_all" ON public.project_shares;
CREATE POLICY "shares_owner_all" ON public.project_shares FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- Public SELECT only when is_public = true (so any visitor on /p/{slug} reads
-- the row without auth).
DROP POLICY IF EXISTS "shares_public_read" ON public.project_shares;
CREATE POLICY "shares_public_read" ON public.project_shares FOR SELECT
  USING (is_public = true);

-- Slug generator RPC: pulls a stable, human-readable slug from a short base
-- and appends a 4-char suffix for uniqueness. Idempotent for re-share.
CREATE OR REPLACE FUNCTION public.mint_project_share_slug(p_project_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_existing text;
  v_title text;
  v_base text;
  v_slug text;
  v_attempts int := 0;
BEGIN
  SELECT user_id, title INTO v_user, v_title FROM public.movie_projects WHERE id = p_project_id;
  IF v_user IS NULL THEN RAISE EXCEPTION 'project not found'; END IF;
  IF v_user <> auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;

  -- Re-share idempotency.
  SELECT slug INTO v_existing FROM public.project_shares WHERE project_id = p_project_id;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  v_base := lower(regexp_replace(coalesce(v_title, 'shot'), '[^a-zA-Z0-9]+', '-', 'g'));
  v_base := trim(both '-' from v_base);
  IF length(v_base) = 0 THEN v_base := 'shot'; END IF;
  IF length(v_base) > 32 THEN v_base := substring(v_base from 1 for 32); END IF;

  LOOP
    v_attempts := v_attempts + 1;
    v_slug := v_base || '-' || lower(substring(md5(random()::text || clock_timestamp()::text) from 1 for 4));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.project_shares WHERE slug = v_slug);
    IF v_attempts > 6 THEN RAISE EXCEPTION 'could not mint slug'; END IF;
  END LOOP;

  INSERT INTO public.project_shares (project_id, user_id, slug)
  VALUES (p_project_id, v_user, v_slug);

  RETURN v_slug;
END;
$$;
GRANT EXECUTE ON FUNCTION public.mint_project_share_slug(uuid) TO authenticated;
