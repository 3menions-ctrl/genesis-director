/**
 * Admin UI primitives — LIGHT "floating analysis" bible. Soft white surfaces,
 * hairline borders, layered shadows (not glows), color-coded data, Fraunces
 * numerals. Numbers count up; cards lift on hover. Used across every admin page
 * so the whole console shares one premium, modern, spacious language.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, animate, useMotionValue, useInView } from "framer-motion";
import { ArrowUpRight, ArrowDownRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

// Light-tuned, saturated palette — reads crisply on white.
const ACCENT_RAW = "222 89% 55%";
export const ACCENT_HSL = `hsl(${ACCENT_RAW})`;
export const CYAN = "hsl(191 91% 40%)";
export const VIOLET = "hsl(262 83% 58%)";
export const ROSE = "hsl(345 82% 56%)";
export const AMBER = "hsl(33 92% 47%)";
export const EMERALD = "hsl(156 84% 34%)";
export const MAGENTA = "hsl(326 80% 52%)";
export const accent = (a: number) => `hsl(${ACCENT_RAW} / ${a})`;
// neutral ink scale
export const INK = "#0c1426";
export const MUT = "#5d6a82";
export const MUT2 = "#9aa4b8";

/** Animated count-up; plays once when scrolled into view. Falls back for strings. */
export function CountUp({ value, className, style }: { value: number | string; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });
  const mv = useMotionValue(0);
  const [txt, setTxt] = useState("0");
  useEffect(() => {
    if (typeof value !== "number" || !inView) return;
    const controls = animate(mv, value, { duration: 1.1, ease: EASE });
    const unsub = mv.on("change", (v) => setTxt(Math.round(v).toLocaleString()));
    return () => { controls.stop(); unsub(); };
  }, [value, inView, mv]);
  return <span ref={ref} className={className} style={style}>{typeof value === "number" ? txt : value}</span>;
}

/** Self-contained gradient SVG sparkline (no chart dep). */
export function Sparkline({ data, id, w = 84, h = 30 }: { data: number[]; id: string; w?: number; h?: number }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1), min = Math.min(...data, 0), range = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - ((v - min) / range) * (h - 5) - 3] as const);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${w} ${h} L0 ${h} Z`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <defs>
        <linearGradient id={`spk-s-${id}`} x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor={ACCENT_HSL} /><stop offset="100%" stopColor={CYAN} /></linearGradient>
        <linearGradient id={`spk-f-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={ACCENT_HSL} stopOpacity={0.18} /><stop offset="100%" stopColor={ACCENT_HSL} stopOpacity={0} /></linearGradient>
      </defs>
      <path d={area} fill={`url(#spk-f-${id})`} />
      <path d={line} fill="none" stroke={`url(#spk-s-${id})`} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AdminPageHeader({ eyebrow, title, sub, actions }: { eyebrow?: string; title: ReactNode; sub?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <div className="font-mono text-[10px] uppercase tracking-[0.3em]" style={{ color: ACCENT_HSL }}>{eyebrow}</div>}
        <h1 className="mt-2 font-display text-[clamp(1.9rem,3.6vw,2.8rem)] font-semibold leading-[1.03] tracking-[-0.03em]" style={{ color: INK }}>{title}</h1>
        {sub && <p className="mt-2 max-w-xl text-[14px] font-light" style={{ color: MUT }}>{sub}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2.5">{actions}</div>}
    </div>
  );
}

/** Light glass surface — white, hairline border, soft layered shadow. `glow`
 *  tints with the accent; `lift`/`interactive` adds a hover float. */
