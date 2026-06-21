/**
 * Cinema content sections — HowItWorks, Studio, Portal, FinalCTA.
 * All transparent: they scroll over the fixed immersive video. Glass panels +
 * text-shadows keep content readable while the footage stays visible.
 */
import { useRef } from "react";
import { motion, useMotionValue, useSpring, useReducedMotion } from "framer-motion";
import { ArrowRight, Cpu, Link2, UserSquare2, Globe2, Drama, Clapperboard, Mic, Music, Film, Share2, type LucideIcon } from "lucide-react";
import { AVATAR_VIDEO } from "./assets";
import { Glass, Button, Eyebrow, Reveal, ACCENT } from "./ui";

const SHADOW = "[text-shadow:0_2px_24px_rgba(0,0,0,0.55)]";

function Head({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <Reveal className="mx-auto mb-12 max-w-2xl text-center">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className={`mt-3 font-display text-[clamp(2.2rem,5.6vw,3.9rem)] font-semibold tracking-[-0.03em] text-white ${SHADOW}`}>{title}</h2>
      {sub && <p className="mx-auto mt-4 max-w-xl text-[17px] font-normal leading-relaxed text-white/70 sm:text-[18px]">{sub}</p>}
    </Reveal>
  );
}

// ── The toolkit — giant transparent "game" circles, drifting left → right ─────
type Feature = { icon: LucideIcon; title: string; sub: string; tag: string };
const FEATURES: Feature[] = [
  { icon: Cpu, title: "AI Engines", sub: "Best-in-class models", tag: "Generate" },
  { icon: Link2, title: "Frame & Pose Chaining", sub: "Shot-to-shot continuity", tag: "Continuity" },
  { icon: UserSquare2, title: "Avatars", sub: "461 characters", tag: "Cast" },
  { icon: Globe2, title: "Environments", sub: "Cinematic worlds", tag: "Worlds" },
  { icon: Drama, title: "4th-Wall Breaks", sub: "Talk to the camera", tag: "Direct" },
  { icon: Clapperboard, title: "Timeline Editor", sub: "A real cutting room", tag: "Edit" },
  { icon: Mic, title: "Voice & Lip-Sync", sub: "Native dialogue", tag: "Sound" },
  { icon: Music, title: "Score & Sound", sub: "Auto-scored", tag: "Sound" },
  { icon: Film, title: "Your Channel", sub: "Profile & publish", tag: "Share" },
  { icon: Share2, title: "Distribution", sub: "Export anywhere", tag: "Deliver" },
];

const FEAT_KEYFRAMES = `
@keyframes feat-marquee { from { transform: translateX(-50%); } to { transform: translateX(0); } }
@keyframes circ-glow { 0%,100%{opacity:.40;transform:scale(.94)} 50%{opacity:.95;transform:scale(1.08)} }
@keyframes circ-ping { 0%{transform:scale(.80);opacity:.55} 70%{opacity:0} 100%{transform:scale(1.30);opacity:0} }
@keyframes circ-pulse { 0%,100%{opacity:.45;transform:scale(.85)} 50%{opacity:1;transform:scale(1.12)} }
@keyframes circ-bob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-14px)} }
@keyframes circ-word { 0%,100%{text-shadow:0 1px 12px rgba(0,0,0,.75)} 50%{text-shadow:0 0 22px hsl(${ACCENT} / .85),0 1px 12px rgba(0,0,0,.75)} }
@keyframes circ-tag { 0%,100%{box-shadow:inset 0 0 0 1px rgba(255,255,255,0.08),0 0 0 0 hsl(${ACCENT}/0)} 50%{box-shadow:inset 0 0 0 1px hsl(${ACCENT}/0.55),0 0 20px -2px hsl(${ACCENT}/0.7)} }
@keyframes circ-sheen { 0%{transform:translateX(-160%) rotate(12deg);opacity:0} 35%{opacity:.55} 65%{opacity:.55} 100%{transform:translateX(160%) rotate(12deg);opacity:0} }
@media (prefers-reduced-motion: reduce){ .feat-circle, .feat-circle * { animation: none !important; } }
`;

const R = 96;
const C = 2 * Math.PI * R;
const NODES = [-90, 30, 150].map((deg) => {
  const a = (deg * Math.PI) / 180;
  return { x: 100 + R * Math.cos(a), y: 100 + R * Math.sin(a) };
});
const spinG = (dur: number, rev = false) => ({ transformBox: "fill-box" as const, transformOrigin: "center", animation: `spin ${dur}s linear infinite${rev ? " reverse" : ""}` });

