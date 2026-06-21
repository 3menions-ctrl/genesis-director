-- CRITICAL: the document-store flush writes JSONB into
-- movie_projects.script_document, but the column never existed in any
-- prior migration. Every script edit, scene change, beat update,
-- character add, etc., has been silently failing with PGRST204 since
-- the editor was wired up — supabase-js swallows the error into
-- console.warn and the UI looks like it's working.
--
-- This adds the column. After this migration and a types regenerate,
-- every document mutation persists.
ALTER TABLE public.movie_projects
  ADD COLUMN IF NOT EXISTS script_document jsonb;

COMMENT ON COLUMN public.movie_projects.script_document IS
  'In-memory ScriptDocument constitution, flushed every 600ms by document-store.ts. Source of truth for scenes/shots/beats/cast/transitions while the project is in edit mode.';
