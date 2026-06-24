/**
 * Admin premium UI primitives — borderless, glassy, alive. Single-accent chrome
 * with richer cool-gradient accents for data/analytics. Surfaces read via
 * gradient glass fills + soft shadow + a 1px top specular highlight + accent
 * glow; numbers count up; tiles lift and glow on hover. No ring outlines.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, animate, useMotionValue, useInView } from "framer-motion";
import { ArrowUpRight, ArrowDownRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACCENT, EASE } from "@/components/cinema/ui";

// Cohesive cool palette — accent blue + neighbours for gradient depth in viz.
export const ACCENT_HSL = `hsl(${ACCENT})`;
export const CYAN = "hsl(188 92% 58%)";
export const VIOLET = "hsl(256 88% 72%)";
export const ROSE = "hsl(350 90% 70%)";
export const AMBER = "hsl(38 96% 62%)";
export const accent = (a: number) => `hsl(${ACCENT} / ${a})`;

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
        <linearGradient id={`spk-f-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={ACCENT_HSL} stopOpacity={0.35} /><stop offset="100%" stopColor={ACCENT_HSL} stopOpacity={0} /></linearGradient>
      </defs>
      <path d={area} fill={`url(#spk-f-${id})`} />
      <path d={line} fill="none" stroke={`url(#spk-s-${id})`} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 4px ${accent(0.6)})` }} />
    </svg>
  );
}

export function AdminPageHeader({ eyebrow, title, sub, actions }: { eyebrow?: string; title: ReactNode; sub?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <div className="font-mono text-[10px] uppercase tracking-[0.3em]" style={{ color: ACCENT_HSL }}>{eyebrow}</div>}
        <h1 className="mt-2 font-display text-[clamp(1.9rem,3.6vw,2.8rem)] font-semibold leading-[1.03] tracking-[-0.03em] text-white">{title}</h1>
        {sub && <p className="mt-2 max-w-xl text-[14px] font-light text-white/55">{sub}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2.5">{actions}</div>}
    </div>
  );
}

const CARD_BG = "linear-gradient(165deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02) 60%, rgba(255,255,255,0.015))";

/** Borderless gradient-glass surface. `glow` = accent emphasis; `lift` = hover. */
export function AdminCard({ children, className, glow, lift, style }: { children: ReactNode; className?: string; glow?: boolean; lift?: boolean; style?: React.CSSProperties }) {
  return (
    <div
      className={cn(
        "group/card relative overflow-hidden rounded-2xl backdrop-blur-xl",
        "shadow-[0_30px_90px_-50px_rgba(0,0,0,0.95)]",
        lift && "transition-all duration-300 hover:-translate-y-0.5",
        className,
      )}
      style={{ background: CARD_BG, ...(glow ? { boxShadow: `0 40px 120px -50px ${accent(0.5)}` } : undefined), ...style }}
    >
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)" }} />
      {/* corner accent bloom */}
      <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover/card:opacity-100" style={{ background: `radial-gradient(closest-side, ${accent(0.25)}, transparent 70%)` }} />
      {lift && <span aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover/card:opacity-100" style={{ boxShadow: `0 0 0 1px ${accent(0.35)}` }} />}
      {children}
    </div>
  );
}

export function KpiTile({ label, value, delta, deltaLabel, icon: Icon, accentNumber, sparkData, index = 0 }: {
  label: string; value: string | number; delta?: number; deltaLabel?: string;
  icon?: LucideIcon; accentNumber?: boolean; sparkData?: number[]; index?: number;
}) {
  const up = (delta ?? 0) >= 0;
  return (
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: index * 0.05, ease: EASE }}>
      <AdminCard lift className="p-5">
        <div className="flex items-start justify-between">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">{label}</div>
          {Icon && (
            <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `linear-gradient(135deg, ${accent(0.22)}, ${accent(0.08)})`, color: ACCENT_HSL }}>
              <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
            </span>
          )}
        </div>
        <CountUp value={value} className="mt-3 block font-display text-[32px] font-semibold leading-none tracking-tight tabular-nums" style={{ color: accentNumber ? ACCENT_HSL : "#fff", textShadow: accentNumber ? `0 0 26px ${accent(0.6)}` : undefined }} />
        <div className="mt-2.5 flex items-center justify-between gap-2">
          {delta !== undefined ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: up ? CYAN : "rgba(255,255,255,0.5)" }}>
              {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(delta).toLocaleString()}{deltaLabel ? ` ${deltaLabel}` : ""}
            </span>
          ) : <span className="text-[11px] text-white/35">{deltaLabel ?? ""}</span>}
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
          <span className="font-display text-[16px] font-semibold tracking-tight text-white">{title}</span>
        </div>
        {meta && <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">{meta}</div>}
      </div>
      {children}
    </AdminCard>
  );
}

