/**
 * AuthHeroStage — left-side cinematic backdrop on the Auth page.
 *
 * A genuine animated mesh-gradient (four blurred color orbs slowly
 * drifting over a near-black base), a faint grid overlay for structure,
 * and confident single-line typography. No fake stats, no filmstrip,
 * no rotating taglines — just signal.
 *
 * Reduced-motion aware: the orbs freeze in place but the composition
 * still reads.
 */
import { motion, useReducedMotion } from "framer-motion";
import { Logo } from "@/components/ui/Logo";

const ORBS = [
  { color: "hsl(215, 100%, 55%)", x: "8%",  y: "14%", size: 520, dur: 26, delay: 0 },
  { color: "hsl(275, 85%, 55%)",  x: "62%", y: "10%", size: 440, dur: 32, delay: 4 },
  { color: "hsl(195, 95%, 50%)",  x: "20%", y: "72%", size: 480, dur: 28, delay: 2 },
  { color: "hsl(330, 85%, 55%)",  x: "70%", y: "65%", size: 400, dur: 36, delay: 6 },
];

interface Props {
  className?: string;
}

export function AuthHeroStage({ className }: Props) {
  const reducedMotion = useReducedMotion();

  return (
    <aside
      className={[
        "relative h-full w-full overflow-hidden",
        "bg-[#08090c]",
        className,
      ].join(" ")}
    >
      {/* Mesh-gradient orbs ───────────────────────────────────────── */}
      <div className="absolute inset-0 overflow-hidden">
        {ORBS.map((o, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              left: o.x,
              top: o.y,
              width: o.size,
              height: o.size,
              backgroundColor: o.color,
              filter: "blur(110px)",
              opacity: 0.55,
              mixBlendMode: "screen",
            }}
            initial={{ x: 0, y: 0, scale: 1 }}
            animate={reducedMotion ? { x: 0, y: 0, scale: 1 } : {
              x: [0, 40, -30, 0],
              y: [0, -30, 30, 0],
              scale: [1, 1.08, 0.96, 1],
            }}
            transition={{
              duration: o.dur,
              ease: "easeInOut",
              repeat: Infinity,
              delay: o.delay,
            }}
          />
        ))}
      </div>

      {/* Fine grid overlay ────────────────────────────────────────── */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage:
            "radial-gradient(ellipse 80% 70% at 50% 50%, black 30%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 70% at 50% 50%, black 30%, transparent 80%)",
        }}
      />

      {/* Vignette to deepen the edges */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 100% 100% at 50% 50%, transparent 40%, rgba(8,9,12,0.75) 100%)",
        }}
      />

      {/* Foreground content ──────────────────────────────────────── */}
      <div className="relative z-10 h-full w-full px-14 pt-14 pb-12 flex flex-col">
        <header className="flex items-center gap-3">
          <Logo size="md" showText textClassName="text-sm tracking-wide" />
        </header>

        <div className="flex-1 flex flex-col justify-center max-w-[560px]">
          <span className="text-[10px] uppercase tracking-[0.32em] text-white/55 mb-8">
            Cinematic AI Video
          </span>

          <h1
            className="font-display text-white leading-[0.98] tracking-tight font-light"
            style={{ fontSize: "clamp(3rem, 5.4vw, 5rem)" }}
          >
            One prompt away
            <br />
            <span className="italic text-white/70">from a film.</span>
          </h1>

          <p className="mt-8 text-[15px] text-white/55 leading-relaxed max-w-[440px]">
            Start with a sentence. Leave with something worth watching.
            Free during beta — 100 credits on us.
          </p>
        </div>

        <footer className="text-[10px] uppercase tracking-[0.28em] text-white/30 font-mono">
          small bridges · est. 2026
        </footer>
      </div>
    </aside>
  );
}
