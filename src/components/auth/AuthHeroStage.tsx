/**
 * AuthHeroStage — full-bleed cinematic editorial composition.
 *
 * Foundation: a looping in-app generation — the detective "break the
 * screen" shot (Seedance) — running full-bleed behind the editorial
 * chrome, so the very first thing a visitor sees is the product's own
 * output punching through the glass toward them.
 *
 * Motion layer:
 *   1. The looping video itself (autoplay, muted, object-cover), with a
 *      faint static zoom so the frame edges never bleed.
 *   2. A soft breathing accent glow tying the cyan break to the brand
 *      blue and giving the lower third depth.
 *   prefers-reduced-motion → the poster still frame instead of the video.
 *
 * Blending:
 *   - Top vignette so the logo + index hold.
 *   - Strong bottom-left wash anchoring the headline.
 *   - Right edge fades to #0a0b0f — the form-pane color — so the seam
 *     between hero and form disappears.
 */
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Logo } from "@/components/ui/Logo";

const HERO_VIDEO = "/cinema-assets/breakouts/auth-detective.mp4";
const HERO_POSTER = "/cinema-assets/breakouts/auth-detective-poster.jpg";
// The glass shatters at ~2.4s — the blind dissolves precisely on the break.
const BREAK_AT = 2.4;

interface Props {
  className?: string;
  /** Video + grade only — no editorial text. Used as a full-bleed backdrop. */
  bare?: boolean;
}

export function AuthHeroStage({ className, bare }: Props) {
  const reducedMotion = useReducedMotion();
  const [broken, setBroken] = useState(false);

  return (
    <aside
      className={[
        "relative h-full w-full overflow-hidden bg-[#0a0b0f]",
        className,
      ].join(" ")}
    >
      {/* ── 1. Looping in-app generation, full-bleed ─────────────── */}
      {reducedMotion ? (
        <img
          src={HERO_POSTER}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full scale-[1.04] object-cover"
        />
      ) : (
        <video
          src={HERO_VIDEO}
          poster={HERO_POSTER}
          autoPlay
          muted
          playsInline
          preload="auto"
          aria-hidden
          onTimeUpdate={(e) => { if (!broken && e.currentTarget.currentTime >= BREAK_AT) setBroken(true); }}
          className="absolute inset-0 h-full w-full scale-[1.04] object-cover"
        />
      )}

      {/* subtle cinematic grade — deepens the blacks, cools toward brand blue */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(150deg, rgba(10,11,15,0) 30%, rgba(10,11,15,0.32) 100%)",
          mixBlendMode: "multiply",
        }}
      />

      {/* ── 2. Breathing accent glow (ties the break to brand blue) ── */}
      <motion.div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          left: "30%",
          bottom: "12%",
          width: 460,
          height: 460,
          transform: "translate(-50%, 50%)",
          background:
            "radial-gradient(circle, hsla(214, 90%, 62%, 0.40) 0%, hsla(200, 90%, 55%, 0.16) 38%, transparent 70%)",
          mixBlendMode: "screen",
          filter: "blur(20px)",
        }}
        initial={{ opacity: reducedMotion ? 0.5 : 0.4, scale: 1 }}
        animate={
          reducedMotion
            ? { opacity: 0.5, scale: 1 }
            : { opacity: [0.4, 0.7, 0.4], scale: [1, 1.08, 1] }
        }
        transition={{
          duration: 7,
          ease: "easeInOut",
          repeat: reducedMotion ? 0 : Infinity,
        }}
      />

      {/* ── 3. Top vignette (logo + index legibility) ────────────── */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-44 pointer-events-none"
        style={{
          background:
            "linear-gradient(to bottom, rgba(8,9,12,0.65) 0%, rgba(8,9,12,0.25) 60%, transparent 100%)",
        }}
      />

      {/* ── 4. Bottom-left wash (headline anchor) ────────────────── */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(to top, rgba(8,9,12,0.92) 0%, rgba(8,9,12,0.65) 25%, transparent 60%)",
        }}
      />

      {/* ── 5. Right-edge fade — invisible seam to the form pane ─── */}
      <div
        aria-hidden
        className="absolute inset-y-0 right-0 w-40 pointer-events-none"
        style={{
          background:
            "linear-gradient(to right, transparent 0%, rgba(10,11,15,0.65) 55%, #0a0b0f 100%)",
        }}
      />

      {/* ── The blind — exactly the right form-pane shade (#0a0b0f). It veils the
           hero so left + right read as one seamless dark panel, then DISSOLVES
           the instant the detective shatters the glass (timed to the break at
           ~2.4s). Once broken it stays revealed. ── */}
      {!reducedMotion && (
        <motion.div
          aria-hidden
          className="absolute inset-0 pointer-events-none bg-[#0a0b0f]"
          initial={false}
          animate={{ opacity: broken ? 0 : 1 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
        />
      )}

      {/* ── 6. Editorial chrome (suppressed in `bare` backdrop mode) ── */}
      {!bare && (
      <div className="relative z-10 h-full w-full px-14 pt-12 pb-14 flex flex-col">
        {/* Top row: logo · index */}
        <motion.header
          className="flex items-start justify-between"
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <Logo size="md" showText textClassName="text-sm tracking-wide" />
          <div className="flex flex-col items-end gap-1.5 pt-1">
            <span className="text-[10px] uppercase tracking-[0.32em] text-white/65 font-mono tabular-nums">
              N° 01 — 24
            </span>
            <span className="block h-px w-10 bg-white/30" />
          </div>
        </motion.header>

        {/* Lower-left headline */}
        <motion.div
          className="mt-auto max-w-[640px]"
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
        >
          <div className="flex items-center gap-3 mb-7">
            <div className="h-px w-10 bg-white/50" />
            <span className="text-[10px] uppercase tracking-[0.34em] text-white/80 font-mono">
              Cinematic AI Video
            </span>
          </div>

          <h1
            className="font-display text-white leading-[0.94] tracking-[-0.025em] font-light"
            style={{
              fontSize: "clamp(3rem, 5.6vw, 5.4rem)",
              textShadow: "0 4px 50px rgba(0,0,0,0.7)",
            }}
          >
            One prompt.
            <br />
            <span
              className="italic"
              style={{
                background:
                  "linear-gradient(135deg, hsl(40, 95%, 92%) 0%, hsl(28, 95%, 70%) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              One film.
            </span>
          </h1>

          <p className="mt-7 text-[15px] text-white/80 leading-relaxed max-w-[440px] font-light">
            Start with a sentence. Leave with something worth watching.
          </p>
        </motion.div>

        {/* Footer */}
        <motion.footer
          className="mt-14 flex items-center justify-between text-[10px] uppercase tracking-[0.32em] text-white/45 font-mono"
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.5 }}
        >
          <span>small bridges · est. 2026</span>
          <span title="This shot was generated in-app">every frame · generated</span>
        </motion.footer>
      </div>
      )}
    </aside>
  );
}
