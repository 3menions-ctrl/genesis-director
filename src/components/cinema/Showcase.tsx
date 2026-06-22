/**
 * Showcase — the centrepiece. Merges the manifesto beat ("We make the whole
 * film.") and the full production-pipeline proof into ONE epic, scroll-driven
 * presentation over the fixed film backdrop:
 *
 *   ACT I  — manifesto: keyword marquee, the headline, a 3D coverflow of scenes.
 *   ACT II — the pipeline: proof band, the cutting room, frame chaining,
 *            screenwriting, storyboard, casting, color/VFX, voice/score,
 *            finish & deliver, and the closing call to action.
 *
 * Every claim is bound to real features (engines.ts, src/lib/editor/*).
 */
import { useEffect, useRef, useState } from "react";
import { motion, animate, useInView, useReducedMotion, type Variants } from "framer-motion";
import {
  PenLine, LayoutGrid, Users, Film, Link2, Palette, AudioLines, Sparkles, ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { Glass, Eyebrow, Reveal, Button, EASE, ACCENT } from "./ui";

const SHADOW = "[text-shadow:0_2px_24px_rgba(0,0,0,0.55)]";
const veil = "linear-gradient(165deg, rgba(8,9,12,0.5) 0%, rgba(8,9,12,0.7) 100%)";

/* ════════════════════ ACT I — manifesto ════════════════════ */

const KEYWORDS = ["Text-to-Video", "Image-to-Video", "AI Voices", "Lip-Sync", "Shot Continuity", "Native Score", "Character DNA", "4K Export"];
const CARD_W = 640;

type Scene = { img: string; label: string; tag: string; time: string };
const SCENES: Scene[] = [
  { img: "/cinema-assets/hero-poster.jpg", label: "Hoppy in the Park", tag: "Scene 01", time: "0:05" },
  { img: "/cinema-assets/surface-environments.jpg", label: "Environments", tag: "World", time: "4K" },
  { img: "/cinema-assets/surface-avatars.jpg", label: "Casting", tag: "Avatars", time: "12" },
  { img: "/cinema-assets/editor-loaded.jpg", label: "The Cutting Room", tag: "Timeline", time: "0:05" },
  { img: "/cinema-assets/cover.jpg", label: "Establishing Shot", tag: "Vista", time: "0:08" },
  { img: "/cinema-assets/surface-profile.jpg", label: "Your Library", tag: "Projects", time: "∞" },
];

function Marquee({ reduced }: { reduced: boolean }) {
  const mask = "linear-gradient(90deg, transparent, #000 14%, #000 86%, transparent)";
  const row = [...KEYWORDS, ...KEYWORDS];
  return (
    <div className="relative w-full overflow-hidden" style={{ maskImage: mask, WebkitMaskImage: mask }}>
      <div className="flex w-max items-center" style={reduced ? undefined : { animation: "sc-marquee 32s linear infinite" }}>
        {row.map((k, i) => (
          <span key={i} className="flex items-center whitespace-nowrap font-mono text-[12px] uppercase tracking-[0.3em] text-white/55">
            <span className="mx-7 h-1 w-1 rounded-full" style={{ background: `hsl(${ACCENT})` }} />{k}
          </span>
        ))}
      </div>
    </div>
  );
}

function SceneCard({ s, active }: { s: Scene; active: boolean }) {
  return (
    <div className="rounded-[20px] p-px" style={{ width: CARD_W, background: active ? `linear-gradient(150deg, hsl(${ACCENT}), rgba(255,255,255,0.16), transparent 70%)` : "linear-gradient(150deg, rgba(255,255,255,0.18), rgba(255,255,255,0.04), transparent 70%)", boxShadow: active ? `0 60px 130px -40px rgba(0,0,0,0.95), 0 0 60px -10px hsl(${ACCENT} / 0.45)` : "0 50px 120px -45px rgba(0,0,0,0.9)" }}>
      <div className="relative overflow-hidden rounded-[19px] bg-black">
        <img src={s.img} alt="" aria-hidden className="h-[360px] w-full object-cover" draggable={false} />
        <div aria-hidden className="absolute inset-x-0 top-0 h-[8%] bg-black" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[8%] bg-black" />
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(125%_105%_at_50%_45%,transparent_52%,rgba(0,0,0,0.6))]" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-[8%] h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        <div className="absolute inset-x-4 top-[8%] flex items-center justify-between pt-2">
          <span className="inline-flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.2em] text-white/80">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: `hsl(${ACCENT})`, boxShadow: `0 0 8px hsl(${ACCENT})` }} />{s.tag}
          </span>
          <span className="font-mono text-[9.5px] tracking-[0.12em] text-white/65">TC {s.time}</span>
        </div>
        <div className="absolute inset-x-5 bottom-[8%] flex items-end justify-between pb-2">
          <span className="font-display text-[25px] font-medium leading-none text-white">{s.label}</span>
          <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/50">Small Bridges</span>
        </div>
      </div>
    </div>
  );
}

