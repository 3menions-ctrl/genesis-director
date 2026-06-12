/**
 * AnimatedCounter — number that smoothly tweens to its target.
 *
 * Used for credit balance, follower counts, play counts, tip totals.
 * Replaces static number renders with a satisfying count-up animation
 * the first time the number changes. Honors `prefers-reduced-motion`.
 *
 * Usage:
 *   <AnimatedCounter value={credits} />
 *   <AnimatedCounter value={1234567} format={(n) => n.toLocaleString()} />
 */
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

interface Props {
  value: number;
  format?: (n: number) => string;
  /** Milliseconds for the count-up. Default 600. */
  duration?: number;
  className?: string;
}

const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);

export function AnimatedCounter({
  value,
  format = (n) => Math.round(n).toString(),
  duration = 600,
  className,
}: Props) {
  const [display, setDisplay] = useState(value);
  const startRef = useRef(value);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) { setDisplay(value); return; }
    const from = startRef.current;
    const to = value;
    if (from === to) return;
    const start = performance.now();
    let rafId = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = easeOutQuart(t);
      setDisplay(from + (to - from) * eased);
      if (t < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        startRef.current = to;
      }
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [value, duration, reducedMotion]);

  return <span className={className}>{format(display)}</span>;
}
