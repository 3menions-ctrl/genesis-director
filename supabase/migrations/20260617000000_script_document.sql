-- Wave 1 of the ScriptDocument constitution.
--
-- Adds movie_projects.script_document — a single JSONB column that
-- holds the entire ScriptDocument typed structure (see
-- src/lib/editor/script-document.ts).
--
-- Design choices:
--   * Default '{}'::jsonb so existing rows don't NULL-out the column.
--     The editor's hydration path (src/lib/editor/hydrate-document.ts)
--     treats {} as "no doc yet" and rebuilds from the legacy tables.
--   * GIN index on the whole document so future filter queries
--     ("every project using kling-2-master", "every project with an
--     approved shot referencing character X") have an index path.
--   * Functional B-tree index on (template id) — surfaces in the
--     Library when grouping projects by template.
--   * Backfill is NOT part of this migration. A one-time script
--     (scripts/backfill-script-documents.ts, lands in wave 2)
--     iterates and writes the hydrated doc per project, with an
--     idempotency guard so a re-run is safe.
--
-- Backwards compatibility:
--   * Legacy columns (script_content, generated_script, video_clips,
--     genesis_scenes, project_characters) STAY. Old read paths
--     keep working. The editor reads script_document when present,
--     falls back to the legacy tables when not.
--   * No data is moved or destroyed by this migration.

ALTER TABLE public.movie_projects
  ADD COLUMN IF NOT EXISTS script_document jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.movie_projects.script_document IS
  'Unified ScriptDocument constitution for the project. See src/lib/editor/script-document.ts for the typed shape. {} means "not yet hydrated" — the editor falls back to script_content + generated_script + video_clips on read.';

-- Full-document GIN index — fast exists/contains queries on any
-- field inside the doc, including nested arrays of scenes / shots
-- / cast / voices.
CREATE INDEX IF NOT EXISTS movie_projects_script_document_gin_idx
  ON public.movie_projects
  USING gin (script_document);

-- Functional B-tree on the template id (the most common filter
-- after project_id itself: "show me every trailer"). Index is
-- partial — only projects that have a doc with a non-null template.
CREATE INDEX IF NOT EXISTS movie_projects_template_id_idx
  ON public.movie_projects
  (((script_document -> 'template' ->> 'id')))
  WHERE script_document -> 'template' ->> 'id' IS NOT NULL;

-- Functional B-tree on default engine — so "which projects are
-- still on Seedance" / "migrate everyone off Veo 2" queries have
-- an index path.
CREATE INDEX IF NOT EXISTS movie_projects_default_engine_idx
  ON public.movie_projects
  (((script_document -> 'capabilities' ->> 'defaultEngine')))
  WHERE script_document -> 'capabilities' ->> 'defaultEngine' IS NOT NULL;

-- Realtime: the editor subscribes to this column via the existing
-- postgres_changes channel that already watches movie_projects.
-- Nothing extra needed here — the publication picks up the new
-- column automatically.

-- ────────────────────────────────────────────────────────────────────
-- Verification: every project has the column.
-- ────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  null_count integer;
BEGIN
  SELECT count(*) INTO null_count
  FROM public.movie_projects
  WHERE script_document IS NULL;

  IF null_count > 0 THEN
    RAISE EXCEPTION 'script_document NULL in % rows after migration', null_count;
  END IF;
END $$;