function Coverflow({ reduced }: { reduced: boolean }) {
  const n = SCENES.length;
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setActive((a) => (a + 1) % n), 3400);
    return () => clearInterval(id);
  }, [reduced, n]);
  const place = (i: number) => {
    let rel = i - active;
    if (rel > n / 2) rel -= n;
    if (rel < -n / 2) rel += n;
    if (rel === 0) return { x: 0, rotateY: 0, scale: 1, opacity: 1, filter: "blur(0px)", zIndex: 30 };
    if (rel === 1) return { x: 470, rotateY: -46, scale: 0.78, opacity: 0.58, filter: "blur(2px)", zIndex: 20 };
    if (rel === -1) return { x: -470, rotateY: 46, scale: 0.78, opacity: 0.58, filter: "blur(2px)", zIndex: 20 };
    return { x: rel > 0 ? 900 : -900, rotateY: rel > 0 ? -58 : 58, scale: 0.58, opacity: 0, filter: "blur(4px)", zIndex: 10 };
  };
  return (
    <div className="relative h-[400px] w-full" style={{ perspective: 2400 }}>
      <div className="absolute left-1/2 top-1/2 h-0 w-0">
        {SCENES.map((s, i) => {
          const rel = (((i - active) % n) + n) % n;
          return (
            <motion.div key={s.label} className="absolute left-0 top-0" style={{ marginLeft: -CARD_W / 2, marginTop: -188, transformStyle: "preserve-3d" }}
              animate={place(i)} transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 70, damping: 18 }}>
              <SceneCard s={s} active={rel === 0} />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

const group: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.13, delayChildren: 0.05 } } };
const up: Variants = { hidden: { opacity: 0, y: 26, filter: "blur(8px)" }, show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.95, ease: EASE } } };

/* ════════════════════ ACT II — pipeline ════════════════════ */

function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-12%" });
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, to, { duration: 1.3, ease: [0.22, 1, 0.36, 1], onUpdate: (x) => setV(Math.round(x)) });
    return () => controls.stop();
  }, [inView, to]);
  return <span ref={ref}>{v}{suffix}</span>;
}

const STATS: { value: React.ReactNode; label: string }[] = [
  { value: <CountUp to={6} />, label: "Frontier engines" },
  { value: <CountUp to={461} />, label: "Cast members" },
  { value: <CountUp to={30} />, label: "Film-grade looks" },
  { value: <CountUp to={20} />, label: "Motion-VFX effects" },
  { value: "4K·60", label: "Cinema finish" },
  { value: "0", label: "Crew, cameras, edit bays" },
];

