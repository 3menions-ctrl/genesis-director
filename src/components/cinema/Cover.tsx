/**
 * Cover — the first screen, rebuilt as a PRODUCT hero (Linear/Stripe school):
 * value-first headline + CTAs on the left, the real editor floating in a
 * cinematic app frame on the right with live pointer-tilt parallax and feature
 * callouts pinned to the UI. The brand lives in the nav; here the product and
 * the promise do the selling. Sits over the darkened cinematic backdrop;
 * scrolling reveals the immersive film.
 */
import { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion, useMotionValue, useSpring, useTransform, type Variants } from "framer-motion";
import { Play, Sparkles } from "lucide-react";
import { Eyebrow, EASE, ACCENT } from "./ui";

const line: Variants = {
  hidden: { opacity: 0, y: 24, filter: "blur(8px)" },
  show: (i: number) => ({ opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.9, delay: 0.35 + i * 0.12, ease: EASE } }),
};

// A little gallery of fun one-liners — the "one sentence in" that becomes a film.
const PROMPTS = [
  "A lonely astronaut plants a garden on Mars.",
  "A noir detective chases shadows through neon rain.",
  "Two kids build a rocket from junkyard scraps.",
  "A dragon learns to bake the perfect croissant.",
  "The last lighthouse keeper befriends a storm.",
  "A jazz trio plays the northern lights to life.",
];

/** Typewriter prompt gallery — types a sentence, holds, erases, cycles. */
function PromptCycle({ reduced }: { reduced: boolean | null }) {
  const [i, setI] = useState(0);
  const [txt, setTxt] = useState("");
  const [phase, setPhase] = useState<"type" | "hold" | "erase">("type");

  useEffect(() => {
    if (reduced) { setTxt(PROMPTS[0]); return; }
    const full = PROMPTS[i];
    let t: ReturnType<typeof setTimeout>;
    if (phase === "type") {
      if (txt.length < full.length) t = setTimeout(() => setTxt(full.slice(0, txt.length + 1)), 36);
      else t = setTimeout(() => setPhase("hold"), 1500);
    } else if (phase === "hold") {
      t = setTimeout(() => setPhase("erase"), 250);
    } else {
      if (txt.length > 0) t = setTimeout(() => setTxt(full.slice(0, txt.length - 1)), 16);
      else { setPhase("type"); setI((v) => (v + 1) % PROMPTS.length); }
    }
    return () => clearTimeout(t);
  }, [txt, phase, i, reduced]);

  return (
    <div className="inline-flex max-w-full items-center gap-2.5 rounded-xl bg-white/[0.05] px-4 py-3 ring-1 ring-inset ring-white/[0.12] backdrop-blur-md"
      style={{ boxShadow: `0 18px 50px -28px rgba(0,0,0,0.9), inset 0 0 0 1px hsl(${ACCENT} / 0.06)` }}>
      <Sparkles className="h-4 w-4 shrink-0" style={{ color: `hsl(${ACCENT})` }} aria-hidden />
      <span className="truncate font-mono text-[13px] text-white/85 sm:text-[14px]">{txt || " "}</span>
      <span aria-hidden className="sb-caret ml-0.5 inline-block h-[1.05em] w-[2px] shrink-0 rounded-full align-middle" style={{ background: `hsl(${ACCENT})` }} />
    </div>
  );
}

const CALLOUTS = [
  { label: "Auto lip-sync", cls: "left-[3%] top-[12%]", d: 1.15 },
  { label: "Shot-to-shot continuity", cls: "right-[1%] top-[44%]", d: 1.3 },
  { label: "Native AI voices & score", cls: "left-[8%] bottom-[8%]", d: 1.45 },
];

