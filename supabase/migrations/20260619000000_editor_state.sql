-- Editor state persistence — transitions + title clips + any other
-- project-level editor mutations that aren't already captured by the
-- per-clip video_clips.properties / video_clips.effects round-trip.
--
-- Why this column exists:
--   The editor stores `ClipTransition[]` on `EditorProject.transitions`
--   and synthesized title clips on `scenes[0].clips[]` with kind:"title".
--   Before this migration, both were in-memory only — closing the tab
--   or reloading the project wiped every transition + every title.
--   ExportPanel passed them live to final-assembly, but mid-edit
--   navigation lost them.
--
-- Why JSONB (vs. dedicated tables):
--   • Transitions are a project-scoped ordered list, not relational.
--   • Title clips are synthetic overlays, not generated/uploaded media,
--     so they don't fit `video_clips`. Putting them in a JSONB blob
--     keeps schema simple while still letting the editor round-trip.
--   • If either grows beyond a few dozen entries per project we can
--     extract to typed tables without breaking the API surface.
--
-- Shape (TypeScript):
--   {
--     transitions: ClipTransition[];        // see src/lib/editor/types.ts
--     titles: TitleClip[];                   // synthesized overlays
--     /** Optional: future per-project editor preferences */
--   }

ALTER TABLE public.movie_projects
  ADD COLUMN IF NOT EXISTS editor_state JSONB;

COMMENT ON COLUMN public.movie_projects.editor_state IS
  'In-editor project state — { transitions, titles }. Written by useEditorStateSync as the user mutates the timeline. Read by useProject during hydration so transitions and title overlays survive reload. ExportPanel + final-assembly consume from in-memory state during a render; this column exists for persistence, not for the export hot path.';
