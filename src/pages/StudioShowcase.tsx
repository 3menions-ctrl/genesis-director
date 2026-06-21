/**
 * StudioShowcase — the "Enter Studio" experience. Not a video tour: an immersive,
 * everything-on-display page —
 *   • a moving wall of finished films
 *   • the 5 video engines (Wan · Kling · Seedance · Veo · Sora)
 *   • a casting wall of real avatars (534 in the studio)
 *   • environments, 4th-wall breaks, the editor + its capabilities
 *   • the creation process, then into the actual studio.
 * Matches the cinema aesthetic (dark, glass, single blue accent, Fraunces).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion, useMotionValue, useSpring, useTransform, useInView, type Variants } from "framer-motion";
import { ArrowRight, ArrowLeft, Cpu, Users, Clapperboard, Mic, Music, GitBranch, Scissors, Download, PenLine, Sparkles, Layers, MonitorPlay, ChevronDown, UserPlus, type LucideIcon } from "lucide-react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAuth } from "@/contexts/AuthContext";
import { FILM_REELS } from "@/data/filmsLibrary";
import { EXTENDED_ENVIRONMENTS } from "@/data/environment-extensions";
import { getAllTemplateBlueprints } from "@/lib/templates/registry";
import { Eyebrow, Reveal, ACCENT, EASE } from "@/components/cinema/ui";
import { BrandTile } from "@/components/cinema/Logo";
import { ImmersiveBreakout } from "@/components/cinema/ImmersiveBreakout";
import { Footer } from "@/components/cinema/Footer";

const KEYFRAMES = `
@keyframes wall-up { from { transform: translateY(0); } to { transform: translateY(-50%); } }
@keyframes wall-down { from { transform: translateY(-50%); } to { transform: translateY(0); } }
@keyframes cast-left { from { transform: translateX(0); } to { transform: translateX(-50%); } }
@keyframes cast-right { from { transform: translateX(-50%); } to { transform: translateX(0); } }
@keyframes hud-scan { 0% { transform: translateY(-120%); } 100% { transform: translateY(820%); } }
@keyframes hud-flicker { 0%,100% { opacity: 0.05; } 50% { opacity: 0.09; } }
/* — background environment animations — */
@keyframes ss-bgdrift { 0% { transform: scale(1.06) translate3d(0,0,0); } 50% { transform: scale(1.13) translate3d(-1.6%,-1.2%,0); } 100% { transform: scale(1.06) translate3d(0,0,0); } }
@keyframes ss-gridpan { from { background-position: 0 0, 0 0; } to { background-position: 64px 64px, 64px 64px; } }
@keyframes ss-vline { 0% { left: -3%; opacity: 0; } 8% { opacity: 1; } 92% { opacity: 1; } 100% { left: 103%; opacity: 0; } }
@keyframes ss-hline { 0% { top: -3%; opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { top: 103%; opacity: 0; } }
@keyframes ss-aurora { 0% { transform: translate(-50%,-50%) scale(1); } 33% { transform: translate(-45%,-55%) scale(1.2); } 66% { transform: translate(-55%,-46%) scale(0.9); } 100% { transform: translate(-50%,-50%) scale(1); } }
@keyframes ss-twinkle { 0%,100% { opacity: 0.25; } 50% { opacity: 0.7; } }
@keyframes ss-rays { 0%,100% { transform: translateX(-50%) rotate(-3.5deg); opacity: 0.55; } 50% { transform: translateX(-50%) rotate(3.5deg); opacity: 1; } }
@keyframes ss-raysB { 0%,100% { transform: translateX(-50%) rotate(2.5deg); opacity: 0.8; } 50% { transform: translateX(-50%) rotate(-2.5deg); opacity: 0.4; } }
@keyframes sb-wordshimmer { 0% { background-position: 135% 0; } 100% { background-position: -135% 0; } }
.sb-wordshimmer { animation: sb-wordshimmer 3.8s ease-in-out 3.7s infinite; }
@media (prefers-reduced-motion: reduce) { .ss-anim, .sb-wordshimmer { animation: none !important; } }
`;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

type Engine = { label: string; provider: string; tagline: string; badge?: string; caps: string[]; dur: string };
const ENGINES: Engine[] = [
  { label: "Wan 2.5", provider: "Alibaba", tagline: "The free-tier workhorse — smooth motion on every starter grant.", badge: "FREE", caps: ["Text → Video", "Image → Video"], dur: "5–10s" },
  { label: "Kling V3", provider: "Kuaishou", tagline: "Cinematic and dependable, with native audio and lip-sync.", caps: ["Lip-sync", "Native audio", "T→V · I→V"], dur: "5–15s" },
  { label: "Seedance 2.0", provider: "ByteDance", tagline: "Razor-sharp, hyperreal motion with the tightest prompt adherence.", badge: "NEW", caps: ["Hyperreal", "Native audio", "T→V · I→V"], dur: "5–12s" },
  { label: "Veo 3 Fast", provider: "Google DeepMind", tagline: "Real-world physics and natural motion with sound born in-shot.", badge: "CINEMA", caps: ["Native audio", "4K", "Physics"], dur: "5–15s" },
  { label: "Runway Gen-4", provider: "Runway", tagline: "Best-in-class character consistency and stylized directorial control.", badge: "CINEMA", caps: ["Character lock", "Stylized", "4K · I→V"], dur: "5–10s" },
  { label: "Sora 2", provider: "OpenAI", tagline: "State-of-the-art realism for complex, narrative multi-shot scenes.", badge: "CINEMA", caps: ["Long shots", "Native audio", "4K"], dur: "5–15s" },
];

// Real avatars from the studio's avatar_templates catalog, pre-resized to local
// ~30KB webp thumbnails (public/cinema-assets/avatars). The source PNGs are 1.2MB
// each and the Supabase transform endpoint aborts under ~50 concurrent requests,
// so serving them same-origin & static is what keeps the casting wall populated.
const avatarThumb = (file: string) => `/cinema-assets/avatars/${file.replace(/-\d+\.png$/, "")}.webp`;
// Full 1024×1024 original (hands intact) — used in the spotlight, which only
// shows one at a time, so the larger fetch is fine. The narrow local webp
// thumbnails crop the sides (cutting the hands), so they stay for dense surfaces only.
const avatarFull = (file: string) => `https://ywcwaumozoejierlfkgj.supabase.co/storage/v1/object/public/avatars/batch-v2/${file}`;
type AvatarType = "Real" | "Animated";
const AVATARS: { name: string; src: string; full: string; type: AvatarType; role: string }[] = ([
  ["Aaliya Patel", "aaliya-patel-front-1778820403959.png", "Real", "Presenter"],
  ["Catrina Kid", "catrina-kid-front-1778821061678.png", "Animated", "Character"],
  ["Emma Laurent", "emma-laurent-front-1769739839656.png", "Real", "Lead"],
  ["Aaliyah Johnson", "aaliyah-johnson-front-1769751379322.png", "Real", "Presenter"],
  ["Barista Crema", "barista-crema-front-1778821030310.png", "Animated", "Mascot"],
  ["Catrina Marigold", "catrina-marigold-front-1778820731388.png", "Animated", "Character"],
  ["Gingerbread Boy", "gingerbread-boy-front-1778820430006.png", "Animated", "Mascot"],
  ["Isla Macdonald", "isla-macdonald-front-1778820369021.png", "Real", "Lead"],
  ["Kenji Yamamoto", "kenji-yamamoto-front-1769739803518.png", "Real", "Lead"],
  ["Alex Thompson", "alex-thompson-front-1769739802579.png", "Real", "Presenter"],
  ["Beast Mantle", "beast-mantle-front-1778820879659.png", "Animated", "Villain"],
  ["Chef Marrow", "chef-marrow-front-1778820926055.png", "Animated", "Character"],
  ["Dash Vector", "dash-vector-front-1778820846630.png", "Animated", "Hero"],
  ["Fatima Al Rashid", "fatima-al-rashid-front-1769739835841.png", "Real", "Lead"],
  ["Groundhog Pal", "groundhog-pal-front-1778820839751.png", "Animated", "Mascot"],
  ["Jack Frost", "jack-frost-front-1778820568875.png", "Animated", "Character"],
  ["Kenzo Nakamura", "kenzo-nakamura-front-1778820394199.png", "Real", "Lead"],
  ["Chief Thunderhawk", "chief-thunderhawk-front-1778820237724.png", "Animated", "Hero"],
  ["David Okonkwo", "david-okonkwo-front-1769739792092.png", "Real", "Presenter"],
  ["Easter Bunny", "easter-bunny-front-1778820544842.png", "Animated", "Mascot"],
  ["Firefighter Ash", "firefighter-ash-front-1778820996294.png", "Animated", "Hero"],
  ["Guardian Angel", "guardian-angel-front-1778820688768.png", "Animated", "Character"],
  ["James Mitchell", "james-mitchell-front-1769739788979.png", "Real", "Lead"],
  ["Kwame Asante", "kwame-asante-front-1778820102495.png", "Real", "Presenter"],
  ["Amara Johnson", "amara-johnson-front-1769739819247.png", "Real", "Lead"],
  ["Calavera Don", "calavera-don-front-1778820738357.png", "Animated", "Villain"],
  ["Chioma Eze", "chioma-eze-front-1778820342115.png", "Real", "Lead"],
  ["Detective Rook", "detective-rook-front-1778820940827.png", "Animated", "Character"],
  ["Eid Crescent", "eid-crescent-front-1778820773078.png", "Animated", "Character"],
] as [string, string, AvatarType, string][]).map(([name, file, type, role]) => ({ name, src: avatarThumb(file), full: avatarFull(file), type, role }));

// Real worlds from the studio's environment catalog (matches /environments).
const ENVIRONMENTS = EXTENDED_ENVIRONMENTS.slice(0, 12);
// Real blueprints from the studio's template registry (matches /templates).
const TEMPLATES = getAllTemplateBlueprints().filter((t) => t.thumbnailUrl).slice(0, 12);

// Featured 4th-wall breakouts — real generations from the staged breakout pipeline.
const FEATURED_BREAKOUTS = [
  { src: "/cinema-assets/breakouts/fb-emma.mp4", label: "Break the feed", sub: "Facebook · solo" },
  { src: "/cinema-assets/breakouts/fb-podcast.mp4", label: "Crash the post", sub: "Facebook · podcast duo" },
  { src: "/cinema-assets/breakouts/fb-detective.mp4", label: "Out of the post", sub: "Facebook · detective" },
];

type Cap = { Icon: LucideIcon; label: string; sub: string };
const EDITOR_CAPS: Cap[] = [
  { Icon: Clapperboard, label: "Real timeline", sub: "Tracks, trims, reorders" },
  { Icon: GitBranch, label: "Continuity lock", sub: "Faces & style across cuts" },
  { Icon: Scissors, label: "Restitch", sub: "Swap a shot, keep the cut" },
  { Icon: Mic, label: "Voice & lip-sync", sub: "Native dialogue" },
  { Icon: Music, label: "Score & sound", sub: "Auto-scored beds" },
  { Icon: Download, label: "Export", sub: "4K, any aspect" },
];

const STEPS = [
  { Icon: PenLine, label: "Describe", sub: "Write the scene in a line." },
  { Icon: Users, label: "Cast", sub: "Pick characters & voices." },
  { Icon: Sparkles, label: "Direct", sub: "Choose engine, world, look." },
  { Icon: Scissors, label: "Cut", sub: "Trim & restitch on the timeline." },
  { Icon: Download, label: "Deliver", sub: "Export a finished film." },
];

// real screenshots of the two surfaces not covered by the galleries above:
// where you build (the studio) and where it lives (your channel).
const APP_SURFACES = [
  { src: "/cinema-assets/editor-loaded.jpg", label: "The Studio", sub: "Build it — timeline, stage & inspector" },
  { src: "/cinema-assets/surface-profile.jpg", label: "Your Channel", sub: "Publish it — your profile & films" },
];

function VideoTile({ film }: { film: { title: string; src: string } }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  return (
    <figure className="group relative overflow-hidden rounded-2xl ring-1 ring-white/10 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)] transition-transform duration-500 hover:-translate-y-1">
      {failed ? (
        <div aria-hidden className="block aspect-video w-full" style={{ background: `linear-gradient(135deg, hsl(${ACCENT} / 0.14), rgba(255,255,255,0.04))` }} />
      ) : (
        <video
          ref={ref}
          src={film.src}
          muted loop autoPlay playsInline preload="auto"
          className="block aspect-video w-full object-cover"
          onLoadedData={() => ref.current?.play().catch(() => {})}
          onError={() => setFailed(true)}
        />
      )}
      {/* top sheen */}
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      {/* title reveal on hover */}
      <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-1 truncate p-3 font-display text-[12.5px] font-medium text-white/90 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">{film.title}</figcaption>
      {/* accent ring + glow on hover */}
      <span aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ boxShadow: `inset 0 0 0 1px hsl(${ACCENT} / 0.6), 0 0 36px -8px hsl(${ACCENT} / 0.55)` }} />
    </figure>
  );
}

