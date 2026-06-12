/**
 * PremiereCountdown — live countdown to a scheduled premiere.
 *
 * Shows DAYS · HRS · MIN · SEC up to the premiere starts_at. Transitions
 * to a "live now" state when the time arrives. Honors prefers-reduced-
 * motion (the digit-flip animation is suppressed; numbers update
 * instantly). Pure presentational — the parent owns the data fetch.
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

interface Props {
  startsAt: string | Date;
  className?: string;
}

interface Parts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

function diff(now: number, target: number): Parts {
  const total = Math.max(0, target - now);
  const s = Math.floor(total / 1000);
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
    total,
  };
}

export function PremiereCountdown({ startsAt, className }: Props) {
  const targetMs = typeof startsAt === "string" ? Date.parse(startsAt) : startsAt.getTime();
  const [parts, setParts] = useState<Parts>(() => diff(Date.now(), targetMs));
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const tick = () => setParts(diff(Date.now(), targetMs));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  if (parts.total === 0) {
    return (
      <div className={"inline-flex items-center gap-2 " + (className ?? "")}>
        <span aria-hidden className="relative w-2 h-2 rounded-full bg-destructive">
          <span className="absolute inset-0 rounded-full bg-destructive animate-ping" />
        </span>
        <span className="text-sm uppercase tracking-[0.16em] font-medium">Live now</span>
      </div>
    );
  }

  return (
    <div className={"inline-flex items-baseline gap-3 font-mono tabular-nums " + (className ?? "")}>
      <Cell value={parts.days} label="d" reducedMotion={!!reducedMotion} />
      <Cell value={parts.hours} label="h" reducedMotion={!!reducedMotion} />
      <Cell value={parts.minutes} label="m" reducedMotion={!!reducedMotion} />
      <Cell value={parts.seconds} label="s" reducedMotion={!!reducedMotion} />
    </div>
  );
}

function Cell({
  value,
  label,
  reducedMotion,
}: {
  value: number;
  label: string;
  reducedMotion: boolean;
}) {
  const formatted = String(value).padStart(2, "0");
  return (
    <span className="inline-flex items-baseline">
      <span className="relative inline-block min-w-[2ch] overflow-hidden text-2xl">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={formatted}
            initial={reducedMotion ? false : { y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { y: -16, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="inline-block"
          >
            {formatted}
          </motion.span>
        </AnimatePresence>
      </span>
      <span className="ml-0.5 text-xs text-foreground/55">{label}</span>
    </span>
  );
}
