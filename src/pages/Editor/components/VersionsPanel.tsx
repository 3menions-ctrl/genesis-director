/**
 * VersionsPanel — "versions, not undo."
 *
 * The editor's undo stack already tracks every mutation as a labelled
 * history entry; this panel reads that stack in reverse-chronological
 * order and surfaces it as a real, browsable list of versions. Each
 * entry is a single click → restore that exact state. The future
 * stack stays intact when restoring backwards, so the user can
 * jump around safely.
 *
 * v1 is read-only on the past stack with restore. v2 will add: named
 * branches, side-by-side compare, and merging.
 */
import { useEffect, useMemo } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Sparkles, X, RotateCcw, Diff, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE_PREMIUM, TYPE_META } from "@/lib/design-system";
import { useEditor } from "@/hooks/editor/useEditor";

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Best-effort guess at what the entry's label means. The store
 * already records labels like "prop:<id>", "kf:<id>:opacity",
 * "xfade:<id>", etc — convert those to readable text.
 */
function prettyLabel(label?: string): string {
  if (!label) return "Edit";
  if (label.startsWith("prop:")) return "Property change";
  if (label.startsWith("kf:remove:")) return "Removed keyframe";
  if (label.startsWith("kf:clear:")) return "Cleared keyframes";
  if (label.startsWith("kf:")) return "Added keyframe";
  if (label.startsWith("xfade:")) return "Adjusted transition";
  return label;
}

