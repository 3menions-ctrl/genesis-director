CREATE OR REPLACE FUNCTION public.reconcile_user_media()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_inserted int := 0;
  v_added int;
BEGIN
  IF v_user IS NULL THEN
    RETURN 0;
  END IF;

  WITH ins AS (
    INSERT INTO public.user_media_assets (
      user_id, project_id, media_type, asset_url, thumbnail_url,
      source, engine, generation_mode, prompt, duration_seconds, created_at
    )
    SELECT vc.user_id, vc.project_id, 'video', vc.video_url,
           COALESCE(vc.last_frame_url, vc.end_image_url, vc.start_image_url),
           'video_clips',
           COALESCE(vc.video_engine, vc.engine),
           COALESCE(vc.generation_mode, 'scene'),
           vc.prompt, vc.duration_seconds, vc.created_at
    FROM public.video_clips vc
    WHERE vc.user_id = v_user AND vc.video_url IS NOT NULL
    ON CONFLICT (user_id, asset_url) DO NOTHING
    RETURNING 1
  ) SELECT count(*) INTO v_added FROM ins;
  v_inserted := v_inserted + COALESCE(v_added, 0);

  WITH ins AS (
    INSERT INTO public.user_media_assets (
      user_id, project_id, media_type, asset_url,
      source, generation_mode, prompt, created_at
    )
    SELECT vc.user_id, vc.project_id, 'image', f.url,
           'video_clips.frame', COALESCE(vc.generation_mode, 'scene'),
           vc.prompt, vc.created_at
    FROM public.video_clips vc
    CROSS JOIN LATERAL (
      VALUES (vc.start_image_url), (vc.end_image_url), (vc.last_frame_url)
    ) AS f(url)
    WHERE vc.user_id = v_user AND f.url IS NOT NULL
    ON CONFLICT (user_id, asset_url) DO NOTHING
    RETURNING 1
  ) SELECT count(*) INTO v_added FROM ins;
  v_inserted := v_inserted + COALESCE(v_added, 0);

  WITH ins AS (
    INSERT INTO public.user_media_assets (
      user_id, project_id, media_type, asset_url, thumbnail_url,
      source, engine, generation_mode, title, created_at
    )
    SELECT mp.user_id, mp.id, 'video', mp.video_url, mp.thumbnail_url,
           'movie_projects.final', mp.video_engine, mp.mode, mp.title, mp.created_at
    FROM public.movie_projects mp
    WHERE mp.user_id = v_user AND mp.video_url IS NOT NULL
    ON CONFLICT (user_id, asset_url) DO NOTHING
    RETURNING 1
  ) SELECT count(*) INTO v_added FROM ins;
  v_inserted := v_inserted + COALESCE(v_added, 0);

  WITH ins AS (
    INSERT INTO public.user_media_assets (
      user_id, project_id, media_type, asset_url,
      source, generation_mode, created_at
    )
    SELECT mp.user_id, mp.id, 'audio', mp.voice_audio_url,
           'generate-voice', 'voice', mp.created_at
    FROM public.movie_projects mp
    WHERE mp.user_id = v_user AND mp.voice_audio_url IS NOT NULL
    ON CONFLICT (user_id, asset_url) DO NOTHING
    RETURNING 1
  ) SELECT count(*) INTO v_added FROM ins;
  v_inserted := v_inserted + COALESCE(v_added, 0);

  WITH ins AS (
    INSERT INTO public.user_media_assets (
      user_id, project_id, media_type, asset_url,
      source, generation_mode, created_at
    )
    SELECT mp.user_id, mp.id, 'audio', mp.music_url,
           'generate-music', 'music', mp.created_at
    FROM public.movie_projects mp
    WHERE mp.user_id = v_user AND mp.music_url IS NOT NULL
    ON CONFLICT (user_id, asset_url) DO NOTHING
    RETURNING 1
  ) SELECT count(*) INTO v_added FROM ins;
  v_inserted := v_inserted + COALESCE(v_added, 0);

  WITH ins AS (
    INSERT INTO public.user_media_assets (
      user_id, project_id, media_type, asset_url,
      source, generation_mode, created_at
    )
    SELECT mp.user_id, mp.id, 'image', mp.source_image_url,
           'movie_projects.source', 'reference', mp.created_at
    FROM public.movie_projects mp
    WHERE mp.user_id = v_user AND mp.source_image_url IS NOT NULL
    ON CONFLICT (user_id, asset_url) DO NOTHING
    RETURNING 1
  ) SELECT count(*) INTO v_added FROM ins;
  v_inserted := v_inserted + COALESCE(v_added, 0);

  WITH ins AS (
    INSERT INTO public.user_media_assets (
      user_id, project_id, media_type, asset_url,
      source, generation_mode, created_at
    )
    SELECT mp.user_id, mp.id, 'image', img_url,
           'movie_projects.scene', 'scene', mp.created_at
    FROM public.movie_projects mp
    CROSS JOIN LATERAL jsonb_array_elements_text(
      CASE jsonb_typeof(mp.scene_images)
        WHEN 'array' THEN mp.scene_images ELSE '[]'::jsonb END
    ) AS img_url
    WHERE mp.user_id = v_user
      AND img_url IS NOT NULL
      AND img_url <> ''
      AND img_url ~* '^https?://'
    ON CONFLICT (user_id, asset_url) DO NOTHING
    RETURNING 1
  ) SELECT count(*) INTO v_added FROM ins;
  v_inserted := v_inserted + COALESCE(v_added, 0);

  RETURN v_inserted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reconcile_user_media() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_user_media() TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.user_media_assets;