type Tone = "accent" | "positive" | "warn" | "danger" | "neutral";
const TONES: Record<Tone, { fg: string; bg: string }> = {
  accent:   { fg: ACCENT_HSL, bg: accent(0.14) },
  positive: { fg: CYAN, bg: "hsl(188 92% 58% / 0.12)" },
  warn:     { fg: AMBER, bg: "hsl(38 96% 62% / 0.12)" },
  danger:   { fg: ROSE, bg: "hsl(350 90% 70% / 0.12)" },
  neutral:  { fg: "rgba(255,255,255,0.6)", bg: "rgba(255,255,255,0.06)" },
};
export function StatusPill({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  const t = TONES[tone];
  return <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[9.5px] font-medium uppercase tracking-[0.16em]" style={{ color: t.fg, background: t.bg }}>{children}</span>;
}

// ─────────────────────────────────────────────────────────────────────────
//  FLOATING layer — "Direction A · Command Deck".
//  Completely borderless: no card surfaces. Figures and numbers float on the
//  page; lists are separated only by a thin hairline below each row; spacious.
//  These are the canonical primitives for the admin landing decks.
// ─────────────────────────────────────────────────────────────────────────

const HAIR = "rgba(255,255,255,0.07)";
const HAIR_SOFT = "rgba(255,255,255,0.05)";

/** A figure that floats on the page — big Fraunces number, mono label, no box. */
export function FloatStat({ label, value, delta, deltaLabel, icon: Icon, accentNumber, sub, index = 0 }: {
  label: string; value: string | number; delta?: number; deltaLabel?: string;
  icon?: LucideIcon; accentNumber?: boolean; sub?: string; index?: number;
}) {
  const up = (delta ?? 0) >= 0;
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: index * 0.05, ease: EASE }}>
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-3.5 w-3.5" strokeWidth={1.8} style={{ color: accent(0.85) }} />}
        <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/45">{label}</span>
      </div>
      <CountUp
        value={value}
        className="mt-3.5 block font-display font-semibold leading-[0.95] tracking-tight tabular-nums"
        style={{ fontSize: "clamp(2rem, 2.7vw, 3rem)", color: accentNumber ? ACCENT_HSL : "#fff", textShadow: accentNumber ? `0 0 32px ${accent(0.55)}` : undefined }}
      />
      {(delta !== undefined || sub) && (
        <div className="mt-3 flex items-center gap-2 text-[11px]">
          {delta !== undefined ? (
            <span className="inline-flex items-center gap-1 font-medium" style={{ color: up ? CYAN : "rgba(255,255,255,0.5)" }}>
              {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(delta).toLocaleString()}{deltaLabel ? ` ${deltaLabel}` : ""}
            </span>
          ) : <span className="text-white/35">{sub}</span>}
        </div>
      )}
    </motion.div>
  );
}

