-- ════════════════════════════════════════════════════════════════════════
-- Style Packs — saveable, tradeable cinematography presets.
--
-- A creator captures their look-and-feel as a bundle: LUT + camera
-- preset + music bed + a thumbnail. Apply to any new project with one
-- click. Sell it on the marketplace to extend their reach.
--
-- The marketplace surface reuses atom_listings (atom_type = 'style_pack'
-- already permitted by the atom_listings CHECK), so no listing schema
-- changes are needed.
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.style_packs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  description     text,
  thumbnail_url   text,
  -- The actual preset payload — opaque to the DB; the renderer reads
  -- whatever shape the studio version emits.
  preset          jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_public       boolean NOT NULL DEFAULT false,
  derived_from    uuid REFERENCES public.style_packs(id) ON DELETE SET NULL,
  -- Cached counters
  apply_count     int NOT NULL DEFAULT 0,
  fork_count      int NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_style_packs_owner ON public.style_packs (owner_id);
CREATE INDEX IF NOT EXISTS idx_style_packs_public_apply
  ON public.style_packs (is_public, apply_count DESC) WHERE is_public = true;

ALTER TABLE public.style_packs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Style packs public-or-owner read" ON public.style_packs;
CREATE POLICY "Style packs public-or-owner read"
  ON public.style_packs FOR SELECT TO anon, authenticated
  USING (is_public = true OR owner_id = auth.uid());

DROP POLICY IF EXISTS "Style packs owner writes" ON public.style_packs;
CREATE POLICY "Style packs owner writes"
  ON public.style_packs FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- Per-(user, pack) "applied to project" join table so a Director can
-- see which packs they've used and the pack can count its applies.
CREATE TABLE IF NOT EXISTS public.style_pack_applications (
  pack_id     uuid NOT NULL REFERENCES public.style_packs(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id  uuid REFERENCES public.movie_projects(id) ON DELETE SET NULL,
  applied_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pack_id, user_id, applied_at)
);

ALTER TABLE public.style_pack_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pack applications self-read" ON public.style_pack_applications;
CREATE POLICY "Pack applications self-read"
  ON public.style_pack_applications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Pack applications self-insert" ON public.style_pack_applications;
CREATE POLICY "Pack applications self-insert"
  ON public.style_pack_applications FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Bump apply_count when a new application row is inserted.
CREATE OR REPLACE FUNCTION public.style_pack_apply_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.style_packs SET apply_count = apply_count + 1, updated_at = now()
    WHERE id = NEW.pack_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_style_pack_apply_sync ON public.style_pack_applications;
CREATE TRIGGER trg_style_pack_apply_sync
  AFTER INSERT ON public.style_pack_applications
  FOR EACH ROW EXECUTE FUNCTION public.style_pack_apply_sync();

-- Fork a public pack as a new owner — bumps fork_count on the parent.
CREATE OR REPLACE FUNCTION public.fork_style_pack(p_pack_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent public.style_packs%ROWTYPE;
  v_new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  SELECT * INTO v_parent FROM public.style_packs WHERE id = p_pack_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'pack_not_found'; END IF;
  IF NOT v_parent.is_public AND v_parent.owner_id <> auth.uid() THEN
    RAISE EXCEPTION 'pack_not_forkable';
  END IF;
  INSERT INTO public.style_packs (owner_id, name, description, thumbnail_url, preset, derived_from)
  VALUES (auth.uid(), v_parent.name || ' (fork)', v_parent.description, v_parent.thumbnail_url, v_parent.preset, p_pack_id)
  RETURNING id INTO v_new_id;
  UPDATE public.style_packs SET fork_count = fork_count + 1 WHERE id = p_pack_id;
  RETURN v_new_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.fork_style_pack(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fork_style_pack(uuid) TO authenticated;
