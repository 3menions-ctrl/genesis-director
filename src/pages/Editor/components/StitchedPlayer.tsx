/**
 * StitchedPlayer — true A/B ping-pong dual-buffer playback.
 *
 * The old single-ref + transient B-buffer pattern had a visible
 * hitch at every clip boundary because the videoRef's src swap
 * triggered a full reload sequence (emptied / loadstart / metadata /
 * canplay / playing) even when the bytes were HTTP-cached.
 *
 * This component owns two <video> elements. Each is assigned to a
 * "slot" (A or B). One slot is "showing" and playing; the other is
 * preloading its next clip silently. When the playhead crosses a
 * boundary, the role flips: the showing slot pauses, the preloaded
 * slot starts playing (already buffered, no reload), the now-idle
 * slot is reassigned to the NEXT clip in the chain and begins
 * preloading.
 *
 * This is the canonical pattern professional NLEs use.
 *
 * The component is intentionally narrow: it doesn't own transport
 * controls, HUD, transition overlays, or any of the editor's UI.
 * It exposes a small API (play, pause, seek, getCurrentTime,
 * setVolume, setMuted, setRate) that the host (PlayerCanvas)
 * drives. Visual filters / scale / mirror are passed via props and
 * applied to the showing slot.
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import type { EditorClip } from "@/lib/editor/types";

// ─────────────────────────────────────────────────────────────────────────────
// Imperative API
// ─────────────────────────────────────────────────────────────────────────────
export interface StitchedPlayerHandle {
  /** Play the currently-active buffer. Returns the underlying promise
   *  so callers can catch autoplay-blocked errors. */
  play: () => Promise<void>;
  pause: () => void;
  /** Seek to a timeline-absolute time in seconds. Switches buffers
   *  if the target lands in a different clip than what's playing. */
  seek: (timelineSec: number) => void;
  /** Returns the timeline-absolute current time. */
  getCurrentTime: () => number;
  /** Get a reference to the currently-showing video element. Used by
   *  the host for snapshot (canvas drawImage) and PiP. */
  getActiveElement: () => HTMLVideoElement | null;
  isPaused: () => boolean;
  setVolume: (v: number) => void;
  setMuted: (m: boolean) => void;
  setRate: (r: number) => void;
}