function GalleryWall({ reduced, cols }: { reduced: boolean; cols: { title: string; src: string }[][] }) {
  const hideAt = ["", "", "hidden md:flex"];
  return (
    <div aria-hidden className="absolute inset-0 grid grid-cols-2 gap-3 overflow-hidden px-3 md:grid-cols-3">
      {cols.map((col, i) => (
        <div key={i} className={`flex flex-col gap-3 ${hideAt[i] ?? ""}`} style={reduced ? undefined : { animation: `wall-${i % 2 ? "down" : "up"} ${52 + i * 7}s linear infinite` }}>
          {[...col, ...col].map((c, j) => <VideoTile key={j} film={c} />)}
        </div>
      ))}
    </div>
  );
}

/** The page backdrop — a fitting cinematic sound-stage photo, gently drifting,
 *  with a deep tint + soft accent glow for legibility. No lines, no beams, no
 *  grid. Fixed behind the whole page; calms under reduced-motion. */
function PageBackdrop({ reduced }: { reduced: boolean }) {
  return (
    <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden bg-[#04050a]">
      {/* the studio sound-stage image — slow, subtle Ken Burns drift */}
      <img
        src="/cinema-assets/studio-bg.jpg"
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        style={reduced ? { transform: "scale(1.06)" } : { animation: "ss-bgdrift 48s ease-in-out infinite", transformOrigin: "50% 38%" }}
      />
      {/* tint + legibility gradients */}
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(4,5,10,0.55) 0%, rgba(4,5,10,0.32) 38%, rgba(4,5,10,0.82) 100%)" }} />
      <div className="absolute inset-0" style={{ background: `radial-gradient(95% 60% at 50% 120%, hsl(${ACCENT} / 0.18), transparent 60%)` }} />
      {/* soft roaming accent glow (a blob, not a line) */}
      {!reduced && (
        <div
          className="ss-anim absolute left-1/2 top-[44%] h-[56vmax] w-[56vmax] rounded-full"
          style={{ background: `radial-gradient(circle, hsl(${ACCENT} / 0.10), transparent 62%)`, filter: "blur(64px)", animation: "ss-aurora 34s ease-in-out infinite" }}
        />
      )}
    </div>
  );
}

