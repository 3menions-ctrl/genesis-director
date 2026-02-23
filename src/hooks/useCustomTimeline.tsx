/**
 * Custom Timeline Engine — types, state, and utilities
 * Replaces the Twick SDK timeline with a fully custom implementation.
 */

import { createContext, useContext, useReducer, useCallback, useRef, useMemo } from "react";

// ─── Core Types ───

export interface TimelineClip {
  id: string;
  type: "video" | "image" | "text" | "audio";
  /** Source URL for video/image/audio */
  src?: string;
  /** Text content for text clips */
  text?: string;
  /** Start time on timeline in seconds */
  start: number;
  /** End time on timeline in seconds */
  end: number;
  /** Trim: how far into the source to start playing (seconds) */
  trimStart: number;
  /** Trim: source duration limit */
  trimEnd: number;
  /** Display label */
  name: string;
  /** Thumbnail URL */
  thumbnail?: string;
  /** Original source duration */
  sourceDuration?: number;
  /** Text styling */
  textStyle?: {
    fontSize: number;
    fontFamily: string;
    color: string;
    backgroundColor?: string;
    position: "top" | "center" | "bottom";
  };
}

export interface TimelineTrack {
  id: string;
  type: "video" | "audio" | "text" | "overlay";
  label: string;
  clips: TimelineClip[];
  muted?: boolean;
  locked?: boolean;
}

export interface TimelineState {
  tracks: TimelineTrack[];
  playheadTime: number;
  duration: number;
  isPlaying: boolean;
  selectedClipId: string | null;
  selectedTrackId: string | null;
  zoom: number; // pixels per second
  scrollX: number;
  fps: number;
  width: number;
  height: number;
}

// ─── Actions ───

type TimelineAction =
  | { type: "SET_PLAYHEAD"; time: number }
  | { type: "SET_PLAYING"; playing: boolean }
  | { type: "SELECT_CLIP"; clipId: string | null; trackId: string | null }
  | { type: "ADD_CLIP"; trackId: string; clip: TimelineClip }
  | { type: "REMOVE_CLIP"; trackId: string; clipId: string }
  | { type: "MOVE_CLIP"; fromTrackId: string; toTrackId: string; clipId: string; newStart: number }
  | { type: "TRIM_CLIP"; trackId: string; clipId: string; edge: "start" | "end"; newTime: number }
  | { type: "ADD_TRACK"; track: TimelineTrack }
  | { type: "REMOVE_TRACK"; trackId: string }
  | { type: "TOGGLE_TRACK_MUTE"; trackId: string }
  | { type: "TOGGLE_TRACK_LOCK"; trackId: string }
  | { type: "SET_ZOOM"; zoom: number }
  | { type: "SET_SCROLL_X"; scrollX: number }
  | { type: "LOAD_PROJECT"; state: Partial<TimelineState> }
  | { type: "REORDER_CLIP"; trackId: string; clipId: string; newIndex: number }
  | { type: "UPDATE_CLIP"; trackId: string; clipId: string; updates: Partial<TimelineClip> };

// ─── Initial State ───

export const INITIAL_TIMELINE_STATE: TimelineState = {
  tracks: [
    { id: "track-video-1", type: "video", label: "Video 1", clips: [] },
  ],
  playheadTime: 0,
  duration: 0,
  isPlaying: false,
  selectedClipId: null,
  selectedTrackId: null,
  zoom: 50, // 50px per second
  scrollX: 0,
  fps: 30,
  width: 1920,
  height: 1080,
};

// ─── Utilities ───

function recalcDuration(tracks: TimelineTrack[]): number {
  let max = 0;
  for (const track of tracks) {
    for (const clip of track.clips) {
      if (clip.end > max) max = clip.end;
    }
  }
  return max;
}

let clipIdCounter = 0;
export function generateClipId(): string {
  return `clip-${Date.now()}-${++clipIdCounter}`;
}