export function Cover({ onEnter }: { onEnter: () => void }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLElement>(null);

  // pointer-driven tilt parallax for the product frame
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 70, damping: 18, mass: 0.6 });
  const sy = useSpring(py, { stiffness: 70, damping: 18, mass: 0.6 });
  const rotY = useTransform(sx, (v) => -11 + v * 9);
  const rotX = useTransform(sy, (v) => 7 - v * 8);
  const glowX = useTransform(sx, (v) => v * 28);

  const onMove = (e: React.MouseEvent) => {
    if (reduced || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    px.set((e.clientX - (r.left + r.width / 2)) / r.width);
    py.set((e.clientY - (r.top + r.height / 2)) / r.height);
  };
  const reset = () => { px.set(0); py.set(0); };

  return (
    <section ref={ref} onMouseMove={onMove} onMouseLeave={reset} className="relative flex h-screen w-full items-center overflow-hidden">
      <style>{`
        @keyframes sb-caret { 0%,45%{opacity:1} 50%,95%{opacity:0} 100%{opacity:1} }
        .sb-caret { animation: sb-caret 1s steps(1) infinite; }
        @keyframes sb-shimmer { 0%{background-position:120% 0} 100%{background-position:-120% 0} }
        .sb-shimmer { animation: sb-shimmer 4.5s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce){ .sb-caret,.sb-shimmer{ animation: none !important; } }
      `}</style>
      {/* cover-only scrim — darken for product contrast + left-side text legibility.
          The whole group fades out over the bottom so it never leaves a hard
          shadow line where the cover meets the next section. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          WebkitMaskImage: "linear-gradient(to bottom, #000 62%, transparent 100%)",
          maskImage: "linear-gradient(to bottom, #000 62%, transparent 100%)",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-[#06070a]/45 via-[#06070a]/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#06070a]/90 via-[#06070a]/45 to-transparent" />
        <motion.div
          style={reduced ? undefined : { x: glowX }}
          className="absolute right-[2%] top-1/2 h-[64vmin] w-[64vmin] -translate-y-1/2 rounded-full"
        >
          <div className="h-full w-full" style={{ background: `radial-gradient(closest-side, hsl(${ACCENT} / 0.20), transparent 70%)`, filter: "blur(46px)" }} />
        </motion.div>
      </div>

      <div className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-12 px-6 lg:grid-cols-[0.92fr_1.08fr] lg:gap-6 lg:px-10">
        {/* ── Left: value-first headline + CTAs ── */}
        <div className="max-w-xl text-center lg:text-left">
          <motion.div initial={reduced ? { opacity: 1 } : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2, ease: EASE }}>
            <Eyebrow>Cinematic AI Studio</Eyebrow>
          </motion.div>

          <h1 className="mt-5 font-display text-[clamp(3rem,7.6vw,5.8rem)] font-semibold leading-[0.98] tracking-[-0.03em] text-white [text-shadow:0_2px_36px_rgba(0,0,0,0.55)]">
            <motion.span className="block text-white/55" custom={0} variants={reduced ? undefined : line} initial={reduced ? false : "hidden"} animate={reduced ? false : "show"}>
              Type a sentence.
            </motion.span>
            <motion.span className="block" custom={1} variants={reduced ? undefined : line} initial={reduced ? false : "hidden"} animate={reduced ? false : "show"}>
              Direct a whole{" "}
              <span className="sb-shimmer italic" style={{ background: `linear-gradient(100deg, #fff 0%, hsl(${ACCENT}) 45%, #cfe1fb 60%, #fff 100%)`, backgroundSize: "220% 100%", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>film</span>.
            </motion.span>
          </h1>

          {/* animated prompt gallery — the "one sentence in" */}
          <motion.div
            initial={reduced ? { opacity: 1 } : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.7, ease: EASE }}
            className="mt-7 flex justify-center lg:justify-start"
          >
            <PromptCycle reduced={reduced} />
          </motion.div>

          <motion.p
            initial={reduced ? { opacity: 1 } : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.85, ease: EASE }}
            className="mx-auto mt-6 max-w-lg text-[17px] font-normal leading-relaxed text-white/80 lg:mx-0 sm:text-[19px]"
          >
            Cast, dialogue, sound, and shot-to-shot continuity — all conjured from a single line. No crew. No camera. No edit bay. Just press <span className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[13px] text-white/90 ring-1 ring-white/15">Enter</span>.
          </motion.p>

          <motion.div
            initial={reduced ? { opacity: 1 } : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.95, ease: EASE }}
            className="mt-9 flex flex-col items-center gap-3 sm:flex-row lg:items-start lg:justify-start sm:justify-center"
          >
            <motion.button
              type="button"
              onClick={onEnter}
              aria-label="Tour"
              whileHover={reduced ? undefined : { scale: 1.06 }}
              whileTap={{ scale: 0.95 }}
              className="group relative flex h-[80px] w-[80px] flex-col items-center justify-center gap-0.5 rounded-full"
            >
              {/* always-on accent glow — intensifies on hover */}
              <span aria-hidden className="pointer-events-none absolute -inset-3 rounded-full blur-md opacity-70 transition-opacity duration-300 group-hover:opacity-100" style={{ background: `radial-gradient(circle, hsl(${ACCENT} / 0.55), transparent 70%)` }} />
              {/* slow-rotating accent arc ring */}
              {!reduced && (
                <span aria-hidden className="pointer-events-none absolute -inset-[3px] rounded-full" style={{ background: `conic-gradient(from 0deg, transparent, hsl(${ACCENT}) 25%, transparent 45%, hsl(214 95% 82% / 0.7) 70%, transparent 85%)`, animation: "spin 6s linear infinite", WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px))", mask: "radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px))" }} />
              )}
              {/* white core with an accent glow ring */}
              <span aria-hidden className="pointer-events-none absolute inset-0 rounded-full bg-white transition-transform duration-300 group-hover:scale-[1.03]" style={{ boxShadow: `0 0 24px -2px hsl(${ACCENT} / 0.85), 0 0 48px -6px hsl(${ACCENT} / 0.6), 0 14px 36px -14px rgba(0,0,0,0.8)` }} />
              <Play className="relative h-[17px] w-[17px] fill-[#0a0b0e] text-[#0a0b0e]" />
              <span className="relative font-display text-[12.5px] font-semibold tracking-tight text-[#0a0b0e]">Tour</span>
            </motion.button>
          </motion.div>

          <motion.p
            initial={reduced ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 1.15, ease: EASE }}
            className="mt-5 text-[12px] font-light text-white/45"
          >
            Free to start · No credit card required
          </motion.p>
        </div>

        {/* ── Right: the real editor, floating in a cinematic frame ── */}
        <motion.div
          initial={reduced ? { opacity: 1 } : { opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1.2, delay: 0.5, ease: EASE }}
          className="relative mx-auto w-full max-w-2xl lg:max-w-none"
          style={{ perspective: 1400 }}
        >
          <motion.div
            style={reduced ? undefined : { rotateX: rotX, rotateY: rotY, transformPerspective: 1400 }}
            className="relative rounded-xl"
          >
            {/* app frame */}
            <div className="relative overflow-hidden rounded-xl ring-1 ring-white/12 shadow-[0_60px_140px_-40px_rgba(0,0,0,0.95)]">
              <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
              {/* title bar */}
              <div className="flex items-center gap-2 border-b border-white/[0.06] bg-[#0c0e12]/95 px-3.5 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]/90" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]/90" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]/90" />
                <span className="ml-3 font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">Small Bridges Studio — Flying Whale</span>
                <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-medium text-white/70 ring-1 ring-white/10">
                  <Sparkles className="h-3 w-3" style={{ color: `hsl(${ACCENT})` }} /> Rendering
                </span>
              </div>
              {/* the real editor — a clip already loaded in the stage + a live right rail */}
              <div className="relative">
                <img src="/cinema-assets/editor-loaded.jpg" alt="The Small Bridges editor — a loaded clip in the stage with the inspector rail" className="block w-full" />
                {/* play affordance over the loaded stage, reads as a playable clip */}
                <div className="absolute" style={{ left: "16.6%", top: "10.9%", width: "58%", height: "47.6%" }}>
                  <div className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 ring-1 ring-white/40 backdrop-blur-sm">
                    <span className="ml-0.5 h-0 w-0 border-y-[6px] border-l-[10px] border-y-transparent border-l-white" />
                  </div>
                </div>
              </div>
              {/* inner sheen */}
              <div aria-hidden className="pointer-events-none absolute inset-0 rounded-xl bg-[radial-gradient(120%_90%_at_70%_0%,rgba(255,255,255,0.06),transparent_55%)]" />
            </div>

            {/* feature callouts pinned to the UI */}
            {!reduced &&
              CALLOUTS.map((c) => (
                <motion.div
                  key={c.label}
                  initial={{ opacity: 0, scale: 0.85, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: c.d, ease: EASE }}
                  className={`absolute hidden items-center gap-2 rounded-full border border-white/15 bg-[#0b0d11]/80 px-3 py-1.5 text-[11px] font-medium text-white/85 shadow-[0_18px_50px_-20px_rgba(0,0,0,0.9)] backdrop-blur-md md:inline-flex ${c.cls}`}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: `hsl(${ACCENT})`, boxShadow: `0 0 10px hsl(${ACCENT})` }} />
                  {c.label}
                </motion.div>
              ))}
          </motion.div>
        </motion.div>
      </div>

      {/* scroll cue */}
      {!reduced && (
        <motion.div
          className="absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-[10px] font-mono uppercase tracking-[0.36em] text-white/55"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.4, 0.85, 0.4] }}
          transition={{ opacity: { duration: 2.4, repeat: Infinity, delay: 1.6 } }}
        >
          Scroll to watch
          <motion.span animate={{ y: [0, 5, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}>↓</motion.span>
        </motion.div>
      )}
    </section>
  );
}
