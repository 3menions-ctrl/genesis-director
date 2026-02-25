/**
 * Custom Timeline Engine — types, state, and utilities
 * Replaces the Twick SDK timeline with a fully custom implementation.
 * Includes undo/redo history, volume, speed, and fade controls.
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
  /** Volume 0–1 (default 1) */
  volume?: number;
  /** Playback speed multiplier 0.5–2 (default 1) */
  speed?: number;
  /** Fade-in duration in seconds (default 0) */
  fadeIn?: number;
  /** Fade-out duration in seconds (default 0) */
  fadeOut?: number;
  /** Opacity 0–1 (default 1) */
  opacity?: number;
  /** Custom color label for organization */
  colorLabel?: string;
  /** Brightness adjustment -100 to 100 (default 0) */
  brightness?: number;
  /** Contrast adjustment -100 to 100 (default 0) */
  contrast?: number;
  /** Saturation adjustment -100 to 100 (default 0) */
  saturation?: number;
  /** Transition type to next clip */
  transition?: "none" | "fade" | "wipeleft" | "wiperight" | "slideup" | "slidedown" | "dissolve";
  /** Transition duration in seconds */
  transitionDuration?: number;
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
  isLooping: boolean;
  selectedClipId: string | null;
  selectedTrackId: string | null;
  zoom: number; // pixels per second
  scrollX: number;
  fps: number;
  width: number;
  height: number;
  aspectRatio: "16:9" | "9:16" | "1:1" | "4:3";
  snapEnabled: boolean;
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
  | { type: "UPDATE_CLIP"; trackId: string; clipId: string; updates: Partial<TimelineClip> }
  | { type: "RIPPLE_DELETE"; trackId: string; clipId: string }
  | { type: "CLEAR_TIMELINE" }
  | { type: "MOVE_TRACK"; trackId: string; direction: "up" | "down" }
  | { type: "SET_LOOP"; looping: boolean }
  | { type: "SET_ASPECT_RATIO"; ratio: "16:9" | "9:16" | "1:1" | "4:3" }
  | { type: "TOGGLE_SNAP" }
  | { type: "SELECT_ALL_CLIPS" };

// ─── Initial State ───

export const INITIAL_TIMELINE_STATE: TimelineState = {
  tracks: [
    { id: "track-video-1", type: "video", label: "Video 1", clips: [] },
  ],
  playheadTime: 0,
  duration: 0,
  isPlaying: false,
  isLooping: false,
  selectedClipId: null,
  selectedTrackId: null,
  zoom: 50,
  scrollX: 0,
  fps: 30,
  width: 1920,
  height: 1080,
  aspectRatio: "16:9",
  snapEnabled: true,
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

// ─── Actions that should NOT push to undo history ───
const NON_UNDOABLE: Set<string> = new Set([
  "SET_PLAYHEAD", "SET_PLAYING", "SELECT_CLIP",
  "SET_ZOOM", "SET_SCROLL_X", "LOAD_PROJECT",
  "SET_LOOP", "SET_ASPECT_RATIO", "TOGGLE_SNAP", "SELECT_ALL_CLIPS",
]);

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

    case "RIPPLE_DELETE": {
      const tracks = state.tracks.map((t) => {
        if (t.id !== action.trackId) return t;
        const clipToRemove = t.clips.find(c => c.id === action.clipId);
        if (!clipToRemove) return t;
        const gap = clipToRemove.end - clipToRemove.start;
        const remaining = t.clips
          .filter(c => c.id !== action.clipId)
          .map(c => {
            if (c.start >= clipToRemove.start) {
              return { ...c, start: c.start - gap, end: c.end - gap };
            }
            return c;
          });
        return { ...t, clips: remaining };
      });
      return { ...state, tracks, duration: recalcDuration(tracks), selectedClipId: state.selectedClipId === action.clipId ? null : state.selectedClipId };
    }

    case "CLEAR_TIMELINE": {
      const tracks = state.tracks.map(t => ({ ...t, clips: [] }));
      return { ...state, tracks, duration: 0, playheadTime: 0, selectedClipId: null, selectedTrackId: null };
    }

    case "MOVE_TRACK": {
      const idx = state.tracks.findIndex(t => t.id === action.trackId);
      if (idx < 0) return state;
      const newIdx = action.direction === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= state.tracks.length) return state;
      const tracks = [...state.tracks];
      [tracks[idx], tracks[newIdx]] = [tracks[newIdx], tracks[idx]];
      return { ...state, tracks };
    }

    case "SET_LOOP":
      return { ...state, isLooping: action.looping };

    case "SET_ASPECT_RATIO": {
      const dims: Record<string, { w: number; h: number }> = {
        "16:9": { w: 1920, h: 1080 },
        "9:16": { w: 1080, h: 1920 },
        "1:1": { w: 1080, h: 1080 },
        "4:3": { w: 1440, h: 1080 },
      };
      const d = dims[action.ratio] || dims["16:9"];
      return { ...state, aspectRatio: action.ratio, width: d.w, height: d.h };
    }

    case "TOGGLE_SNAP":
      return { ...state, snapEnabled: !state.snapEnabled };

    case "SELECT_ALL_CLIPS": {
      // Select first clip found
      for (const t of state.tracks) {
        if (t.clips.length > 0) {
          return { ...state, selectedClipId: t.clips[0].id, selectedTrackId: t.id };
        }
      }
      return state;
    }

    default:
      return state;
  }
}

