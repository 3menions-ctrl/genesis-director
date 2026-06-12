/**
 * AuthHeroStage — full-bleed cosmic editorial composition.
 *
 * Foundation: NASA/JPL artist's concept of the surface of Kepler-1649c,
 * an Earth-sized exoplanet in the habitable zone of a red dwarf star.
 * The horizon shows the host star setting with a small companion moon
 * visible alongside it.
 *
 * Motion layer:
 *   1. Very slow Ken-Burns drift on the photograph (~52s loop).
 *   2. A soft, breathing star-glow halo anchored to the host-star
 *      position in the painting so the sky feels alive.
 *
 * Blending:
 *   - Top vignette so the logo + index hold.
 *   - Strong bottom-left wash anchoring the headline against the
 *     alien terrain.
 *   - Right edge fades to #0a0b0f — the form-pane color — so the seam
 *     between hero and form disappears.
 *
 * Credit (legal): NASA / JPL-Caltech.
 */
import { motion, useReducedMotion } from "framer-motion";
import { Logo } from "@/components/ui/Logo";
import cosmosImage from "@/assets/cosmos/kepler-1649c.jpg";

interface Props {
  className?: string;
}

export function AuthHeroStage({ className }: Props) {
  const reducedMotion = useReducedMotion();

  return (
    <aside
      className={[
        "relative h-full w-full overflow-hidden bg-[#0a0b0f]",
        className,
      ].join(" ")}
    >
      {/* ── 1. Alien horizon w/ slow Ken-Burns drift ─────────────── */}
      <motion.div
        className="absolute inset-0"
        initial={{ scale: 1.08, x: 0, y: 0 }}
        animate={
          reducedMotion
            ? { scale: 1.08 }
            : { scale: [1.08, 1.14, 1.08], x: [0, -10, 0], y: [0, -6, 0] }
        }
        transition={{ duration: 52, ease: "easeInOut", repeat: Infinity }}
        style={{
          backgroundImage: `url(${cosmosImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center 50%",
        }}
      />

      {/* ── 2. Breathing star-glow over the host sun ─────────────── */}
      <motion.div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          left: "38%",
          top: "32%",
          width: 360,
          height: 360,
          transform: "translate(-50%, -50%)",
          background:
            "radial-gradient(circle, hsla(38, 100%, 75%, 0.55) 0%, hsla(20, 90%, 55%, 0.25) 35%, transparent 70%)",
          mixBlendMode: "screen",
          filter: "blur(12px)",
        }}
        initial={{ opacity: reducedMotion ? 0.8 : 0.6, scale: 1 }}
        animate={
          reducedMotion
            ? { opacity: 0.8, scale: 1 }
            : { opacity: [0.6, 0.92, 0.6], scale: [1, 1.08, 1] }
        }
        transition={{
          duration: 6.5,
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

      {/* ── 6. Editorial chrome ──────────────────────────────────── */}
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
          <span title="Image credit: NASA / JPL-Caltech">NASA · JPL-Caltech</span>
        </motion.footer>
      </div>
    </aside>
  );
}
