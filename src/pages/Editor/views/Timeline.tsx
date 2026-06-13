/**
 * Timeline — placeholder. Next commit builds the magnetic timeline
 * (ripple/roll/slip/slide, beat & scene snap, multicam, speed ramps).
 */
import { motion, useReducedMotion } from "framer-motion";
import { Scissors } from "lucide-react";
import { cn } from "@/lib/utils";
import { TYPE_META, EASE_PREMIUM } from "@/lib/design-system";

export function Timeline() {
  const reducedMotion = useReducedMotion();
  return (
    <section className="relative flex-1 flex items-center justify-center px-6 sm:px-10 lg:px-12">
      <motion.div
        initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE_PREMIUM }}
        className="text-center max-w-md"
      >
        <Scissors className="h-7 w-7 text-accent/70 mx-auto" strokeWidth={1.4} />
        <h2
          className="mt-5 font-display italic text-[clamp(2rem,3.2vw,2.8rem)] font-light tracking-tight leading-[0.98]"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/55 bg-clip-text text-transparent">
            Timeline.
          </span>
        </h2>
        <p
          className="mt-5 font-display italic font-light leading-[1.5] text-foreground/65 text-[15px]"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          Magnetic, ripple-by-default. Beat snap. Multicam. Speed ramps.
          Coming next.
        </p>
        <p className={cn(TYPE_META, "mt-6 text-muted-foreground/40 tracking-[0.32em]")}>
          press 1 to return to stage
        </p>
      </motion.div>
    </section>
  );
}
