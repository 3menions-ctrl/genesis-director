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
  /** Between-clip transitions on V1. Keyed by (fromClipId, toClipId)
   *  — at most one transition per boundary. Empty array = hard cuts. */
  transitions: ClipTransition[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Transitions — what happens at a V1 boundary
// ─────────────────────────────────────────────────────────────────────────────

/** Names match the ffmpeg xfade filter so the seamless-stitcher
 *  can apply the same transition on export without translation. */
export type TransitionKind =
  | "fade"
  | "dissolve"
  | "wipeleft"
  | "wiperight"
  | "wipeup"
  | "wipedown"
  | "slideleft"
  | "slideright"
  | "slideup"
  | "slidedown"
  | "circleopen"
  | "circleclose"
  | "radial"
  | "smoothleft"
  | "smoothright"
  | "fadeblack"
  | "fadewhite";

export const TRANSITION_KINDS: TransitionKind[] = [
  "fade",
  "dissolve",
  "wipeleft",
  "wiperight",
  "wipeup",
  "wipedown",
  "slideleft",
  "slideright",
  "slideup",
  "slidedown",
  "circleopen",
  "circleclose",
  "radial",
  "smoothleft",
  "smoothright",
  "fadeblack",
  "fadewhite",
];

export const TRANSITION_LABELS: Record<TransitionKind, string> = {
  fade: "Fade",
  dissolve: "Dissolve",
  wipeleft: "Wipe ←",
  wiperight: "Wipe →",
  wipeup: "Wipe ↑",
  wipedown: "Wipe ↓",
  slideleft: "Slide ←",
  slideright: "Slide →",
  slideup: "Slide ↑",
  slidedown: "Slide ↓",
  circleopen: "Circle open",
  circleclose: "Circle close",
  radial: "Radial",
  smoothleft: "Smooth ←",
  smoothright: "Smooth →",
  fadeblack: "Fade to black",
  fadewhite: "Fade to white",
};

export interface ClipTransition {
  id: string;
  /** Outgoing clip id. */
  fromClipId: string;
  /** Incoming clip id. */
  toClipId: string;
  /** Duration of the crossfade in seconds. Clamped at runtime to
   *  min(fromClipDuration, toClipDuration) / 2. */
  durationSec: number;
  kind: TransitionKind;
}

export const TRANSITION_DEFAULT_SEC = 0.4;

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
  /** 0.25 – 4.0 — applied as HTMLVideoElement.playbackRate */
  speed: number;
  /** Force-mute this clip even when volume > 0 */
  muted: boolean;
  /** When any clip is soloed, every non-soloed clip plays muted. */
  soloed: boolean;
  /** CSS filter string applied to the video — empty = none */
  filter: string;
  /** Horizontal flip — transform: scaleX(-1) */
  mirror: boolean;
}

export const CLIP_PROPERTY_DEFAULTS: ClipProperties = {
  volume: 1.0,
  opacity: 1.0,
  scale: 1.0,
  fadeInSec: 0,
  fadeOutSec: 0,
  speed: 1.0,
  muted: false,
  soloed: false,
  filter: "",
  mirror: false,
};

/** Read a property with fall-through to the default. */
export function getClipProperty<K extends keyof ClipProperties>(
  clip: EditorClip,
  key: K,
): ClipProperties[K] {
  return clip.properties?.[key] ?? CLIP_PROPERTY_DEFAULTS[key];
}

export type ClipKind = "video" | "title";

/** Properties that can carry keyframes (numeric, time-varying). */
export type AnimatableProperty = "opacity" | "scale" | "volume";

export interface Keyframe {
  id: string;
  property: AnimatableProperty;
  /** Seconds relative to the clip's start (not timeline-absolute). */
  time: number;
  value: number;
}

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
  /** Keyframes that animate properties over the clip's local time. */
  keyframes?: Keyframe[];
  /** Available takes — first is the active canonical take. */
  takes: EditorTake[];
}

/**
 * Compute the effective value of an animatable property at a given
 * RELATIVE time within the clip (0 .. clip.durationSec). Linearly
 * interpolates between the surrounding keyframes; falls back to the
 * static clip property when no keyframes exist or the time is
 * outside the keyframe range and only one side exists.
 */