function TimelineMotif() {
  const tracks = [
    { k: "V3", segs: [[6, 16], [40, 22]], c: "rgba(255,255,255,0.4)" },
    { k: "V2", segs: [[10, 30], [52, 30]], c: `hsl(${ACCENT})` },
    { k: "V1", segs: [[4, 40], [50, 44]], c: "rgba(255,255,255,0.6)" },
    { k: "A1", segs: [[8, 50]], c: "hsl(190 80% 60%)" },
    { k: "A2", segs: [[20, 70]], c: "hsl(270 70% 66%)" },
  ];
  return (
    <div className="relative mt-1 select-none">
      <div className="space-y-1.5">
        {tracks.map((t) => (
          <div key={t.k} className="flex items-center gap-2">
            <span className="w-5 shrink-0 font-mono text-[8px] uppercase tracking-[0.15em] text-white/35">{t.k}</span>
            <div className="relative h-[10px] flex-1 overflow-hidden rounded-[3px] bg-white/[0.04]">
              {t.segs.map((s, i) => <span key={i} className="absolute top-0 h-full rounded-[3px]" style={{ left: `${s[0]}%`, width: `${s[1]}%`, background: t.c, opacity: 0.85 }} />)}
            </div>
          </div>
        ))}
      </div>
      <span aria-hidden className="sc-anim pointer-events-none absolute -top-1 bottom-0 w-px" style={{ left: "4%", background: `hsl(${ACCENT})`, boxShadow: `0 0 8px hsl(${ACCENT})`, animation: "sc-playhead 5.5s ease-in-out infinite alternate" }}>
        <span className="absolute -top-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rotate-45 rounded-[1px]" style={{ background: `hsl(${ACCENT})` }} />
      </span>
    </div>
  );
}

function FrameChainMotif() {
  return (
    <div className="relative mt-2 flex items-center gap-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="relative flex-1">
          <div className="aspect-video w-full rounded-[5px] ring-1 ring-inset ring-white/15" style={{ background: `linear-gradient(135deg, hsl(${ACCENT} / ${0.18 + i * 0.06}), rgba(255,255,255,0.05))` }} />
          {i < 2 && <span aria-hidden className="absolute right-[-9px] top-1/2 z-10 h-3 w-3 -translate-y-1/2 rounded-full" style={{ background: `hsl(${ACCENT})`, boxShadow: `0 0 10px hsl(${ACCENT})` }} />}
        </div>
      ))}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)" }}>
        <span className="sc-anim absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full" style={{ background: "#fff", boxShadow: `0 0 10px hsl(${ACCENT})`, animation: "sc-chain 3.4s ease-in-out infinite" }} />
      </div>
    </div>
  );
}

function ScriptMotif() {
  return (
    <div className="mt-1 font-mono text-[10px] leading-[1.5] text-white/55">
      <div style={{ color: `hsl(${ACCENT})` }}>INT. LIGHTHOUSE — NIGHT</div>
      <div className="text-white/45">The lamp sweeps the black water.</div>
      <div className="mt-1 pl-8 text-white/70">KEEPER</div>
      <div className="pl-5 text-white/55">One more turn till dawn<span aria-hidden className="sc-anim ml-0.5 inline-block h-[1em] w-[5px] translate-y-[2px]" style={{ background: `hsl(${ACCENT})`, animation: "sc-caret 1s steps(1) infinite" }} /></div>
    </div>
  );
}

function StoryboardMotif() {
  return (
    <div className="mt-1 grid grid-cols-3 gap-1.5">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="sc-anim aspect-video rounded-[4px] ring-1 ring-inset ring-white/12" style={{ background: `linear-gradient(140deg, hsl(${ACCENT} / 0.16), rgba(255,255,255,0.04))`, animation: `sc-board 3.2s ease-in-out ${i * 0.25}s infinite` }} />
      ))}
    </div>
  );
}

function AvatarsMotif() {
  const hues = [10, 200, 280, 150, 40, 320];
  return (
    <div className="mt-2 flex items-center">
      {hues.map((h, i) => <span key={i} className="-ml-2 first:ml-0 h-9 w-9 rounded-full ring-2 ring-[#0b0d11]" style={{ background: `radial-gradient(circle at 35% 30%, hsl(${h} 70% 70%), hsl(${h} 60% 38%))`, zIndex: 10 - i }} />)}
      <span className="ml-3 font-mono text-[11px] tracking-[0.1em] text-white/55">+461 cast</span>
    </div>
  );
}

