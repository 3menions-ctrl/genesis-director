-- ============================================================
-- UNIFIED USER MEDIA LIBRARY
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.movie_projects(id) ON DELETE SET NULL,
  media_type text NOT NULL CHECK (media_type IN ('image','audio','video')),
  asset_url text NOT NULL,
  thumbnail_url text,
  source text,                 -- e.g. 'generate-scene-images', 'generate-voice', 'kling-v3'
  engine text,                 -- e.g. 'flux-1.1-pro', 'elevenlabs', 'kling-v3', 'seedance'
  generation_mode text,        -- e.g. 'avatar', 'seedance', 'scene', 'text-to-image'
  prompt text,
  title text,
  duration_seconds numeric,
  width int,
  height int,
  file_size_bytes bigint,
  mime_type text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_favorite boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_media_assets_user_idx
  ON public.user_media_assets (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_media_assets_user_type_idx
  ON public.user_media_assets (user_id, media_type, created_at DESC);
CREATE INDEX IF NOT EXISTS user_media_assets_project_idx
  ON public.user_media_assets (project_id);
CREATE UNIQUE INDEX IF NOT EXISTS user_media_assets_user_url_unique
  ON public.user_media_assets (user_id, asset_url);

ALTER TABLE public.user_media_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own media" ON public.user_media_assets;
CREATE POLICY "Users view own media"
  ON public.user_media_assets FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own media" ON public.user_media_assets;
CREATE POLICY "Users insert own media"
  ON public.user_media_assets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own media" ON public.user_media_assets;
CREATE POLICY "Users update own media"
  ON public.user_media_assets FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own media" ON public.user_media_assets;
CREATE POLICY "Users delete own media"
  ON public.user_media_assets FOR DELETE
  USING (auth.uid() = user_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_user_media_assets()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_media_assets_touch ON public.user_media_assets;
CREATE TRIGGER user_media_assets_touch
BEFORE UPDATE ON public.user_media_assets
FOR EACH ROW EXECUTE FUNCTION public.touch_user_media_assets();

-- ============================================================
-- record_user_media: safe upsert callable by edge functions
-- ============================================================
CREATE OR REPLACE FUNCTION public.record_user_media(
  p_user_id uuid,
  p_media_type text,
  p_asset_url text,
  p_project_id uuid DEFAULT NULL,
  p_source text DEFAULT NULL,
  p_engine text DEFAULT NULL,
  p_generation_mode text DEFAULT NULL,
  p_prompt text DEFAULT NULL,
  p_title text DEFAULT NULL,
  p_thumbnail_url text DEFAULT NULL,
  p_duration_seconds numeric DEFAULT NULL,
  p_width int DEFAULT NULL,
  p_height int DEFAULT NULL,
  p_file_size_bytes bigint DEFAULT NULL,
  p_mime_type text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_user_id IS NULL OR p_asset_url IS NULL OR p_media_type IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.user_media_assets (
    user_id, project_id, media_type, asset_url, thumbnail_url,
    source, engine, generation_mode, prompt, title,
    duration_seconds, width, height, file_size_bytes, mime_type, metadata
  )
  VALUES (
    p_user_id, p_project_id, p_media_type, p_asset_url, p_thumbnail_url,
    p_source, p_engine, p_generation_mode, p_prompt, p_title,
    p_duration_seconds, p_width, p_height, p_file_size_bytes, p_mime_type, COALESCE(p_metadata,'{}'::jsonb)
  )
  ON CONFLICT (user_id, asset_url) DO UPDATE
    SET project_id = COALESCE(EXCLUDED.project_id, public.user_media_assets.project_id),
        thumbnail_url = COALESCE(EXCLUDED.thumbnail_url, public.user_media_assets.thumbnail_url),
        source = COALESCE(EXCLUDED.source, public.user_media_assets.source),
        engine = COALESCE(EXCLUDED.engine, public.user_media_assets.engine),
        generation_mode = COALESCE(EXCLUDED.generation_mode, public.user_media_assets.generation_mode),
        prompt = COALESCE(EXCLUDED.prompt, public.user_media_assets.prompt),
        title = COALESCE(EXCLUDED.title, public.user_media_assets.title),
        duration_seconds = COALESCE(EXCLUDED.duration_seconds, public.user_media_assets.duration_seconds),
        width = COALESCE(EXCLUDED.width, public.user_media_assets.width),
        height = COALESCE(EXCLUDED.height, public.user_media_assets.height),
        file_size_bytes = COALESCE(EXCLUDED.file_size_bytes, public.user_media_assets.file_size_bytes),
        mime_type = COALESCE(EXCLUDED.mime_type, public.user_media_assets.mime_type),
        metadata = public.user_media_assets.metadata || EXCLUDED.metadata,
        updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_user_media(uuid,text,text,uuid,text,text,text,text,text,text,numeric,int,int,bigint,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_user_media(uuid,text,text,uuid,text,text,text,text,text,text,numeric,int,int,bigint,text,jsonb) TO authenticated, service_role;

-- ============================================================
-- get_user_media_library: caller's own assets, newest first
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_media_library(
  p_media_type text DEFAULT NULL,
  p_project_id uuid DEFAULT NULL,
  p_limit int DEFAULT 200,
  p_offset int DEFAULT 0
)
RETURNS SETOF public.user_media_assets
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT *
  FROM public.user_media_assets
  WHERE user_id = auth.uid()
    AND is_archived = false
    AND (p_media_type IS NULL OR media_type = p_media_type)
    AND (p_project_id IS NULL OR project_id = p_project_id)
  ORDER BY created_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 500))
  OFFSET GREATEST(0, p_offset);
$$;

REVOKE EXECUTE ON FUNCTION public.get_user_media_library(text,uuid,int,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_media_library(text,uuid,int,int) TO authenticated;

-- ============================================================
-- BACKFILL from existing rows
-- ============================================================

-- Video clips → video assets
INSERT INTO public.user_media_assets (
  user_id, project_id, media_type, asset_url, thumbnail_url,
  source, engine, generation_mode, prompt, duration_seconds, created_at
)
SELECT
  vc.user_id,
  vc.project_id,
  'video',
  vc.video_url,
  vc.last_frame_url,
  'video_clips',
  COALESCE(vc.video_engine, vc.engine),
  COALESCE(vc.generation_mode, 'scene'),
  vc.prompt,
  vc.duration_seconds,
  vc.created_at
FROM public.video_clips vc
WHERE vc.video_url IS NOT NULL
  AND vc.user_id IS NOT NULL
ON CONFLICT (user_id, asset_url) DO NOTHING;

-- movie_projects.video_url (final stitched film)
INSERT INTO public.user_media_assets (
  user_id, project_id, media_type, asset_url, thumbnail_url,
  source, engine, generation_mode, title, created_at
)
SELECT
  mp.user_id,
  mp.id,
  'video',
  mp.video_url,
  mp.thumbnail_url,
  'movie_projects.final',
  mp.video_engine,
  mp.mode,
  mp.title,
  mp.created_at
FROM public.movie_projects mp
WHERE mp.video_url IS NOT NULL
  AND mp.user_id IS NOT NULL
ON CONFLICT (user_id, asset_url) DO NOTHING;

-- voice audio
INSERT INTO public.user_media_assets (
  user_id, project_id, media_type, asset_url, source, generation_mode, created_at
)
SELECT
  mp.user_id, mp.id, 'audio', mp.voice_audio_url,
  'generate-voice', 'voice', mp.created_at
FROM public.movie_projects mp
WHERE mp.voice_audio_url IS NOT NULL
  AND mp.user_id IS NOT NULL
ON CONFLICT (user_id, asset_url) DO NOTHING;

-- music
INSERT INTO public.user_media_assets (
  user_id, project_id, media_type, asset_url, source, generation_mode, created_at
)
SELECT
  mp.user_id, mp.id, 'audio', mp.music_url,
  'generate-music', 'music', mp.created_at
FROM public.movie_projects mp
WHERE mp.music_url IS NOT NULL
  AND mp.user_id IS NOT NULL
ON CONFLICT (user_id, asset_url) DO NOTHING;

-- source images (scene reference)
INSERT INTO public.user_media_assets (
  user_id, project_id, media_type, asset_url, source, generation_mode, created_at
)
SELECT
  mp.user_id, mp.id, 'image', mp.source_image_url,
  'movie_projects.source', 'reference', mp.created_at
FROM public.movie_projects mp
WHERE mp.source_image_url IS NOT NULL
  AND mp.user_id IS NOT NULL
ON CONFLICT (user_id, asset_url) DO NOTHING;