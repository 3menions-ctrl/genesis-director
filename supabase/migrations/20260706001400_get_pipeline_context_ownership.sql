-- =====================================================================
-- Audit remediation (phase 2): close get_pipeline_context cross-tenant IDOR
--
-- BLOCKER fixed (full-platform audit 2026-06-27):
--   get_pipeline_context(p_project_id) is SECURITY DEFINER with no ownership
--   check. 20260429224707 revoked it from PUBLIC + anon but NOT from
--   `authenticated`, so any logged-in user could call it for ANY project id
--   and read another tenant's generated_script, scene_images, identity
--   bible (pro_features_data) and pipeline snapshot.
--
--   The only caller is the edge function shared helper
--   supabase/functions/_shared/generation-mutex.ts, which runs with the
--   service-role key (auth.uid() IS NULL). No client/src caller exists.
--
-- Fix (belt-and-suspenders):
--   1. Recreate with an in-body ownership guard: a non-service-role caller
--      must own the project (or be admin); service-role (uid NULL) passes.
--   2. Revoke EXECUTE from authenticated; grant only to service_role.
--
-- NOTE: record_user_media (the sibling IDOR in this audit item) was ALREADY
-- fixed in 20260704002500 (auth.uid() ownership guard) — no change needed.
--
-- NOTE: migration file only. Apply via the safe ordered apply-plan.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_pipeline_context(
  p_project_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  project RECORD;
  context jsonb;
  v_caller uuid := auth.uid();
BEGIN
  SELECT
    user_id,
    pipeline_context_snapshot,
    pro_features_data,
    generated_script,
    scene_images,
    quality_tier,
    aspect_ratio
  INTO project
  FROM movie_projects
  WHERE id = p_project_id;

  IF NOT FOUND THEN
    RETURN '{}'::jsonb;
  END IF;

  -- Ownership guard. Service-role/edge calls have auth.uid() IS NULL and
  -- pass through; an end-user JWT must own the project (or be an admin).
  IF v_caller IS NOT NULL
     AND project.user_id IS DISTINCT FROM v_caller
     AND NOT public.is_admin(v_caller) THEN
    RAISE EXCEPTION 'forbidden: not your project';
  END IF;

  -- Start with persisted context
  context := COALESCE(project.pipeline_context_snapshot, '{}'::jsonb);

  -- Merge with pro_features_data if context is sparse
  IF (context->>'identityBible') IS NULL AND (project.pro_features_data->>'identityBible') IS NOT NULL THEN
    context := context || jsonb_build_object('identityBible', project.pro_features_data->'identityBible');
  END IF;

  IF (context->>'extractedCharacters') IS NULL AND (project.pro_features_data->>'extractedCharacters') IS NOT NULL THEN
    context := context || jsonb_build_object('extractedCharacters', project.pro_features_data->'extractedCharacters');
  END IF;

  IF (context->>'masterSceneAnchor') IS NULL AND (project.pro_features_data->>'masterSceneAnchor') IS NOT NULL THEN
    context := context || jsonb_build_object('masterSceneAnchor', project.pro_features_data->'masterSceneAnchor');
  END IF;

  IF (context->>'goldenFrameData') IS NULL AND (project.pro_features_data->>'goldenFrameData') IS NOT NULL THEN
    context := context || jsonb_build_object('goldenFrameData', project.pro_features_data->'goldenFrameData');
  END IF;

  -- Add project-level settings
  context := context || jsonb_build_object(
    'qualityTier', COALESCE(project.quality_tier, 'standard'),
    'aspectRatio', COALESCE(project.aspect_ratio, '16:9')
  );

  RETURN context;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_pipeline_context(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_pipeline_context(uuid) TO service_role;
