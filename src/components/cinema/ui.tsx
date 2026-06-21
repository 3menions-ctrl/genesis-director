/**
 * Cinema UI primitives — refined, dark, single accent.
 * Charcoal surfaces, restrained glassmorphism, white CTAs, one blue accent.
 */
import { useRef, type ReactNode, type CSSProperties } from "react";
import { motion, useMotionValue, useSpring, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export const ACCENT = "214 90% 62%"; // single accent (HSL parts)
export const EASE = [0.22, 1, 0.36, 1] as const;

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("font-mono text-[11px] uppercase tracking-[0.34em]", className)} style={{ color: `hsl(${ACCENT})` }}>
      {children}
    </span>
  );
}

/** Restrained frosted-glass surface — video reads through it. */
export function Glass({ children, className, style, hover }: { children?: ReactNode; className?: string; style?: CSSProperties; hover?: boolean }) {
  return (
    <div
      style={style}
      className={cn(
        "relative overflow-hidden rounded-2xl bg-white/[0.045] ring-1 ring-white/10 backdrop-blur-xl",
        "shadow-[0_40px_120px_-50px_rgba(0,0,0,0.9)]",
        hover && "transition-colors duration-300 hover:bg-white/[0.07] hover:ring-white/15",
        className,
      )}
    >
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      {children}
    </div>
  );
}

/** White primary / ghost secondary, with a gentle magnetic lean. */
export function Button({
  children, onClick, variant = "primary", className,
}: { children: ReactNode; onClick?: () => void; variant?: "primary" | "ghost"; className?: string }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLButtonElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const x = useSpring(mx, { stiffness: 200, damping: 18, mass: 0.4 });
  const y = useSpring(my, { stiffness: 200, damping: 18, mass: 0.4 });
  const onMove = (e: React.MouseEvent) => {
    if (reduced || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    mx.set((e.clientX - (r.left + r.width / 2)) * 0.25);
    my.set((e.clientY - (r.top + r.height / 2)) * 0.25);
  };
  const reset = () => { mx.set(0); my.set(0); };
  return (
    <motion.button
      ref={ref}
      type="button"
      onClick={onClick}
      onMouseMove={onMove}
      onMouseLeave={reset}
      style={{ x, y }}
      whileTap={{ scale: 0.97 }}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-[14px] font-medium transition-colors",
        variant === "primary"
          ? "bg-white text-[#0a0b0e] hover:bg-white/90"
          : "bg-white/[0.06] text-white ring-1 ring-white/15 backdrop-blur-md hover:bg-white/[0.12]",
        className,
      )}
    >
      {children}
    </motion.button>
  );
}

/** Subtle scroll-reveal: fade + small rise, once. */
export function Reveal({ children, className, delay = 0, y = 22 }: { children: ReactNode; className?: string; delay?: number; y?: number }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? { opacity: 1 } : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-12%" }}
      transition={{ duration: 0.7, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}