const MAX_HISTORY = 50;

interface HistoryEntry {
  tracks: TimelineTrack[];
}

function snapshotTracks(state: TimelineState): HistoryEntry {
  return { tracks: JSON.parse(JSON.stringify(state.tracks)) };
}

// ─── Context ───

interface TimelineContextValue {
  state: TimelineState;
  dispatch: React.Dispatch<TimelineAction>;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const TimelineContext = createContext<TimelineContextValue | null>(null);

export function CustomTimelineProvider({ children }: { children: React.ReactNode }) {
  const [state, rawDispatch] = useReducer(timelineReducer, INITIAL_TIMELINE_STATE);

  // Undo/redo stacks
  const undoStack = useRef<HistoryEntry[]>([]);
  const redoStack = useRef<HistoryEntry[]>([]);
  // Force re-render when undo/redo availability changes
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  // Wrap dispatch to capture history for undoable actions
  const dispatch = useCallback((action: TimelineAction) => {
    if (!NON_UNDOABLE.has(action.type)) {
      // Save current state before mutation
      undoStack.current.push(snapshotTracks(stateRef.current));
      if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();
      redoStack.current = []; // clear redo on new action
      forceUpdate();
    }
    rawDispatch(action);
  }, []);

  // Keep a ref to current state for snapshot capture
  const stateRef = useRef(state);
  stateRef.current = state;

  const undo = useCallback(() => {
    const entry = undoStack.current.pop();
    if (!entry) return;
    // Push current to redo
    redoStack.current.push(snapshotTracks(stateRef.current));
    rawDispatch({ type: "LOAD_PROJECT", state: { tracks: entry.tracks } });
    forceUpdate();
  }, []);

  const redo = useCallback(() => {
    const entry = redoStack.current.pop();
    if (!entry) return;
    undoStack.current.push(snapshotTracks(stateRef.current));
    rawDispatch({ type: "LOAD_PROJECT", state: { tracks: entry.tracks } });
    forceUpdate();
  }, []);

  const canUndo = undoStack.current.length > 0;
  const canRedo = redoStack.current.length > 0;

  const value = useMemo(() => ({
    state, dispatch, undo, redo, canUndo, canRedo,
  }), [state, dispatch, undo, redo, canUndo, canRedo]);

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
    version: 2,
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
          volume: c.volume,
          speed: c.speed,
          fadeIn: c.fadeIn,
          fadeOut: c.fadeOut,
          opacity: c.opacity,
          colorLabel: c.colorLabel,
          brightness: c.brightness,
          contrast: c.contrast,
          saturation: c.saturation,
          transition: c.transition,
          transitionDuration: c.transitionDuration,
        },
      })),
    })),
    fps: state.fps,
    width: state.width,
    height: state.height,
    aspectRatio: state.aspectRatio,
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
          volume: el.props?.volume,
          speed: el.props?.speed,
          fadeIn: el.props?.fadeIn,
          fadeOut: el.props?.fadeOut,
          opacity: el.props?.opacity,
          colorLabel: el.props?.colorLabel,
          brightness: el.props?.brightness,
          contrast: el.props?.contrast,
          saturation: el.props?.saturation,
          transition: el.props?.transition,
          transitionDuration: el.props?.transitionDuration,
      })),
    })),
    fps: json.fps || 30,
    width: json.width || 1920,
    height: json.height || 1080,
  };
}