export function VersionsPanel({ open, onClose }: Props) {
  const reducedMotion = useReducedMotion();
  const { history, project, undo } = useEditor();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Walk N undos to restore a past version. Each undo() shifts the
  // current project into future[] and pulls the most recent past[]
  // entry into project — so to reach past[i] we undo (past.length - i)
  // times.
  const restoreToPastIndex = (i: number) => {
    const steps = history.past.length - i;
    for (let k = 0; k < steps; k++) {
      const ok = undo();
      if (!ok) break;
    }
    onClose();
  };

  /**
   * Display list in REVERSE-CHRONOLOGICAL order. "Current" is the
   * project in the store. Then each past[] entry, newest first.
   * The bottom of the list is the original load state.
   */
  const items = useMemo(() => {
    const list: {
      kind: "current" | "past";
      label: string;
      clips: number;
      transitions: number;
      duration: number;
      pastIndex?: number;
    }[] = [];
    if (project) {
      list.push({
        kind: "current",
        label: "Now",
        clips: project.scenes.flatMap((s) => s.clips).length,
        transitions: project.transitions?.length ?? 0,
        duration: project.durationSec,
      });
    }
    for (let i = history.past.length - 1; i >= 0; i--) {
      const e = history.past[i];
      list.push({
        kind: "past",
        label: prettyLabel(e.label),
        clips: e.project.scenes.flatMap((s) => s.clips).length,
        transitions: e.project.transitions?.length ?? 0,
        duration: e.project.durationSec,
        pastIndex: i,
      });
    }
    return list;
  }, [history.past, project]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-[hsl(220_30%_2%/0.55)] backdrop-blur-sm"
          />
          <motion.aside
            role="dialog"
            aria-labelledby="versions-title"
            initial={reducedMotion ? { opacity: 1 } : { opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: -24 }}
            transition={{ duration: 0.32, ease: EASE_PREMIUM }}
            className={cn(
              "fixed top-1/2 left-3 -translate-y-1/2 z-50",
              "w-[min(420px,92vw)] max-h-[88vh] overflow-hidden flex flex-col",
              "rounded-2xl border border-white/[0.08]",
              "bg-[hsl(220_30%_4%/0.92)] backdrop-blur-2xl",
              "shadow-[0_40px_120px_-30px_hsl(0_0%_0%/0.85)]",
            )}
          >
            {/* Header */}
            <header className="shrink-0 px-5 pt-5 pb-3 flex items-start justify-between gap-3 border-b border-white/[0.05]">
              <div className="min-w-0">
                <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.34em] flex items-center gap-2")}>
                  <GitBranch className="h-3 w-3 text-accent" strokeWidth={1.5} />
                  <span>◆ Versions</span>
                </div>
                <h3
                  id="versions-title"
                  className="mt-1 font-display italic text-[20px] font-light tracking-tight text-foreground/95"
                  style={{ fontFamily: "'Fraunces', serif" }}
                >
                  Every edit you&rsquo;ve made
                </h3>
                <p className="mt-1 text-[12px] text-muted-foreground/65">
                  Click any version to restore it. Your current work is preserved as the next entry.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close versions"
                className="text-muted-foreground/55 hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-2 py-2 scrollbar-hide">
              {items.length <= 1 ? (
                <div className="px-6 py-12 text-center">
                  <Sparkles className="h-5 w-5 text-muted-foreground/45 mx-auto" strokeWidth={1.4} />
                  <p
                    className="mt-4 font-display italic text-[15px] text-foreground/80"
                    style={{ fontFamily: "'Fraunces', serif" }}
                  >
                    No versions yet.
                  </p>
                  <p className={cn(TYPE_META, "mt-2 text-muted-foreground/55")}>
                    Make an edit — it appears here.
                  </p>
                </div>
              ) : (
                <ol className="space-y-1">
                  {items.map((item, idx) => (
                    <li key={`${item.kind}-${item.pastIndex ?? "current"}-${idx}`}>
                      <button
                        type="button"
                        disabled={item.kind === "current"}
                        onClick={() => {
                          if (item.kind === "past" && item.pastIndex !== undefined) {
                            restoreToPastIndex(item.pastIndex);
                          }
                        }}
                        className={cn(
                          "group w-full text-left px-3 py-2.5 rounded-md",
                          "flex items-start gap-3",
                          "transition-colors",
                          item.kind === "current"
                            ? "bg-[hsl(212_100%_60%/0.10)] ring-1 ring-inset ring-accent/40 cursor-default"
                            : "hover:bg-white/[0.05] ring-1 ring-inset ring-transparent hover:ring-white/[0.06]",
                        )}
                      >
                        <div className={cn(
                          "shrink-0 mt-0.5 h-2 w-2 rounded-full",
                          item.kind === "current" ? "bg-accent" : "bg-foreground/35",
                        )} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={cn(
                                "font-display italic text-[14px] leading-tight",
                                item.kind === "current" ? "text-accent" : "text-foreground/95",
                              )}
                              style={{ fontFamily: "'Fraunces', serif" }}
                            >
                              {item.label}
                            </span>
                            <span className={cn(
                              TYPE_META,
                              "font-mono tabular-nums tracking-[0.16em]",
                              item.kind === "current" ? "text-accent/85" : "text-muted-foreground/55",
                            )}>
                              {item.kind === "current" ? "now" : `−${(history.past.length - (item.pastIndex ?? 0))}`}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground/65 font-mono">
                            <span>{item.clips} clips</span>
                            <span>·</span>
                            <span>{item.transitions} transitions</span>
                            <span>·</span>
                            <span>{item.duration.toFixed(1)}s</span>
                          </div>
                        </div>
                        {item.kind === "past" && (
                          <RotateCcw
                            className="shrink-0 h-3.5 w-3.5 text-muted-foreground/55 group-hover:text-foreground transition-colors mt-1"
                            strokeWidth={1.5}
                          />
                        )}
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <footer className="shrink-0 px-5 py-3 border-t border-white/[0.05] flex items-center justify-between text-[11px] text-muted-foreground/65 font-mono uppercase tracking-[0.18em]">
              <span className="flex items-center gap-1.5">
                <Diff className="h-3 w-3" strokeWidth={1.5} />
                {history.past.length} past · {history.future.length} ahead
              </span>
              <span>Cmd+Shift+V</span>
            </footer>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
