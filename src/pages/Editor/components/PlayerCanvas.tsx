/**
 * PlayerCanvas — the center-top player surface for the unified
 * editor layout. Embeds the Stage-style cinematic player (aspect-
 * locked, letterboxed, title overlays, opacity/scale CSS applied
 * per clip) but without the bottom film-reel strip — the always-
 * visible Timeline below now serves as the clip strip.
 *
 * The transport bar (play / pause + scrub + timecode) lives in
 * this component so the user always sees it directly above the
 * timeline, matching how every NLE arranges them.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Play,
  Pause,
  Film,
  AlertCircle,
  Columns2,
  Square,
  Maximize2,
  Minimize2,
  PictureInPicture2,
  Volume2,
  VolumeX,
  Volume1,
  Volume,
  Camera,
  Repeat,
  Gauge,
  SkipBack,
  SkipForward,
  Rewind,
  FastForward,
  ChevronsLeft,
  ChevronsRight,
  Crosshair,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TYPE_META, EASE_PREMIUM } from "@/lib/design-system";
import type { EditorClip, EditorProject } from "@/lib/editor/types";
import {
  ASPECT_RATIOS,
  PLAYBACK_SPEEDS,
  getClipProperty,
  getClipPropertyAt,
} from "@/lib/editor/types";
import {
  setPlayhead,
  setInPoint as setInPointMut,
  setOutPoint as setOutPointMut,
  clearInOut as clearInOutMut,
  setMasterVolume,
} from "@/lib/editor/store";
import { useEditor } from "@/hooks/editor/useEditor";

interface Props {
  project: EditorProject;
  selectedClipId: string | null;
  playheadSec: number;
}

type MonitorMode = "program" | "dual";

function fmtTC(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ff = Math.floor((sec - Math.floor(sec)) * 30);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}:${ff.toString().padStart(2, "0")}`;
}

/**
 * VuMeter — two narrow vertical bars that animate while playing.
 * Pseudo-real: oscillates with a sine + random jitter scaled by the
 * active clip's volume. When real audio decode lands, this swaps in
 * a Web Audio Analyser-driven version with no change to the
 * surface contract.
 */
// ─────────────────────────────────────────────────────────────────────────────
// SourceMonitor — independent player for the currently-selected clip
// (dual-monitor mode). Plays the clip in isolation with its own
// transport; doesn't drive or read the global playhead.
// ─────────────────────────────────────────────────────────────────────────────
function SourceMonitor({
  clip,
  aspect,
  reducedMotion,
}: {
  clip: EditorClip | null;
  aspect: { w: number; h: number };
  reducedMotion: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [time, setTime] = useState(0);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => setTime(v.currentTime);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("ended", onEnded);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("ended", onEnded);
    };
  }, [clip?.videoUrl]);

  useEffect(() => {
    // Reset to start when the selected clip changes
    setTime(0);
    setIsPlaying(false);
    const v = videoRef.current;
    if (v) {
      try {
        v.currentTime = 0;
        v.pause();
      } catch {
        /* ignored */
      }
    }
  }, [clip?.id]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => {});
    else v.pause();
  };

  const dur = clip?.durationSec ?? 0;
  const pct = dur > 0 ? (time / dur) * 100 : 0;

  return (
    <motion.div
      initial={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.32, ease: EASE_PREMIUM }}
      className="relative flex-1 min-w-0 h-full flex flex-col items-center justify-center"
    >
      <div
        className="relative w-full bg-black shadow-[0_30px_80px_-30px_hsl(0_0%_0%/0.8),0_0_0_1px_hsl(0_0%_100%/0.04)]"
        style={{
          aspectRatio: `${aspect.w} / ${aspect.h}`,
          // height: auto with width: 100% + aspect-ratio makes the
          // box maintain ratio without collapsing. Cap with max-h so
          // we don't push the strip off the bottom of the monitor.
          maxHeight: "calc(100% - 36px)",
        }}
      >
        <div className="absolute -top-5 left-0">
          <span className={cn(TYPE_META, "text-muted-foreground/65 tracking-[0.32em]")}>
            ◆ Source
            {clip && ` · clip ${String(clip.index + 1).padStart(2, "0")}`}
          </span>
        </div>

        {clip?.videoUrl ? (
          <video
            ref={videoRef}
            src={clip.videoUrl}
            poster={clip.thumbnailUrl ?? undefined}
            className="absolute inset-0 w-full h-full object-contain bg-black"
            playsInline
            preload="metadata"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/55">
            <Film className="h-6 w-6" strokeWidth={1.4} />
            <p className={cn(TYPE_META, "mt-3 tracking-[0.28em]")}>
              {clip ? (clip.kind === "title" ? "title card on V2" : "rendering") : "select a clip"}
            </p>
          </div>
        )}

        <div className="absolute top-2 right-2 pointer-events-none">
          <span className={cn(TYPE_META, "text-foreground/65 tracking-[0.32em] mix-blend-difference font-mono tabular-nums")}>
            {fmtTC(time)} / {fmtTC(dur)}
          </span>
        </div>
      </div>

      <div className="mt-3 w-full max-w-full px-2 flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          disabled={!clip?.videoUrl}
          className={cn(
            "inline-flex items-center justify-center h-7 w-7 rounded-full border border-white/[0.10] bg-white/[0.04]",
            "transition-all hover:border-accent/40 hover:bg-[hsl(var(--accent)/0.08)]",
            "disabled:opacity-40 disabled:cursor-not-allowed",
          )}
          aria-label={isPlaying ? "Pause source" : "Play source"}
        >
          {isPlaying ? (
            <Pause className="h-3 w-3 text-foreground" strokeWidth={1.6} />
          ) : (
            <Play className="h-3 w-3 text-foreground ml-px" strokeWidth={1.6} />
          )}
        </button>
        <div className="relative flex-1 h-1 rounded-full bg-white/[0.05] overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-foreground/55 rounded-full"
            style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
          />
        </div>
        <span className={cn(TYPE_META, "font-mono tabular-nums text-foreground/75 shrink-0")}>
          {fmtTC(time)}
        </span>
      </div>
    </motion.div>
  );
}