function ColorMotif() {
  const looks = ["Kodak 2383", "Portra", "Wong Kar-wai", "Blade Runner", "Teal & Orange", "Noir"];
  const sw = ["hsl(28 80% 56%)", "hsl(18 70% 62%)", "hsl(340 55% 50%)", "hsl(200 80% 52%)", "hsl(190 75% 50%)", "hsl(220 12% 60%)"];
  return (
    <div className="mt-2">
      <div className="sc-anim flex gap-1.5" style={{ animation: "sc-hue 6s ease-in-out infinite" }}>
        {sw.map((c, i) => <span key={i} className="h-6 flex-1 rounded-[3px]" style={{ background: c }} />)}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-2 gap-y-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-white/40">{looks.map((l) => <span key={l}>{l}</span>)}</div>
    </div>
  );
}

function WaveformMotif() {
  const bars = Array.from({ length: 38 });
  return (
    <div className="mt-2 flex h-12 items-center gap-[3px]">
      {bars.map((_, i) => <span key={i} className="sc-anim w-full origin-center rounded-full" style={{ height: "100%", background: i % 5 === 0 ? `hsl(${ACCENT})` : "rgba(255,255,255,0.45)", animation: `sc-wave ${1 + (i % 7) * 0.18}s ease-in-out ${i * 0.04}s infinite` }} />)}
    </div>
  );
}

function Tile({ icon: Icon, kicker, title, desc, motif, className, idx }: { icon: LucideIcon; kicker: string; title: string; desc: string; motif?: React.ReactNode; className?: string; idx: number }) {
  return (
    <Reveal delay={idx * 0.05} className={className}>
      <Glass hover className="group relative flex h-full flex-col p-6 sm:p-7">
        <span aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl" style={{ background: veil }} />
        <span aria-hidden className="pointer-events-none absolute inset-x-7 top-0 h-px opacity-60 transition-opacity duration-500 group-hover:opacity-100" style={{ background: `linear-gradient(90deg, transparent, hsl(${ACCENT} / 0.9), transparent)` }} />
        <div className="relative flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06] ring-1 ring-inset ring-white/10"><Icon className="h-4 w-4" style={{ color: `hsl(${ACCENT})` }} aria-hidden /></span>
          <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/45">{kicker}</span>
        </div>
        <h3 className={`relative mt-3.5 font-display text-[1.4rem] font-semibold leading-tight tracking-[-0.02em] text-white ${SHADOW}`}>{title}</h3>
        <p className="relative mt-2 text-[13.5px] leading-relaxed text-white/65">{desc}</p>
        {motif && <div className="relative mt-auto pt-5">{motif}</div>}
      </Glass>
    </Reveal>
  );
}

const KEYFRAMES = `
@keyframes sc-marquee { to { transform: translateX(-50%); } }
@keyframes sc-playhead { 0%{left:4%} 92%,100%{left:96%} }
@keyframes sc-wave { 0%,100%{ transform: scaleY(0.35) } 50%{ transform: scaleY(1) } }
@keyframes sc-chain { 0%{ left:0%; opacity:0 } 12%{opacity:1} 88%{opacity:1} 100%{ left:100%; opacity:0 } }
@keyframes sc-hue { 0%,100%{ filter: hue-rotate(0deg) } 50%{ filter: hue-rotate(26deg) } }
@keyframes sc-caret { 50%{ opacity: 0 } }
@keyframes sc-board { 0%,100%{ opacity:.25 } 50%{ opacity:1 } }
@media (prefers-reduced-motion: reduce){ [class*="sc-"]{ animation: none !important; } }
`;

/* ════════════════════ the merged showcase ════════════════════ */