function FeatureCircle({ icon: Icon, title, sub, tag, idx }: Feature & { idx: number }) {
  const d = -((idx % 5) * 0.55); // stagger so the fleet isn't in lock-step
  return (
    <div className="feat-circle relative shrink-0" style={{ width: "clamp(340px,40vw,500px)", height: "clamp(340px,40vw,500px)", animation: `circ-bob 5.6s ease-in-out ${d}s infinite` }}>
      {/* rotating conic energy field */}
      <div aria-hidden className="absolute inset-[7%] rounded-full" style={{ background: `conic-gradient(from 0deg, transparent, hsl(${ACCENT} / 0.4), transparent 38%, hsl(214 95% 80% / 0.32), transparent 72%)`, filter: "blur(14px)", animation: "spin 9s linear infinite", opacity: 0.7 }} />
      {/* pulsing ambient glow */}
      <div aria-hidden className="absolute inset-4 rounded-full blur-2xl" style={{ background: `radial-gradient(circle, hsl(${ACCENT} / 0.26), transparent 62%)`, animation: `circ-glow 4.6s ease-in-out ${d}s infinite` }} />
      {/* radar pings */}
      <span aria-hidden className="absolute inset-[12%] rounded-full border-2" style={{ borderColor: `hsl(${ACCENT} / 0.55)`, animation: `circ-ping 3.8s ease-out ${d}s infinite` }} />
      <span aria-hidden className="absolute inset-[12%] rounded-full border" style={{ borderColor: `hsl(${ACCENT} / 0.35)`, animation: `circ-ping 3.8s ease-out ${d - 1.9}s infinite` }} />

      {/* HUD rings */}
      <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full">
        <circle cx="100" cy="100" r={R} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
        <g style={spinG(26)}><circle cx="100" cy="100" r="90" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="4" strokeDasharray="1.4 7" /></g>
        <g style={spinG(19, true)}><circle cx="100" cy="100" r="71" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeDasharray="3 5" /></g>
        {/* three rotating energy arcs */}
        <g style={spinG(7)}><circle cx="100" cy="100" r={R} fill="none" stroke={`hsl(${ACCENT})`} strokeWidth="2.6" strokeLinecap="round" strokeDasharray={`${C * 0.3} ${C}`} style={{ filter: `drop-shadow(0 0 5px hsl(${ACCENT}))` }} /></g>
        <g style={spinG(11, true)}><circle cx="100" cy="100" r="84" fill="none" stroke="hsl(214 95% 80%)" strokeWidth="1.6" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 84 * 0.18} ${2 * Math.PI * 84}`} style={{ filter: `drop-shadow(0 0 4px hsl(${ACCENT}))`, opacity: 0.75 }} /></g>
        <g style={spinG(5)}><circle cx="100" cy="100" r="63" fill="none" stroke={`hsl(${ACCENT})`} strokeWidth="1.3" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 63 * 0.12} ${2 * Math.PI * 63}`} style={{ filter: `drop-shadow(0 0 4px hsl(${ACCENT}))`, opacity: 0.6 }} /></g>
        {/* two orbiting dot rings */}
        <g style={spinG(22)}>{NODES.map((p, i) => (<circle key={i} cx={p.x} cy={p.y} r="3" fill={`hsl(${ACCENT})`} style={{ filter: `drop-shadow(0 0 6px hsl(${ACCENT}))` }} />))}</g>
        <g style={spinG(16, true)}>{NODES.map((p, i) => { const a = ((-90 + i * 120 + 60) * Math.PI) / 180; return (<circle key={`b${i}`} cx={100 + 72 * Math.cos(a)} cy={100 + 72 * Math.sin(a)} r="2" fill="hsl(214 95% 82%)" style={{ filter: `drop-shadow(0 0 5px hsl(${ACCENT}))` }} />); })}</g>
      </svg>

      {/* frosted core with a sweeping light sheen */}
      <div aria-hidden className="absolute inset-[14%] overflow-hidden rounded-full bg-[#080a0e]/45 ring-1 ring-white/12 backdrop-blur-md" style={{ boxShadow: "inset 0 0 50px rgba(0,0,0,0.45)" }}>
        <span aria-hidden className="absolute inset-y-0 left-1/2 w-1/3 -translate-x-1/2" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.16), transparent)", animation: `circ-sheen 5.5s ease-in-out ${d}s infinite` }} />
      </div>

      {/* content */}
      <div className="absolute inset-0 grid place-items-center px-14 text-center">
        <div className="flex flex-col items-center gap-3">
          <span className="relative flex h-[68px] w-[68px] items-center justify-center rounded-full ring-1 ring-white/15" style={{ background: `hsl(${ACCENT} / 0.16)` }}>
            <span aria-hidden className="absolute -inset-3 rounded-full blur-md" style={{ background: `radial-gradient(circle, hsl(${ACCENT} / 0.65), transparent 70%)`, animation: `circ-pulse 3.2s ease-in-out ${d}s infinite` }} />
            <Icon className="relative h-8 w-8" style={{ color: `hsl(${ACCENT})` }} strokeWidth={1.6} />
          </span>
          <span className="font-display text-[26px] font-medium leading-tight text-white" style={{ animation: `circ-word 3.6s ease-in-out ${d}s infinite` }}>{title}</span>
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/60">{sub}</span>
          <span className="mt-1 rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-white/85" style={{ background: `hsl(${ACCENT} / 0.16)`, animation: `circ-tag 3.4s ease-in-out ${d}s infinite` }}>{tag}</span>
        </div>
      </div>
    </div>
  );
}

