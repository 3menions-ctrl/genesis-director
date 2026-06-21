/**
 * Engines — the "engine room" section, placed just under the hero on the
 * cinema home page. Lists every AI video model the studio can render with,
 * in a brilliant, premium fashion. Specs are bound to the real engine
 * registry (src/lib/video/engines.ts) so this never drifts from production.
 *
 * Transparent like the other cinema sections: it scrolls over the fixed
 * immersive film. Glass cards + single blue accent + restrained motion.
 */
import { useReducedMotion } from "framer-motion";
import {
  Volume2, Sparkles, ImageIcon, Users, Clapperboard, Gauge, ArrowUpRight,
  type LucideIcon,
} from "lucide-react";
import {
  ENGINES, listEngines, type EngineId, type EngineSpec,
} from "@/lib/video/engines";
import { Glass, Eyebrow, Reveal, ACCENT } from "./ui";

const SHADOW = "[text-shadow:0_2px_24px_rgba(0,0,0,0.55)]";

/** The studio / lab behind each model + a one-line poetic descriptor. */
const MAKER: Record<EngineId, { company: string; tagline: string }> = {
  "wan-25":      { company: "Alibaba",         tagline: "Free, fast, and surprisingly cinematic — on every starter grant." },
  "kling-v3":    { company: "Kuaishou",        tagline: "The dependable workhorse. Native audio, reliable every render." },
  "seedance-2":  { company: "ByteDance",       tagline: "Razor-sharp motion and the tightest prompt adherence in its class." },
  "veo-3":       { company: "Google DeepMind", tagline: "Physics that feels real. Sound born inside the shot." },
  "runway-gen4": { company: "Runway",          tagline: "Best-in-class character consistency and directorial control." },
  "sora-2":      { company: "OpenAI",          tagline: "State-of-the-art realism for complex, multi-shot scenes." },
};

/** Display order: free → standard → pro → cinema flagships last. */
const ORDER: EngineId[] = ["wan-25", "kling-v3", "seedance-2", "veo-3", "runway-gen4", "sora-2"];

function capabilities(spec: EngineSpec): { icon: LucideIcon; label: string }[] {
  const caps: { icon: LucideIcon; label: string }[] = [];
  if (spec.supportsAudio) caps.push({ icon: Volume2, label: "Native audio" });
  if (spec.qualityProfiles.some((q) => q.resolution === "4K")) caps.push({ icon: Sparkles, label: "4K upscale" });
  if (spec.supportsAvatar) caps.push({ icon: Users, label: "Avatars" });
  if (spec.supportsImageInput) caps.push({ icon: ImageIcon, label: "Image-to-video" });
  return caps;
}

function EngineCard({ id, idx }: { id: EngineId; idx: number }) {
  const reduced = useReducedMotion();
  const spec = ENGINES[id];
  const maker = MAKER[id];
  const flagship = spec.tier === "cinema";
  const caps = capabilities(spec);
  const is4k = spec.qualityProfiles.some((q) => q.resolution === "4K");
  const numeral = String(idx + 1).padStart(2, "0");

  return (
    <Reveal delay={idx * 0.06} className="h-full">
      <div className="group relative h-full">
        {/* gradient edge-glow — brightens on hover; flagships glow by default */}
        <div
          aria-hidden
          className={`pointer-events-none absolute -inset-px rounded-[20px] transition-opacity duration-500 ${flagship ? "opacity-40 group-hover:opacity-90" : "opacity-0 group-hover:opacity-70"}`}
          style={{
            background: `radial-gradient(120% 120% at 50% 0%, hsl(${ACCENT} / 0.55), transparent 60%)`,
            filter: "blur(14px)",
          }}
        />
        {/* flagship engines get a slow conic energy ring */}
        {flagship && !reduced && (
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-px rounded-[20px] opacity-40 transition-opacity duration-500 group-hover:opacity-80"
            style={{
              background: `conic-gradient(from 0deg, transparent, hsl(${ACCENT} / 0.5), transparent 40%, hsl(214 95% 82% / 0.35), transparent 75%)`,
              filter: "blur(18px)", animation: "engine-halo 14s linear infinite",
            }}
          />
        )}

        <Glass hover className="relative flex h-full flex-col p-7 sm:p-8 transition-transform duration-500 group-hover:-translate-y-1">
          {/* dark inner veil — guarantees depth + legibility over any video frame */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-2xl"
            style={{ background: "linear-gradient(165deg, rgba(8,9,12,0.42) 0%, rgba(8,9,12,0.62) 100%)" }}
          />
          {/* bright accent hairline along the top edge */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-7 top-0 h-px opacity-60 transition-opacity duration-500 group-hover:opacity-100"
            style={{ background: `linear-gradient(90deg, transparent, hsl(${ACCENT} / 0.9), transparent)` }}
          />
          {/* faint index numeral */}
          <span aria-hidden className="pointer-events-none absolute right-6 top-5 font-display text-[2.4rem] font-semibold leading-none text-white/[0.05]">{numeral}</span>

          {/* header */}
          <div className="relative">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: `hsl(${ACCENT})`, boxShadow: `0 0 10px hsl(${ACCENT})` }} />
              <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/50">{maker.company}</span>
            </div>
            <h3 className={`mt-2.5 font-display text-[1.7rem] font-semibold leading-[1.05] tracking-[-0.025em] text-white ${SHADOW}`}>
              {spec.shortLabel}
            </h3>
          </div>

          <p className="relative mt-3.5 text-[14.5px] leading-relaxed text-white/65">{maker.tagline}</p>

          {/* capability chips */}
          <div className="relative mt-6 flex flex-wrap gap-2">
            {caps.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] px-3 py-1.5 text-[11.5px] font-medium text-white/70 ring-1 ring-inset ring-white/[0.08] transition-colors duration-300 group-hover:ring-white/[0.14]"
              >
                <Icon className="h-3.5 w-3.5" style={{ color: `hsl(${ACCENT})` }} aria-hidden />
                {label}
              </span>
            ))}
          </div>

          {/* spec footer */}
          <div className="relative mt-auto flex items-center justify-between pt-7">
            <span className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.06em] text-white/50">
              <Clapperboard className="h-3.5 w-3.5 text-white/35" aria-hidden />
              UP TO {spec.maxDuration}s
            </span>
            <span
              className="rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em]"
              style={
                is4k
                  ? { background: `hsl(${ACCENT} / 0.14)`, color: `hsl(${ACCENT})`, boxShadow: `inset 0 0 0 1px hsl(${ACCENT} / 0.35)` }
                  : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)" }
              }
            >
              {is4k ? "4K Cinema" : "1080p HD"}
            </span>
          </div>
        </Glass>
      </div>
    </Reveal>
  );
}

