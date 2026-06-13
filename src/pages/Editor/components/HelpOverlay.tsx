/**
 * HelpOverlay — every editor keyboard shortcut, in one floating
 * sheet. Press ? to open, Esc to close.
 *
 * Discoverability is the entire point — the editor is keyboard-
 * dense (1/2/3/4, space, R, E, C, ?, ⌘P, +/-, arrows) and nobody
 * memorises a shortcut they haven't seen.
 */
import { useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Keyboard, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE_PREMIUM, TYPE_META } from "@/lib/design-system";

interface Shortcut {
  keys: string[];
  label: string;
}
interface Group {
  title: string;
  items: Shortcut[];
}

const SHORTCUTS: Group[] = [
  {
    title: "Views",
    items: [
      { keys: ["1"], label: "Stage — cinematic player" },
      { keys: ["2"], label: "Timeline — magnetic editor" },
      { keys: ["3"], label: "Script — screenplay editor" },
      { keys: ["4"], label: "Storyboard — scene cards" },
    ],
  },
  {
    title: "Playback",
    items: [
      { keys: ["Space"], label: "Play / pause" },
      { keys: [",", "."], label: "Step playhead one frame" },
      { keys: ["←", "→"], label: "Step playhead 1s" },
      { keys: ["Shift", "←/→"], label: "Step playhead 0.1s" },
      { keys: ["Alt", "←/→"], label: "Step playhead 5s" },
    ],
  },
  {
    title: "Timeline",
    items: [
      { keys: ["+", "−"], label: "Zoom in / out" },
      { keys: ["⌘", "scroll"], label: "Pinch zoom anchored to cursor" },
      { keys: ["⌫"], label: "Ripple-delete selected clip" },
      { keys: ["drag clip"], label: "Reorder (magnetic)" },
      { keys: ["drag edge"], label: "Trim clip" },
    ],
  },
  {
    title: "AI · Versions",
    items: [
      { keys: ["R"], label: "Regenerate selected clip" },
      { keys: ["⌘", "↵"], label: "Submit regenerate prompt" },
      { keys: ["Esc"], label: "Cancel composer / close panel" },
    ],
  },
  {
    title: "Collaboration",
    items: [
      { keys: ["C"], label: "Toggle comments panel" },
      { keys: ["⌘", "↵"], label: "Post comment (in composer)" },
    ],
  },
  {
    title: "Export · Help",
    items: [
      { keys: ["E"], label: "Open export panel" },
      { keys: ["⌘", "P"], label: "Editor command palette" },
      { keys: ["?"], label: "This sheet" },
    ],
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function HelpOverlay({ open, onClose }: Props) {
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-[hsl(220_30%_2%/0.55)] backdrop-blur-sm"
          />
          <motion.div
            initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.97 }}
            transition={{ duration: 0.3, ease: EASE_PREMIUM }}
            role="dialog"
            aria-labelledby="help-title"
            className={cn(
              "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50",
              "w-[min(720px,92vw)] max-h-[88vh] overflow-hidden flex flex-col",
              "rounded-3xl border border-white/[0.07]",
              "bg-[hsl(220_30%_4%/0.88)] backdrop-blur-2xl",
              "shadow-[0_60px_140px_-30px_hsl(0_0%_0%/0.85)]",
            )}
          >
            <header className="shrink-0 px-7 pt-7 pb-3 flex items-start justify-between">
              <div>
                <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.34em] flex items-center gap-2")}>
                  <Keyboard className="h-3 w-3 text-accent/70" strokeWidth={1.5} />
                  <span>◆ Keyboard</span>
                </div>
                <h2
                  id="help-title"
                  className="mt-2 font-display italic text-[clamp(1.6rem,2.5vw,2.1rem)] font-light tracking-tight"
                  style={{ fontFamily: "'Fraunces', serif" }}
                >
                  <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/60 bg-clip-text text-transparent">
                    Direct from the keyboard.
                  </span>
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-muted-foreground/55 hover:text-foreground transition-colors"
                aria-label="Close help"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto scrollbar-hide px-7 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-7">
                {SHORTCUTS.map((g) => (
                  <section key={g.title}>
                    <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.30em] mb-3")}>
                      ◆ {g.title}
                    </div>
                    <ul className="space-y-2">
                      {g.items.map((s) => (
                        <li
                          key={s.label}
                          className="flex items-center justify-between gap-4 text-[13px]"
                        >
                          <span className="text-foreground/85">{s.label}</span>
                          <span className="flex items-center gap-1 shrink-0">
                            {s.keys.map((k, i) => (
                              <Kbd key={i}>{k}</Kbd>
                            ))}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </div>

            <footer className="shrink-0 px-7 py-4 border-t border-white/[0.05] flex items-center justify-between text-[12px] text-muted-foreground/55">
              <span>Inputs always win — keys are ignored while typing</span>
              <span className="flex items-center gap-1.5">
                <Kbd>?</Kbd>
                <span>any time</span>
              </span>
            </footer>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5",
        "font-mono text-[10.5px] tabular-nums tracking-[0.04em]",
        "rounded-md border border-white/[0.10] bg-white/[0.03] text-foreground/85",
      )}
    >
      {children}
    </span>
  );
}