function Section({ eyebrow, title, children, className }: { eyebrow: string; title: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`relative mx-auto w-full max-w-6xl px-5 py-20 sm:py-24 ${className ?? ""}`}>
      <Reveal className="mb-12 text-center">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className="mt-3 font-display text-[clamp(2rem,5.4vw,3.7rem)] font-semibold tracking-[-0.03em] [text-shadow:0_2px_24px_rgba(0,0,0,0.5)]">{title}</h2>
      </Reveal>
      {children}
    </section>
  );
}

/** Game-style engine card — 3D pointer-tilt, accent glow ring, HUD corner brackets. */
const badgeStyle = (b?: string): React.CSSProperties =>
  b === "FREE"
    ? { background: "hsl(150 60% 45% / 0.18)", color: "hsl(150 70% 72%)", boxShadow: "inset 0 0 0 1px hsl(150 60% 50% / 0.4)" }
    : { background: `hsl(${ACCENT} / 0.2)`, color: "#cfe1fb", boxShadow: `inset 0 0 0 1px hsl(${ACCENT} / 0.5)` };

/** Interactive engine showcase — a selector rail + a large featured panel that
 *  auto-cycles (pauses on hover) with shared-layout, animated transitions. */
function EngineShowcase({ reduced }: { reduced: boolean }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (reduced || paused) return;
    const id = setInterval(() => setActive((a) => (a + 1) % ENGINES.length), 3600);
    return () => clearInterval(id);
  }, [reduced, paused]);
  const e = ENGINES[active];

  return (
    <div className="grid gap-5 lg:grid-cols-[0.82fr_1.5fr]" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      {/* selector rail */}
      <div className="flex flex-col gap-2">
        {ENGINES.map((eng, i) => {
          const on = i === active;
          return (
            <button key={eng.label} type="button" onClick={() => setActive(i)}
              className={`group relative flex items-center gap-3 overflow-hidden rounded-xl px-4 py-3 text-left ring-1 ring-inset transition-colors ${on ? "bg-white/[0.07] ring-white/15" : "bg-white/[0.02] ring-white/[0.06] hover:bg-white/[0.05]"}`}>
              {on && <motion.span layoutId="engine-active-bar" className="absolute left-0 top-1/2 h-8 w-[3px] -translate-y-1/2 rounded-full" style={{ background: `hsl(${ACCENT})`, boxShadow: `0 0 12px hsl(${ACCENT})` }} />}
              <span className="w-6 font-mono text-[11px] tabular-nums" style={{ color: on ? `hsl(${ACCENT})` : "rgba(255,255,255,0.3)" }}>{String(i + 1).padStart(2, "0")}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-[15px] font-semibold text-white">{eng.label}</span>
                <span className="block font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">{eng.provider}</span>
              </span>
              {eng.badge && <span className="shrink-0 rounded-full px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.16em]" style={badgeStyle(eng.badge)}>{eng.badge}</span>}
            </button>
          );
        })}
      </div>

      {/* featured panel */}
      <div className="relative min-h-[340px] overflow-hidden rounded-2xl ring-1 ring-inset ring-white/10">
        <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(150deg, rgba(20,26,38,0.6), rgba(7,9,14,0.85))" }} />
        <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full opacity-70" style={{ background: `radial-gradient(circle, hsl(${ACCENT} / 0.4), transparent 65%)`, filter: "blur(40px)" }} />
        {!reduced && <span aria-hidden className="pointer-events-none absolute -left-10 bottom-[-30%] h-72 w-72 rounded-full opacity-50" style={{ background: `radial-gradient(circle, hsl(214 90% 70% / 0.25), transparent 62%)`, filter: "blur(46px)", animation: "ss-aurora 18s ease-in-out infinite" }} />}

        <AnimatePresence mode="wait">
          <motion.div key={e.label} initial={reduced ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={reduced ? undefined : { opacity: 0, y: -12 }} transition={{ duration: 0.4, ease: EASE }} className="relative flex h-full flex-col p-7 sm:p-9">
            <span aria-hidden className="pointer-events-none absolute right-6 top-3 font-display text-[5rem] font-semibold leading-none text-white/[0.05]">{String(active + 1).padStart(2, "0")}</span>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: `hsl(${ACCENT})`, boxShadow: `0 0 10px hsl(${ACCENT})` }} />
              <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/55">{e.provider}</span>
              {e.badge && <span className="rounded-full px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.16em]" style={badgeStyle(e.badge)}>{e.badge}</span>}
            </div>
            <h3 className="mt-3 font-display text-[clamp(2rem,4.4vw,3rem)] font-semibold tracking-[-0.02em] text-white">{e.label}</h3>
            <p className="mt-3 max-w-md text-[15px] leading-relaxed text-white/70">{e.tagline}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {e.caps.map((c) => <span key={c} className="rounded-full bg-white/[0.06] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/70 ring-1 ring-inset ring-white/10">{c}</span>)}
            </div>
            <div className="mt-auto flex items-center gap-2 pt-7 font-mono text-[11px] uppercase tracking-[0.2em]" style={{ color: `hsl(${ACCENT})` }}>
              <Clapperboard className="h-3.5 w-3.5" /> {e.dur} clips
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="absolute bottom-5 right-6 flex gap-1.5">
          {ENGINES.map((_, i) => <span key={i} className="h-1.5 rounded-full transition-all duration-300" style={{ width: i === active ? 18 : 6, background: i === active ? `hsl(${ACCENT})` : "rgba(255,255,255,0.25)" }} />)}
        </div>
      </div>
    </div>
  );
}