export function Showcase({ onStart }: { onStart?: () => void }) {
  const reduced = useReducedMotion() ?? false;
  return (
    <section className="relative z-[3]">
      <style>{KEYFRAMES}</style>

      {/* ── ACT I — manifesto ── */}
      <div className="relative flex min-h-screen flex-col justify-center overflow-hidden px-6 py-24">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(60%_52%_at_50%_42%,rgba(6,7,10,0.62),transparent_72%)]" />
        <div className="relative mx-auto w-full max-w-6xl">
          <div className="mb-10">
            <Marquee reduced={reduced} />
          </div>

          <motion.div variants={reduced ? undefined : group} initial={reduced ? false : "hidden"} whileInView={reduced ? undefined : "show"} viewport={{ once: true, margin: "-15%" }} className="mx-auto flex max-w-3xl flex-col items-center text-center">
            <motion.div variants={reduced ? undefined : up} className="mb-6 flex items-center justify-center gap-3">
              <span className="h-px w-7" style={{ background: `hsl(${ACCENT} / 0.7)` }} />
              <span className="font-mono text-[11px] uppercase tracking-[0.4em]" style={{ color: `hsl(${ACCENT})` }}>Cinematic AI Studio</span>
              <span className="h-px w-7" style={{ background: `hsl(${ACCENT} / 0.7)` }} />
            </motion.div>
            <h2 className="font-display font-semibold tracking-[-0.03em] text-white [text-shadow:0_6px_60px_rgba(0,0,0,0.9)]">
              <motion.span variants={reduced ? undefined : up} className="block text-[clamp(1.4rem,3.4vw,2.3rem)] font-normal text-white/55">Everyone else makes clips.</motion.span>
              <motion.span variants={reduced ? undefined : up} className="mt-3 block text-[clamp(2.9rem,8.4vw,6.4rem)] leading-[0.96]">
                We make the whole{" "}
                <span className="relative inline-block italic">film.
                  {!reduced && <motion.span aria-hidden variants={{ hidden: { scaleX: 0, opacity: 0 }, show: { scaleX: 1, opacity: 1, transition: { duration: 0.7, ease: EASE, delay: 0.2 } } }} className="absolute -bottom-1 left-0 h-[3px] w-full origin-left rounded-full" style={{ background: `linear-gradient(90deg, hsl(${ACCENT}), transparent)` }} />}
                </span>
              </motion.span>
            </h2>
            <motion.p variants={reduced ? undefined : up} className="mx-auto mt-7 max-w-xl text-[18px] font-normal leading-relaxed text-white/80 [text-shadow:0_2px_18px_rgba(0,0,0,0.85)] sm:text-[20px]">
              Cast, dialogue, sound and continuity — locked across every cut. A finished cinematic video from a single sentence.
            </motion.p>
          </motion.div>

          <div className="mt-14 flex justify-center">
            <Coverflow reduced={reduced} />
          </div>
        </div>
      </div>

      {/* ── ACT II — pipeline ── */}
      <div className="px-6 pb-28 pt-8">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mx-auto mb-10 max-w-2xl text-center">
            <Eyebrow>The whole production pipeline</Eyebrow>
            <h2 className={`mt-3 font-display text-[clamp(2rem,5.2vw,3.5rem)] font-semibold tracking-[-0.03em] text-white ${SHADOW}`}>
              Not a clip generator.<br className="hidden sm:block" /> A studio.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[17px] leading-relaxed text-white/70 sm:text-[18px]">
              Skip the crew, the camera and the edit bay. Everything a film needs — written, cast, boarded, shot, cut, graded and scored — happens right here, in one unbroken pipeline. You bring the idea.
            </p>
          </Reveal>

          <Reveal delay={0.06} className="mx-auto mb-14 max-w-4xl">
            <Glass className="relative overflow-hidden">
              <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: veil }} />
              <div className="relative grid grid-cols-3 divide-x divide-y divide-white/[0.06] sm:grid-cols-6 sm:divide-y-0">
                {STATS.map((s) => (
                  <div key={s.label} className="flex flex-col items-center gap-1 px-2 py-5 text-center">
                    <span className="font-display text-[1.7rem] font-semibold tabular-nums tracking-[-0.02em]" style={{ color: `hsl(${ACCENT})` }}>{s.value}</span>
                    <span className="font-mono text-[9px] uppercase leading-tight tracking-[0.14em] text-white/45">{s.label}</span>
                  </div>
                ))}
              </div>
            </Glass>
          </Reveal>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-6">
            <Tile idx={0} className="lg:col-span-4" icon={Film} kicker="The cutting room" title="A real timeline. Not a prompt box." desc="Stage, Timeline, Script and Storyboard — four views of one film. Five tracks for titles, overlay VFX, video, dialogue and score. Trim, split, slip and dissolve every cut, frame-accurate." motif={<TimelineMotif />} />
            <Tile idx={1} className="lg:col-span-2" icon={Link2} kicker="Continuity" title="Frame chaining." desc="The last frame of every shot seeds the next — motion, light and character carry across the cut. No jump. No drift." motif={<FrameChainMotif />} />
            <Tile idx={2} className="lg:col-span-2" icon={PenLine} kicker="Screenwriting" title="One line to a shooting script." desc="Logline → synopsis → scenes, beats and shots. Industry-standard Fountain & Final Draft, with genre, mood and pacing baked in." motif={<ScriptMotif />} />
            <Tile idx={3} className="lg:col-span-2" icon={LayoutGrid} kicker="Storyboard" title="See it before you render." desc="Every scene as a board — slug-lines and framing from wide establishing to over-the-shoulder, act by act." motif={<StoryboardMotif />} />
            <Tile idx={4} className="lg:col-span-2" icon={Users} kicker="Casting" title="A cast that stays itself." desc="461 characters with identity DNA, multi-angle references and locked wardrobe — the same face, shot after shot." motif={<AvatarsMotif />} />
            <Tile idx={5} className="lg:col-span-3" icon={Palette} kicker="Color & VFX" title="Grade it like film." desc="30 LUT looks — Kodak 2383, Portra, Wong Kar-wai, Blade Runner 2049 — plus lift/gamma/gain wheels, grain, halation and 20 motion-VFX effects." motif={<ColorMotif />} />
            <Tile idx={6} className="lg:col-span-3" icon={AudioLines} kicker="Voice & score" title="Native sound, in every register." desc="ElevenLabs voices, character clones and lip-sync over a generated score — with per-clip EQ, compression and EBU-R128 master loudness." motif={<WaveformMotif />} />
          </div>

          <Reveal delay={0.1}>
            <Glass className="relative mt-5 overflow-hidden p-6 sm:p-7">
              <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: veil }} />
              <span aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full opacity-60" style={{ background: `radial-gradient(circle, hsl(${ACCENT} / 0.4), transparent 65%)`, filter: "blur(36px)" }} />
              <div className="relative flex flex-col items-start justify-between gap-5 lg:flex-row lg:items-center">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.06] ring-1 ring-inset ring-white/10"><Sparkles className="h-4 w-4" style={{ color: `hsl(${ACCENT})` }} aria-hidden /></span>
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/45">Finish &amp; deliver</div>
                    <h3 className={`font-display text-[1.5rem] font-semibold tracking-[-0.02em] text-white ${SHADOW}`}>4K. 60fps. One file.</h3>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {["Topaz Astra 4K", "RIFE 60fps", "Seamless stitch", "Auto-retake", "Branded intro", "Publish to gallery"].map((c) => (
                    <span key={c} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-3 py-1.5 text-[12px] font-medium text-white/70 ring-1 ring-inset ring-white/10"><span className="h-1.5 w-1.5 rounded-full" style={{ background: `hsl(${ACCENT})`, boxShadow: `0 0 8px hsl(${ACCENT})` }} />{c}</span>
                  ))}
                </div>
              </div>
            </Glass>
          </Reveal>

          <Reveal delay={0.1} className="mx-auto mt-16 max-w-2xl text-center">
            <h3 className={`font-display text-[clamp(1.7rem,4vw,2.6rem)] font-semibold tracking-[-0.025em] text-white ${SHADOW}`}>One sentence is all it takes.</h3>
            <p className="mx-auto mt-3 max-w-md text-[16px] leading-relaxed text-white/65">The whole crew is already here. Type your idea and watch it become a finished, cinematic film.</p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button onClick={onStart} className="px-7 py-3.5 text-[15px]">Start your first film <ArrowRight className="h-4 w-4" /></Button>
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/40">Free to start · No card</span>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
