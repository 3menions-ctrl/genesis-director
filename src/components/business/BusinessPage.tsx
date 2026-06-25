/**
 * BusinessPage — the page scaffold for the /business module.
 *
 * Same editorial language as the consumer Profile/Studio pages: a full-bleed
 * aurora cover band (canonical business blue), content pulled up to overlap
 * it, an open borderless hero (eyebrow · big serif title · subtitle ·
 * right-aligned actions), then a centered content column. No card chrome.
 */
import type { ComponentType, ReactNode } from "react";
import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { LucideProps } from "lucide-react";
import { cn } from "@/lib/utils";
import { TYPE_META, EASE_PREMIUM } from "@/lib/design-system";
import { useWorkspaceCovers } from "@/hooks/useWorkspaceCovers";

interface Props {
  eyebrow: ReactNode;
  title: string;
  accent?: string;
  subtitle?: string;
  actions?: ReactNode;
  children?: ReactNode;
  /** Render children flush (no centered max-width column). */
  wide?: boolean;
}

export function BusinessPage({ eyebrow, title, accent, subtitle, actions, children, wide }: Props) {
  const reducedMotion = useReducedMotion();
  const covers = useWorkspaceCovers();
  const hasCover = covers.length > 0;
  return (
    <motion.div
      initial={reducedMotion ? { opacity: 1 } : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="relative w-full"
    >
      {/* COVER BAND — rotating production gallery. Rendered ONLY when the
          workspace has media, so a content-less workspace never shows an
          empty header band. */}
      {hasCover && (
        <div className="relative w-full h-[200px] sm:h-[248px] lg:h-[284px] overflow-hidden">
          <CoverGallery images={covers} reducedMotion={!!reducedMotion} />
          {/* Legibility scrim — keeps the overlapping hero readable. */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#040506] via-[#040506]/45 to-[#040506]/20" />
        </div>
      )}

      <div className={cn("mx-auto w-full px-6 sm:px-8 lg:px-12 pb-24", wide ? "max-w-[1480px]" : "max-w-6xl")}>
        {/* HERO — overlaps the cover when present; sits at the top otherwise. */}
        <div className={cn("relative mb-10 flex flex-col lg:flex-row lg:items-end justify-between gap-5", hasCover ? "-mt-16 lg:-mt-20" : "pt-8 lg:pt-10")}>
          <div className="min-w-0">
            <div className="text-[10px] font-mono uppercase tracking-[0.22em] mb-3 flex items-center gap-2.5 flex-wrap text-white/45">
              {eyebrow}
            </div>
            <h1 className="font-display font-light text-[clamp(2rem,4.6vw,3.15rem)] leading-[1.04] tracking-tight text-white">
              {title}{accent && <> <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(120deg, hsl(215 100% 70%), hsl(200 100% 72%))" }}>{accent}</span></>}
            </h1>
            {subtitle && (
              <p className="mt-4 max-w-2xl text-[14px] lg:text-[15px] font-light leading-relaxed text-white/65">
                {subtitle}
              </p>
            )}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2.5 shrink-0">{actions}</div>}
        </div>

        <motion.div
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE_PREMIUM }}
        >
          {children}
        </motion.div>
      </div>
    </motion.div>
  );
}

// ── CoverGallery — crossfading workspace production thumbnails ──────────────

function CoverGallery({ images, reducedMotion }: { images: string[]; reducedMotion: boolean }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reducedMotion || images.length < 2) return;
    const t = setInterval(() => setI((p) => (p + 1) % images.length), 6500);
    return () => clearInterval(t);
  }, [reducedMotion, images.length]);
  const src = images[i % images.length];
  return (
    <div aria-hidden className="absolute inset-0">
      {reducedMotion ? (
        <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <AnimatePresence>
          <motion.img
            key={src}
            src={src}
            alt=""
            initial={{ opacity: 0, scale: 1.08 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ opacity: { duration: 1.3, ease: "easeInOut" }, scale: { duration: 7, ease: "linear" } }}
            className="absolute inset-0 w-full h-full object-cover"
          />
        </AnimatePresence>
      )}
      {/* Brand tint + darken so it reads as a cover, not a raw photo. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 22% 26%, hsla(215,95%,52%,0.28), transparent 60%)," +
            "linear-gradient(180deg, hsla(220,30%,5%,0.45), hsla(220,30%,3%,0.82))",
        }}
      />
    </div>
  );
}

// ── Shared business surface primitives (borderless, hairline-only) ─────────

// Horizon: figures FLOAT on the page — no box, no ring. Big Fraunces numeral,
// mono uppercase label. (Same API as before; borderless rendering.)
export function StatCard({ label, value, hint, accent, loading }: {
  label: string; value: ReactNode; hint?: string; accent?: boolean; loading?: boolean;
}) {
  return (
    <div>
      <div className={cn(TYPE_META, "text-white/45 tracking-[0.22em]")}>{label}</div>
      {loading ? (
        <div className="mt-3 h-[30px] w-16 rounded-md bg-white/[0.06] animate-pulse" />
      ) : (
        <div
          className="mt-2.5 font-display font-semibold text-[34px] leading-[0.95] tracking-tight tabular-nums"
          style={accent ? { color: "hsl(215 100% 72%)", textShadow: "0 0 30px hsl(215 90% 60% / 0.5)" } : { color: "#fff" }}
        >{value}</div>
      )}
      {hint && !loading && <div className="mt-2 text-[12px] text-white/40">{hint}</div>}
    </div>
  );
}

// Horizon section heading: accent-tick gradient bar + Fraunces title (no rule).
export function SectionHead({ label, count, action }: { label: string; count?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3 mb-4 mt-10">
      <div className="flex items-center gap-2.5">
        <span aria-hidden className="h-4 w-1 rounded-full" style={{ background: "linear-gradient(hsl(215 90% 60%), hsl(188 92% 58%))" }} />
        <h2 className="font-display text-[17px] font-semibold tracking-tight text-white">{label}</h2>
        {count !== undefined && count !== null && <span className={cn(TYPE_META, "ml-1 text-white/35 tracking-[0.18em]")}>{count}</span>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

// ── Badge / Pill — one primitive for the status pills scattered across pages ──

type BadgeTone = "good" | "bad" | "neutral" | "warn" | "accent";

// Horizon StatusPill idiom: tone background + tone text, NO ring/border.
const BADGE_TONE: Record<BadgeTone, string> = {
  good: "text-emerald-300/90 bg-emerald-400/12",
  bad: "text-rose-300/90 bg-rose-400/12",
  warn: "text-amber-300/90 bg-amber-400/12",
  neutral: "text-white/55 bg-white/[0.06]",
  accent: "text-[hsl(215,100%,78%)] bg-[hsl(215,90%,55%/0.14)]",
};

export function Badge({ tone = "neutral", className, children }: {
  tone?: BadgeTone; className?: string; children: ReactNode;
}) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2.5 h-5 rounded-full text-[9.5px] font-mono font-medium uppercase tracking-[0.16em]",
      BADGE_TONE[tone],
      className,
    )}>
      {children}
    </span>
  );
}

// ── EmptyState — icon · title · description, the polished no-data treatment ───

export function EmptyState({ icon: Icon, title, description, action, className }: {
  icon?: ComponentType<LucideProps>;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(
      "px-6 py-14 flex flex-col items-center text-center",
      className,
    )}>
      {Icon && (
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-white/[0.08] to-white/[0.015] flex items-center justify-center mb-4">
          <Icon className="w-5 h-5 text-white/40" strokeWidth={1.5} />
        </div>
      )}
      <div className="font-display font-semibold text-[19px] text-white/90 tracking-tight">{title}</div>
      {description && (
        <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-white/45 font-light">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ── Loading skeletons — match the bg-white/[0.04] glass idiom, not bg-muted ──

export function SkeletonRows({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-14 rounded-2xl bg-white/[0.03] animate-pulse"
          style={{ animationDelay: `${i * 80}ms` }}
        />
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 6, grid, className }: { count?: number; grid?: string; className?: string }) {
  return (
    <div className={cn("grid gap-3", grid ?? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="aspect-video rounded-2xl bg-white/[0.03] animate-pulse"
          style={{ animationDelay: `${i * 70}ms` }}
        />
      ))}
    </div>
  );
}

// ── StaggerList — staggered fade/slide entrance for list & card groups ───────

export function StaggerList({ children, className, step = 0.045 }: {
  children: ReactNode; className?: string; step?: number;
}) {
  const reducedMotion = useReducedMotion();
  if (reducedMotion) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: step } } }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  const reducedMotion = useReducedMotion();
  if (reducedMotion) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
      transition={{ duration: 0.38, ease: EASE_PREMIUM }}
    >
      {children}
    </motion.div>
  );
}

// ── BusinessTabs — the in-page tab bar for consolidated hub surfaces ─────────

export interface BusinessTab {
  key: string;
  label: string;
  icon?: ComponentType<LucideProps>;
  /** Optional trailing count/badge. */
  count?: ReactNode;
}

export function BusinessTabs({ tabs, active, onChange, className }: {
  tabs: BusinessTab[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn("flex items-center gap-1 flex-wrap border-b border-white/[0.07] mb-8", className)}
    >
      {tabs.map((t) => {
        const on = t.key === active;
        const Icon = t.icon;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.key)}
            className={cn(
              "relative -mb-px inline-flex items-center gap-2 px-4 h-11 text-[13px] font-light border-b-2 transition-colors",
              on
                ? "text-white border-[hsl(215,90%,60%)]"
                : "text-white/45 border-transparent hover:text-white/80",
            )}
          >
            {Icon && <Icon className="w-4 h-4" strokeWidth={1.6} />}
            {t.label}
            {t.count !== undefined && t.count !== null && (
              <span className={cn(TYPE_META, on ? "text-[hsl(215,100%,78%)]" : "text-white/35")}>{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