const BRAND_CONTAINER: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 2.7 } } };
const BRAND_LETTER: Variants = {
  hidden: { opacity: 0, y: "0.45em", filter: "blur(10px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.85, ease: EASE } },
};

/** The Small Bridges brandmark that DRAWS itself — one big, beautiful arch sweep,
 *  then the keystone ignites. No deck, no lines. Built on the real logo geometry. */
function AnimatedBrandmark() {
  return (
    <motion.svg viewBox="2 4 36 30" fill="none" initial="hidden" animate="show" className="relative w-[clamp(230px,40vw,480px)] text-white" style={{ filter: `drop-shadow(0 0 36px hsl(${ACCENT} / 0.55))` }}>
      <defs>
        <linearGradient id="sb-reveal-arch" x1="5" y1="9" x2="35" y2="31" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#eaf2ff" /><stop offset="0.5" stopColor={`hsl(${ACCENT})`} /><stop offset="1" stopColor={`hsl(${ACCENT})`} />
        </linearGradient>
        <filter id="sb-reveal-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="1.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* the arch draws itself, big and bold */}
      <motion.path d="M5 31 Q20 -14 35 31" stroke="url(#sb-reveal-arch)" strokeWidth="2.6" strokeLinecap="round" filter="url(#sb-reveal-glow)"
        variants={{ hidden: { pathLength: 0, opacity: 0 }, show: { pathLength: 1, opacity: 1, transition: { pathLength: { delay: 0.5, duration: 2.0, ease: EASE }, opacity: { delay: 0.5, duration: 0.3 } } } }} />
      {/* keystone ignites + gleam */}
      <motion.circle cx="20" cy="8.6" r="2.3" fill={`hsl(${ACCENT})`} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 2.4, type: "spring", stiffness: 200, damping: 11 }} style={{ transformOrigin: "20px 8.6px" }} />
      <motion.circle cx="19.2" cy="7.7" r="0.8" fill="#ffffff" fillOpacity="0.95" initial={{ opacity: 0 }} animate={{ opacity: 0.95 }} transition={{ delay: 2.7, duration: 0.4 }} />
    </motion.svg>
  );
}

/** The animated Small Bridges branding — letter-reveal wordmark + glowing tile.
 *  Reused for the page-load intro and the enter-the-studio transition. */
