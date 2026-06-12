/**
 * NextReelOverlay — slide-in "next reel" banner that appears when the
 * current reel ends. Auto-advances after a 3-second countdown unless
 * the viewer cancels. Smooth fade-to-black transition between reels.
 *
 * The parent owns the queue; we just render the next-up and call
 * onAdvance when it's time.
 */
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Pause, X } from "lucide-react";

interface NextReel {
  id: string;
  title: string | null;
  thumbnail_url: string | null;
  creator_handle?: string | null;
}

interface Props {
  open: boolean;
  next: NextReel | null;
  /** Seconds to count down before auto-advance. Default 4. */
  countdown?: number;
  onAdvance: (reelId: string) => void;
  onCancel: () => void;
}

export function NextReelOverlay({ open, next, countdown = 4, onAdvance, onCancel }: Props) {
  const reducedMotion = useReducedMotion();
  const [secs, setSecs] = useState(countdown);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!open || !next) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setSecs(countdown);
      return;
    }
    setSecs(countdown);
    intervalRef.current = setInterval(() => {
      setSecs((s) => {
        if (s <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          onAdvance(next.id);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [open, next, countdown, onAdvance]);

  return (
    <AnimatePresence>
      {open && next && (
        <motion.aside
          initial={reducedMotion ? { opacity: 0.95 } : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          role="region"
          aria-label="Up next"
          className={[
            "fixed z-40 bottom-6 right-6 w-[min(380px,calc(100vw-3rem))]",
            "rounded-2xl border border-glass-active bg-glass backdrop-blur-xl",
            "shadow-xl shadow-black/60 overflow-hidden",
          ].join(" ")}
        >
          <div className="flex">
            {next.thumbnail_url ? (
              <img
                src={next.thumbnail_url}
                alt=""
                className="w-28 h-20 object-cover"
              />
            ) : (
              <div className="w-28 h-20 bg-black/40" aria-hidden />
            )}
            <div className="flex-1 p-3 min-w-0">
              <div className="text-[10px] uppercase tracking-[0.18em] text-foreground/55">Up next</div>
              <div className="text-sm font-medium text-foreground truncate mt-0.5">
                {next.title ?? "Untitled reel"}
              </div>
              {next.creator_handle && (
                <div className="text-xs text-foreground/55 truncate">@{next.creator_handle}</div>
              )}
            </div>
            <div className="flex flex-col items-end gap-1 p-2">
              <button
                type="button"
                onClick={onCancel}
                aria-label="Stop autoplay"
                className="p-1.5 text-foreground/60 hover:text-foreground rounded-md hover:bg-glass-hover"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1 text-xs tabular-nums text-foreground/70">
                <Pause className="w-3 h-3" aria-hidden />
                {secs}s
              </div>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
