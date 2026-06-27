-- ════════════════════════════════════════════════════════════════════════
-- World Chat — image attachments.
--
-- Adds an optional image to a world_chat message: a new image_url column, a
-- relaxed content constraint (an image-only message — no text — is allowed),
-- a public storage bucket for chat images, and an updated post_world_chat()
-- that accepts an image URL (validated to be from our own chat bucket so the
-- field can't be used to embed arbitrary remote URLs).
--
-- Zero-downtime: the RPC becomes post_world_chat(p_body, p_image_url DEFAULT
-- NULL) and the old 1-arg version is dropped. The currently-deployed client
-- calls it with only p_body, which resolves to the new function via the
-- default — so prod keeps working before the new client ships.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.world_chat ADD COLUMN IF NOT EXISTS image_url text;

-- Relax the content rule: text (1–500) OR an image must be present.
ALTER TABLE public.world_chat DROP CONSTRAINT IF EXISTS world_chat_body_check;
ALTER TABLE public.world_chat DROP CONSTRAINT IF EXISTS world_chat_content_check;
ALTER TABLE public.world_chat ALTER COLUMN body DROP NOT NULL;
ALTER TABLE public.world_chat
  ADD CONSTRAINT world_chat_content_check CHECK (
    length(coalesce(body, '')) <= 500
    AND (length(btrim(coalesce(body, ''))) >= 1 OR image_url IS NOT NULL)
  );

-- ── Public bucket for chat images ────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('world-chat', 'world-chat', true, 10485760,
        ARRAY['image/jpeg','image/png','image/gif','image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = 10485760,
      allowed_mime_types = ARRAY['image/jpeg','image/png','image/gif','image/webp'];

-- Public read; each user uploads/deletes only within their own {uid}/ folder.
DROP POLICY IF EXISTS "World chat images readable" ON storage.objects;
CREATE POLICY "World chat images readable" ON storage.objects
  FOR SELECT USING (bucket_id = 'world-chat');

DROP POLICY IF EXISTS "World chat images owner upload" ON storage.objects;
CREATE POLICY "World chat images owner upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'world-chat' AND (auth.uid())::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "World chat images owner delete" ON storage.objects;
CREATE POLICY "World chat images owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'world-chat' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- ── RPC: post a message (now with optional image) ────────────────────────
DROP FUNCTION IF EXISTS public.post_world_chat(text);

CREATE OR REPLACE FUNCTION public.post_world_chat(p_body text, p_image_url text DEFAULT NULL)
RETURNS public.world_chat
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid         uuid := auth.uid();
  v_body        text := btrim(coalesce(p_body, ''));
  v_img         text := nullif(btrim(coalesce(p_image_url, '')), '');
  v_name        text;
  v_avatar      text;
  v_suspended   timestamptz;
  v_deactivated timestamptz;
  v_row         public.world_chat;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF length(v_body) = 0 AND v_img IS NULL THEN RAISE EXCEPTION 'empty_message'; END IF;
  IF length(v_body) > 500 THEN v_body := left(v_body, 500); END IF;

  -- An attached image must live in our own chat bucket — no arbitrary embeds.
  IF v_img IS NOT NULL AND position('/storage/v1/object/public/world-chat/' in v_img) = 0 THEN
    RAISE EXCEPTION 'invalid_image';
  END IF;

  SELECT display_name, avatar_url, suspended_at, deactivated_at
    INTO v_name, v_avatar, v_suspended, v_deactivated
    FROM public.profiles WHERE id = v_uid;
  IF v_suspended IS NOT NULL OR v_deactivated IS NOT NULL THEN
    RAISE EXCEPTION 'account_restricted';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.world_chat
    WHERE user_id = v_uid AND created_at > now() - interval '1.2 seconds'
  ) THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;

  INSERT INTO public.world_chat (user_id, display_name, avatar_url, body, image_url)
  VALUES (v_uid, coalesce(nullif(btrim(v_name), ''), 'Director'), v_avatar,
          nullif(v_body, ''), v_img)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.post_world_chat(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.post_world_chat(text, text) TO authenticated;
