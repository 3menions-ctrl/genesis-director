/**
 * AuthHeroStage — left-side cinematic backdrop on the Auth page.
 *
 * Hold-the-room feel: rotating tagline, a drifting film-strip ticker,
 * an inset Director's reel preview, and a quiet live ticker so the
 * lobby feels alive even before the user signs up.
 *
 * Reduced-motion aware. Below md breakpoint the parent stacks it below
 * the form; here we only render it once it has horizontal real estate.
 */
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Sparkles, Film, Users, Clock } from "lucide-react";
import { Logo } from "@/components/ui/Logo";

const TAGLINES = [
  "From premise to premiere.",
  "An idea in. A film out.",
  "Direct your first take tonight.",
  "Bridge the small distance to the screen.",
  "Make something tomorrow remembers.",
];

const FILMSTRIP_THUMBS = [
  "https://videos.pexels.com/video-files/3192305/3192305-uhd_2560_1440_25fps.mp4",
  "https://videos.pexels.com/video-files/2715411/2715411-uhd_2560_1440_30fps.mp4",
  "https://videos.pexels.com/video-files/4630019/4630019-uhd_2560_1440_25fps.mp4",
  "https://videos.pexels.com/video-files/4761711/4761711-uhd_2560_1440_25fps.mp4",
  "https://videos.pexels.com/video-files/3209663/3209663-hd_1920_1080_25fps.mp4",
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
    { icon: Film,  label: "Reels published today", value: "1,284" },
    { icon: Users, label: "Directors signed up this week", value: "613" },
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

      {/* Drifting film strip */}
      {!reducedMotion && (
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
            animate={{ x: "-50%" }}
            transition={{ duration: 38, ease: "linear", repeat: Infinity }}
          >
            {[...FILMSTRIP_THUMBS, ...FILMSTRIP_THUMBS].map((src, i) => (
              <div
                key={`${src}-${i}`}
                className="shrink-0 w-[180px] aspect-video rounded-md overflow-hidden border border-white/[0.06] bg-black/40"
              >
                <video
                  src={src}
                  className="w-full h-full object-cover opacity-70"
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                />
              </div>
            ))}
          </motion.div>
        </div>
      )}

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
