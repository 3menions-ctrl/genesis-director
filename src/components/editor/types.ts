export interface ClipEffect {
  type: "transition" | "filter" | "text";
  name: string;
  duration: number;
  params?: Record<string, unknown>;
}

export interface TextStyle {
  fontSize: number;
  color: string;
  fontWeight?: string;
  fontFamily?: string;
  textAlign?: "left" | "center" | "right";
  backgroundColor?: string;
  position?: { x: number; y: number };
}

export interface ColorGrading {
  brightness: number; // 0-200, default 100
  contrast: number;   // 0-200, default 100
  saturation: number; // 0-200, default 100
  hue: number;        // 0-360, default 0
  opacity: number;    // 0-100, default 100
}

export interface Keyframe {
  time: number; // seconds relative to clip start
  properties: {
    x?: number;
    y?: number;
    scale?: number;
    rotation?: number;
    opacity?: number;
  };
  easing?: "linear" | "ease-in" | "ease-out" | "ease-in-out";
}

export interface ClipTransform {
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  cropAspect: number | null;
}

export interface TimelineClip {
  id: string;
  trackId: string;
  start: number;
  end: number;
  type: "video" | "audio" | "text" | "image";
  sourceUrl: string;
  label: string;
  effects: ClipEffect[];
  textContent?: string;
  textStyle?: TextStyle;
  trimStart?: number;
  trimEnd?: number;
  colorGrading?: ColorGrading;
  keyframes?: Keyframe[];
  volume?: number; // 0-100, default 100
  speed?: number; // playback speed multiplier, default 1
  transform?: ClipTransform;
}

export interface TimelineTrack {
  id: string;
  name: string;
  type: "video" | "audio" | "text";
  clips: TimelineClip[];
  muted: boolean;
  locked: boolean;
}

export interface EditorState {
  sessionId: string | null;
  projectId: string | null;
  title: string;
  tracks: TimelineTrack[];
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  selectedClipId: string | null;
  zoom: number;
  renderStatus: "idle" | "rendering" | "completed" | "failed";
  renderProgress: number;
}

export const DEFAULT_COLOR_GRADING: ColorGrading = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  hue: 0,
  opacity: 100,
};

export const TRANSITION_TYPES = [
  { id: "crossfade", name: "Crossfade", icon: "Blend" },
  { id: "dissolve", name: "Dissolve", icon: "Sparkles" },
  { id: "wipe-left", name: "Wipe Left", icon: "ArrowLeft" },
  { id: "wipe-right", name: "Wipe Right", icon: "ArrowRight" },
  { id: "fade-black", name: "Fade to Black", icon: "Moon" },
  { id: "fade-white", name: "Fade to White", icon: "Sun" },
] as const;
