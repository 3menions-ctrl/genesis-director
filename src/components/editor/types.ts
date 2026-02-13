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

export interface TimelineClip {
  id: string;
  trackId: string;
  start: number; // seconds
  end: number; // seconds
  type: "video" | "audio" | "text" | "image";
  sourceUrl: string;
  label: string;
  effects: ClipEffect[];
  textContent?: string;
  textStyle?: TextStyle;
  trimStart?: number; // in-point within source
  trimEnd?: number; // out-point within source
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

export const TRANSITION_TYPES = [
  { id: "crossfade", name: "Crossfade", icon: "Blend" },
  { id: "dissolve", name: "Dissolve", icon: "Sparkles" },
  { id: "wipe-left", name: "Wipe Left", icon: "ArrowLeft" },
  { id: "wipe-right", name: "Wipe Right", icon: "ArrowRight" },
  { id: "fade-black", name: "Fade to Black", icon: "Moon" },
  { id: "fade-white", name: "Fade to White", icon: "Sun" },
] as const;