export function generateTrackId(): string {
  return `track-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Reducer ───

function timelineReducer(state: TimelineState, action: TimelineAction): TimelineState {
  switch (action.type) {
    case "SET_PLAYHEAD":
      return { ...state, playheadTime: Math.max(0, action.time) };

    case "SET_PLAYING":
      return { ...state, isPlaying: action.playing };

    case "SELECT_CLIP":
      return { ...state, selectedClipId: action.clipId, selectedTrackId: action.trackId };

    case "ADD_CLIP": {
      const tracks = state.tracks.map((t) => {
        if (t.id !== action.trackId) return t;
        return { ...t, clips: [...t.clips, action.clip].sort((a, b) => a.start - b.start) };
      });
      return { ...state, tracks, duration: recalcDuration(tracks) };
    }

    case "REMOVE_CLIP": {
      const tracks = state.tracks.map((t) => {
        if (t.id !== action.trackId) return t;
        return { ...t, clips: t.clips.filter((c) => c.id !== action.clipId) };
      });
      return { ...state, tracks, duration: recalcDuration(tracks), selectedClipId: state.selectedClipId === action.clipId ? null : state.selectedClipId };
    }

    case "MOVE_CLIP": {
      let movedClip: TimelineClip | null = null;
      let tracks = state.tracks.map((t) => {
        if (t.id !== action.fromTrackId) return t;
        const clip = t.clips.find((c) => c.id === action.clipId);
        if (clip) {
          movedClip = { ...clip, start: action.newStart, end: action.newStart + (clip.end - clip.start) };
        }
        return { ...t, clips: t.clips.filter((c) => c.id !== action.clipId) };
      });
      if (movedClip) {
        tracks = tracks.map((t) => {
          if (t.id !== action.toTrackId) return t;
          return { ...t, clips: [...t.clips, movedClip!].sort((a, b) => a.start - b.start) };
        });
      }
      return { ...state, tracks, duration: recalcDuration(tracks) };
    }

    case "TRIM_CLIP": {
      const tracks = state.tracks.map((t) => {
        if (t.id !== action.trackId) return t;
        return {
          ...t,
          clips: t.clips.map((c) => {
            if (c.id !== action.clipId) return c;
            if (action.edge === "start") {
              const newStart = Math.max(0, Math.min(action.newTime, c.end - 0.1));
              const diff = newStart - c.start;
              return { ...c, start: newStart, trimStart: c.trimStart + diff };
            } else {
              const newEnd = Math.max(c.start + 0.1, action.newTime);
              return { ...c, end: newEnd };
            }
          }),
        };
      });
      return { ...state, tracks, duration: recalcDuration(tracks) };
    }

    case "ADD_TRACK":
      return { ...state, tracks: [...state.tracks, action.track] };

    case "REMOVE_TRACK":
      return { ...state, tracks: state.tracks.filter((t) => t.id !== action.trackId) };

    case "TOGGLE_TRACK_MUTE":
      return { ...state, tracks: state.tracks.map((t) => t.id === action.trackId ? { ...t, muted: !t.muted } : t) };

    case "TOGGLE_TRACK_LOCK":
      return { ...state, tracks: state.tracks.map((t) => t.id === action.trackId ? { ...t, locked: !t.locked } : t) };

    case "SET_ZOOM":
      return { ...state, zoom: Math.max(10, Math.min(200, action.zoom)) };

    case "SET_SCROLL_X":
      return { ...state, scrollX: Math.max(0, action.scrollX) };

    case "LOAD_PROJECT":
      return { ...state, ...action.state, duration: recalcDuration(action.state.tracks || state.tracks) };

    case "UPDATE_CLIP": {
      const tracks = state.tracks.map((t) => {
        if (t.id !== action.trackId) return t;
        return {
          ...t,
          clips: t.clips.map((c) =>
            c.id === action.clipId ? { ...c, ...action.updates } : c
          ),
        };
      });
      return { ...state, tracks, duration: recalcDuration(tracks) };
    }

    case "REORDER_CLIP": {
      const tracks = state.tracks.map((t) => {
        if (t.id !== action.trackId) return t;
        const clips = [...t.clips];
        const idx = clips.findIndex((c) => c.id === action.clipId);
        if (idx < 0) return t;
        const [clip] = clips.splice(idx, 1);
        clips.splice(action.newIndex, 0, clip);
        // Recalc positions based on new order
        let pos = 0;
        const reordered = clips.map((c) => {
          const dur = c.end - c.start;
          const updated = { ...c, start: pos, end: pos + dur };
          pos += dur;
          return updated;
        });
        return { ...t, clips: reordered };
      });
      return { ...state, tracks, duration: recalcDuration(tracks) };
    }

    default:
      return state;
  }
}

// ─── Context ───

interface TimelineContextValue {
  state: TimelineState;
  dispatch: React.Dispatch<TimelineAction>;
}

const TimelineContext = createContext<TimelineContextValue | null>(null);

export function CustomTimelineProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(timelineReducer, INITIAL_TIMELINE_STATE);

  const value = useMemo(() => ({ state, dispatch }), [state, dispatch]);

  return (
    <TimelineContext.Provider value={value}>
      {children}
    </TimelineContext.Provider>
  );
}

export function useCustomTimeline() {
  const ctx = useContext(TimelineContext);
  if (!ctx) throw new Error("useCustomTimeline must be inside CustomTimelineProvider");
  return ctx;
}

// ─── Conversion to/from SDK format for save/load compatibility ───

export function toProjectJSON(state: TimelineState): any {
  return {
    version: 1,
    tracks: state.tracks.map((t) => ({
      id: t.id,
      type: t.type,
      label: t.label,
      elements: t.clips.map((c) => ({
        id: c.id,
        type: c.type,
        s: c.start,
        e: c.end,
        name: c.name,
        props: {
          src: c.src,
          text: c.text,
          thumbnail: c.thumbnail,
          trimStart: c.trimStart,
          trimEnd: c.trimEnd,
          sourceDuration: c.sourceDuration,
          textStyle: c.textStyle,
        },
      })),
    })),
    fps: state.fps,
    width: state.width,
    height: state.height,
  };
}

export function fromProjectJSON(json: any): Partial<TimelineState> {
  if (!json?.tracks) return {};
  return {
    tracks: json.tracks.map((t: any) => ({
      id: t.id || generateTrackId(),
      type: t.type || "video",
      label: t.label || "Track",
      clips: (t.elements || []).map((el: any) => ({
        id: el.id || generateClipId(),
        type: el.type || "video",
        src: el.props?.src,
        text: el.props?.text,
        start: el.s ?? 0,
        end: el.e ?? 6,
        trimStart: el.props?.trimStart ?? 0,
        trimEnd: el.props?.trimEnd ?? (el.e - el.s),
        name: el.name || el.props?.name || "Clip",
        thumbnail: el.props?.thumbnail,
        sourceDuration: el.props?.sourceDuration,
        textStyle: el.props?.textStyle,
      })),
    })),
    fps: json.fps || 30,
    width: json.width || 1920,
    height: json.height || 1080,
  };
}