function VuMeter({ isPlaying, volume }: { isPlaying: boolean; volume: number }) {
  const [levels, setLevels] = useState<[number, number]>([0, 0]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isPlaying) {
      // Smooth decay to 0 when paused
      let l: [number, number] = [...levels] as [number, number];
      const tick = () => {
        l = [l[0] * 0.85, l[1] * 0.85] as [number, number];
        if (l[0] < 0.01 && l[1] < 0.01) {
          setLevels([0, 0]);
          return;
        }
        setLevels(l);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
      return () => {
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      };
    }
    const start = performance.now();
    const tick = () => {
      const t = (performance.now() - start) / 1000;
      const sine = (Math.sin(t * 7.3) + 1) / 2; // 0..1
      const jitterL = Math.random() * 0.35;
      const jitterR = Math.random() * 0.35;
      const env = 0.4 + 0.6 * sine;
      const next: [number, number] = [
        Math.min(1, volume * (env + jitterL) * 0.95),
        Math.min(1, volume * (env + jitterR) * 0.95),
      ];
      setLevels(next);
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, volume]);

  return (
    <div className="flex items-end gap-1 h-9" aria-hidden>
      {[0, 1].map((ch) => (
        <div
          key={ch}
          className="relative w-1.5 h-full rounded-full bg-white/[0.05] overflow-hidden"
        >
          <div
            className="absolute inset-x-0 bottom-0 rounded-full transition-[height] duration-75 bg-gradient-to-t from-emerald-400 via-amber-300 to-rose-300"
            style={{ height: `${levels[ch] * 100}%` }}
          />
        </div>
      ))}
    </div>
  );
}