export function Engines() {
  const count = listEngines().length;
  return (
    <section className="relative z-[3] px-6 py-24 sm:py-28">
      <style>{`
        @keyframes engine-halo { to { transform: rotate(360deg); } }
        @keyframes engine-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @media (prefers-reduced-motion: reduce){ .engine-marquee-track { animation: none !important; } }
      `}</style>

      <div className="mx-auto max-w-6xl">
        {/* heading */}
        <Reveal className="mx-auto mb-4 max-w-2xl text-center">
          <Eyebrow>The engine room</Eyebrow>
          <h2 className={`mt-3 font-display text-[clamp(2.1rem,5.4vw,3.7rem)] font-semibold tracking-[-0.03em] text-white ${SHADOW}`}>
            {count} world-class engines.<br className="hidden sm:block" /> One studio.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[17px] leading-relaxed text-white/70 sm:text-[18px]">
            We don't bet on a single model. Every frontier video engine on earth, in one cutting room —
            pick the look, we route the render.
          </p>
        </Reveal>

        {/* prestige provider marquee */}
        <Reveal delay={0.1} className="relative mx-auto mb-14 max-w-4xl overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24"
            style={{ background: "linear-gradient(90deg,#08090c,transparent)" }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24"
            style={{ background: "linear-gradient(270deg,#08090c,transparent)" }}
          />
          <div className="engine-marquee-track flex w-max items-center gap-10 whitespace-nowrap" style={{ animation: "engine-marquee 26s linear infinite" }}>
            {[0, 1].map((dup) => (
              <div key={dup} className="flex items-center gap-10" aria-hidden={dup === 1}>
                {ORDER.map((id) => (
                  <span key={`${dup}-${id}`} className="inline-flex items-center gap-3">
                    <span className="font-display text-[16px] font-medium tracking-[0.02em] text-white/55">{MAKER[id].company}</span>
                    <span className="h-1 w-1 rounded-full" style={{ background: `hsl(${ACCENT} / 0.6)` }} />
                  </span>
                ))}
              </div>
            ))}
          </div>
        </Reveal>

        {/* engine grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {ORDER.map((id, i) => (
            <EngineCard key={id} id={id} idx={i} />
          ))}
        </div>

        {/* finishing pipeline note */}
        <Reveal delay={0.15} className="mx-auto mt-10 max-w-2xl text-center">
          <p className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 font-mono text-[12px] tracking-[0.04em] text-white/45">
            <Gauge className="h-3.5 w-3.5" style={{ color: `hsl(${ACCENT})` }} aria-hidden />
            Every render finished with Topaz Astra 4K upscaling
            <span className="text-white/25">·</span>
            RIFE 60fps interpolation
            <span className="text-white/25">·</span>
            auto-retake on failed shots
            <ArrowUpRight className="h-3.5 w-3.5 text-white/40" aria-hidden />
          </p>
        </Reveal>
      </div>
    </section>
  );
}
