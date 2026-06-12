/**
 * AuthHeroStage — left-side cinematic backdrop on the Auth page.
 *
 * Hold-the-room feel: rotating tagline, a drifting procedural film strip
 * (pure CSS — no external media), and a quiet live ticker so the lobby
 * feels alive even before the user signs up.
 *
 * Reduced-motion aware. The film strip uses gradient art instead of
 * video so it loads instantly and never paints a black flash on slow
 * networks.
 */
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Sparkles, Film, Users, Clock } from "lucide-react";
import { Logo } from "@/components/ui/Logo";

const TAGLINES = [
  "From premise to premiere.",
  "An idea in. A film out.",
  "Tell a story tonight.",
  "Bridge the small distance to the screen.",
  "Make something tomorrow remembers.",
];

// Each frame is a procedural cinematic gradient — no external assets.
// The angle/colors give every frame a different "still" feel.
const FRAMES: Array<{ a: string; b: string; c: string; angle: number }> = [
  { a: "hsl(215, 90%, 60%)", b: "hsl(280, 75%, 55%)", c: "hsl(330, 80%, 50%)", angle: 135 },
  { a: "hsl(18, 92%, 58%)",  b: "hsl(345, 88%, 52%)", c: "hsl(280, 70%, 38%)", angle: 110 },
  { a: "hsl(160, 75%, 48%)", b: "hsl(190, 85%, 52%)", c: "hsl(230, 75%, 45%)", angle: 145 },
  { a: "hsl(45, 95%, 60%)",  b: "hsl(20, 92%, 55%)",  c: "hsl(345, 80%, 45%)", angle: 120 },
  { a: "hsl(265, 80%, 60%)", b: "hsl(215, 85%, 55%)", c: "hsl(195, 90%, 50%)", angle: 160 },
  { a: "hsl(0, 0%, 88%)",    b: "hsl(215, 30%, 28%)", c: "hsl(220, 50%, 12%)", angle: 130 },
  { a: "hsl(330, 80%, 60%)", b: "hsl(265, 70%, 45%)", c: "hsl(215, 85%, 40%)", angle: 100 },
  { a: "hsl(200, 90%, 65%)", b: "hsl(220, 75%, 45%)", c: "hsl(245, 70%, 28%)", angle: 150 },
];

interface Props {
  className?: string;
}

export function AuthHeroStage({ className }: Props) {
  const reducedMotion = useReducedMotion();
  const [taglineIdx, setTaglineIdx] = useState(0);

  // Rotate the tagline every 4.4s.
  useEffect(() => {
    if (reducedMotion) return;
    const id = setInterval(() => {
      setTaglineIdx((i) => (i + 1) % TAGLINES.length);
    }, 4400);
    return () => clearInterval(id);
  }, [reducedMotion]);

  const liveTicker = useMemo(() => ([
    { icon: Film,  label: "Reels published today",     value: "1,284" },
    { icon: Users, label: "Creators signed up this week", value: "613" },
    { icon: Clock, label: "Avg time to first publish", value: "11m" },
  ]), []);

  return (
    <aside
      className={[
        "relative h-full w-full overflow-hidden",
        "px-12 pt-14 pb-12 flex flex-col justify-between",
        className,
      ].join(" ")}
    >
      {/* Brand row */}
      <header className="relative z-10 flex items-center gap-3">
        <Logo size="md" showText textClassName="text-sm" />
        <span className="text-[10px] uppercase tracking-[0.28em] text-white/40">
          · cinematic AI video
        </span>
      </header>

      {/* Main pitch — fixed eyebrow + rotating headline */}
      <div className="relative z-10 max-w-[520px] py-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/[0.08] bg-white/[0.02] mb-6">
          <Sparkles className="w-3 h-3 text-primary" aria-hidden />
          <span className="text-[10px] uppercase tracking-[0.24em] text-white/65">
            Step onto the set
          </span>
        </div>

        <h1 className="font-display text-[clamp(2.5rem,4.6vw,4.2rem)] leading-[1.02] text-white font-light tracking-tight">
          Make it,{" "}
          <span className="text-white/55">premiere it,</span>
          <br />
          <span className="text-primary">earn from it.</span>
        </h1>

        <div className="mt-8 h-7 relative">
          <AnimatePresence mode="wait">
            <motion.p
              key={taglineIdx}
              initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 text-base text-white/65"
            >
              {TAGLINES[taglineIdx]}
            </motion.p>
          </AnimatePresence>
        </div>

        <p className="mt-6 text-sm text-white/45 max-w-[420px] leading-relaxed">
          Free during beta. 100 starter credits the moment you sign in.
          Apple / Google / email — your call.
        </p>
      </div>

      {/* Drifting procedural film strip — purely generated, no external media. */}
      <div
        aria-hidden
        className="absolute left-0 right-0 top-[44%] -translate-y-1/2 z-0 overflow-hidden"
        style={{
          mask: "linear-gradient(90deg, transparent 0%, black 12%, black 88%, transparent 100%)",
          WebkitMask: "linear-gradient(90deg, transparent 0%, black 12%, black 88%, transparent 100%)",
        }}
      >
        <motion.div
          className="flex gap-3"
          initial={{ x: 0 }}
          animate={reducedMotion ? { x: 0 } : { x: "-50%" }}
          transition={{ duration: 48, ease: "linear", repeat: Infinity }}
        >
          {[...FRAMES, ...FRAMES].map((f, i) => (
            <FilmFrame key={`${i}`} frame={f} />
          ))}
        </motion.div>
      </div>

      {/* Live ticker */}
      <footer className="relative z-10">
        <div className="grid grid-cols-3 gap-6 max-w-[520px]">
          {liveTicker.map((t) => (
            <div key={t.label}>
              <div className="flex items-center gap-1.5 text-white/40 text-[10px] uppercase tracking-[0.18em]">
                <t.icon className="w-3 h-3" aria-hidden />
                {t.label}
              </div>
              <div className="mt-1 font-display text-2xl text-white tabular-nums font-light">
                {t.value}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 text-[10px] uppercase tracking-[0.18em] text-white/30 font-mono">
          small bridges · est. 2026
        </div>
      </footer>
    </aside>
  );
}

/** A single film frame — gradient art with sprocket dots top/bottom. */
function FilmFrame({ frame }: { frame: { a: string; b: string; c: string; angle: number } }) {
  return (
    <div
      className="relative shrink-0 w-[180px] aspect-video rounded-md overflow-hidden border border-white/[0.08]"
      style={{
        background: `linear-gradient(${frame.angle}deg, ${frame.a} 0%, ${frame.b} 55%, ${frame.c} 100%)`,
      }}
    >
      {/* Subtle film grain via a layered radial gradient. */}
      <div
        className="absolute inset-0 opacity-[0.18] mix-blend-overlay"
        style={{
          background:
            "radial-gradient(circle at 25% 30%, rgba(255,255,255,0.6), transparent 35%), radial-gradient(circle at 75% 75%, rgba(0,0,0,0.55), transparent 40%)",
        }}
      />
      {/* Sprocket holes — top & bottom row to evoke real film. */}
      <div className="absolute inset-x-0 top-1 flex justify-around px-2 pointer-events-none">
        {Array.from({ length: 8 }).map((_, i) => (
          <span key={i} className="w-1 h-1 rounded-full bg-black/45" />
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-1 flex justify-around px-2 pointer-events-none">
        {Array.from({ length: 8 }).map((_, i) => (
          <span key={i} className="w-1 h-1 rounded-full bg-black/45" />
        ))}
      </div>
    </div>
  );
}
