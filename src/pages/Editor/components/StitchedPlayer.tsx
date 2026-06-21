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
import { useAudioMixChain, resumeAudioCtx, rampElementGain, setElementGain } from "@/hooks/editor/useAudioMixChain";

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
    // ── Decode first frame of the showing buffer on mount ──────
    // Without this, the canvas compositor shows pure black until the
    // user clicks play, because video readyState < 2 → drawImage
    // no-ops. play()→pause() forces the decoder to render frame 0.
    // The img fallback under the canvas handles the brief window
    // before this resolves.
    useEffect(() => {
      const el = bufferState.showing === "A" ? videoARef.current : videoBRef.current;
      if (!el) return;
      if (el.readyState >= 2) return;
      // Mute the element directly during the prime so audio can't leak
      // out before the Web Audio chain has wired up. The chain rebinds
      // muted-state on the next role-flip ramp. Without this mute, the
      // pre-warm play() produced a quarter-second of unwanted audio at
      // mount because the gain ramp effect hadn't run yet — and on a
      // narrow race window, the .then().pause() could lose to a user
      // pressing space, leaving the slot mid-play. The owner field
      // pinned below ensures only the original priming caller pauses.
      let cancelled = false;
      const wasMuted = el.muted;
      el.muted = true;
      const owner = Symbol("prime");
      (el as HTMLVideoElement & { __primeOwner?: symbol }).__primeOwner = owner;
      void el.play()
        .then(() => {
          if (cancelled) return;
          // If the user already issued a real play() (intentToPlay)
          // and that flipped the primeOwner, leave the element alone.
          if ((el as HTMLVideoElement & { __primeOwner?: symbol }).__primeOwner !== owner) return;
          if (intentToPlayRef.current) {
            el.muted = wasMuted;
            return;
          }
          try {
            el.pause();
            el.currentTime = 0;
          } catch { /* ignored */ }
          el.muted = wasMuted;
        })
        .catch(() => {
          el.muted = wasMuted;
          /* autoplay blocked — img fallback covers */
        });
      return () => { cancelled = true; el.muted = wasMuted; };
    }, [bufferState.showing]);

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
    // Boundary detection runs via rAF (60Hz) instead of timeupdate
    // (browser-throttled to ~4Hz). With timeupdate, the
    // "clip is ending" signal could fire up to 250ms LATE — the
    // element would naturally stop playing while we still hadn't
    // called onClipEnded, and the user saw a frozen frame. rAF gives
    // us frame-accurate boundary detection so the swap fires within
    // 16ms of the end.
    useEffect(() => {
      const el = bufferState.showing === "A" ? videoARef.current : videoBRef.current;
      if (!el) return;

      const handlePlay = () => {
        intentToPlayRef.current = true;
        onPlay?.();
      };
      const handlePause = () => {
        onPause?.();
      };
      const handleEnded = () => {
        // Safety net — if rAF missed the boundary (tab in background,
        // throttled to 1Hz), the element will fire `ended` when its
        // source actually finishes. Still emit onClipEnded so the host
        // advances.
        const clip = clips[activeIdx];
        if (clip) onClipEnded?.(clip.id);
      };

      // rAF-based time monitor. IDLES WHEN PAUSED — the previous
      // implementation ran 60 ticks/sec for the editor's entire
      // lifetime even when nothing was playing, contributing to the
      // editor-slowness + cursor-glitch problem.
      let raf = 0;
      let endedFor: string | null = null;
      // Throttle the store playhead write to ~12Hz. Boundary detection
      // (onClipEnded) still runs every frame for accuracy, but pushing
      // setPlayhead 60×/sec re-rendered the whole editor tree on every
      // frame — the dominant cause of the "playback feels janky / the
      // transport bar stutters" report. 12Hz is smooth to the eye and
      // an 80% reduction in store churn.
      let lastEmit = 0;
      const EMIT_INTERVAL_MS = 80;
      const tick = () => {
        if (el.paused || el.ended) {
          // Idle: schedule but do no work; cheap. Scheduling lets us
          // pick up immediately when playback resumes without needing
          // a separate listener-based restart path.
          raf = window.requestAnimationFrame(tick);
          return;
        }
        const clip = clips[activeIdx];
        if (!clip) {
          // Empty timeline / out-of-range — schedule next tick but
          // skip work. Cheaper than not scheduling because the effect
          // dep list catches the re-arming via clips/activeIdx anyway.
          raf = window.requestAnimationFrame(tick);
          return;
        }
        const rel = el.currentTime;
        if (rel >= clip.durationSec - 0.08 && endedFor !== clip.id) {
          endedFor = clip.id;
          onClipEnded?.(clip.id);
        } else if (rel < clip.durationSec - 0.08) {
          endedFor = null;
          const now = performance.now();
          if (now - lastEmit >= EMIT_INTERVAL_MS) {
            lastEmit = now;
            onTimeUpdate?.(clip.timelineStartSec + rel);
          }
        }
        raf = window.requestAnimationFrame(tick);
      };
      raf = window.requestAnimationFrame(tick);

      el.addEventListener("play", handlePlay);
      el.addEventListener("pause", handlePause);
      el.addEventListener("ended", handleEnded);
      return () => {
        window.cancelAnimationFrame(raf);
        el.removeEventListener("play", handlePlay);
        el.removeEventListener("pause", handlePause);
        el.removeEventListener("ended", handleEnded);
      };
    }, [bufferState.showing, activeIdx, clips, onClipEnded, onPlay, onPause, onTimeUpdate]);

    // ── Pre-roll the HIDDEN buffer near the boundary ────────────
    // preload="auto" only fetches BYTES; the first frame isn't decoded
    // until play() is called. So when the swap fires at clip end, the
    // new showing element has to cold-decode its first frame, which
    // reads as a 100-300ms pause between clips. Fix: in the last
    // ~1s of the active clip, briefly play(→pause) the hidden buffer
    // to force a decode pass. By swap time the first frame is already
    // in the GPU pipeline so the visual handover is seamless.
    //
    // NOTE: we DON'T attempt an audio crossfade here. Web Audio chains
    // (created by useAudioMixChain) cache the element's source on
    // first instantiation; meddling with element.volume / .muted from
    // an external rAF loop can desync the chain and silence the next
    // clip. Audio swap stays attribute-driven via JSX below — simple
    // and reliable.
    const primedForRef = useRef<string | null>(null);
    // showingRef mirrors bufferState.showing but updates synchronously
    // on every render. The pre-roll's play().then(pause) callback
    // reads from THIS — not the effect's closure — so when a swap
    // fires between play() and the promise resolution the callback
    // sees the LIVE showing and skips the pause. Stale-closure read
    // was the cause of the "second clip lost audio" intermittent bug.
    const showingRef = useRef(bufferState.showing);
    showingRef.current = bufferState.showing;
    useEffect(() => {
      const showing = bufferState.showing === "A" ? videoARef.current : videoBRef.current;
      const hidden  = bufferState.showing === "A" ? videoBRef.current : videoARef.current;
      const clip = clips[activeIdx];
      if (!showing || !hidden || !clip) return;
      primedForRef.current = null;
      const PRIME_WINDOW_SEC = 1.0;       // start decoder warm-up here
      const ROLL_WINDOW_SEC  = 0.32;      // keep hidden PLAYING from here for canvas to blend live frames
      let raf = 0;
      let rollingForId: string | null = null;
      let previousTime = 0;
      const tick = () => {
        // Reset primed flag on backward scrub — the previously-primed
        // "next clip" may no longer be next if the user seeked back.
        if (previousTime - showing.currentTime > 0.5) {
          primedForRef.current = null;
          rollingForId = null;
        }
        previousTime = showing.currentTime;
        // Idle when paused — pre-roll only matters during playback.
        if (showing.paused || showing.ended) {
          raf = window.requestAnimationFrame(tick);
          return;
        }
        const remaining = clip.durationSec - showing.currentTime;
        const nextClipId = bufferState.showing === "A"
          ? clips[bufferState.bIdx]?.id
          : clips[bufferState.aIdx]?.id;
        if (!nextClipId) {
          raf = window.requestAnimationFrame(tick);
          return;
        }

        // ── ROLL phase: in the last 320ms, keep B PLAYING so the
        // canvas can blend live frames. Don't pause it — the canvas
        // compositor reads from a playing element. After data swap
        // fires, B becomes "showing" and continues playing naturally.
        if (
          remaining > 0 &&
          remaining < ROLL_WINDOW_SEC &&
          hidden.readyState >= 2 &&
          hidden.paused &&
          rollingForId !== nextClipId
        ) {
          rollingForId = nextClipId;
          // CRITICAL: silence hidden BEFORE play(). The canvas tick
          // will ramp it back up via the equal-power curve as the
          // crossfade progresses. Without this, the hidden buffer
          // plays at gain=1 (the value left over from when it was
          // previously "showing") and we hear it as a second
          // audio source mid-crossfade. This was a direct cause
          // of the inter-clip clicks the user reported.
          setElementGain(hidden, 0);
          try { hidden.currentTime = 0; } catch { /* ignored */ }
          void hidden.play().catch(() => { /* autoplay blocked */ });
          // Mark as primed so the PRIME branch below doesn't re-fire.
          primedForRef.current = nextClipId;
        }
        // ── PRIME phase: 1.0s to 0.32s, briefly play→pause to warm
        // the decoder so the first frame is ready when ROLL hits.
        else if (
          remaining > ROLL_WINDOW_SEC &&
          remaining < PRIME_WINDOW_SEC &&
          hidden.readyState >= 2 &&
          hidden.paused &&
          primedForRef.current !== nextClipId
        ) {
          primedForRef.current = nextClipId;
          const primedEl = hidden;
          // CRITICAL: silence before priming. The PRIME phase runs
          // play() for 50-680ms purely to warm the decoder so the
          // first frame is ready when ROLL hits. The hidden chain's
          // master.gain may still be at the "showing" gain from
          // before — without this zero, the user hears the next
          // clip's audio start 1s early and then click as it stops.
          setElementGain(primedEl, 0);
          void primedEl.play()
            .then(() => {
              // RACE GUARD: skip pause if a swap or ROLL phase took
              // over the element while play() was pending. The seek
              // to 0 used to live here too but caused the "second clip
              // lost audio" bug — if the swap fired in the same micro-
              // task batch where this .then() resolved, the reset
              // would land on the NEW showing buffer. ROLL phase
              // already does currentTime=0 reliably, so the only thing
              // we need here is the pause.
              const liveShowing = showingRef.current;
              const liveHidden = liveShowing === "A" ? videoBRef.current : videoARef.current;
              if (primedEl !== liveHidden) return;
              if (primedEl.ended) return;
              const newRemaining = clip.durationSec - showing.currentTime;
              if (newRemaining < ROLL_WINDOW_SEC) return;
              try { primedEl.pause(); } catch { /* ignored */ }
            })
            .catch(() => { /* autoplay blocked */ });
        }
        raf = window.requestAnimationFrame(tick);
      };
      raf = window.requestAnimationFrame(tick);
      return () => window.cancelAnimationFrame(raf);
    }, [bufferState.showing, bufferState.aIdx, bufferState.bIdx, activeIdx, clips]);

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
          // Resume the AudioContext if suspended. This call site IS a
          // user-gesture-bound entry point (transport play button); the
          // ctx.resume() inside useAudioMixChain runs OUTSIDE a gesture
          // and would be ignored by browser autoplay policy.
          resumeAudioCtx();
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

    // Wire each buffer's audio output through the per-clip mix
    // (volume, pan, EQ, compressor) via Web Audio API. Each buffer
    // owns its own chain because MediaElementAudioSourceNode can only
    // be created once per element. Params update in place when the
    // underlying clip's mix changes — no reconnections, no clicks.
    useAudioMixChain(videoARef, aClip?.properties?.audioMix);
    useAudioMixChain(videoBRef, bClip?.properties?.audioMix);
    const isShowingA = bufferState.showing === "A";

    // ── Audio role flip — ramp master gain instead of toggling `muted` ──
    // The old approach (`muted={!isShowingA}`) hit zero in a single
    // frame and the boundary clicked. With the chain already built by
    // useAudioMixChain above, both elements stay unmuted and we ramp
    // their master gain to a target across ~60ms — true audio
    // crossfade. If the chain hasn't been built yet (first mount, ref
    // hasn't resolved), we poll for a few frames.
    useEffect(() => {
      const a = videoARef.current;
      const b = videoBRef.current;
      let attempts = 0;
      let raf = 0;
      const apply = () => {
        const okA = rampElementGain(a, isShowingA ? 1 : 0, 60);
        const okB = rampElementGain(b, isShowingA ? 0 : 1, 60);
        if (okA && okB) return;
        if (++attempts > 240) return;
        raf = requestAnimationFrame(apply);
      };
      raf = requestAnimationFrame(apply);
      return () => { if (raf) cancelAnimationFrame(raf); };
    }, [isShowingA]);
    const transform = `scale(${scale})${mirror ? " scaleX(-1)" : ""}`;

    // ── Canvas compositor ──────────────────────────────────────
    // Both video elements stay mounted + decoding but are visually
    // hidden (opacity 0). A canvas overlay reads frames from them via
    // drawImage() and composites to the displayed surface. During the
    // crossfade window (last ~300ms of the active clip), we draw BOTH
    // buffers at inverse alpha — true frame-level blending, the
    // pattern professional NLEs (Premiere, Resolve) use internally.
    //
    // This kills the "flashing between clips" the opacity-swap
    // approach had — there's no DOM element being toggled, just one
    // canvas being painted at 60Hz. The audio mute swap still
    // happens via the JSX `muted` attribute below; that's reliable
    // and the human ear doesn't notice a 1-frame mute hand-off.
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const CROSSFADE_MS = 320;
    // Stable mirror refs — the canvas effect reads from these so its
    // tick closure stays current without the effect having to re-bind
    // (and re-create its ResizeObserver + rAF) every time clips or
    // activeIdx change. Was thrashing the entire render loop on every
    // clip-boundary crossing.
    const clipsRef = useRef(clips);
    clipsRef.current = clips;
    const activeIdxRef = useRef(activeIdx);
    activeIdxRef.current = activeIdx;
    const isShowingARef = useRef(isShowingA);
    isShowingARef.current = isShowingA;
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
      if (!ctx) return;

      // Resize observer keeps the canvas's drawing surface matched to
      // its rendered CSS size, so drawImage isn't pixelated.
      const resize = () => {
        const rect = canvas.getBoundingClientRect();
        // DPR cap raised from 2 → 3 so 3x retina (M-series laptops on
        // built-in panels) no longer blurs. The drawImage cost scales
        // linearly with surface area — at 1280×720 viewport that's
        // a +56% pixel count vs DPR=2 (5.5MP vs 3.5MP), still well
        // under the 16MP MediaElement texture limit and the rAF loop
        // stays at 60fps in Chrome/Safari profiling.
        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        const w = Math.max(1, Math.floor(rect.width  * dpr));
        const h = Math.max(1, Math.floor(rect.height * dpr));
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(canvas);

      // `object-cover` equivalent for canvas — fill the surface,
      // crop overflow, preserve aspect.
      const drawCover = (vid: HTMLVideoElement, alpha: number) => {
        if (vid.readyState < 2) return;          // no frame to draw yet
        const cw = canvas.width;
        const ch = canvas.height;
        const vw = vid.videoWidth || 16;
        const vh = vid.videoHeight || 9;
        const scale = Math.max(cw / vw, ch / vh);
        const dw = vw * scale;
        const dh = vh * scale;
        const dx = (cw - dw) / 2;
        const dy = (ch - dh) / 2;
        ctx.globalAlpha = alpha;
        ctx.drawImage(vid, dx, dy, dw, dh);
      };

      // Repaint counter — used so we draw a few extra frames after the
      // active video pauses (paused frame is static; no need to draw
      // it 60x/s forever). Paint stops once we've redrawn a couple of
      // settled frames; mousemove or playback resume restart the loop.
      let raf = 0;
      let paintsAfterPause = 0;
      const tick = () => {
        const a = videoARef.current;
        const b = videoBRef.current;
        // Read role + clips from refs so the effect only re-binds on
        // mount/unmount, not every clip-boundary crossing.
        const isA = isShowingARef.current;
        const showingEl = isA ? a : b;
        const hiddenEl  = isA ? b : a;
        const clip = clipsRef.current[activeIdxRef.current];
        const playing = !!showingEl && !showingEl.paused && !showingEl.ended;
        if (!playing) {
          // Draw a couple of settled frames so resize / first-mount
          // shows content, then stop until something changes.
          if (paintsAfterPause < 3 && showingEl && clip) {
            paintsAfterPause++;
            ctx.globalAlpha = 1;
            ctx.fillStyle = "#000";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            drawCover(showingEl, 1);
          }
          raf = window.requestAnimationFrame(tick);
          return;
        }
        paintsAfterPause = 0;

        ctx.globalAlpha = 1;
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (showingEl && clip) {
          const remaining = clip.durationSec - showingEl.currentTime;
          if (
            hiddenEl &&
            hiddenEl.readyState >= 2 &&
            !hiddenEl.paused &&
            remaining > 0 &&
            remaining < CROSSFADE_MS / 1000
          ) {
            const t = 1 - (remaining / (CROSSFADE_MS / 1000));
            const showingGainVal = Math.cos((t * Math.PI) / 2);
            const hiddenGainVal  = Math.sin((t * Math.PI) / 2);
            drawCover(showingEl, showingGainVal);
            drawCover(hiddenEl,  hiddenGainVal);
            // Track the audio crossfade to the visual envelope so
            // they finish at the same instant. Without this, the
            // audio swap happened at the buffer-state flip (a single
            // frame) and clicked even with the 60ms ramp because the
            // ramp started after the discontinuity was already
            // audible. Setting the gain immediately every frame IS
            // the crossfade — equal-power so total perceived loudness
            // stays flat across the boundary.
            setElementGain(showingEl, showingGainVal);
            setElementGain(hiddenEl,  hiddenGainVal);
          } else {
            drawCover(showingEl, 1);
            // Outside the crossfade window the showing element should
            // be unity gain; the hidden one stays at 0 (the role-flip
            // effect handles steady-state).
            setElementGain(showingEl, 1);
          }
        }

        raf = window.requestAnimationFrame(tick);
      };
      raf = window.requestAnimationFrame(tick);
      return () => {
        window.cancelAnimationFrame(raf);
        ro.disconnect();
      };
      // Empty deps — the canvas + RO + rAF live for the lifetime of
      // the component. State changes flow in via refs above.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // The canvas is the visible surface. Apply transform + filter to
    // it (mirrors what the video elements used to carry in their CSS).
    // Video elements are kept invisible but in layout so they keep
    // decoding + producing audio.
    return (
      <>
        {/* Poster fallback — visible behind the canvas as a base layer.
            The canvas fillRect+drawImage paints over it. When the video
            hasn't decoded yet, the canvas no-ops (readyState<2 in
            drawCover), so the user sees the thumbnail through transparent
            canvas. Once the first frame decodes, the canvas's solid
            paint takes over naturally. */}
        {(aClip?.thumbnailUrl || posterFallback) && (
          <img
            src={(isShowingA ? aClip?.thumbnailUrl : bClip?.thumbnailUrl) ?? aClip?.thumbnailUrl ?? posterFallback ?? undefined}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover bg-black pointer-events-none"
            style={{ opacity, transform }}
          />
        )}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full bg-black"
          style={{
            opacity,
            transform,
            filter: filter || undefined,
            pointerEvents: "none",
          }}
        />
        {/* CRITICAL: no React `key` prop on these video elements. A
            clip-id-based key would remount the element on every clip
            swap; that breaks the cached MediaElementAudioSourceNode in
            useAudioMixChain (can only be created once per element).
            Result was the well-known "second clip lost its audio" bug.
            Changing the `src` prop is enough — the browser triggers a
            media reload without losing the audio chain binding. */}
        {/* Audio crossfade is driven by `rampElementGain` in the role-flip
            effect below, NOT by a `muted` JSX attribute swap. Toggling
            `muted` produced a click at every boundary — the human ear
            hears the hard zero crossing as a pop. Letting both elements
            play unmuted and ramping their master gain over ~60ms across
            the role flip is what professional NLEs do internally. */}
        {aClip?.videoUrl && (
          <video
            ref={videoARef}
            src={aClip.videoUrl}
            poster={aClip.thumbnailUrl ?? posterFallback ?? undefined}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: 0, pointerEvents: "none" }}
            playsInline
            preload="auto"
          />
        )}
        {bClip?.videoUrl && (
          <video
            ref={videoBRef}
            src={bClip.videoUrl}
            poster={bClip.thumbnailUrl ?? posterFallback ?? undefined}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: 0, pointerEvents: "none" }}
            playsInline
            preload="auto"
          />
        )}
      </>
    );
  },
);
