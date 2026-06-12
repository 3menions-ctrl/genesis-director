/**
 * ConcentrationMode — when the user starts creating, the chrome around
 * the canvas fades and the rest of the world dims. Esc returns the
 * room to normal.
 *
 * Triggers:
 *   - Typing into an element with data-focus-trigger="canvas" or
 *     data-focus-trigger="prompt"
 *   - Calling startConcentration() / stopConcentration() programmatically
 *   - Pressing Cmd/Ctrl+Shift+. as a manual toggle
 *
 * Honors prefers-reduced-motion: skip the transition, jump straight to
 * the target state.
 */
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

// Module-level state so any code path can request concentration.
let setOuter: ((on: boolean) => void) | null = null;

export function startConcentration() { setOuter?.(true); }
export function stopConcentration()  { setOuter?.(false); }

export function ConcentrationOverlay() {
  const [active, setActive] = useState(false);
  const reducedMotion = useReducedMotion();
  const idleSinceRef = useRef<number>(0);

  useEffect(() => {
    setOuter = setActive;
    return () => { setOuter = null; };
  }, []);

  // Auto-engage: focus a data-focus-trigger="canvas"|"prompt" element.
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (t.matches('[data-focus-trigger="canvas"], [data-focus-trigger="prompt"]')) {
        setActive(true);
      }
    };
    const onFocusOut = () => {
      idleSinceRef.current = Date.now();
      // 1.2s after focus leaves, fade back to normal.
      setTimeout(() => {
        if (Date.now() - idleSinceRef.current >= 1100) setActive(false);
      }, 1200);
    };
    window.addEventListener("focusin", onFocusIn);
    window.addEventListener("focusout", onFocusOut);
    return () => {
      window.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  // Manual toggle: Cmd/Ctrl + Shift + .
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === ".") {
        e.preventDefault();
        setActive((a) => !a);
      }
      // Escape — leave concentration mode.
      if (e.key === "Escape" && active) {
        setActive(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          aria-hidden
          initial={reducedMotion ? { opacity: 0.8 } : { opacity: 0 }}
          animate={{ opacity: 0.8 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.4, ease: "easeOut" }}
          className="pointer-events-none fixed inset-0 z-[40] bg-black"
          // Mix-blend hides everything behind it with a soft dim while
          // preserving the canvas color underneath. Spotlight on the
          // currently-focused [data-focus-trigger] element happens via
          // a radial mask cutout — implemented inline.
          style={{
            background:
              "radial-gradient(60vmax 60vmax at var(--sb-focus-x, 50%) var(--sb-focus-y, 50%), transparent 0%, rgba(0,0,0,0.7) 70%, rgba(0,0,0,0.85) 100%)",
            mixBlendMode: "normal",
          }}
        />
      )}
    </AnimatePresence>
  );
}