function BrandReveal({ caption }: { caption: string }) {
  return (
    <motion.div className="fixed inset-0 z-[100] grid place-items-center bg-[#05060a]" initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.5 } }}>
      <div aria-hidden className="absolute inset-0" style={{ background: `radial-gradient(50% 42% at 50% 45%, hsl(${ACCENT} / 0.22), transparent 70%)` }} />
      {/* light-ray sweep behind the wordmark */}
      <div aria-hidden className="ss-anim absolute left-1/2 top-[-30%] h-[140%] w-[140%]" style={{ transformOrigin: "50% 0%", filter: "blur(26px)", animation: "ss-rays 8s ease-in-out infinite", background: `conic-gradient(from 180deg at 50% 0%, transparent 0deg, hsl(${ACCENT} / 0.12) 8deg, transparent 18deg, transparent 38deg, hsl(${ACCENT} / 0.08) 50deg, transparent 64deg)` }} />
      <div className="relative flex flex-col items-center px-6 text-center">
        {/* the big, standalone animated logo — no container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.86, filter: "blur(10px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          transition={{ duration: 1.2, ease: EASE }}
          className="relative flex items-center justify-center"
        >
          {/* big soft glow behind the arch */}
          <span aria-hidden className="pointer-events-none absolute -inset-24 rounded-full blur-3xl" style={{ background: `radial-gradient(circle, hsl(${ACCENT} / 0.42), transparent 64%)` }} />
          {/* ignite pulse rings, radiating as the keystone fires */}
          {[0, 1, 2].map((i) => (
            <motion.span key={i} aria-hidden className="pointer-events-none absolute rounded-full" style={{ width: 140, height: 140, border: `2px solid hsl(${ACCENT})` }} initial={{ opacity: 0, scale: 0.35 }} animate={{ opacity: [0, 0.5, 0], scale: 3 }} transition={{ delay: 2.45 + i * 0.32, duration: 1.8, ease: "easeOut" }} />
          ))}
          <AnimatedBrandmark />
        </motion.div>

        {/* the app name — solid white letters reveal in, then an accent shine sweeps across */}
        <div className="relative mt-10">
          <motion.div className="flex font-display text-[clamp(2.8rem,10vw,7rem)] font-semibold leading-none tracking-tight text-white [text-shadow:0_4px_40px_rgba(0,0,0,0.6)]" variants={BRAND_CONTAINER} initial="hidden" animate="show">
            {["Small", "Bridges"].map((w, wi) => (
              <span key={wi} className={wi === 1 ? "italic" : ""}>
                {wi === 1 && <span>&nbsp;</span>}
                {w.split("").map((ch, i) => <motion.span key={i} variants={BRAND_LETTER} className="inline-block">{ch}</motion.span>)}
              </span>
            ))}
          </motion.div>
          {/* shine-sweep overlay — no per-letter transforms, so background-clip:text works */}
          <motion.div aria-hidden initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.2, duration: 0.5 }}
            className="sb-wordshimmer pointer-events-none absolute inset-0 flex font-display text-[clamp(2.8rem,10vw,7rem)] font-semibold leading-none tracking-tight"
            style={{ background: `linear-gradient(100deg, transparent 36%, #ffffff 49%, hsl(${ACCENT}) 50%, #ffffff 51%, transparent 64%)`, backgroundSize: "240% 100%", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
            <span>Small</span><span className="italic">&nbsp;Bridges</span>
          </motion.div>
        </div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3.7, duration: 0.7 }} className="mt-7 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.36em] text-white/45">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: `hsl(${ACCENT})` }} /> {caption}
        </motion.div>
      </div>
    </motion.div>
  );
}

const ROLE_DESC: Record<string, string> = {
  Lead: "A leading face to carry your story, scene after scene.",
  Presenter: "Warm, clear and natural — a presenter built for straight-to-camera.",
  Mascot: "A playful brand mascot with instant, lovable personality.",
  Villain: "Menace on cue — the antagonist your story has been waiting for.",
  Hero: "Bold, heroic and larger than life when the moment calls for it.",
  Character: "Brimming with character and ready to perform any role.",
};

/** Casting spotlight — one GIANT avatar at a time, like the avatar gallery's
 *  focused view. Auto-advances (pauses on hover), with prev/next + dots and a
 *  "build your own" call to action. */
function CastSpotlight({ reduced }: { reduced: boolean }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (reduced || paused) return;
    const id = setInterval(() => setActive((a) => (a + 1) % AVATARS.length), 3600);
    return () => clearInterval(id);
  }, [reduced, paused]);
  const a = AVATARS[active];
  const go = (d: number) => setActive((v) => (v + d + AVATARS.length) % AVATARS.length);
  const navBtn = "flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.05] text-white/70 ring-1 ring-inset ring-white/12 transition-colors hover:bg-white/[0.12] hover:text-white";

  return (
    <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 sm:gap-14 lg:grid-cols-[auto_1fr]"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      {/* the giant avatar — whole figure, no crop (thumbnails are 360×1024) */}
      <div className="relative mx-auto">
        <div aria-hidden className="pointer-events-none absolute -inset-8 rounded-full opacity-70" style={{ background: `radial-gradient(circle, hsl(${ACCENT} / 0.22), transparent 65%)`, filter: "blur(60px)" }} />
        <AnimatePresence mode="wait">
          <motion.figure key={a.src} initial={reduced ? false : { opacity: 0, scale: 0.96, filter: "blur(6px)" }} animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }} exit={reduced ? undefined : { opacity: 0, scale: 1.02 }} transition={{ duration: 0.5, ease: EASE }}
            className="relative overflow-hidden rounded-[26px] border border-white/[0.09] bg-gradient-to-br from-white/[0.06] via-white/[0.02] to-white/[0.01] p-3 backdrop-blur-2xl shadow-[0_50px_120px_-30px_rgba(4,6,12,0.9)]">
            <div className="relative aspect-square w-[clamp(320px,44vw,540px)] overflow-hidden rounded-[18px] ring-1 ring-inset ring-white/[0.06]" style={{ background: "radial-gradient(82% 72% at 50% 30%, #131c30 0%, #0b1222 55%, #070a14 100%)" }}>
              {/* full 1024×1024 original — both hands intact, fills the square edge-to-edge */}
              <img src={a.full} alt={a.name} className="absolute inset-0 h-full w-full object-cover" />
              <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
              <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-[hsl(220_30%_4%/0.6)] to-transparent" />
            </div>
          </motion.figure>
        </AnimatePresence>
      </div>

      {/* info + controls */}
      <div className="text-center lg:text-left">
        <AnimatePresence mode="wait">
          <motion.div key={a.name} initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={reduced ? undefined : { opacity: 0, y: -8 }} transition={{ duration: 0.4, ease: EASE }}>
            <div className="flex items-center justify-center gap-2.5 font-mono text-[10px] uppercase tracking-[0.28em] lg:justify-start">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: `hsl(${ACCENT})`, boxShadow: `0 0 8px hsl(${ACCENT})` }} />
              <span style={{ color: `hsl(${ACCENT})` }}>{a.role}</span>
            </div>
            <h3 className="mt-3 font-display text-[clamp(2.4rem,5.4vw,3.8rem)] font-semibold italic leading-[1.02] tracking-[-0.02em] text-white">{a.name}</h3>
            <p className="mx-auto mt-4 max-w-md text-[16px] leading-relaxed text-white/65 lg:mx-0">{ROLE_DESC[a.role] ?? "Ready to perform."}</p>
          </motion.div>
        </AnimatePresence>

        <div className="mt-8 flex items-center justify-center gap-4 lg:justify-start">
          <button type="button" onClick={() => go(-1)} aria-label="Previous avatar" className={navBtn}><ArrowLeft className="h-4 w-4" /></button>
          <span className="font-mono text-[12px] tabular-nums text-white/50">{String(active + 1).padStart(2, "0")} <span className="text-white/25">/ {AVATARS.length}</span></span>
          <button type="button" onClick={() => go(1)} aria-label="Next avatar" className={navBtn}><ArrowRight className="h-4 w-4" /></button>
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-1.5 lg:justify-start">
          {AVATARS.map((_, i) => <button key={i} type="button" onClick={() => setActive(i)} aria-label={`Avatar ${i + 1}`} className="h-1.5 rounded-full transition-all duration-300" style={{ width: i === active ? 16 : 6, background: i === active ? `hsl(${ACCENT})` : "rgba(255,255,255,0.25)" }} />)}
        </div>

        <p className="mt-8 inline-flex items-center gap-2.5 text-[14px] text-white/55">
          <UserPlus className="h-4 w-4" style={{ color: `hsl(${ACCENT})` }} /> Or build your own avatar.
        </p>
      </div>
    </div>
  );
}

