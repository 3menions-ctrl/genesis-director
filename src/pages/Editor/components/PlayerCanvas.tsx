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
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Play, Pause, Film, AlertCircle, Columns2, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { TYPE_META, EASE_PREMIUM } from "@/lib/design-system";
import type { EditorClip, EditorProject } from "@/lib/editor/types";
import { ASPECT_RATIOS, getClipProperty, getClipPropertyAt } from "@/lib/editor/types";
import { setPlayhead } from "@/lib/editor/store";
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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [monitorMode, setMonitorMode] = useState<MonitorMode>("program");
  const {
    masterVolume,
    masterMuted,
    trackVolumes,
    trackMuted,
    isPlaying: storeIsPlaying,
    setIsPlaying,
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
      setPlayhead(activeClip.timelineStartSec + v.currentTime);
      const rel = v.currentTime;
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
    v.playbackRate = Math.max(0.1, Math.min(4, getClipProperty(activeClip, "speed")));

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
  }, [activeClip, allClips, trackVolumes, trackMuted, masterVolume, masterMuted]);

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

  // Space toggles play (input-aware)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      e.preventDefault();
      togglePlay();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
    <section className="relative flex flex-col h-full min-h-0">
      {/* Monitor mode toggle — top-right corner */}
      <div className="absolute top-3 right-4 z-30">
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
              <video
                ref={videoRef}
                src={activeClip.videoUrl}
                poster={activeClip.thumbnailUrl ?? project.thumbnailUrl ?? undefined}
                className="absolute inset-0 w-full h-full object-contain bg-black transition-[opacity,transform,filter] duration-150"
                style={{
                  opacity: opacityStyle,
                  transform: `scale(${scaleStyle})${mirrorStyle ? " scaleX(-1)" : ""}`,
                  filter: filterStyle || undefined,
                }}
                playsInline
                preload="auto"
              />
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
        <div className="flex items-center gap-4">
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
          >
            {isPlaying ? (
              <Pause className="h-4 w-4 text-foreground" strokeWidth={1.6} />
            ) : (
              <Play className="h-4 w-4 text-foreground ml-0.5" strokeWidth={1.6} />
            )}
          </button>

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

          <div className="relative flex-1 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
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
          </div>

          <div className={cn(TYPE_META, "font-mono tabular-nums text-foreground/80 shrink-0")}>
            {fmtTC(playheadSec)}
          </div>
        </div>
      </div>
    </section>
  );
}