export function PlayerCanvas({ project, selectedClipId, playheadSec }: Props) {
  const reducedMotion = useReducedMotion();
  /**
   * Container ref — what `Element.requestFullscreen()` targets so the
   * whole player surface (frame + transport + HUD) goes fullscreen
   * together, not just the bare <video>. Native video fullscreen
   * loses our HUD overlays and the custom transport.
   */
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  /**
   * Secondary "B" buffer used to render the INCOMING clip during a
   * between-clip transition (crossfade). Outside of a transition
   * window this element stays hidden + paused. See xfadeInfo below.
   */
  const videoBRef = useRef<HTMLVideoElement | null>(null);
  const [monitorMode, setMonitorMode] = useState<MonitorMode>("program");
  const {
    masterVolume,
    masterMuted,
    trackVolumes,
    trackMuted,
    isPlaying: storeIsPlaying,
    setIsPlaying,
    playbackSpeed,
    loopRegion,
    inSec,
    outSec,
    theaterMode,
    toggleTheaterMode,
    isFullscreen,
    setFullscreen,
    setPlaybackSpeed,
    toggleLoopRegion,
    setMasterMuted,
  } = useEditor();
  /**
   * Intent-to-play flag. Survives across clip-src changes so that when
   * one clip ends and the next clip's video loads, we can auto-resume
   * playback. Without this the player would stop at every clip boundary
   * because the new <video> element starts paused.
   */
  const intentToPlayRef = useRef(false);
  /**
   * Pending seek-to-time when the video's src changes. The seek can't
   * apply until the new source has metadata; loadedmetadata reads this
   * ref and applies it.
   */
  const pendingSeekRef = useRef<number | null>(null);

  const allClips: EditorClip[] = useMemo(() => project.scenes.flatMap((s) => s.clips), [project]);
  const clips = useMemo(() => allClips.filter((c) => c.kind !== "title"), [allClips]);
  const titleClips = useMemo(() => allClips.filter((c) => c.kind === "title"), [allClips]);

  // Find which V1 clip the playhead is currently inside.
  const activeIdx = useMemo(() => {
    if (clips.length === 0) return 0;
    for (let i = 0; i < clips.length; i++) {
      const c = clips[i];
      if (playheadSec >= c.timelineStartSec && playheadSec < c.timelineStartSec + c.durationSec) {
        return i;
      }
    }
    return clips.length - 1;
  }, [clips, playheadSec]);
  const activeClip = clips[activeIdx];

  /**
   * Crossfade descriptor — non-null when the playhead is currently
   * inside a transition window between activeClip → next clip.
   *
   * Geometry: the crossfade overlaps the END of outgoing with the
   * START of incoming, durationSec wide. So at progress = 0 we're at
   * (out.timelineStartSec + out.durationSec - dur), and at progress
   * = 1 we're exactly at the boundary. After the boundary, activeClip
   * has advanced and xfadeInfo flips back to null.
   */
  const xfadeInfo = useMemo(() => {
    if (!activeClip) return null;
    const next = clips[activeIdx + 1];
    if (!next) return null;
    const transition = (project.transitions ?? []).find(
      (t) => t.fromClipId === activeClip.id && t.toClipId === next.id,
    );
    if (!transition) return null;
    const xfadeStart =
      activeClip.timelineStartSec + activeClip.durationSec - transition.durationSec;
    const rel = playheadSec - xfadeStart;
    if (rel < 0) return null;
    const progress = Math.min(1, rel / Math.max(0.01, transition.durationSec));
    return { transition, progress, next, xfadeStart };
  }, [activeClip, activeIdx, clips, playheadSec, project.transitions]);

  // Local mirror of store isPlaying — the JSX reads it for the
  // play/pause icon. The store is the source of truth so the
  // mixer / status bar / future panels all share one notion of
  // "playing now".
  const isPlaying = storeIsPlaying;

  // ── Playback chain (rewritten for v1 reliability) ──────────────────
  //
  // Two-effect design with explicit intent-to-play:
  //
  //   Effect A — bound to activeClip.id (and so re-runs when the
  //   video src changes). Sets up timeupdate / play / pause / ended /
  //   loadedmetadata listeners and tears them down on the next src
  //   change.
  //
  //   Effect B — bound to playheadSec, applies seeks that the user
  //   makes via the scrub bar / arrow keys / blade / Cmd+P, but
  //   leaves the video alone during natural timeupdate progression.
  //
  // intentToPlayRef carries the user's "we are playing" intent
  // ACROSS clip boundaries so the next clip auto-resumes on
  // loadedmetadata. pendingSeekRef stashes the position for the
  // first frame of a new clip when the user seeks across the
  // boundary.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !activeClip) return;

    const onTime = () => {
      if (!activeClip) return;
      const rel = v.currentTime;

      // CLIP OUT-POINT — each clip declares a durationSec that's
      // almost always SHORTER than the underlying source video.
      // (A 6-second clip on the timeline can reference Sintel's 52s
      // trailer; we only want to play the first 6 seconds.) When the
      // video element's playhead crosses durationSec, we treat the
      // clip as ended — advance to the next clip's start, or pause
      // at the end of the chain.
      if (rel >= activeClip.durationSec - 0.05) {
        const next = clips[activeIdx + 1];
        if (next) {
          // intentToPlayRef stays true → next clip auto-resumes via
          // its loadedmetadata handler.
          setPlayhead(next.timelineStartSec);
        } else {
          intentToPlayRef.current = false;
          try {
            v.pause();
          } catch {
            /* ignored */
          }
        }
        return;
      }

      setPlayhead(activeClip.timelineStartSec + rel);
      const baseOpacity = getClipPropertyAt(activeClip, "opacity", rel);
      const fadeIn = getClipProperty(activeClip, "fadeInSec");
      const fadeOut = getClipProperty(activeClip, "fadeOutSec");
      let mult = 1;
      if (fadeIn > 0 && rel < fadeIn) mult = rel / fadeIn;
      const fromEnd = activeClip.durationSec - rel;
      if (fadeOut > 0 && fromEnd < fadeOut) {
        mult = Math.min(mult, Math.max(0, fromEnd / fadeOut));
      }
      v.style.opacity = String(baseOpacity * mult);
      const liveScale = getClipPropertyAt(activeClip, "scale", rel);
      const mirror = getClipProperty(activeClip, "mirror");
      v.style.transform = `scale(${liveScale})${mirror ? " scaleX(-1)" : ""}`;
      const liveVol = getClipPropertyAt(activeClip, "volume", rel);
      const effective = liveVol * trackVolumes.V1 * masterVolume;
      v.volume = Math.max(0, Math.min(1, effective));
    };
    const onPlay = () => {
      intentToPlayRef.current = true;
      setIsPlaying(true);
    };
    const onPause = () => {
      // Intent only clears on explicit user pause, not on
      // boundary-driven pauses. We can't distinguish those reliably
      // from inside an event handler, so we leave intent alone —
      // togglePlay clears it explicitly.
      setIsPlaying(false);
    };
    const onEnded = () => {
      const next = clips[activeIdx + 1];
      if (next) {
        // intentToPlayRef stays true so the next clip auto-resumes.
        setPlayhead(next.timelineStartSec);
      } else {
        intentToPlayRef.current = false;
        setIsPlaying(false);
      }
    };
    const onLoadedMetadata = () => {
      // The src has just changed. Apply any pending seek, then if
      // the user wants to be playing, resume.
      const seek = pendingSeekRef.current;
      if (seek !== null) {
        try {
          v.currentTime = Math.max(0, Math.min(v.duration || seek, seek));
        } catch {
          /* ignored */
        }
        pendingSeekRef.current = null;
      }
      if (intentToPlayRef.current) {
        void v.play().catch((e) => {
          // eslint-disable-next-line no-console
          console.warn("[PlayerCanvas] auto-resume blocked:", e);
          intentToPlayRef.current = false;
          setIsPlaying(false);
        });
      }
    };

    v.addEventListener("timeupdate", onTime);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("ended", onEnded);
    v.addEventListener("loadedmetadata", onLoadedMetadata);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("ended", onEnded);
      v.removeEventListener("loadedmetadata", onLoadedMetadata);
    };
    // Re-bind on src changes — that's what activeClip.id captures.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClip?.id]);

  // Effect B — apply external seeks. Skip during natural playback
  // (when |v.currentTime - wantRel| is small the timeupdate handler
  // already wrote playheadSec and there's nothing to do).
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !activeClip) return;
    const wantRel = Math.max(0, playheadSec - activeClip.timelineStartSec);
    // If the video is still loading the current clip, stash the seek
    // for loadedmetadata to apply.
    if (v.readyState < 1) {
      pendingSeekRef.current = wantRel;
      return;
    }
    // Only seek when the gap is large enough to be a deliberate jump
    // (not a 1-frame drift from natural playback timing).
    if (Math.abs(v.currentTime - wantRel) > 0.25) {
      try {
        v.currentTime = wantRel;
      } catch {
        pendingSeekRef.current = wantRel;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playheadSec, activeClip?.id]);

  // Apply per-clip / per-track / master volume + mute + speed
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !activeClip) return;
    v.volume = Math.max(
      0,
      Math.min(
        1,
        getClipProperty(activeClip, "volume") *
          trackVolumes.V1 *
          masterVolume,
      ),
    );
    v.playbackRate = Math.max(
      0.05,
      Math.min(8, getClipProperty(activeClip, "speed") * playbackSpeed),
    );

    // Solo logic + mute composition: any per-clip / per-track / master
    // mute kills the audio. Solo (per-clip) overrides — when any
    // clip is soloed, non-soloed clips mute.
    const anySoloed = allClips.some((c) => getClipProperty(c, "soloed"));
    const isThisSoloed = getClipProperty(activeClip, "soloed");
    const explicitMute = getClipProperty(activeClip, "muted");
    v.muted =
      masterMuted ||
      trackMuted.V1 ||
      explicitMute ||
      (anySoloed && !isThisSoloed);
  }, [activeClip, allClips, trackVolumes, trackMuted, masterVolume, masterMuted, playbackSpeed]);

  // ── B-buffer crossfade ────────────────────────────────────────────
  // When entering a transition window, mount the next clip onto the B
  // buffer, start it from 0, and let opacity ramp drive the visual.
  // The cap inside the timeupdate handler still fires at the boundary
  // so activeClip advances normally; the B-buffer is just a visual
  // pre-roll.
  useEffect(() => {
    const v = videoBRef.current;
    if (!v) return;
    if (!xfadeInfo) {
      // Outside any xfade window — make sure B is paused + hidden.
      try {
        v.pause();
      } catch {
        /* ignored */
      }
      return;
    }
    // We're in an xfade. Sync B's time + ensure it's playing if A is.
    const wantTime = xfadeInfo.progress * xfadeInfo.transition.durationSec;
    if (v.readyState >= 1 && Math.abs(v.currentTime - wantTime) > 0.25) {
      try {
        v.currentTime = wantTime;
      } catch {
        /* ignored */
      }
    }
    v.muted = true; // outgoing clip's audio carries until boundary
    v.playbackRate = Math.max(0.05, Math.min(8, playbackSpeed));
    if (storeIsPlaying && v.paused) {
      void v.play().catch(() => {
        /* autoplay blocked — fine, the fade still works visually */
      });
    } else if (!storeIsPlaying && !v.paused) {
      try {
        v.pause();
      } catch {
        /* ignored */
      }
    }
  }, [xfadeInfo, storeIsPlaying, playbackSpeed]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      intentToPlayRef.current = true;
      void v.play().catch((e) => {
        // eslint-disable-next-line no-console
        console.warn("[PlayerCanvas] play() blocked:", e);
        intentToPlayRef.current = false;
        setIsPlaying(false);
      });
    } else {
      intentToPlayRef.current = false;
      v.pause();
    }
  };

  // ── Playback chrome — fullscreen, theater, PiP, snapshot, loop ────
  // FULLSCREEN. requestFullscreen() targets the container so HUD +
  // transport survive. We sync the store's isFullscreen flag with the
  // browser's actual state via fullscreenchange so external toggles
  // (Esc key) keep the store consistent.
  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    } else {
      void el.requestFullscreen?.().catch(() => {});
    }
  }, []);
  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, [setFullscreen]);

  // PICTURE-IN-PICTURE
  const togglePiP = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement === v) {
        await document.exitPictureInPicture();
      } else {
        await v.requestPictureInPicture?.();
      }
    } catch {
      /* the browser refused — feature not supported on this codec */
    }
  }, []);

  // SNAPSHOT — grab the current frame as a PNG download
  const snapshot = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    try {
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    } catch {
      // tainted canvas (cross-origin) — fall back to thumbnail
      return;
    }
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const tc = Math.floor(playheadSec * 30);
      a.href = url;
      a.download = `${project.title.replace(/\s+/g, "-").toLowerCase()}-frame-${tc}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    }, "image/png");
  }, [playheadSec, project.title]);

  // GOTO timecode — prompt and seek
  const promptGoto = useCallback(() => {
    const v = window.prompt(
      "Go to timecode (MM:SS, MM:SS:FF, or seconds)",
      `${Math.floor(playheadSec / 60).toString().padStart(2, "0")}:${Math.floor(playheadSec % 60)
        .toString()
        .padStart(2, "0")}`,
    );
    if (!v) return;
    const parts = v.split(":").map((p) => parseFloat(p));
    let target = playheadSec;
    if (parts.length === 1) target = parts[0];
    else if (parts.length === 2) target = parts[0] * 60 + parts[1];
    else if (parts.length >= 3) target = parts[0] * 60 + parts[1] + parts[2] / 30;
    if (Number.isFinite(target)) {
      intentToPlayRef.current = false;
      setPlayhead(Math.max(0, target));
    }
  }, [playheadSec]);

  // JKL transport — J reverse / K pause / L forward. Multi-tap each
  // direction doubles speed up to 4× to match Avid/Premiere behavior.
  const jklSpeedRef = useRef<{ dir: -1 | 0 | 1; speed: number }>({ dir: 0, speed: 1 });
  const reverseLoopRef = useRef<number | null>(null);
  const stopReverse = useCallback(() => {
    if (reverseLoopRef.current !== null) {
      cancelAnimationFrame(reverseLoopRef.current);
      reverseLoopRef.current = null;
    }
  }, []);
  const driveReverse = useCallback(
    (speed: number) => {
      stopReverse();
      const v = videoRef.current;
      if (!v) return;
      try {
        v.pause();
      } catch {
        /* ignored */
      }
      let last = performance.now();
      const tick = () => {
        const now = performance.now();
        const dt = (now - last) / 1000;
        last = now;
        setPlayhead(Math.max(0, playheadSec - speed * dt));
        reverseLoopRef.current = requestAnimationFrame(tick);
      };
      reverseLoopRef.current = requestAnimationFrame(tick);
    },
    [stopReverse, playheadSec],
  );
  useEffect(() => stopReverse, [stopReverse]);

  const handleJ = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (jklSpeedRef.current.dir === -1) {
      jklSpeedRef.current.speed = Math.min(4, jklSpeedRef.current.speed * 2);
    } else {
      jklSpeedRef.current = { dir: -1, speed: 1 };
    }
    setPlaybackSpeed(jklSpeedRef.current.speed);
    intentToPlayRef.current = false;
    driveReverse(jklSpeedRef.current.speed);
  }, [setPlaybackSpeed, driveReverse]);

  const handleK = useCallback(() => {
    jklSpeedRef.current = { dir: 0, speed: 1 };
    setPlaybackSpeed(1);
    stopReverse();
    const v = videoRef.current;
    if (!v) return;
    intentToPlayRef.current = false;
    try {
      v.pause();
    } catch {
      /* ignored */
    }
  }, [setPlaybackSpeed, stopReverse]);

  const handleL = useCallback(() => {
    stopReverse();
    const v = videoRef.current;
    if (!v) return;
    if (jklSpeedRef.current.dir === 1) {
      jklSpeedRef.current.speed = Math.min(4, jklSpeedRef.current.speed * 2);
    } else {
      jklSpeedRef.current = { dir: 1, speed: 1 };
    }
    setPlaybackSpeed(jklSpeedRef.current.speed);
    intentToPlayRef.current = true;
    void v.play().catch(() => {
      intentToPlayRef.current = false;
    });
  }, [setPlaybackSpeed, stopReverse]);

  // LOOP REGION — when loopRegion is on and the playhead reaches
  // outSec (or end), wrap back to inSec (or 0). Implemented as a
  // separate effect off playheadSec so it works regardless of which
  // player surface is driving playback.
  useEffect(() => {
    if (!loopRegion) return;
    const lo = inSec ?? 0;
    const hi = outSec ?? project.durationSec ?? 0;
    if (hi <= lo) return;
    if (playheadSec >= hi - 0.02) {
      setPlayhead(lo);
    }
  }, [loopRegion, playheadSec, inSec, outSec, project.durationSec]);

  // ── Keyboard map ──────────────────────────────────────────────────
  // Space toggles play. F = fullscreen. Shift+T = theater. P = PiP.
  // J/K/L = transport. Shift+S = snapshot. Shift+M = mute. Cmd+L =
  // loop. Cmd+G = goto timecode. (Period/comma frame-step lives in
  // Timeline; this handler does NOT swallow those.)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      const meta = e.metaKey || e.ctrlKey;
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
        return;
      }
      // J/K/L — must NOT trigger when the user is also holding cmd
      // since cmd+L is the loop shortcut.
      if (!meta && (e.key === "j" || e.key === "J")) {
        e.preventDefault();
        handleJ();
        return;
      }
      if (!meta && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        handleK();
        return;
      }
      if (!meta && (e.key === "l" || e.key === "L")) {
        e.preventDefault();
        handleL();
        return;
      }
      if (!meta && (e.key === "f" || e.key === "F")) {
        e.preventDefault();
        toggleFullscreen();
        return;
      }
      if (!meta && e.shiftKey && (e.key === "T")) {
        e.preventDefault();
        toggleTheaterMode();
        return;
      }
      if (!meta && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        void togglePiP();
        return;
      }
      if (!meta && e.shiftKey && (e.key === "S")) {
        e.preventDefault();
        snapshot();
        return;
      }
      if (!meta && e.shiftKey && (e.key === "M")) {
        e.preventDefault();
        setMasterMuted(!masterMuted);
        return;
      }
      if (meta && (e.key === "l" || e.key === "L")) {
        e.preventDefault();
        toggleLoopRegion();
        return;
      }
      if (meta && (e.key === "g" || e.key === "G")) {
        e.preventDefault();
        promptGoto();
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    handleJ,
    handleK,
    handleL,
    toggleFullscreen,
    toggleTheaterMode,
    togglePiP,
    snapshot,
    promptGoto,
    toggleLoopRegion,
    masterMuted,
    setMasterMuted,
  ]);

  const aspect = ASPECT_RATIOS[project.aspectRatio];
  const totalSec = project.durationSec || 1;
  const playheadPct = (playheadSec / totalSec) * 100;
  const opacityStyle = activeClip ? getClipProperty(activeClip, "opacity") : 1;
  const scaleStyle = activeClip ? getClipProperty(activeClip, "scale") : 1;
  const filterStyle = activeClip ? getClipProperty(activeClip, "filter") : "";
  const mirrorStyle = activeClip ? getClipProperty(activeClip, "mirror") : false;

  const activeTitles = useMemo(
    () =>
      titleClips.filter(
        (t) => playheadSec >= t.timelineStartSec && playheadSec < t.timelineStartSec + t.durationSec,
      ),
    [titleClips, playheadSec],
  );

  // Find currently-selected clip (for the Source monitor in dual mode)
  const selectedClip = useMemo(
    () => clips.find((c) => c.id === selectedClipId) ?? null,
    [clips, selectedClipId],
  );

  return (
    <section ref={containerRef} className={cn(
      "relative flex flex-col h-full min-h-0",
      // When in fullscreen we paint the entire viewport black so any
      // gap around the aspect-locked frame reads as a cinema mat,
      // not as the editor chrome bleeding through.
      isFullscreen && "bg-black",
    )}>
      {/* Monitor mode + chrome toggles — top-right corner */}
      <div className="absolute top-3 right-4 z-30 flex items-center gap-1.5">
        <ChromeButton
          active={loopRegion}
          onClick={toggleLoopRegion}
          title="Loop between in / out (Cmd+L)"
          ariaLabel="Toggle loop region"
          icon={<Repeat className="h-3 w-3" strokeWidth={1.5} />}
          label="loop"
        />
        <SpeedDropdown speed={playbackSpeed} setSpeed={setPlaybackSpeed} />
        <ChromeButton
          onClick={snapshot}
          title="Snapshot current frame (Shift+S)"
          ariaLabel="Snapshot current frame"
          icon={<Camera className="h-3 w-3" strokeWidth={1.5} />}
        />
        <ChromeButton
          onClick={promptGoto}
          title="Go to timecode (Cmd+G)"
          ariaLabel="Go to timecode"
          icon={<Crosshair className="h-3 w-3" strokeWidth={1.5} />}
        />
        <ChromeButton
          onClick={() => void togglePiP()}
          title="Picture-in-picture (P)"
          ariaLabel="Picture-in-picture"
          icon={<PictureInPicture2 className="h-3 w-3" strokeWidth={1.5} />}
        />
        <ChromeButton
          active={theaterMode}
          onClick={toggleTheaterMode}
          title="Theater mode (Shift+T)"
          ariaLabel="Theater mode"
          icon={<Square className="h-3 w-3" strokeWidth={1.5} />}
          label="theater"
        />
        <ChromeButton
          active={isFullscreen}
          onClick={toggleFullscreen}
          title={isFullscreen ? "Exit fullscreen (F)" : "Fullscreen (F)"}
          ariaLabel="Fullscreen"
          icon={
            isFullscreen ? (
              <Minimize2 className="h-3 w-3" strokeWidth={1.5} />
            ) : (
              <Maximize2 className="h-3 w-3" strokeWidth={1.5} />
            )
          }
        />
        <button
          type="button"
          onClick={() =>
            setMonitorMode((m) => (m === "dual" ? "program" : "dual"))
          }
          title={
            monitorMode === "dual"
              ? "Single monitor (program only)"
              : "Source / Program dual monitor"
          }
          aria-label="Toggle monitor mode"
          className={cn(
            "inline-flex items-center gap-1.5 px-2 h-7 rounded-md transition-colors",
            "text-[11px] font-mono uppercase tracking-[0.18em]",
            monitorMode === "dual"
              ? "bg-[hsl(var(--accent)/0.12)] text-accent ring-1 ring-inset ring-accent/40"
              : "text-muted-foreground/65 hover:text-foreground hover:bg-white/[0.04]",
          )}
        >
          {monitorMode === "dual" ? (
            <Columns2 className="h-3 w-3" strokeWidth={1.5} />
          ) : (
            <Square className="h-3 w-3" strokeWidth={1.5} />
          )}
          <span>{monitorMode === "dual" ? "dual" : "single"}</span>
        </button>
      </div>

      {/* CANVAS */}
      <div
        className={cn(
          "relative flex-1 min-h-0 flex items-center justify-center pt-4 pb-3",
          monitorMode === "dual" ? "gap-3 px-3" : "px-6",
        )}
      >
        {/* SOURCE monitor (dual mode only) */}
        {monitorMode === "dual" && (
          <SourceMonitor clip={selectedClip} aspect={aspect} reducedMotion={reducedMotion ?? false} />
        )}

        {/* PROGRAM monitor (always visible) */}
        <motion.div
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: EASE_PREMIUM }}
          className={cn(
            "relative h-full flex items-center justify-center",
            monitorMode === "dual" ? "flex-1 min-w-0" : "w-full",
          )}
        >
          {/* The picture frame fills the available space; the video
              inside uses object-fit: contain to maintain its aspect
              ratio with letterbox/pillarbox bars as needed. Earlier
              we used `aspect-ratio` on this box with max-w/h: 100% —
              but with no explicit width OR height set, CSS computes
              that box to 0×0, so the audio plays but the video is
              invisible. Filling the area and using object-fit fixes
              that without losing the cinematic black-bars look. */}
          <div
            className="relative w-full h-full bg-black shadow-[0_30px_80px_-30px_hsl(0_0%_0%/0.8),0_0_0_1px_hsl(0_0%_100%/0.04)]"
            style={{
              // Keep aspectRatio as a styling hint so devtools clearly
              // shows the intended ratio (browsers honor it only when
              // there's no conflicting explicit sizing, which there is
              // here — w-full h-full wins).
              aspectRatio: `${aspect.w} / ${aspect.h}`,
            }}
          >
            {/* "PROGRAM" label badge (only in dual mode) */}
            {monitorMode === "dual" && (
              <div className="absolute -top-5 left-0">
                <span className={cn(TYPE_META, "text-accent tracking-[0.32em]")}>
                  ◆ Program
                </span>
              </div>
            )}
            {activeClip?.videoUrl ? (
              <>
                <video
                  ref={videoRef}
                  src={activeClip.videoUrl}
                  poster={activeClip.thumbnailUrl ?? project.thumbnailUrl ?? undefined}
                  className="absolute inset-0 w-full h-full object-contain bg-black transition-[opacity,transform,filter] duration-150"
                  style={{
                    opacity: xfadeInfo ? opacityStyle * (1 - xfadeInfo.progress) : opacityStyle,
                    transform: `scale(${scaleStyle})${mirrorStyle ? " scaleX(-1)" : ""}`,
                    filter: filterStyle || undefined,
                  }}
                  playsInline
                  preload="auto"
                />
                {/* B buffer — the next clip pre-loaded. When an
                    explicit transition is active, the B buffer
                    opacity-ramps over the A buffer for the crossfade.
                    Otherwise it stays at opacity 0 but the browser
                    has already cached the next clip's video, so the
                    A buffer's src swap on clip advance lands instantly
                    without the black-frame load gap that broke
                    earlier playback ("editor stitch technology is
                    horrible" — this is the fix). */}
                {clips[activeIdx + 1]?.videoUrl && (
                  <video
                    ref={videoBRef}
                    key={`buffer-${clips[activeIdx + 1].id}`}
                    src={clips[activeIdx + 1].videoUrl ?? undefined}
                    poster={clips[activeIdx + 1].thumbnailUrl ?? undefined}
                    className="absolute inset-0 w-full h-full object-contain bg-black"
                    style={{
                      opacity: xfadeInfo ? xfadeInfo.progress : 0,
                      pointerEvents: "none",
                    }}
                    playsInline
                    preload="auto"
                    muted
                  />
                )}
                {/* Transition overlay for "fadeblack" / "fadewhite" —
                    a solid pane that peaks at the boundary then ramps
                    back out, giving the canonical black/white wipe
                    feel without depending on the B buffer. */}
                {xfadeInfo &&
                  (xfadeInfo.transition.kind === "fadeblack" ||
                    xfadeInfo.transition.kind === "fadewhite") && (
                    <div
                      aria-hidden
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background:
                          xfadeInfo.transition.kind === "fadewhite"
                            ? "hsl(0 0% 100%)"
                            : "hsl(0 0% 0%)",
                        opacity:
                          1 -
                          Math.abs(2 * xfadeInfo.progress - 1) /* peaks at 1.0 mid-fade */,
                      }}
                    />
                  )}
              </>
            ) : clips.length > 0 ? (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center bg-cover bg-center"
                style={{
                  backgroundImage: project.thumbnailUrl
                    ? `linear-gradient(180deg, hsl(220 30% 4% / 0.65), hsl(220 30% 4% / 0.85)), url(${project.thumbnailUrl})`
                    : undefined,
                }}
              >
                <AlertCircle className="h-7 w-7 text-amber-300/70" strokeWidth={1.4} />
                <p
                  className="mt-4 font-display italic text-[20px] font-light text-foreground/90"
                  style={{ fontFamily: "'Fraunces', serif" }}
                >
                  This clip is still rendering.
                </p>
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Film className="h-8 w-8 text-muted-foreground/55" strokeWidth={1.3} />
                <p
                  className="mt-4 font-display italic text-[20px] font-light text-foreground/90"
                  style={{ fontFamily: "'Fraunces', serif" }}
                >
                  No clips yet.
                </p>
                <p className={cn(TYPE_META, "mt-2 text-muted-foreground/55")}>
                  Render clips in Studio to see them play here
                </p>
              </div>
            )}

            {/* Title overlays */}
            {activeTitles.map((t) => (
              <div
                key={t.id}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                style={{
                  background: t.titleColor
                    ? `linear-gradient(180deg, ${t.titleColor}E0, ${t.titleColor}FF)`
                    : "linear-gradient(180deg, hsl(220 30% 4% / 0.92), hsl(220 30% 4%))",
                }}
              >
                <div className="px-8 text-center">
                  <p
                    className="font-display italic font-light tracking-tight leading-[1.05]"
                    style={{
                      fontFamily: "'Fraunces', serif",
                      fontSize: "clamp(2rem, 5vw, 4.5rem)",
                      color: "hsl(0 0% 98%)",
                      textShadow: "0 6px 30px hsl(0 0% 0% / 0.55)",
                    }}
                  >
                    {t.titleText || "TITLE"}
                  </p>
                </div>
              </div>
            ))}

            {/* HUD */}
            {activeClip && (
              <div className="absolute top-2 left-2 pointer-events-none">
                <div className={cn(TYPE_META, "text-foreground/65 tracking-[0.32em] mix-blend-difference")}>
                  CLIP {String(activeIdx + 1).padStart(2, "0")} / {String(clips.length).padStart(2, "0")}
                </div>
              </div>
            )}
            <div className="absolute top-2 right-2 pointer-events-none">
              <div className={cn(TYPE_META, "text-foreground/65 tracking-[0.32em] mix-blend-difference font-mono tabular-nums")}>
                {fmtTC(playheadSec)} / {fmtTC(totalSec)}
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* TRANSPORT (drives the Program monitor) */}
      <div className="relative shrink-0 px-6 pb-3">
        <div className="flex items-center gap-3">
          {/* JKL transport cluster — prev-clip / reverse / pause / forward / next-clip */}
          <TransportButton
            onClick={() => {
              const prev = clips[activeIdx - 1];
              if (prev) setPlayhead(prev.timelineStartSec);
            }}
            disabled={activeIdx <= 0}
            title="Previous clip"
            icon={<SkipBack className="h-3.5 w-3.5" strokeWidth={1.6} />}
          />
          <TransportButton
            onClick={handleJ}
            title="JKL reverse (J — tap again to double speed)"
            icon={<Rewind className="h-3.5 w-3.5" strokeWidth={1.6} />}
          />
          <button
            type="button"
            onClick={togglePlay}
            disabled={!activeClip?.videoUrl}
            className={cn(
              "inline-flex items-center justify-center h-10 w-10 rounded-full",
              "border border-white/[0.10] bg-white/[0.04]",
              "transition-all hover:border-accent/40 hover:bg-[hsl(var(--accent)/0.08)]",
              "disabled:opacity-40 disabled:cursor-not-allowed",
            )}
            aria-label={isPlaying ? "Pause" : "Play"}
            title={isPlaying ? "Pause (Space, K)" : "Play (Space, L)"}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4 text-foreground" strokeWidth={1.6} />
            ) : (
              <Play className="h-4 w-4 text-foreground ml-0.5" strokeWidth={1.6} />
            )}
          </button>
          <TransportButton
            onClick={handleL}
            title="JKL forward (L — tap again to double speed)"
            icon={<FastForward className="h-3.5 w-3.5" strokeWidth={1.6} />}
          />
          <TransportButton
            onClick={() => {
              const next = clips[activeIdx + 1];
              if (next) setPlayhead(next.timelineStartSec);
            }}
            disabled={activeIdx >= clips.length - 1}
            title="Next clip"
            icon={<SkipForward className="h-3.5 w-3.5" strokeWidth={1.6} />}
          />

          {/* Frame step + in/out */}
          <TransportButton
            onClick={() => setPlayhead(Math.max(0, playheadSec - 1 / 30))}
            title="Step back 1 frame (,)"
            icon={<ChevronsLeft className="h-3.5 w-3.5" strokeWidth={1.6} />}
          />
          <TransportButton
            onClick={() => setPlayhead(Math.min(totalSec, playheadSec + 1 / 30))}
            title="Step forward 1 frame (.)"
            icon={<ChevronsRight className="h-3.5 w-3.5" strokeWidth={1.6} />}
          />

          {/* L/R VU meters — pseudo levels driven by clip × master */}
          <VuMeter
            isPlaying={isPlaying}
            volume={
              activeClip
                ? getClipProperty(activeClip, "volume") *
                  trackVolumes.V1 *
                  masterVolume
                : 0
            }
          />

          {/* Scrub bar with clip dividers + transition pip markers */}
          <div
            className="relative flex-1 h-1.5 rounded-full bg-white/[0.05] overflow-hidden cursor-pointer"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = (e.clientX - rect.left) / rect.width;
              setPlayhead(Math.max(0, Math.min(totalSec, pct * totalSec)));
            }}
          >
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-accent via-accent to-accent/60"
              style={{ width: `${Math.min(100, Math.max(0, playheadPct))}%` }}
            />
            {clips.length > 1 &&
              clips.slice(1).map((c) => {
                const left = (c.timelineStartSec / totalSec) * 100;
                return (
                  <span
                    key={c.id}
                    className="absolute top-0 bottom-0 w-px bg-white/[0.10]"
                    style={{ left: `${left}%` }}
                  />
                );
              })}
            {(project.transitions ?? []).map((t) => {
              const from = clips.find((c) => c.id === t.fromClipId);
              if (!from) return null;
              const center = (from.timelineStartSec + from.durationSec) / totalSec;
              const half = t.durationSec / 2 / totalSec;
              return (
                <span
                  key={t.id}
                  className="absolute top-0 bottom-0 bg-accent/55"
                  style={{
                    left: `${Math.max(0, (center - half) * 100)}%`,
                    width: `${Math.min(100, (half * 2) * 100)}%`,
                  }}
                />
              );
            })}
            {inSec !== null && (
              <span
                className="absolute top-0 bottom-0 w-px bg-emerald-300"
                style={{ left: `${(inSec / totalSec) * 100}%` }}
              />
            )}
            {outSec !== null && (
              <span
                className="absolute top-0 bottom-0 w-px bg-rose-300"
                style={{ left: `${(outSec / totalSec) * 100}%` }}
              />
            )}
          </div>

          {/* Master mute + volume */}
          <button
            type="button"
            onClick={() => setMasterMuted(!masterMuted)}
            title={masterMuted ? "Unmute (Shift+M)" : "Mute (Shift+M)"}
            className="inline-flex items-center justify-center h-7 w-7 rounded-md text-foreground/75 hover:text-foreground hover:bg-white/[0.05]"
            aria-label={masterMuted ? "Unmute" : "Mute"}
          >
            {masterMuted ? (
              <VolumeX className="h-3.5 w-3.5" strokeWidth={1.5} />
            ) : masterVolume > 0.66 ? (
              <Volume2 className="h-3.5 w-3.5" strokeWidth={1.5} />
            ) : masterVolume > 0.33 ? (
              <Volume1 className="h-3.5 w-3.5" strokeWidth={1.5} />
            ) : (
              <Volume className="h-3.5 w-3.5" strokeWidth={1.5} />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1.5}
            step={0.01}
            value={masterMuted ? 0 : masterVolume}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (masterMuted && v > 0) setMasterMuted(false);
              setMasterVolume(v);
            }}
            className="w-20 accent-foreground/85"
            aria-label="Master volume"
            title={`Volume ${Math.round((masterMuted ? 0 : masterVolume) * 100)}%`}
          />

          <div className={cn(TYPE_META, "font-mono tabular-nums text-foreground/80 shrink-0")}>
            {fmtTC(playheadSec)} / {fmtTC(totalSec)}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ChromeButton — top-right chrome toggle. Accent ring when active.
// ─────────────────────────────────────────────────────────────────────────────
function ChromeButton({
  active,
  onClick,
  title,
  ariaLabel,
  icon,
  label,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  ariaLabel: string;
  icon: React.ReactNode;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-1.5 px-2 h-7 rounded-md transition-colors",
        "text-[11px] font-mono uppercase tracking-[0.18em]",
        active
          ? "bg-[hsl(var(--accent)/0.12)] text-accent ring-1 ring-inset ring-accent/40"
          : "text-muted-foreground/65 hover:text-foreground hover:bg-white/[0.04]",
      )}
    >
      {icon}
      {label && <span>{label}</span>}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SpeedDropdown — discrete playback speeds (matches NLE conventions).
// ─────────────────────────────────────────────────────────────────────────────
function SpeedDropdown({
  speed,
  setSpeed,
}: {
  speed: number;
  setSpeed: (s: number) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Playback speed"
        aria-label="Playback speed"
        className={cn(
          "inline-flex items-center gap-1.5 px-2 h-7 rounded-md transition-colors",
          "text-[11px] font-mono uppercase tracking-[0.18em]",
          speed !== 1
            ? "bg-[hsl(var(--accent)/0.12)] text-accent ring-1 ring-inset ring-accent/40"
            : "text-muted-foreground/65 hover:text-foreground hover:bg-white/[0.04]",
        )}
      >
        <Gauge className="h-3 w-3" strokeWidth={1.5} />
        <span>{speed === 1 ? "1×" : `${speed}×`}</span>
      </button>
      {open && (
        <div
          className={cn(
            "absolute right-0 top-full mt-1 z-50",
            "min-w-[120px] rounded-md border border-white/[0.10]",
            "bg-[hsl(220_30%_6%/0.96)] backdrop-blur-sm shadow-[0_20px_50px_-12px_hsl(0_0%_0%/0.7)]",
            "py-1",
          )}
          onMouseLeave={() => setOpen(false)}
        >
          {PLAYBACK_SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setSpeed(s);
                setOpen(false);
              }}
              className={cn(
                "w-full text-left px-3 py-1.5 flex items-center justify-between",
                "text-[12px] font-mono uppercase tracking-[0.10em]",
                s === speed
                  ? "bg-[hsl(212_100%_60%/0.18)] text-accent"
                  : "text-foreground/80 hover:bg-white/[0.04]",
              )}
            >
              <span>{s}×</span>
              {s === speed && <span className="text-accent">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TransportButton — round-corner button for transport actions
// ─────────────────────────────────────────────────────────────────────────────
function TransportButton({
  onClick,
  disabled,
  title,
  icon,
}: {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "inline-flex items-center justify-center h-7 w-7 rounded-md",
        "text-foreground/70 hover:text-foreground hover:bg-white/[0.04]",
        "transition-colors",
        "disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent",
      )}
      aria-label={title}
    >
      {icon}
    </button>
  );
}
