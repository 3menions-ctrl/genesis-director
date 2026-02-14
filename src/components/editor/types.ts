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

export interface AudioFade {
  fadeIn: number;  // seconds
  fadeOut: number; // seconds
}

export interface PipSettings {
  enabled: boolean;
  x: number;       // 0-100 percentage
  y: number;       // 0-100 percentage
  width: number;   // 0-100 percentage
  height: number;  // 0-100 percentage
}

export interface ChromaKey {
  enabled: boolean;
  color: string;       // hex color to key out
  similarity: number;  // 0-100
  smoothness: number;  // 0-100
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
  volume?: number;
  speed?: number;
  transform?: ClipTransform;
  audioFade?: AudioFade;
  pip?: PipSettings;
  chromaKey?: ChromaKey;
  filter?: string;         // preset filter name
  noiseSuppression?: boolean;
  captions?: Caption[];
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

export interface Caption {
  start: number; // seconds relative to clip
  end: number;
  text: string;
}

export const TRANSITION_TYPES = [
  { id: "crossfade", name: "Crossfade", icon: "Blend" },
  { id: "dissolve", name: "Dissolve", icon: "Sparkles" },
  { id: "wipe-left", name: "Wipe Left", icon: "ArrowLeft" },
  { id: "wipe-right", name: "Wipe Right", icon: "ArrowRight" },
  { id: "fade-black", name: "Fade to Black", icon: "Moon" },
  { id: "fade-white", name: "Fade to White", icon: "Sun" },
] as const;

export const FILTER_PRESETS = [
  { id: "none", name: "None", css: "" },
  { id: "vintage", name: "Vintage", css: "sepia(40%) contrast(110%) brightness(90%)" },
  { id: "noir", name: "Noir", css: "grayscale(100%) contrast(130%) brightness(90%)" },
  { id: "warm", name: "Warm", css: "sepia(20%) saturate(140%) brightness(105%)" },
  { id: "cool", name: "Cool", css: "saturate(80%) hue-rotate(20deg) brightness(105%)" },
  { id: "vivid", name: "Vivid", css: "saturate(180%) contrast(110%)" },
  { id: "muted", name: "Muted", css: "saturate(50%) brightness(105%)" },
  { id: "cinematic", name: "Cinematic", css: "contrast(120%) saturate(85%) brightness(95%)" },
  { id: "dreamy", name: "Dreamy", css: "brightness(110%) contrast(90%) saturate(120%) blur(0.5px)" },
  { id: "retro", name: "Retro", css: "sepia(60%) hue-rotate(-10deg) saturate(120%)" },
  { id: "hdr", name: "HDR", css: "contrast(140%) saturate(130%) brightness(105%)" },
  { id: "bleach", name: "Bleach", css: "contrast(130%) saturate(60%) brightness(110%)" },
  { id: "lomo", name: "Lomo", css: "contrast(150%) saturate(130%) brightness(90%)" },
] as const;

export const TEMPLATE_PRESETS = [
  { id: "intro-outro", name: "Intro + Outro", description: "Title card, content, end card", tracks: 3 },
  { id: "slideshow", name: "Slideshow", description: "Clips with crossfades", tracks: 1 },
  { id: "vlog", name: "Vlog", description: "Jump cuts with text overlays", tracks: 2 },
  { id: "promo", name: "Promo", description: "Fast cuts with music", tracks: 3 },
  { id: "tutorial", name: "Tutorial", description: "Screen + PiP + captions", tracks: 3 },
] as const;
