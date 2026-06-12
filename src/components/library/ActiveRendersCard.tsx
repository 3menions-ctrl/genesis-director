/**
 * ActiveRendersCard — Vercel-deploy-style dashboard for in-progress
 * films. Mounts at the top of Library when the user has any active
 * pipeline. One row per render with title, stage label, animated
 * progress bar, and a click-through to the Production page.
 *
 * Design vocabulary follows Foundation canon:
 *   - Glass card on EditorialCanvas (`bg-foreground/0.02`, `border-border/30`)
 *   - Mono uppercase eyebrow ("ACTIVE RENDERS · 3")
 *   - Hairline rule under header
 *   - Accent-tinted progress bar with subtle shimmer
 *   - Reduced-motion aware
 *
 * Hidden entirely when no renders are active so the surface stays calm.
 */
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Loader2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useActiveProjects } from "@/hooks/useActiveProjects";
import { EASE_PREMIUM, TYPE_META } from "@/lib/design-system";

export function ActiveRendersCard() {
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const { projects } = useActiveProjects();

  if (projects.length === 0) return null;

  return (
    <motion.section
      initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE_PREMIUM }}
      className={cn(
        "mb-8 overflow-hidden rounded-2xl",
        "border border-border/30",
        "bg-[hsl(var(--foreground)/0.02)] backdrop-blur-xl",
      )}
      aria-label="Active renders"
    >
      {/* Header */}
      <header className="flex items-center justify-between gap-4 border-b border-border/30 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-accent/70 opacity-70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
          </span>
          <span
            className={cn(
              TYPE_META,
              "text-foreground/85",
            )}
          >
            Active renders · {projects.length}
          </span>
        </div>
        <span className={cn(TYPE_META, "text-muted-foreground/50")}>
          live
        </span>
      </header>

      {/* Rows */}
      <ul className="divide-y divide-border/20">
        {projects.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => navigate(`/production/${p.id}`)}
              className="group flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-[hsl(var(--accent)/0.04)]"
            >
              {/* Spinner / thumbnail */}
              <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md border border-border/40 bg-[hsl(var(--foreground)/0.03)]">
                {p.thumbnail_url ? (
                  <img
                    src={p.thumbnail_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Loader2
                    className="absolute inset-0 m-auto h-3.5 w-3.5 animate-spin text-accent/70"
                    strokeWidth={1.5}
                  />
                )}
              </div>

              {/* Title + stage */}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-3">
                  <span className="truncate text-[13px] font-light text-foreground/90 group-hover:text-foreground">
                    {p.title}
                  </span>
                  <span className={cn(TYPE_META, "text-muted-foreground/60")}>
                    {p.stage}
                  </span>
                </div>

                {/* Progress bar — animated width transition.
                    Shimmer keyframe lives in tailwind globals; if absent,
                    the bar still reads correctly without it. */}
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[hsl(var(--foreground)/0.04)]">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-accent/60 via-accent to-accent/60"
                    initial={false}
                    animate={{ width: `${p.progress}%` }}
                    transition={{ duration: 0.6, ease: EASE_PREMIUM }}
                    style={{
                      boxShadow: "0 0 12px hsl(var(--accent) / 0.35)",
                    }}
                  />
                </div>
              </div>

              {/* Percent + chevron */}
              <div className="flex items-center gap-3 shrink-0">
                <span
                  className={cn(
                    TYPE_META,
                    "tabular-nums text-foreground/70 group-hover:text-foreground",
                  )}
                >
                  {p.progress}%
                </span>
                <ChevronRight
                  className="h-3.5 w-3.5 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground/80"
                  strokeWidth={1.5}
                />
              </div>
            </button>
          </li>
        ))}
      </ul>
    </motion.section>
  );
}