/** Section heading for a floating block (chart / list) — accent tick + Fraunces. */
export function FloatSection({ title, meta, actions, children, className }: {
  title: ReactNode; meta?: string; actions?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={className}>
      <div className="mb-5 flex items-end justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="h-4 w-1 rounded-full" style={{ background: `linear-gradient(${ACCENT_HSL}, ${CYAN})` }} />
          <h2 className="font-display text-[17px] font-semibold tracking-tight text-white">{title}</h2>
          {meta && <span className="ml-1 font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">{meta}</span>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

export interface FloatColumn {
  key: string;
  label: string;
  align?: "left" | "right";
  /** Optional fixed/auto width hint, e.g. "1px" to shrink, or a class. */
  className?: string;
}

/** Borderless data table — no surface, just a thin hairline below each row. */
export function FloatTable({ columns, rows, empty = "Nothing here yet." }: {
  columns: FloatColumn[];
  rows: Array<Record<string, ReactNode> & { _key?: string | number }>;
  empty?: ReactNode;
}) {
  if (rows.length === 0) {
    return <div className="py-12 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-white/30">{empty}</div>;
  }
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.key} style={{ borderBottom: `1px solid ${HAIR}` }}
              className={cn("pb-3 font-mono text-[9.5px] font-medium uppercase tracking-[0.2em] text-white/38", c.align === "right" ? "text-right" : "text-left", c.className)}>
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r._key ?? i} className="transition-colors hover:bg-white/[0.015]">
            {columns.map((c) => (
              <td key={c.key} style={{ borderBottom: `1px solid ${HAIR_SOFT}` }}
                className={cn("py-3.5 text-[13px] text-white/80", c.align === "right" ? "text-right tabular-nums" : "text-left", c.className)}>
                {r[c.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Compact floating list row — label left, value right, thin hairline below. */
export function FloatRow({ left, right, onClick, last }: { left: ReactNode; right?: ReactNode; onClick?: () => void; last?: boolean }) {
  return (
    <div
      onClick={onClick}
      style={{ borderBottom: last ? undefined : `1px solid ${HAIR_SOFT}` }}
      className={cn("flex items-center justify-between gap-3 py-3.5", onClick && "cursor-pointer transition-colors hover:bg-white/[0.015]")}
    >
      <div className="min-w-0">{left}</div>
      {right !== undefined && <div className="shrink-0 text-right">{right}</div>}
    </div>
  );
}

/** Round monogram avatar (matches the sidebar operator chip). */
export function Avatar({ name, size = 26 }: { name: string; size?: number }) {
  const initials = name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.42, background: `linear-gradient(135deg, ${accent(0.4)}, ${accent(0.08)})` }}>
      {initials || "?"}
    </span>
  );
}

/** Pill-style header action button (floating, borderless). */
export function DeckButton({ children, onClick, primary, accent: isAccent, disabled }: {
  children: ReactNode; onClick?: () => void; primary?: boolean; accent?: boolean; disabled?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-4 py-2 font-mono text-[10px] uppercase tracking-[0.22em] transition-colors disabled:opacity-40",
        primary ? "bg-white text-[#06070a] hover:bg-white/90"
        : isAccent ? "text-[hsl(214_90%_62%)] hover:bg-[hsl(214_90%_62%/0.16)]"
        : "bg-white/[0.06] text-white/60 hover:bg-white/[0.1] hover:text-white",
      )}
      style={isAccent ? { background: accent(0.12) } : undefined}>
      {children}
    </button>
  );
}

export function AttentionCard({ priority, icon: Icon, title, body, ctaLabel, ctaTo, index = 0 }: {
  priority: "high" | "medium" | "low"; icon: LucideIcon; title: string; body: string; ctaLabel: string; ctaTo: string; index?: number;
}) {
  const dot = priority === "high" ? ROSE : priority === "medium" ? AMBER : ACCENT_HSL;
  return (
    <motion.a href={ctaTo} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: index * 0.05, ease: EASE }} className="group block">
      <AdminCard lift className="p-5">
        <div className="flex items-start gap-4">
          <span className="relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: `linear-gradient(135deg, ${accent(0.2)}, ${accent(0.06)})`, color: ACCENT_HSL }}>
            <Icon className="h-4 w-4" strokeWidth={1.8} />
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full" style={{ background: dot, boxShadow: `0 0 10px ${dot}` }} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <div className="font-display text-[15.5px] font-semibold leading-tight text-white">{title}</div>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-white/30 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white" />
            </div>
            <p className="mt-1.5 text-[13px] font-light leading-relaxed text-white/55">{body}</p>
            <span className="mt-3 inline-block font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: ACCENT_HSL }}>{ctaLabel} →</span>
          </div>
        </div>
      </AdminCard>
    </motion.a>
  );
}