export function HowItWorks() {
  const reduced = useReducedMotion();
  const row = [...FEATURES, ...FEATURES];
  const mask = "linear-gradient(90deg, transparent, #000 5%, #000 95%, transparent)";
  return (
    <section className="relative w-full py-24 sm:py-28">
      <div className="px-5">
        <Head eyebrow="The toolkit" title="One studio. Every craft." sub="Engines, chaining, cast, worlds, fourth-wall, scoring, and your own channel — the whole pipeline, in one place." />
      </div>
      <style>{FEAT_KEYFRAMES}</style>
      <div className="group relative w-full overflow-hidden py-12" style={{ maskImage: mask, WebkitMaskImage: mask }}>
        <div className="flex w-max items-center gap-8 hover:[animation-play-state:paused] sm:gap-14" style={reduced ? undefined : { animation: "feat-marquee 84s linear infinite" }}>
          {row.map((f, i) => <FeatureCircle key={i} idx={i} {...f} />)}
        </div>
      </div>
    </section>
  );
}

// ── Studio (editor + surfaces) ───────────────────────────────────────────────
const SURFACES = [
  { icon: UserSquare2, label: "Cast a character", sub: "461 avatars", img: "/cinema-assets/surface-avatars.jpg" },
  { icon: Globe2, label: "Pick a world", sub: "Cinematic environments", img: "/cinema-assets/surface-environments.jpg" },
  { icon: Film, label: "Your channel", sub: "Publish & share", img: "/cinema-assets/surface-profile.jpg" },
];

function EditorFrame() {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const rx = useSpring(useMotionValue(0), { stiffness: 150, damping: 20 });
  const ry = useSpring(useMotionValue(0), { stiffness: 150, damping: 20 });
  const onMove = (e: React.MouseEvent) => {
    if (reduced || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    ry.set(((e.clientX - r.left) / r.width - 0.5) * 8);
    rx.set(-((e.clientY - r.top) / r.height - 0.5) * 8);
  };
  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={() => { rx.set(0); ry.set(0); }} style={{ perspective: 1300 }}>
      <motion.div style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }}>
        <Glass className="p-2">
          <div className="relative overflow-hidden rounded-xl ring-1 ring-white/10">
            <img src="/cinema-assets/editor-loaded.jpg" alt="A loaded project in the cutting room" className="block w-full" loading="lazy" />
            <span className="absolute left-3 top-3 rounded-full bg-black/45 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-white/75 ring-1 ring-white/15 backdrop-blur-md">◆ Cutting room</span>
          </div>
        </Glass>
      </motion.div>
    </div>
  );
}

