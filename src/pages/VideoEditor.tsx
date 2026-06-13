/**
 * VideoEditor — thin re-export of the new Editor at /editor.
 *
 * The previous Twick wrapper was destroyed; the new editor lives at
 * src/pages/Editor/. This file is kept as the legacy entry point so
 * App.tsx and WorkspaceEditor don't need to change every time the
 * editor's internal structure does.
 */
export { default } from "@/pages/Editor";