export default function StudioShowcase() {
  usePageMeta({ title: "Inside the Studio — Small Bridges" });
  const navigate = useNavigate();
  const reduced = useReducedMotion() ?? false;
  const { profile } = useAuth();
  const firstName = (profile?.display_name || "").trim().split(/\s+/)[0] || "";
  const [entering, setEntering] = useState(false);
  // branding intro plays once on load (skipped under reduced-motion)
  const [intro, setIntro] = useState(!reduced);
  useEffect(() => {
    if (reduced) return;
    const t = window.setTimeout(() => setIntro(false), 5400);
    return () => window.clearTimeout(t);
  }, [reduced]);
  const enterStudio = () => {
    if (entering) return;
    if (reduced) { navigate("/studio"); return; }
    setEntering(true);
    window.setTimeout(() => navigate("/studio"), 4700);
  };
  // The wall: every visible tile is a DIFFERENT film — no repeats on screen.
  // 3 columns × 4 unique = 12 distinct clips, reshuffled from the 58-film
  // library on every visit. Each column is 4 tall tiles (then duplicated for a
  // seamless loop) — taller than the viewport, so the loop copy stays off-screen
  // and no film is shown twice at once. Kept modest so dozens of autoplaying
  // videos don't choke the page.
  const wallCols = useMemo(() => {
    const NCOL = 3, PER = 4;
    const reels = shuffle(FILM_REELS).slice(0, NCOL * PER);
    return Array.from({ length: NCOL }, (_, ci) => reels.slice(ci * PER, (ci + 1) * PER));
  }, []);
  // When the featured breakouts scroll into view, Detective Rook takes over the
  // whole page as an immersive (blinded) background — tour-page only.
  const breakoutRef = useRef<HTMLDivElement>(null);
  const breakoutInView = useInView(breakoutRef, { amount: 0.35 });
  const detectiveTileRef = useRef<HTMLVideoElement>(null);
  const tileVideos = useRef<(HTMLVideoElement | null)[]>([]);
  const breakoutsPlayed = useRef(false);
  // 4th-wall tour videos play ONCE then pause (no loop) — started on scroll-in.
  useEffect(() => {
    if (!breakoutInView || breakoutsPlayed.current) return;
    breakoutsPlayed.current = true;
    tileVideos.current.forEach((v) => { if (v) { try { v.currentTime = 0; v.play().catch(() => {}); } catch { /* noop */ } } });
  }, [breakoutInView]);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-transparent text-white antialiased">
      <style>{KEYFRAMES}</style>
      <PageBackdrop reduced={reduced} />
      <ImmersiveBreakout active={breakoutInView && !intro} reduced={reduced} tileRef={detectiveTileRef} />

      <header className="fixed inset-x-0 top-0 z-50 flex items-center justify-between border-b border-white/[0.06] bg-[#070809]/40 px-5 py-3 backdrop-blur-xl sm:px-8">
        <button type="button" onClick={() => navigate("/")} aria-label="Small Bridges home" className="flex items-center gap-2.5">
          <BrandTile className="h-8 w-8" />
          <span className="hidden font-display text-[16px] tracking-tight sm:inline">Small <span className="font-semibold italic">Bridges</span></span>
        </button>
        <div className="flex items-center gap-2 sm:gap-3">
          <button type="button" onClick={() => navigate("/auth")} className="px-3.5 py-2 text-[13px] font-light text-white/70 transition-colors hover:text-white">Sign in</button>
          <button type="button" onClick={() => navigate("/auth?mode=signup")} className="rounded-full bg-white px-5 py-2 text-[13px] font-semibold text-[#0a0b0e] transition-transform hover:-translate-y-0.5" style={{ boxShadow: `0 10px 30px -12px hsl(${ACCENT})` }}>Start now</button>
        </div>
      </header>

      {/* HERO — a warm welcome over the moving wall of films */}
      <section className="relative flex h-screen items-center justify-center overflow-hidden">
        {/* Hold the film wall until the intro finishes — loading two dozen
            videos behind the overlay was stealing the main thread and making
            the entry animation stutter. */}
        {!intro && <GalleryWall reduced={reduced} cols={wallCols} />}
        {/* lighter vignette so more of the wall shows through */}
        <div aria-hidden className="absolute inset-0" style={{ background: "radial-gradient(70% 70% at 50% 50%, rgba(6,7,11,0.62), rgba(6,7,11,0.34))" }} />
        <div aria-hidden className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-[#05060a] to-transparent" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[#05060a] to-transparent" />
        {/* localized darkening + glow behind the welcome, so the text reads */}
        <div aria-hidden className="absolute left-1/2 top-1/2 h-[64vh] w-[88vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: `radial-gradient(closest-side, rgba(5,6,11,0.9), rgba(5,6,11,0.5) 58%, transparent), radial-gradient(closest-side, hsl(${ACCENT} / 0.14), transparent 70%)`, filter: "blur(12px)" }} />

        <motion.div initial={reduced ? { opacity: 1 } : { opacity: 0, y: 26, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: 1.1, ease: EASE }} className="relative z-10 flex flex-col items-center px-6 text-center">
          {/* welcome chip */}
          <div className="mb-7 inline-flex items-center gap-2.5 rounded-full bg-white/[0.06] px-4 py-2 ring-1 ring-inset ring-white/12 backdrop-blur-md">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: `hsl(${ACCENT})`, boxShadow: `0 0 8px hsl(${ACCENT})` }} />
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/70">Welcome to Small Bridges</span>
          </div>
          <h1 className="font-display text-[clamp(2.7rem,8.6vw,6.4rem)] font-semibold leading-[0.95] tracking-[-0.03em] [text-shadow:0_6px_60px_rgba(0,0,0,0.9)]">
            {firstName
              ? <>Welcome, <span className="italic">{firstName}</span>.</>
              : <>Welcome to the <span className="italic">studio</span>.</>}
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-[18px] font-normal leading-relaxed text-white/85 [text-shadow:0_2px_18px_rgba(0,0,0,0.95)] sm:text-[20px]">
            Every film on these walls was written, cast, shot, scored and cut right here — no crew, no camera. Take your time and look around.
          </p>
          {/* scroll cue */}
          {!reduced && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8, duration: 0.8 }} className="mt-12 flex flex-col items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-white/50">
              Scroll to explore
              <motion.span animate={{ y: [0, 6, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}><ChevronDown className="h-4 w-4" style={{ color: `hsl(${ACCENT})` }} /></motion.span>
            </motion.div>
          )}
        </motion.div>
      </section>

      {/* ENGINES */}
      <Section eyebrow="The engine room" title={<>Six engines. <span className="italic">One</span> studio.</>}>
        <EngineShowcase reduced={reduced} />
      </Section>

      {/* AVATARS — casting wall */}
      <section className="w-full py-20 sm:py-24">
        <Reveal className="mb-10 px-5 text-center">
          <Eyebrow>The cast</Eyebrow>
          <h2 className="mt-3 font-display text-[clamp(2rem,5.4vw,3.7rem)] font-semibold tracking-[-0.03em]">Cast in a <span className="italic">click</span>.</h2>
          <p className="mx-auto mt-4 max-w-xl text-[16px] font-light text-white/60">Heroes, villains, mascots, presenters — pick a face, give it a voice, and it acts.</p>
        </Reveal>
        <CastSpotlight reduced={reduced} />
      </section>

      {/* ENVIRONMENTS — real worlds from the studio's environment catalog */}
      <Section eyebrow="The worlds" title={<>120 <span className="italic">worlds</span> to shoot in.</>}>
        <Reveal className="-mt-8 mb-10 text-center">
          <p className="mx-auto max-w-xl text-[16px] font-light text-white/60">Hand-graded environments — golden hour, neon nights, deep space, ancient ruins. Pick a world and your scene inherits its light and mood.</p>
        </Reveal>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {ENVIRONMENTS.map((e, i) => (
            <Reveal key={e.id} delay={(i % 3) * 0.06}>
              <div className="group relative overflow-hidden rounded-xl ring-1 ring-white/10">
                <img src={e.image} alt={e.name} className="aspect-video w-full object-cover transition-transform duration-[1.4s] group-hover:scale-105" loading="lazy" />
                <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                <span aria-hidden className="pointer-events-none absolute -inset-px rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ boxShadow: `inset 0 0 0 1px hsl(${ACCENT} / 0.55)` }} />
                <div className="absolute inset-x-0 bottom-0 p-3.5">
                  <div className="font-mono text-[8.5px] uppercase tracking-[0.22em] text-white/45">{e.category}</div>
                  <div className="mt-0.5 font-display text-[15px] font-semibold leading-tight">{e.name}</div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* TEMPLATES — real blueprints from the studio's template registry */}
      <Section eyebrow="The blueprints" title={<>Start from a <span className="italic">template</span>.</>}>
        <Reveal className="-mt-8 mb-10 flex items-center justify-center gap-2 text-center">
          <Layers className="h-4 w-4" style={{ color: `hsl(${ACCENT})` }} />
          <p className="max-w-xl text-[16px] font-light text-white/60">50 ready-to-shoot blueprints — viral hooks, cinematic stories, 4th-wall breakouts — each carrying its own engine, look, pacing and sound.</p>
        </Reveal>
        {/* Featured live 4th-wall breakouts — real generations */}
        <Reveal className="mb-12">
          <div ref={breakoutRef} className="mx-auto grid max-w-2xl grid-cols-3 gap-4">
            {FEATURED_BREAKOUTS.map((v, i) => (
              <div key={v.src} className="group relative overflow-hidden rounded-2xl ring-1 ring-white/12 shadow-[0_40px_120px_-50px_rgba(0,0,0,0.95)]">
                <video
                  ref={(el) => { tileVideos.current[i] = el; if (v.src.includes("fb-detective")) detectiveTileRef.current = el; }}
                  src={v.src} muted playsInline preload="auto"
                  className="aspect-[9/16] w-full object-cover"
                />
                <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/15" />
                <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.14em] text-white/85 ring-1 ring-white/15 backdrop-blur">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: `hsl(${ACCENT})` }} />4th-wall breakout
                </span>
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <div className="font-display text-[13px] font-semibold leading-tight">{v.label}</div>
                  <div className="font-mono text-[8px] uppercase tracking-[0.18em] text-white/50">{v.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {TEMPLATES.map((t, i) => (
            <Reveal key={t.id} delay={(i % 4) * 0.05}>
              <div className="group relative overflow-hidden rounded-xl ring-1 ring-white/10">
                <img src={t.thumbnailUrl} alt={t.name} className="aspect-[4/5] w-full object-cover transition-transform duration-[1.4s] group-hover:scale-105" loading="lazy" />
                <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />
                <span aria-hidden className="pointer-events-none absolute -inset-px rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ boxShadow: `inset 0 0 0 1px hsl(${ACCENT} / 0.55)` }} />
                {t.engine && <span className="absolute right-2 top-2 rounded-full bg-black/55 px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.12em] text-white/85 ring-1 ring-white/15 backdrop-blur">{t.engine}</span>}
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-white/45">{t.category}</div>
                  <div className="mt-0.5 font-display text-[14px] font-semibold leading-tight">{t.name}</div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* THE STUDIO — the real editor, shown as a labelled product sample */}
      <Section eyebrow="The studio" title={<>This is the <span className="italic">studio</span>.</>}>
        <Reveal className="-mt-8 mb-10 text-center">
          <p className="mx-auto max-w-xl text-[16px] font-light text-white/60">A real timeline, stage and inspector — where your shots become a film. Trim, restitch, voice, score and export, all in one place.</p>
        </Reveal>
        <Reveal>
          <div className="relative overflow-hidden rounded-2xl ring-1 ring-white/12 shadow-[0_60px_150px_-40px_rgba(0,0,0,0.95)]">
            {/* window chrome so it reads unmistakably as the live app */}
            <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.045] px-4 py-2.5">
              <span aria-hidden className="flex gap-1.5">
                <i className="h-2.5 w-2.5 rounded-full bg-white/20" />
                <i className="h-2.5 w-2.5 rounded-full bg-white/20" />
                <i className="h-2.5 w-2.5 rounded-full bg-white/20" />
              </span>
              <span className="ml-2 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-white/55">
                <MonitorPlay className="h-3.5 w-3.5" style={{ color: `hsl(${ACCENT})` }} /> Small Bridges · Studio
              </span>
            </div>
            <img src="/cinema-assets/editor-loaded.jpg" alt="The Small Bridges studio — timeline, stage and inspector" className="block w-full" loading="lazy" />
          </div>
        </Reveal>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {EDITOR_CAPS.map((c, i) => (
            <Reveal key={c.label} delay={i * 0.05}>
              <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-white/12" style={{ background: `hsl(${ACCENT} / 0.14)` }}>
                  <c.Icon className="h-4 w-4" style={{ color: `hsl(${ACCENT})` }} strokeWidth={1.7} />
                </span>
                <div><div className="text-[14px] font-medium text-white">{c.label}</div><div className="text-[12px] font-light text-white/55">{c.sub}</div></div>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* CREATION PROCESS */}
      <Section eyebrow="How it's made" title={<>Sentence to screen, in <span className="italic">five</span>.</>}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {STEPS.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.07}>
              <div className="relative h-full rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full ring-1 ring-white/15" style={{ background: `hsl(${ACCENT} / 0.16)` }}>
                  <s.Icon className="h-5 w-5" style={{ color: `hsl(${ACCENT})` }} strokeWidth={1.7} />
                </span>
                <div className="mt-3 font-mono text-[10px] tracking-[0.2em] text-white/35">0{i + 1}</div>
                <div className="mt-1 font-display text-[18px] font-semibold">{s.label}</div>
                <div className="mt-1 text-[12.5px] font-light leading-snug text-white/55">{s.sub}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* BUILD & PUBLISH — the studio and your channel */}
      <Section eyebrow="End to end" title={<>Build it. <span className="italic">Publish</span> it.</>}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {APP_SURFACES.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.08}>
              <div className="group relative overflow-hidden rounded-xl ring-1 ring-white/10">
                <img src={s.src} alt={s.label} className="aspect-[16/10] w-full object-cover object-top transition-transform duration-[1.4s] group-hover:scale-105" loading="lazy" />
                <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/5 to-transparent" />
                <span aria-hidden className="pointer-events-none absolute -inset-px rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ boxShadow: `inset 0 0 0 1px hsl(${ACCENT} / 0.55)` }} />
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <div className="font-display text-[17px] font-semibold">{s.label}</div>
                  <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-white/50">{s.sub}</div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* CTA — giant Enter Studio */}
      <section className="px-5 pb-36 pt-24 text-center">
        <h2 className="font-display text-[clamp(2.1rem,5.8vw,3.9rem)] font-semibold leading-[0.98] tracking-[-0.03em]">Your turn to <span className="italic">direct</span>.</h2>
        <p className="mx-auto mt-5 max-w-md text-[17px] font-normal text-white/65">Describe a scene in a sentence — the studio casts, scores and cuts it.</p>
        <div className="mt-12 flex justify-center">
          <motion.button
            type="button"
            onClick={() => navigate("/auth?mode=signup")}
            whileHover={reduced ? undefined : { scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            className="group relative inline-flex items-center gap-3.5 rounded-full bg-white px-14 py-7 font-display text-[clamp(1.3rem,3.2vw,1.9rem)] font-semibold text-[#0a0b0e]"
            style={{ boxShadow: `0 0 110px -4px hsl(${ACCENT}), 0 0 46px -8px hsl(${ACCENT})` }}
          >
            Start now <ArrowRight className="h-7 w-7 transition-transform duration-300 group-hover:translate-x-1.5" />
          </motion.button>
        </div>
      </section>

      <Footer />

      <AnimatePresence>{intro && <BrandReveal caption="Inside the studio" />}</AnimatePresence>
      <AnimatePresence>{entering && <BrandReveal caption="Entering the studio" />}</AnimatePresence>
    </div>
  );
}
