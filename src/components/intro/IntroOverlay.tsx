/**
 * IntroOverlay — controlled wrapper around StudioIntro.
 *
 * StudioIntro itself is a "fire and forget" component — you flip
 * `isPlaying` to true, it runs for ~7.5s, calls `onComplete`. Real
 * surfaces (auth landing, video pre-roll, download branding) need more:
 *   - A skip button (visible after a short reveal grace period so the
 *     first frame still gets to breathe before becoming dismissible)
 *   - Escape-key skip
 *   - Click-anywhere skip after the reveal grace
 *   - Single onComplete that fires whether the intro finished naturally
 *     or was skipped, so callers don't have to branch
 *
 * The overlay portals to <body> so it always sits above the page chrome.
 */
import { memo, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { StudioIntro } from "@/components/intro/StudioIntro";

interface Props {
  /** When true, mount and run the intro. */
  open: boolean;
  /** Fires when the intro completes naturally OR the user skips. */
  onComplete: () => void;
  /**
   * How long (ms) into the intro before the Skip affordance becomes
   * visible. Keeps the first reveal pure. Default 1800 — long enough for
   * the horizon line to finish drawing.
   */
  skipAvailableAfterMs?: number;
  /** Total intro duration; usually leave defaulted. */
  duration?: number;
}

const STUDIO_INTRO_DURATION = 7500;

export const IntroOverlay = memo(function IntroOverlay({
  open,
  onComplete,
  skipAvailableAfterMs = 1800,
  duration = STUDIO_INTRO_DURATION,
}: Props) {
  const [skipReady, setSkipReady] = useState(false);
  const completedRef = useRef(false);

  // Reset the skip affordance when the overlay re-opens.
  useEffect(() => {
    if (!open) {
      setSkipReady(false);
      completedRef.current = false;
      return;
    }
    const t = window.setTimeout(() => setSkipReady(true), skipAvailableAfterMs);
    return () => window.clearTimeout(t);
  }, [open, skipAvailableAfterMs]);

  // Single source of truth for "we're done" — fires once regardless of path.
  const fireComplete = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  };

  // Esc key skip.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && skipReady) fireComplete();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, skipReady]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <>
      <StudioIntro isPlaying={open} onComplete={fireComplete} duration={duration} />

      {/* Skip affordance — sits above the intro at z-index 10001 so it's
          always clickable even during the iris-out wash. */}
      <AnimatePresence>
        {open && skipReady && (
          <motion.button
            key="intro-skip"
            type="button"
            onClick={fireComplete}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-7 right-7 z-[10001] inline-flex items-center gap-2 h-9 px-4 rounded-full border border-white/[0.10] hover:border-white/30 text-white/65 hover:text-white text-[10px] font-mono uppercase tracking-[0.32em] transition-colors backdrop-blur-md"
            style={{ backgroundColor: "hsla(220, 30%, 2%, 0.55)" }}
            aria-label="Skip intro"
          >
            Skip
            <kbd className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-white/[0.10] text-white/55">Esc</kbd>
          </motion.button>
        )}
      </AnimatePresence>
    </>,
    document.body,
  );
});

export default IntroOverlay;
