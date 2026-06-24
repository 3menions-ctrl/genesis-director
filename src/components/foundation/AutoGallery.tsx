/**
 * AutoGallery — a generic auto-cycling image gallery shared across the
 * Templates, Environments, and Training pages.
 *
 * Two variants:
 *   • "card"  — compact 16:9 framed card with chip + progress + dots,
 *               for sitting inside a column.
 *   • "hero"  — full-bleed background — no internal chrome — for living
 *               behind page-level headings as a kinetic backdrop.
 *
 * Animation:
 *   Cross-fade between items every ~3.2s using framer-motion's
 *   AnimatePresence so transitions feel filmic, not abrupt. A subtle
 *   scale (1.04 → 1) reads as "the camera settles." Reduced-motion users
 *   get a hard fade with no zoom.
 *
 * Glow:
 *   Each item carries its own halo color so the ambient halo shifts as
 *   the carousel moves. Callers supply colors per item via the
 *   `items[].glow` field, keeping the gallery itself taxonomy-agnostic.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { TYPE_META } from "@/lib/design-system";

const ADVANCE_MS = 3200;

export interface AutoGalleryItem {
  id: string;
  name: string;
  /** Image URL. Items without one are filtered out — a blank frame
   *  would feel like a broken image, not a deliberate pause. */
  imageUrl: string | null | undefined;
  /** Optional caption shown under the name in card mode. */
  caption?: string;
  /** rgba/hsla color used for the ambient halo when this item is
   *  active. Defaults to a warm cinematic amber. */
  glow?: string;
}

interface Props {
  items: AutoGalleryItem[];
  className?: string;
  variant?: "card" | "hero";
}

export function AutoGallery({ items, className, variant = "card" }: Props) {
  const isHero = variant === "hero";
  const reducedMotion = useReducedMotion();

  // Stable shuffled walk on mount so each user sees a different sequence
  // without it changing every render.
  const pool = useMemo(() => {
    const withImage = items.filter((it) => !!it.imageUrl);
    const arr = withImage.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [items]);

  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const tickStartRef = useRef<number>(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (pool.length <= 1) return;
    let raf = 0;
    tickStartRef.current = performance.now();
    const step = (now: number) => {
      if (hovered) {
        tickStartRef.current = now - progress * ADVANCE_MS;
        raf = requestAnimationFrame(step);
        return;
      }
      const elapsed = now - tickStartRef.current;
      const p = Math.min(1, elapsed / ADVANCE_MS);
      setProgress(p);
      if (p >= 1) {
        setIndex((i) => (i + 1) % pool.length);
        tickStartRef.current = now;
        setProgress(0);
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool.length, hovered]);

  if (pool.length === 0) return null;

  const active = pool[index];
  const glow = active.glow ?? "hsl(45 95% 65% / 0.45)";

  return (
    <div
      className={cn(
        !isHero && [
          "relative w-[280px] sm:w-[320px] aspect-[16/9] rounded-2xl overflow-hidden",
          // Borderless: no ring / no 1px shadow-border — just a soft drop shadow
          // so the card floats on the backdrop.
          "shadow-[0_24px_60px_-18px_rgba(0,0,0,0.65)]",
        ],
        isHero && "absolute inset-0 overflow-hidden",
        className,
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.div
          key={active.id}
          className="absolute inset-0"
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          <img
            src={active.imageUrl ?? undefined}
            alt={active.name}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
            draggable={false}
          />
          {!isHero && (
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[hsl(220_30%_2%/0.85)] via-[hsl(220_30%_2%/0.35)] to-transparent" />
          )}
        </motion.div>
      </AnimatePresence>

      <div
        aria-hidden
        className="pointer-events-none absolute -inset-3 rounded-3xl opacity-50 transition-opacity duration-700"
        style={{
          background: `radial-gradient(80% 60% at 60% 30%, ${glow} 0%, transparent 70%)`,
          mixBlendMode: "screen",
        }}
      />

      {!isHero && (
        <>
          <div className="absolute left-3 bottom-3 right-3 z-10">
            {active.caption && (
              <div className={cn(TYPE_META, "text-amber-200/85 tracking-[0.22em]")}>
                ◆ Featured · {active.caption}
              </div>
            )}
            <div
              className="mt-1 font-display italic text-[18px] leading-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.65)] truncate"
              style={{ fontFamily: "'Fraunces', serif" }}
            >
              {active.name}
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 h-[2px] bg-white/[0.06] z-10">
            <div
              className="h-full bg-gradient-to-r from-accent/80 via-accent to-accent/60 transition-[width] duration-100 ease-linear"
              style={{ width: `${progress * 100}%` }}
            />
          </div>

          {pool.length > 1 && pool.length <= 8 && (
            <div className="absolute top-3 right-3 z-10 flex items-center gap-1">
              {pool.map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1.5 w-1.5 rounded-full transition-all duration-300",
                    i === index ? "bg-white/95 scale-110" : "bg-white/35",
                  )}
                />
              ))}
            </div>
          )}

          {pool.length > 8 && (
            <div className={cn(TYPE_META, "absolute top-3 left-3 z-10 inline-flex items-center gap-1 px-2 h-5 rounded-full bg-black/55 backdrop-blur-md ring-1 ring-inset ring-white/15 text-white/90 tracking-[0.22em]")}>
              {index + 1} · {pool.length}
            </div>
          )}
        </>
      )}
    </div>
  );
}
