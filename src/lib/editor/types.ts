/**
 * Editor types — the canonical data model for the rebuilt v1 editor.
 *
 * Aligned with the supabase tables that already exist on the schema:
 *   - movie_projects        — Project root (title, aspect, status, …)
 *   - genesis_scenes        — Scene hierarchy
 *   - video_clips           — Clip atoms (url, duration, prompt, …)
 *   - shot_takes            — Versions per shot (take_number, …)
 *   - project_characters    — Cast in this project
 *
 * The model is hierarchical: Project → Scene → Clip → Take.
 * Timeline view derives from this hierarchy by ordering Scenes by
 * scene_number, then Clips within each Scene by index. Script and
 * Storyboard views are projections over the same data.
 *
 * Editor-time state (view, playhead, selection) lives in the store
 * and never round-trips to supabase. Persisted edits go into
 * movie_projects.pipeline_state (a JSONB column already there) or
 * mutate the scene/clip tables directly.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Views
// ─────────────────────────────────────────────────────────────────────────────
export type EditorView = "stage" | "timeline" | "script" | "storyboard";

export const EDITOR_VIEWS: EditorView[] = [
  "stage",
  "timeline",
  "script",
  "storyboard",
];

// ─────────────────────────────────────────────────────────────────────────────
// Aspect ratios
// ─────────────────────────────────────────────────────────────────────────────
export type AspectRatio = "16:9" | "9:16" | "1:1" | "21:9" | "4:5" | "4:3";

export const ASPECT_RATIOS: Record<AspectRatio, { w: number; h: number; label: string }> = {
  "16:9": { w: 16, h: 9, label: "Wide" },
  "9:16": { w: 9, h: 16, label: "Vertical" },
  "1:1": { w: 1, h: 1, label: "Square" },
  "21:9": { w: 21, h: 9, label: "Cinematic" },
  "4:5": { w: 4, h: 5, label: "Portrait" },
  "4:3": { w: 4, h: 3, label: "Classic" },
};

/**
 * Coerce the freeform aspect_ratio string from movie_projects into a
 * canonical AspectRatio. Defaults to 16:9 when unrecognized.
 */
export function parseAspectRatio(raw: string | null | undefined): AspectRatio {
  if (!raw) return "16:9";
  const r = raw.replace(/\s+/g, "").toLowerCase();
  if (r === "16:9" || r === "16/9" || r === "wide") return "16:9";
  if (r === "9:16" || r === "9/16" || r === "vertical" || r === "portrait") return "9:16";
  if (r === "1:1" || r === "1/1" || r === "square") return "1:1";
  if (r === "21:9" || r === "21/9" || r === "cinema" || r === "anamorphic" || r === "cinematic") return "21:9";
  if (r === "4:5" || r === "4/5") return "4:5";
  if (r === "4:3" || r === "4/3") return "4:3";
  return "16:9";
}

// ─────────────────────────────────────────────────────────────────────────────
// Data model
// ─────────────────────────────────────────────────────────────────────────────
export interface EditorProject {
  id: string;
  title: string;
  aspectRatio: AspectRatio;
  status: string;
  thumbnailUrl: string | null;
  /** Sum of all clip durations across all scenes. */
  durationSec: number;
  /** Latest generated script if any (full screenplay text). */
  scriptContent: string | null;
  /** Project mood / genre / setting — used as hue inputs for the
   *  ProjectBackdrop and as cinematic copy in the chrome. */
  mood: string | null;
  genre: string | null;
  setting: string | null;
  scenes: EditorScene[];
}

export interface EditorScene {
  id: string;
  /** scene_number from genesis_scenes — used to order the timeline. */
  number: number;
  title: string;
  description: string | null;
  durationSec: number;
  mood: string | null;
  timeOfDay: string | null;
  actNumber: number | null;
  isKeyScene: boolean;
  visualPrompt: string | null;
  cameraDirections: string | null;
  clips: EditorClip[];
}

export interface ClipProperties {
  /** 0.0 – 1.5 — gain applied to the <video>.volume on Stage */
  volume: number;
  /** 0.0 – 1.0 — opacity applied as CSS opacity on Stage */
  opacity: number;
  /** 0.5 – 2.0 — CSS scale transform on Stage */
  scale: number;
  /** Optional crossfade-in seconds */
  fadeInSec: number;
  /** Optional crossfade-out seconds */
  fadeOutSec: number;
}

export const CLIP_PROPERTY_DEFAULTS: ClipProperties = {
  volume: 1.0,
  opacity: 1.0,
  scale: 1.0,
  fadeInSec: 0,
  fadeOutSec: 0,
};

/** Read a property with fall-through to the default. */
export function getClipProperty<K extends keyof ClipProperties>(
  clip: EditorClip,
  key: K,
): ClipProperties[K] {
  return clip.properties?.[key] ?? CLIP_PROPERTY_DEFAULTS[key];
}

export type ClipKind = "video" | "title";

export interface EditorClip {
  id: string;
  /** "video" by default — title clips live on V2 and render as a
   *  text overlay during their active range. */
  kind?: ClipKind;
  /** Position within the scene (0-indexed). */
  index: number;
  /** Absolute timeline start in seconds — cached on load for fast scrub. */
  timelineStartSec: number;
  durationSec: number;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  prompt: string;
  /** For kind === "title" — the rendered text and optional colour. */
  titleText?: string;
  titleColor?: string;
  /** Per-clip overrides — sparse; missing keys fall back to defaults. */
  properties?: Partial<ClipProperties>;
  /** Available takes — first is the active canonical take. */
  takes: EditorTake[];
}

export interface EditorTake {
  id: string;
  takeNumber: number;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  promptUsed: string | null;
  status: string;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Editor-time state
// ─────────────────────────────────────────────────────────────────────────────
export type TimelineTool = "select" | "blade" | "hand";

export interface EditorMarker {
  id: string;
  /** Timeline-absolute position in seconds */
  timelineSec: number;
  label: string;
  /** CSS colour, e.g. "hsl(45 95% 60%)" or "#ff8" */
  color: string;
}

export interface EditorState {
  view: EditorView;
  project: EditorProject | null;
  loading: boolean;
  error: string | null;
  /** Selection — which scene/clip the user is focused on. */
  selectedSceneId: string | null;
  selectedClipId: string | null;
  /**
   * Timeline-absolute playhead, in seconds. Updated at the browser's
   * native `timeupdate` rate (~4–5 Hz) — fine for visual playhead
   * tracking without thrashing the React tree. The Stage's own
   * frame-rate scrub UI reads directly from the <video> ref instead.
   */
  playheadSec: number;
  /** Timeline horizontal zoom in pixels per second. */
  pxPerSec: number;
  /** Currently-active timeline tool (selection / razor blade / hand pan). */
  tool: TimelineTool;
  /** Whether new edits snap to clip boundaries + markers. */
  snapEnabled: boolean;
  /** Range markers — chapters / annotations on the ruler. */
  markers: EditorMarker[];
  /** In-point for ranged playback / export. null = use 0. */
  inSec: number | null;
  /** Out-point for ranged playback / export. null = use durationSec. */
  outSec: number | null;
  /** Render is in progress (background job). */
  isRendering: boolean;
}

export const INITIAL_EDITOR_STATE: EditorState = {
  view: "stage",
  project: null,
  loading: false,
  error: null,
  selectedSceneId: null,
  selectedClipId: null,
  playheadSec: 0,
  pxPerSec: 60,
  tool: "select",
  snapEnabled: true,
  markers: [],
  inSec: null,
  outSec: null,
  isRendering: false,
};