export function Studio({ onStart }: { onStart: () => void }) {
  return (
    <section className="relative mx-auto w-full max-w-6xl px-5 py-28 sm:py-32">
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[1.2fr_1fr]">
        <Reveal><EditorFrame /></Reveal>
        <div>
          <Eyebrow>The studio</Eyebrow>
          <h2 className={`mt-3 font-display text-[clamp(2.1rem,4.9vw,3.4rem)] font-semibold leading-tight tracking-[-0.03em] text-white ${SHADOW}`}>A full edit bay — that you <span className="italic">talk</span> to.</h2>
          <p className="mt-5 text-[17px] font-normal leading-relaxed text-white/75 [text-shadow:0_1px_16px_rgba(0,0,0,0.5)] sm:text-[18px]">Direct in plain language, then cut on a real timeline. Reorder shots, restyle, restitch — continuity stays locked, with voice, score, and sound in every cut.</p>
          <div className="mt-7"><Button onClick={onStart} className="px-6 py-3.5 text-[15px]">Open the studio <ArrowRight className="h-4 w-4" /></Button></div>
        </div>
      </div>
      <div className="mt-14 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {SURFACES.map(({ icon: Icon, label, sub, img }, i) => (
          <Reveal key={label} delay={i * 0.08}>
            <Glass hover className="group overflow-hidden">
              <div className="relative aspect-[16/10] overflow-hidden">
                <img src={img} alt={label} className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1.2s] group-hover:scale-105" loading="lazy" />
                <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
              </div>
              <div className="flex items-center gap-2.5 p-3.5">
                <Icon className="h-4 w-4" style={{ color: `hsl(${ACCENT})` }} strokeWidth={1.7} />
                <div><div className="text-[13px] font-medium text-white">{label}</div><div className="text-[11px] font-light text-white/45">{sub}</div></div>
              </div>
            </Glass>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// ── Portal ───────────────────────────────────────────────────────────────────
export function Portal({ onEnter, onStart }: { onEnter: () => void; onStart: () => void }) {
  const reduced = useReducedMotion();
  const spin = (dur: number, dir = 1) => (reduced ? {} : { animate: { rotate: 360 * dir }, transition: { duration: dur, ease: "linear", repeat: Infinity } });
  return (
    <section className="relative mx-auto flex w-full max-w-4xl flex-col items-center px-5 py-28 text-center sm:py-32">
      <Eyebrow>The portal</Eyebrow>
      <h2 className={`mt-3 font-display text-[clamp(2.2rem,5.6vw,3.9rem)] font-semibold tracking-[-0.03em] text-white ${SHADOW}`}>Step onto the lot.</h2>
      <p className="mt-4 max-w-md text-[17px] font-normal text-white/70 sm:text-[18px]">Skip the tour. Walk in and start directing.</p>
      <div className="relative mt-12 flex h-[clamp(260px,42vw,420px)] w-[clamp(260px,42vw,420px)] items-center justify-center">
        <div aria-hidden className="absolute inset-0 rounded-full blur-3xl" style={{ background: `radial-gradient(circle, hsl(${ACCENT} / 0.30), transparent 65%)` }} />
        <motion.div {...spin(44)} className="absolute inset-0 rounded-full border border-white/12" />
        <motion.div {...spin(30, -1)} className="absolute inset-[7%] rounded-full border border-dashed border-white/15" />
        <div className="relative h-[80%] w-[80%] overflow-hidden rounded-full ring-1 ring-white/20" style={{ boxShadow: `0 0 70px -12px hsl(${ACCENT} / 0.6)`, background: `radial-gradient(circle at 50% 32%, hsl(${ACCENT} / 0.34), #0b1018 70%)` }}>
          <video src={AVATAR_VIDEO} className="h-full w-full object-cover" muted loop autoPlay playsInline preload="metadata" onError={(e) => { e.currentTarget.style.display = "none"; }} />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
        </div>
        <button type="button" onClick={onEnter} aria-label="Enter Studio" className="absolute inset-[12%] rounded-full" />
      </div>
      <div className="mt-12 flex items-center justify-center">
        <Button onClick={onStart} className="px-7 py-3.5 text-[15px]">Create an account</Button>
      </div>
    </section>
  );
}

// ── Final CTA ────────────────────────────────────────────────────────────────
export function FinalCTA() {
  return (
    <section className="relative mx-auto w-full max-w-3xl px-5 pb-32 pt-8 text-center">
      <Reveal>
        <Glass className="px-7 py-14 sm:px-14 sm:py-20">
          <h2 className="font-display text-[clamp(2.3rem,6vw,4.2rem)] font-semibold leading-[0.98] tracking-[-0.03em] text-white">Your first <span className="italic">film</span> is one sentence away.</h2>
          <p className="mx-auto mt-5 max-w-lg text-[18px] font-normal text-white/70 sm:text-[19px]">Describe it. We direct, cast, score, and cut it — start to finished film.</p>
          <p className="mt-7 text-[12px] font-light text-white/40">Free to start · No credit card required</p>
        </Glass>
      </Reveal>
    </section>
  );
}
