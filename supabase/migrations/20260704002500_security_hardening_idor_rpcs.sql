-- Non-balance-mutating security hardening (2026-06-25 bug hunt).
-- IDOR ownership guard + revoke over-granted RPCs.

-- 1) record_user_media: an authenticated caller may only write to their OWN
--    media library. Was IDOR (arbitrary p_user_id → inject/overwrite any
--    user's rows via ON CONFLICT). Service-role calls (auth.uid() IS NULL)
--    are unaffected; frontend callers already pass their own user.id.
CREATE OR REPLACE FUNCTION public.record_user_media(p_user_id uuid, p_media_type text, p_asset_url text, p_project_id uuid DEFAULT NULL::uuid, p_source text DEFAULT NULL::text, p_engine text DEFAULT NULL::text, p_generation_mode text DEFAULT NULL::text, p_prompt text DEFAULT NULL::text, p_title text DEFAULT NULL::text, p_thumbnail_url text DEFAULT NULL::text, p_duration_seconds numeric DEFAULT NULL::numeric, p_width integer DEFAULT NULL::integer, p_height integer DEFAULT NULL::integer, p_file_size_bytes bigint DEFAULT NULL::bigint, p_mime_type text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  -- Ownership guard (added 2026-06-25). auth.uid() IS NULL for service-role.
  IF auth.uid() IS NOT NULL AND p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'record_user_media: cannot write to another user''s library';
  END IF;

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
$function$;

-- 2) Revoke EXECUTE on RPCs with only service-role / no legitimate client
--    callers (verified). Closes IDOR (creator earnings) + anon info-leaks
--    (quiet-hours / email-preference oracle). service_role retains EXECUTE,
--    so the edge functions that use these keep working.
REVOKE EXECUTE ON FUNCTION public.creator_pending_payout_cents(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_within_quiet_hours(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_within_quiet_hours(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.should_send_email_to(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.should_send_email_to(uuid, text) TO service_role;
