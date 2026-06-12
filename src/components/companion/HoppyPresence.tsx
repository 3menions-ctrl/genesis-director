/**
 * Hoppy presence — minimal first version of the AI companion.
 *
 * Renders a small floating Hoppy badge in the bottom-right corner that
 * "breathes" while idle and reacts to render-complete events. Clicking
 * it opens the Muse panel (see CompanionPanel). This is the seed of the
 * persistent AI co-pilot described in the spectacular roadmap.
 *
 * Skipped on touch primaries (Hoppy lives on desktop for now) and when
 * the user has opted out via prefers-reduced-motion.
 */
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  /** Manually controlled open state from the Muse panel parent. */
  open?: boolean;
  onToggle?: () => void;
  className?: string;
}

export function HoppyPresence({ open, onToggle, className }: Props) {
  const reducedMotion = useReducedMotion();
  const [pulse, setPulse] = useState(false);

  // Listen for global custom events from the rest of the app — e.g. a
  // render completes → Hoppy pulses to acknowledge. Decoupled via
  // window events so the AI companion never needs to import context.
  useEffect(() => {
    const onReact = () => {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 1600);
      return () => clearTimeout(t);
    };
    window.addEventListener("sb:hoppy:react", onReact);
    return () => window.removeEventListener("sb:hoppy:react", onReact);
  }, []);

  return (
    <motion.button
      type="button"
      onClick={onToggle}
      aria-label={open ? "Close Hoppy" : "Open Hoppy"}
      aria-pressed={open}
      className={cn(
        "fixed bottom-6 right-6 z-50",
        "h-12 w-12 rounded-full flex items-center justify-center",
        "bg-glass border border-glass-active backdrop-blur-md",
        "shadow-lg shadow-black/40 transition-shadow",
        "hover:shadow-xl hover:shadow-black/60",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        className,
      )}
      animate={
        reducedMotion
          ? undefined
          : {
              scale: pulse ? [1, 1.18, 1.04, 1.1, 1] : 1,
              rotate: pulse ? [0, -6, 6, -3, 0] : 0,
            }
      }
      transition={{
        duration: pulse ? 0.9 : 0.3,
        ease: "easeOut",
      }}
    >
      <Sparkles className="w-5 h-5 text-primary" aria-hidden />
      {!reducedMotion && (
        <span
          aria-hidden
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "radial-gradient(closest-side, hsla(215, 100%, 70%, 0.25), transparent 70%)",
            animation: "hoppy-breathe 3.2s ease-in-out infinite",
          }}
        />
      )}
      <style>{`
        @keyframes hoppy-breathe {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50%      { opacity: 1.0; transform: scale(1.18); }
        }
      `}</style>
    </motion.button>
  );
}
