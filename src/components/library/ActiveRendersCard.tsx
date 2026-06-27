/**
 * ActiveRendersCard — live in-progress films, rendered as FLOATING DIGITS.
 *
 * Design vocabulary (Aurora / borderless canon):
 *   - NO card container, NO border, NO glass panel — everything floats
 *     directly over the page's atmospheric backdrop.
 *   - Each active render is led by a large floating progress digit
 *     (TYPE_DISPLAY) with a soft accent glow.
 *   - Title + stage as light/mono type; a single hairline progress line
 *     (no boxed track) carries the accent.
 *   - Mono eyebrow with a live ping dot. Reduced-motion aware.
 *
 * Hidden entirely when no renders are active so the surface stays calm.
 */
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useActiveProjects } from "@/hooks/useActiveProjects";
import { EASE_PREMIUM, TYPE_META, TYPE_DISPLAY } from "@/lib/design-system";

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
      className="mb-10"
      aria-label="Active renders"
    >
      {/* Floating eyebrow — pure type over the backdrop, no rule, no chrome */}
      <div className="mb-6 flex items-center gap-2.5">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inset-0 animate-ping rounded-full bg-accent/70 opacity-70" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
        </span>
        <span className={cn(TYPE_META, "text-foreground/70")}>
          Rendering · {projects.length}
        </span>
      </div>

      {/* One floating digit per active render */}
      <div className="flex flex-col gap-7">
        {projects.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => navigate(`/production/${p.id}`)}
            className="group flex w-full items-end gap-5 text-left"
          >
            {/* THE FLOATING DIGIT — the hero number, glowing over the backdrop */}
            <div className="flex shrink-0 items-baseline gap-0.5 tabular-nums">
              <motion.span
                key={p.progress}
                className={cn(TYPE_DISPLAY.md, "font-extralight leading-none text-foreground")}
                style={{ textShadow: "0 2px 32px hsl(var(--accent) / 0.30)" }}
                initial={reducedMotion ? false : { opacity: 0.6 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, ease: EASE_PREMIUM }}
              >
                {p.progress}
              </motion.span>
              <span className="text-[15px] font-light text-muted-foreground/50">%</span>
            </div>

            {/* Title + stage + a single hairline progress line (no boxed track) */}
            <div className="min-w-0 flex-1 pb-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-[14px] font-light text-foreground/85 group-hover:text-foreground">
                  {p.title}
                </span>
                <span className={cn(TYPE_META, "shrink-0 text-muted-foreground/55 group-hover:text-accent/80")}>
                  {p.stage}
                </span>
              </div>
              <div className="mt-3 h-px w-full bg-foreground/[0.06]">
                <motion.div
                  className="h-px bg-gradient-to-r from-accent/50 via-accent to-accent"
                  initial={false}
                  animate={{ width: `${p.progress}%` }}
                  transition={{ duration: 0.6, ease: EASE_PREMIUM }}
                  style={{ boxShadow: "0 0 10px hsl(var(--accent) / 0.5)" }}
                />
              </div>
            </div>

            <ChevronRight
              className="h-3.5 w-3.5 shrink-0 self-center text-muted-foreground/30 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground/70"
              strokeWidth={1.5}
            />
          </button>
        ))}
      </div>
    </motion.section>
  );
}