export function getClipPropertyAt(
  clip: EditorClip,
  prop: AnimatableProperty,
  relativeTime: number,
): number {
  const kfs = (clip.keyframes ?? [])
    .filter((k) => k.property === prop)
    .sort((a, b) => a.time - b.time);
  if (kfs.length === 0) return getClipProperty(clip, prop);
  let before: Keyframe | null = null;
  let after: Keyframe | null = null;
  for (const k of kfs) {
    if (k.time <= relativeTime) before = k;
    else if (after === null) {
      after = k;
      break;
    }
  }
  if (before && after) {
    if (after.time === before.time) return before.value;
    const t = (relativeTime - before.time) / (after.time - before.time);
    return before.value + (after.value - before.value) * t;
  }
  if (before) return before.value;
  if (after) return after.value;
  return getClipProperty(clip, prop);
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

export type RenderJobStatus = "queued" | "rendering" | "done" | "error";

export interface RenderJob {
  id: string;
  projectId: string;
  projectTitle: string;
  aspect: AspectRatio;
  status: RenderJobStatus;
  createdAt: string;
  completedAt?: string;
  outputUrl?: string;
  error?: string;
  reframe: boolean;
}

export interface EditorMarker {
  id: string;
  /** Timeline-absolute position in seconds */
  timelineSec: number;
  label: string;
  /** CSS colour, e.g. "hsl(45 95% 60%)" or "#ff8" */
  color: string;
}

/** Internal clipboard for copy/paste — never persisted to disk. */
export interface ClipboardData {
  clips: EditorClip[];
  copiedAt: number;
}

/** History entry — a project snapshot that undo restores. */
export interface HistoryEntry {
  project: EditorProject;
  label?: string;
}

export interface EditorState {
  view: EditorView;
  project: EditorProject | null;
  loading: boolean;
  error: string | null;
  /** Selection — which scene/clip the user is focused on. */
  selectedSceneId: string | null;
  /** Primary selected clip (the one the Inspector focuses on). */
  selectedClipId: string | null;
  /** All selected clips — always includes selectedClipId when non-null. */
  selectedClipIds: string[];
  /** Internal copy/paste buffer. */
  clipboard: ClipboardData | null;
  /** Undo / redo history. */
  history: { past: HistoryEntry[]; future: HistoryEntry[] };
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
  /** Master output volume — multiplies every clip's volume. */
  masterVolume: number;
  /** Master mute — overrides every clip's volume. */
  masterMuted: boolean;
  /** Per-track volume (V1=clip video audio, A1/A2 scaffolding). */
  trackVolumes: { V1: number; A1: number; A2: number };
  /** Per-track mute. */
  trackMuted: { V1: boolean; A1: boolean; A2: boolean };
  /** True while the program player is playing back. Lifted here so
   *  every panel (audio mixer, status bar, etc) can react in lockstep. */
  isPlaying: boolean;
  /** Playback speed multiplier for the program monitor.
   *  Discrete values: 0.25 / 0.5 / 0.75 / 1 / 1.25 / 1.5 / 2 / 4. */
  playbackSpeed: number;
  /** Loop between inSec and outSec when both are set. */
  loopRegion: boolean;
  /** Theater mode hides left/right panes and the inspector to give
   *  the player the entire viewport. */
  theaterMode: boolean;
  /** True while the browser is in fullscreen for the program monitor. */
  isFullscreen: boolean;
  /** Currently-selected transition (for the inspector). Mutually
   *  exclusive with selectedClipId — selecting one clears the other. */
  selectedTransitionId: string | null;
}

export const INITIAL_EDITOR_STATE: EditorState = {
  view: "stage",
  project: null,
  loading: false,
  error: null,
  selectedSceneId: null,
  selectedClipId: null,
  selectedClipIds: [],
  clipboard: null,
  history: { past: [], future: [] },
  playheadSec: 0,
  pxPerSec: 60,
  tool: "select",
  snapEnabled: true,
  markers: [],
  inSec: null,
  outSec: null,
  isRendering: false,
  masterVolume: 1.0,
  masterMuted: false,
  trackVolumes: { V1: 1.0, A1: 1.0, A2: 1.0 },
  trackMuted: { V1: false, A1: false, A2: false },
  isPlaying: false,
  playbackSpeed: 1,
  loopRegion: false,
  theaterMode: false,
  isFullscreen: false,
  selectedTransitionId: null,
};

export const PLAYBACK_SPEEDS: number[] = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4];