export interface StitchedPlayerProps {
  clips: EditorClip[];
  /** Timeline-absolute playhead in seconds. The host's source of
   *  truth; this component reacts to it. */
  playheadSec: number;
  /** Callback the host listens to so it can update its store. The
   *  active buffer's timeupdate drives this; rate-limited at the
   *  browser's native cadence (~4-5Hz). */
  onTimeUpdate?: (timelineSec: number) => void;
  /** Fired when the active buffer naturally reaches its clip's
   *  out point (or the source ends). Host decides whether to advance
   *  the playhead (this component just emits the signal). */
  onClipEnded?: (clipId: string) => void;
  onPlay?: () => void;
  onPause?: () => void;
  /** CSS filter applied to the showing buffer (color grade). */
  filter?: string;
  /** CSS scale + mirror transform applied to the showing buffer. */
  scale?: number;
  mirror?: boolean;
  /** Opacity applied to the showing buffer (per-clip fade
   *  envelope). The host computes this from the clip's keyframes
   *  + fade in/out. */
  opacity?: number;
  /** Poster fallback when the clip has no thumbnail. */
  posterFallback?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Implementation
// ─────────────────────────────────────────────────────────────────────────────

interface BufferState {
  /** Index of the clip assigned to this slot, -1 when slot is idle. */
  aIdx: number;
  bIdx: number;
  /** Which slot is "showing" + driving playback. */
  showing: "A" | "B";
}

export const StitchedPlayer = forwardRef<StitchedPlayerHandle, StitchedPlayerProps>(
  function StitchedPlayer(
    {
      clips,
      playheadSec,
      onTimeUpdate,
      onClipEnded,
      onPlay,
      onPause,
      filter,
      scale = 1,
      mirror = false,
      opacity = 1,
      posterFallback,
    },
    ref,
  ) {
    const videoARef = useRef<HTMLVideoElement | null>(null);
    const videoBRef = useRef<HTMLVideoElement | null>(null);

    // Resolve which clip index the playhead is currently inside.
    const activeIdx = useMemo(() => {
      if (clips.length === 0) return -1;
      for (let i = 0; i < clips.length; i++) {
        const c = clips[i];
        if (
          playheadSec >= c.timelineStartSec &&
          playheadSec < c.timelineStartSec + c.durationSec
        ) {
          return i;
        }
      }
      return clips.length - 1;
    }, [clips, playheadSec]);

    // The buffer state — which clip is assigned where + which is
    // showing. Initialized to A=first clip, B=second clip.
    const [bufferState, setBufferState] = useState<BufferState>(() => ({
      aIdx: 0,
      bIdx: clips.length > 1 ? 1 : -1,
      showing: "A",
    }));

    // Intent-to-play flag survives buffer swaps so the new showing
    // slot resumes playback automatically.
    const intentToPlayRef = useRef(false);

    // ── Sync buffer assignments to the active clip ─────────────
    // Called whenever activeIdx changes. The hot path is: "the new
    // active clip is ALREADY in the inactive buffer" — that's where
    // the ping-pong shines (instant swap, no reload). The cold path
    // (seek to an unloaded clip) reassigns one slot's src.
    useEffect(() => {
      if (activeIdx < 0 || clips.length === 0) return;

      setBufferState((prev) => {
        const targetClip = clips[activeIdx];
        if (!targetClip) return prev;

        // Already showing the right clip? Just update the inactive
        // slot to the NEXT clip if it isn't already pre-loaded there.
        if (
          prev.showing === "A" &&
          prev.aIdx === activeIdx
        ) {
          const nextIdx = activeIdx + 1 < clips.length ? activeIdx + 1 : -1;
          if (prev.bIdx === nextIdx) return prev;
          return { ...prev, bIdx: nextIdx };
        }
        if (
          prev.showing === "B" &&
          prev.bIdx === activeIdx
        ) {
          const nextIdx = activeIdx + 1 < clips.length ? activeIdx + 1 : -1;
          if (prev.aIdx === nextIdx) return prev;
          return { ...prev, aIdx: nextIdx };
        }

        // The target clip is in the OTHER buffer → swap "showing"
        // (instant; both bytes already loaded). Update the now-idle
        // slot to the next clip.
        if (prev.aIdx === activeIdx) {
          const nextIdx = activeIdx + 1 < clips.length ? activeIdx + 1 : -1;
          return { aIdx: activeIdx, bIdx: nextIdx, showing: "A" };
        }
        if (prev.bIdx === activeIdx) {
          const nextIdx = activeIdx + 1 < clips.length ? activeIdx + 1 : -1;
          return { aIdx: nextIdx, bIdx: activeIdx, showing: "B" };
        }

        // The target clip is in NEITHER buffer (large seek, or
        // initial mount). Assign to A, preload next on B, show A.
        const nextIdx = activeIdx + 1 < clips.length ? activeIdx + 1 : -1;
        return { aIdx: activeIdx, bIdx: nextIdx, showing: "A" };
      });
    }, [activeIdx, clips]);

    // ── Drive playback on the showing slot ──────────────────────
    // When the showing slot changes (instant ping-pong swap), pause
    // the previous showing element + play the new one. The new one
    // is already buffered, so play() is near-instant.
    useEffect(() => {
      const showing = bufferState.showing === "A" ? videoARef.current : videoBRef.current;
      const hidden = bufferState.showing === "A" ? videoBRef.current : videoARef.current;
      if (!showing) return;

      // Pause the hidden one + rewind so its next role start has a
      // clean position. We don't reset hidden's currentTime here —
      // that would defeat the preload. Just pause silently.
      if (hidden) {
        try {
          hidden.pause();
        } catch {
          /* ignored */
        }
      }

      // The showing element's currentTime: align with the playhead's
      // position WITHIN the active clip.
      const clip = clips[activeIdx];
      if (clip) {
        const rel = Math.max(0, playheadSec - clip.timelineStartSec);
        const drift = Math.abs(showing.currentTime - rel);
        if (drift > 0.5) {
          // Only re-seek when there's meaningful drift (e.g. on
          // initial mount or after a manual scrub). Tiny drifts
          // from natural playback shouldn't trigger reseeks.
          try {
            showing.currentTime = rel;
          } catch {
            /* ignored — try again on next render */
          }
        }
      }

      if (intentToPlayRef.current) {
        void showing.play().catch(() => {
          /* autoplay blocked — host will handle via its play button */
        });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bufferState.showing]);

    // ── Bind event listeners to the SHOWING slot ───────────────
    useEffect(() => {
      const el = bufferState.showing === "A" ? videoARef.current : videoBRef.current;
      if (!el) return;

      const handleTime = () => {
        const clip = clips[activeIdx];
        if (!clip) return;
        const rel = el.currentTime;
        // Cap at the clip's out point — emit onClipEnded so the host
        // can advance the playhead. The host's advance will trigger
        // the buffer swap effect above.
        if (rel >= clip.durationSec - 0.05) {
          onClipEnded?.(clip.id);
          return;
        }
        onTimeUpdate?.(clip.timelineStartSec + rel);
      };
      const handlePlay = () => {
        intentToPlayRef.current = true;
        onPlay?.();
      };
      const handlePause = () => {
        onPause?.();
      };
      const handleEnded = () => {
        const clip = clips[activeIdx];
        if (clip) onClipEnded?.(clip.id);
      };

      el.addEventListener("timeupdate", handleTime);
      el.addEventListener("play", handlePlay);
      el.addEventListener("pause", handlePause);
      el.addEventListener("ended", handleEnded);
      return () => {
        el.removeEventListener("timeupdate", handleTime);
        el.removeEventListener("play", handlePlay);
        el.removeEventListener("pause", handlePause);
        el.removeEventListener("ended", handleEnded);
      };
    }, [bufferState.showing, activeIdx, clips, onClipEnded, onPlay, onPause, onTimeUpdate]);

    // ── External seeks (from scrub bar / JKL / goto timecode) ──
    // The buffer-state sync effect above handles "what clip is
    // active". We just need to seek the showing element's
    // currentTime when the playhead moves WITHIN the active clip.
    useEffect(() => {
      const el = bufferState.showing === "A" ? videoARef.current : videoBRef.current;
      if (!el) return;
      const clip = clips[activeIdx];
      if (!clip) return;
      const rel = Math.max(0, playheadSec - clip.timelineStartSec);
      const drift = Math.abs(el.currentTime - rel);
      // Only seek on meaningful drift — natural playback writes
      // currentTime continuously and we don't want to fight it.
      if (drift > 0.25 && el.readyState >= 1) {
        try {
          el.currentTime = rel;
        } catch {
          /* ignored */
        }
      }
    }, [playheadSec, bufferState.showing, activeIdx, clips]);

    // ── Imperative API ─────────────────────────────────────────
    const getActive = useCallback((): HTMLVideoElement | null => {
      return bufferState.showing === "A" ? videoARef.current : videoBRef.current;
    }, [bufferState.showing]);

    useImperativeHandle(
      ref,
      (): StitchedPlayerHandle => ({
        play: async () => {
          const el = getActive();
          if (!el) return;
          intentToPlayRef.current = true;
          await el.play().catch(() => {
            intentToPlayRef.current = false;
          });
        },
        pause: () => {
          const el = getActive();
          intentToPlayRef.current = false;
          el?.pause();
        },
        seek: (timelineSec: number) => {
          const el = getActive();
          if (!el) return;
          const clip = clips[activeIdx];
          if (!clip) return;
          const rel = Math.max(0, timelineSec - clip.timelineStartSec);
          try {
            el.currentTime = rel;
          } catch {
            /* ignored */
          }
        },
        getCurrentTime: () => {
          const el = getActive();
          const clip = clips[activeIdx];
          if (!el || !clip) return 0;
          return clip.timelineStartSec + el.currentTime;
        },
        getActiveElement: () => getActive(),
        isPaused: () => getActive()?.paused ?? true,
        setVolume: (v: number) => {
          const el = getActive();
          if (el) el.volume = Math.max(0, Math.min(1, v));
        },
        setMuted: (m: boolean) => {
          const el = getActive();
          if (el) el.muted = m;
        },
        setRate: (r: number) => {
          const el = getActive();
          if (el) el.playbackRate = Math.max(0.05, Math.min(8, r));
        },
      }),
      [getActive, clips, activeIdx],
    );

    // ── Render ─────────────────────────────────────────────────
    const aClip = bufferState.aIdx >= 0 ? clips[bufferState.aIdx] : null;
    const bClip = bufferState.bIdx >= 0 ? clips[bufferState.bIdx] : null;
    const isShowingA = bufferState.showing === "A";
    const transform = `scale(${scale})${mirror ? " scaleX(-1)" : ""}`;

    return (
      <>
        {aClip?.videoUrl && (
          <video
            ref={videoARef}
            key={`stitch-A-${aClip.id}`}
            src={aClip.videoUrl}
            poster={aClip.thumbnailUrl ?? posterFallback ?? undefined}
            className={cn(
              "absolute inset-0 w-full h-full object-contain bg-black",
              "transition-[opacity] duration-150",
            )}
            style={{
              opacity: isShowingA ? opacity : 0,
              transform: isShowingA ? transform : undefined,
              filter: isShowingA ? filter || undefined : undefined,
              pointerEvents: isShowingA ? "auto" : "none",
            }}
            playsInline
            preload="auto"
            muted={!isShowingA}
          />
        )}
        {bClip?.videoUrl && (
          <video
            ref={videoBRef}
            key={`stitch-B-${bClip.id}`}
            src={bClip.videoUrl}
            poster={bClip.thumbnailUrl ?? posterFallback ?? undefined}
            className={cn(
              "absolute inset-0 w-full h-full object-contain bg-black",
              "transition-[opacity] duration-150",
            )}
            style={{
              opacity: !isShowingA ? opacity : 0,
              transform: !isShowingA ? transform : undefined,
              filter: !isShowingA ? filter || undefined : undefined,
              pointerEvents: !isShowingA ? "auto" : "none",
            }}
            playsInline
            preload="auto"
            muted={isShowingA}
          />
        )}
      </>
    );
  },
);
