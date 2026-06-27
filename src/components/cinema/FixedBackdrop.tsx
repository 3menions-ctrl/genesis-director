/**
 * FixedBackdrop — the persistent landing backdrop, driven by a deterministic
 * loading state machine so the immersive film is reliable on every device:
 *
 *   cover    → epic still + CoverFX, before any scroll.
 *   loading  → the viewer scrolled in; we buffer the film and show a loader.
 *   playing  → the film is GENUINELY playing (confirmed by real playback).
 *   climax   → final seconds: the film scales up, everything else blurs out.
 *   takeover → the film ended: the screen CRACKS, then a glowing "Start now".
 *   rest     → dismissed (or a same-session revisit): film holds its last frame.
 *   failed   → the film couldn't load/play: fall back to the static cover.
 *
 * Critically, `climax`/`takeover` (the crack + music cues) can only be reached
 * AFTER real playback — never from `loading` — so the screen can't crack before
 * the film plays, and the score (gated on `playing`) can't play without it.
 *
 * The film is served same-origin in two sizes (desktop / mobile) so it loads
 * fast and never depends on a heavy cross-origin fetch.
 */
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Loader2 } from "lucide-react";
import { CrackOverlay } from "./CrackOverlay";
import { CoverFX } from "./CoverFX";
import { ACCENT } from "./ui";

const VIDEO_DESKTOP = "/cinema-assets/park-desktop.mp4"; // ~6.6MB, 1280×690
const VIDEO_MOBILE = "/cinema-assets/park-mobile.mp4"; //  ~2.3MB, 768×414
const POSTER = "/cinema-assets/park-poster.jpg";
const COVER = "/cinema-assets/cover-park-bridge.jpg"; // entry-point still: video's bunny/park frame + bridge (fresh URL = cache-bust)

export type Status = "cover" | "loading" | "playing" | "climax" | "takeover" | "rest" | "failed";

// Survives in-app navigation, resets on a full refresh — so the film plays once
// per session and a revisit lands straight on the calm last-frame backdrop.
let hasPlayedImmersive = false;

/** Pick the lightest source that fits the device. */
function pickSrc(): string {
  if (typeof window === "undefined") return VIDEO_DESKTOP;
  try {
    const coarse = window.matchMedia?.("(pointer: coarse)")?.matches;
    const small = window.innerWidth < 820;
    const saveData = (navigator as unknown as { connection?: { saveData?: boolean } })?.connection?.saveData;
    return coarse || small || saveData ? VIDEO_MOBILE : VIDEO_DESKTOP;
  } catch {
    return VIDEO_DESKTOP;
  }
}

function StartNowTakeover({ onStart, onDismiss }: { onStart: () => void; onDismiss: () => void }) {
  return (
    <div className="relative flex flex-col items-center">
      <motion.button
        type="button"
        onClick={onStart}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.5, type: "spring", stiffness: 130, damping: 13 }}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.97 }}
        className="relative flex h-72 w-72 flex-col items-center justify-center rounded-full sm:h-[22rem] sm:w-[22rem]"
        style={{ boxShadow: `0 0 160px -6px hsl(${ACCENT}), 0 0 70px -8px hsl(${ACCENT}), 0 0 24px -2px hsl(${ACCENT})` }}
      >
        <span aria-hidden className="absolute -inset-10 rounded-full blur-3xl" style={{ background: `radial-gradient(circle, hsl(${ACCENT} / 0.55), transparent 70%)`, animation: "spin 8s linear infinite" }} />
        <span aria-hidden className="absolute -inset-1 rounded-full" style={{ background: `conic-gradient(from 0deg, transparent, hsl(${ACCENT}), #fff, hsl(${ACCENT}), transparent 70%)`, animation: "spin 5s linear infinite", filter: "blur(3px)" }} />
        <span aria-hidden className="absolute inset-0 rounded-full bg-[#0a0c10]/85 backdrop-blur-xl ring-1 ring-white/20" />
        {[0, 1, 2].map((i) => (
          <motion.span key={i} aria-hidden className="absolute inset-0 rounded-full border-2" style={{ borderColor: `hsl(${ACCENT})` }} initial={{ opacity: 0.6, scale: 1 }} animate={{ opacity: 0, scale: 1.6 }} transition={{ duration: 2.6, repeat: Infinity, delay: i * 0.85, ease: "easeOut" }} />
        ))}
        <span className="relative z-10 font-display text-[34px] font-semibold text-white sm:text-[40px]">Start now</span>
        <span className="relative z-10 mt-2 flex items-center gap-2 font-mono text-[12px] uppercase tracking-[0.32em]" style={{ color: `hsl(${ACCENT})` }}>
          Begin <ArrowRight className="h-4 w-4" />
        </span>
      </motion.button>
      <motion.button type="button" onClick={onDismiss} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }} className="mt-10 font-mono text-[10px] uppercase tracking-[0.3em] text-white/45 transition-colors hover:text-white/85">
        Keep exploring ↓
      </motion.button>
    </div>
  );
}

