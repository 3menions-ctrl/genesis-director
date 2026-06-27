-- =====================================================================
-- Audit remediation (phase 2): fix cross-tenant project org injection
--
-- BLOCKER fixed (full-platform audit 2026-06-27):
--   movie_projects had two PERMISSIVE INSERT policies, OR'd together:
--     1. "Users can create own projects"               CHECK (auth.uid() = user_id)
--     2. "Org producers+ can create projects in their org"
--          CHECK (organization_id IS NOT NULL
--                 AND has_org_permission(organization_id, auth.uid(), 'producer'))
--   Policy (1) does NOT constrain organization_id, so under PERMISSIVE OR
--   semantics a user could INSERT user_id = self together with ANY foreign
--   organization_id and pass — stamping their project onto another tenant's
--   org, where it then surfaces to that org's members (createProject in
--   StudioContext + createDraftProject read organization_id from
--   localStorage and insert it verbatim).
--
-- Fix: collapse to a single canonical INSERT policy that requires
-- ownership AND (no org OR producer permission on that org). Personal
-- projects (organization_id NULL) and legitimate org-producer projects both
-- pass; a foreign org id can no longer slip through.
--
-- NOTE: migration file only. Apply via the safe ordered apply-plan.
-- =====================================================================

DROP POLICY IF EXISTS "Users can create own projects"                    ON public.movie_projects;
DROP POLICY IF EXISTS "Org producers+ can create projects in their org"  ON public.movie_projects;

CREATE POLICY "Users can create own projects"
ON public.movie_projects
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    organization_id IS NULL
    OR public.has_org_permission(organization_id, auth.uid(), 'producer')
  )
);