export function AdminCard({ children, className, glow, lift, interactive, style }: { children: ReactNode; className?: string; glow?: boolean; lift?: boolean; interactive?: boolean; style?: React.CSSProperties }) {
  const hov = lift || interactive;
  return (
    <div
      className={cn(
        "group/card relative overflow-hidden rounded-2xl bg-white",
        "shadow-[0_1px_2px_rgba(16,24,40,.04),0_18px_40px_-18px_rgba(16,24,40,.18)]",
        hov && "transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_4px_10px_rgba(16,24,40,.06),0_30px_56px_-20px_rgba(16,24,40,.26)]",
        className,
      )}
      style={{ ...(glow ? { boxShadow: `0 24px 60px -24px ${accent(0.4)}` } : undefined), ...style }}
    >
      {glow && <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full blur-3xl" style={{ background: `radial-gradient(closest-side, ${accent(0.16)}, transparent 70%)` }} />}
      {children}
    </div>
  );
}

export function KpiTile({ label, value, delta, deltaLabel, icon: Icon, accentNumber, sparkData, index = 0, tone }: {
  label: string; value: string | number; delta?: number; deltaLabel?: string;
  icon?: LucideIcon; accentNumber?: boolean; sparkData?: number[]; index?: number; tone?: string;
}) {
  const up = (delta ?? 0) >= 0;
  const numColor = tone ?? (accentNumber ? ACCENT_HSL : INK);
  return (
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: index * 0.05, ease: EASE }}>
      <AdminCard lift className="p-5">
        <div className="flex items-start justify-between">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em]" style={{ color: MUT2 }}>{label}</div>
          {Icon && (
            <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: accent(0.1), color: ACCENT_HSL }}>
              <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
            </span>
          )}
        </div>
        <CountUp value={value} className="mt-3 block font-display text-[32px] font-semibold leading-none tracking-tight tabular-nums" style={{ color: numColor }} />
        <div className="mt-2.5 flex items-center justify-between gap-2">
          {delta !== undefined ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: up ? EMERALD : ROSE }}>
              {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(delta).toLocaleString()}{deltaLabel ? ` ${deltaLabel}` : ""}
            </span>
          ) : <span className="text-[11px]" style={{ color: MUT2 }}>{deltaLabel ?? ""}</span>}
          {sparkData && <Sparkline data={sparkData} id={`kpi-${index}`} />}
        </div>
      </AdminCard>
    </motion.div>
  );
}

export function ChartCard({ title, meta, children, className }: { title: string; meta?: string; children: ReactNode; className?: string }) {
  return (
    <AdminCard className={cn("p-5", className)}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="h-4 w-1 rounded-full" style={{ background: `linear-gradient(${ACCENT_HSL}, ${CYAN})` }} />
          <span className="font-display text-[16px] font-semibold tracking-tight" style={{ color: INK }}>{title}</span>
        </div>
        {meta && <div className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: MUT2 }}>{meta}</div>}
      </div>
      {children}
    </AdminCard>
  );
}

type Tone = "accent" | "positive" | "warn" | "danger" | "neutral";
const TONES: Record<Tone, { fg: string; bg: string }> = {
  accent:   { fg: ACCENT_HSL, bg: accent(0.1) },
  positive: { fg: EMERALD, bg: "hsl(156 84% 34% / 0.1)" },
  warn:     { fg: AMBER, bg: "hsl(33 92% 47% / 0.12)" },
  danger:   { fg: ROSE, bg: "hsl(345 82% 56% / 0.1)" },
  neutral:  { fg: MUT, bg: "rgba(12,20,38,0.05)" },
};
export function StatusPill({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  const t = TONES[tone];
  return <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em]" style={{ color: t.fg, background: t.bg }}>{children}</span>;
}

export function AttentionCard({ priority, icon: Icon, title, body, ctaLabel, ctaTo, index = 0 }: {
  priority: "high" | "medium" | "low"; icon: LucideIcon; title: string; body: string; ctaLabel: string; ctaTo: string; index?: number;
}) {
  const dot = priority === "high" ? ROSE : priority === "medium" ? AMBER : ACCENT_HSL;
  return (
    <motion.a href={ctaTo} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: index * 0.05, ease: EASE }} className="group block">
      <AdminCard lift className="p-5">
        <div className="flex items-start gap-4">
          <span className="relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: accent(0.1), color: ACCENT_HSL }}>
            <Icon className="h-4 w-4" strokeWidth={1.8} />
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full" style={{ background: dot, boxShadow: `0 0 8px ${dot}` }} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <div className="font-display text-[15.5px] font-semibold leading-tight" style={{ color: INK }}>{title}</div>
              <ArrowUpRight className="h-4 w-4 shrink-0 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5" style={{ color: MUT2 }} />
            </div>
            <p className="mt-1.5 text-[13px] font-light leading-relaxed" style={{ color: MUT }}>{body}</p>
            <span className="mt-3 inline-block font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: ACCENT_HSL }}>{ctaLabel} →</span>
          </div>
        </div>
      </AdminCard>
    </motion.a>
  );
}