/** Device-scaled loading indicator shown while the film buffers. */
function FilmLoader() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="pointer-events-none absolute inset-0 z-[5] flex flex-col items-center justify-center gap-[clamp(0.6rem,1.6vw,1rem)]"
    >
      <Loader2 className="h-[clamp(1.6rem,3.4vw,2.4rem)] w-[clamp(1.6rem,3.4vw,2.4rem)] animate-spin text-white/80" />
      <span className="font-mono text-[clamp(9px,1.1vw,11px)] uppercase tracking-[0.34em] text-white/55">Loading the film</span>
    </motion.div>
  );
}

export function FixedBackdrop({ onStart, videoRef, muted, onPhase, onFail }: { onStart: () => void; videoRef: RefObject<HTMLVideoElement>; muted: boolean; onPhase?: (s: Status) => void; onFail?: () => void }) {
  const srcRef = useRef(pickSrc());
  const durRef = useRef(0);
  const revisit = useRef(hasPlayedImmersive);
  const [status, setStatus] = useState<Status>(revisit.current ? "rest" : "cover");
  // On a revisit the <video> mounts at frame 0 and must seek to the end; keep it
  // hidden until the seek lands so the only frame shown is the last one.
  const [revealRevisit, setRevealRevisit] = useState(!revisit.current);
  const failGuard = useRef(false);
  const statusRef = useRef(status);
  statusRef.current = status;

  useEffect(() => { onPhase?.(status); }, [status, onPhase]);
  useEffect(() => {
    if (status === "playing" || status === "climax" || status === "takeover" || status === "rest") hasPlayedImmersive = true;
  }, [status]);

  const markFailed = useCallback(() => {
    if (failGuard.current) return;
    failGuard.current = true;
    setRevealRevisit(true);
    setStatus((s) => (s === "takeover" ? s : "failed"));
    onFail?.();
  }, [onFail]);

  // ── ignition: begin buffering + playing once the viewer scrolls past cover ──
  useEffect(() => {
    if (status !== "cover") return;
    const ignite = () => {
      if (statusRef.current !== "cover") return;
      if (window.scrollY < window.innerHeight * 0.85) return;
      setStatus("loading");
      videoRef.current?.play().catch(() => { /* retried in the loading effect */ });
    };
    window.addEventListener("scroll", ignite, { passive: true });
    ignite(); // handle an already-scrolled load
    return () => window.removeEventListener("scroll", ignite);
  }, [status, videoRef]);

  // ── loading: nudge play() until real playback starts; fail if it never does ──
  useEffect(() => {
    if (status !== "loading") return;
    const v = videoRef.current;
    if (!v) return;
    let cancelled = false;
    const tryPlay = () => { if (!cancelled) v.play().catch(() => {}); };
    v.addEventListener("canplay", tryPlay);
    v.addEventListener("loadeddata", tryPlay);
    const id = window.setInterval(tryPlay, 1200);
    const watchdog = window.setTimeout(() => {
      if (!cancelled && statusRef.current === "loading") markFailed();
    }, 14000);
    return () => {
      cancelled = true;
      v.removeEventListener("canplay", tryPlay);
      v.removeEventListener("loadeddata", tryPlay);
      window.clearInterval(id);
      window.clearTimeout(watchdog);
    };
  }, [status, videoRef, markFailed]);

  // Fallback reveal on revisit if `seeked` never fires.
  useEffect(() => {
    if (!revisit.current || revealRevisit) return;
    const t = window.setTimeout(() => setRevealRevisit(true), 1600);
    return () => window.clearTimeout(t);
  }, [revealRevisit]);

  // ── video event handlers ──
  const onPlaying = useCallback(() => {
    if (revisit.current) return; // revisit holds on the last frame, never "plays"
    setStatus((s) => (s === "loading" || s === "cover" ? "playing" : s));
  }, []);

  const onTimeUpdate = useCallback(() => {
    const v = videoRef.current;
    if (!v || !durRef.current || revisit.current) return;
    setStatus((s) => {
      if ((s === "playing") && v.currentTime > 1 && durRef.current - v.currentTime <= 2.0) return "climax";
      return s;
    });
  }, [videoRef]);

  const onEnded = useCallback(() => {
    setStatus((s) => (s === "playing" || s === "climax" || s === "loading" ? "takeover" : s));
  }, []);

  // Safety net — if `ended` never fires, force the takeover after the film's
  // remaining runtime (only once it has genuinely started).
  useEffect(() => {
    if (status !== "playing" && status !== "climax") return;
    const v = videoRef.current;
    if (!v || !durRef.current) return;
    const ms = Math.max(1500, (durRef.current - v.currentTime) * 1000 + 4000);
    const t = window.setTimeout(() => {
      setStatus((s) => (s === "playing" || s === "climax" ? "takeover" : s));
    }, ms);
    return () => window.clearTimeout(t);
  }, [status, videoRef]);

  const immersive = status === "climax" || status === "takeover";

  return (
    <div className={`fixed inset-0 overflow-hidden ${immersive ? "z-[60]" : "z-0"} bg-[#08090c]`}>
      {/* cover still — shown before playback and as the failure fallback */}
      <img
        src={COVER}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-1000"
        style={{ opacity: status === "cover" || status === "loading" || status === "failed" ? 1 : 0, animation: "cfx-kenburns 34s ease-in-out infinite alternate", transformOrigin: "50% 46%" }}
      />

      {/* the film */}
      <div className="absolute inset-0 overflow-hidden">
        <video
          ref={videoRef}
          src={srcRef.current}
          poster={POSTER}
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700"
          style={{ opacity: !revealRevisit || status === "cover" || status === "loading" || status === "failed" ? 0 : 1 }}
          muted={muted}
          playsInline
          preload="auto"
          onLoadedMetadata={(e) => {
            durRef.current = e.currentTarget.duration || 0;
            if (revisit.current && durRef.current) {
              try { e.currentTarget.currentTime = Math.max(0, durRef.current - 0.05); } catch { /* noop */ }
              e.currentTarget.pause();
            }
          }}
          onSeeked={() => { if (revisit.current) setRevealRevisit(true); }}
          onPlaying={onPlaying}
          onTimeUpdate={onTimeUpdate}
          onEnded={onEnded}
          onError={markFailed}
        />
        {status === "takeover" && <CrackOverlay />}
      </div>

      {/* legibility scrims — fade away as the film goes fully immersive */}
      <div aria-hidden className="absolute inset-0 transition-opacity duration-700" style={{ opacity: immersive ? 0 : 1 }}>
        <div className="absolute inset-0 bg-[#06070a]/38" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#06070a]/18 via-[#06070a]/32 to-[#06070a]/80" />
        <div className="absolute inset-0 bg-[radial-gradient(130%_110%_at_50%_25%,transparent_45%,rgba(4,5,7,0.6))]" />
      </div>

      {/* device-scaled loader while buffering */}
      <AnimatePresence>{status === "loading" && <FilmLoader />}</AnimatePresence>

      {/* grand cover animation — only before playback */}
      {status === "cover" && (
        <div className="absolute inset-0" style={{ pointerEvents: "none" }}>
          <CoverFX />
        </div>
      )}

      {/* START NOW takeover */}
      <AnimatePresence>
        {status === "takeover" && (
          <motion.div className="absolute inset-0 z-[70] grid place-items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <StartNowTakeover onStart={onStart} onDismiss={() => setStatus("rest")} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
