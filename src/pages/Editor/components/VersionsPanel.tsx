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
import { useMemo } from "react";
import { Sparkles, RotateCcw, Diff } from "lucide-react";
import { cn } from "@/lib/utils";
import { TYPE_META } from "@/lib/design-system";
import { useEditor } from "@/hooks/editor/useEditor";
import { Surface, SurfaceHeader, SurfaceBody, SurfaceFooter, SurfaceKbdHint } from "./Surface";

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
  const { history, project, undo } = useEditor();

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
    <Surface
      open={open}
      onClose={onClose}
      size="md"
      labelledBy="versions-title"
    >
      <SurfaceHeader
        id="versions-title"
        eyebrow="◆ Versions"
        title="Every edit you've made"
        description="Click any version to restore it. Your current work is preserved as the next entry."
        onClose={onClose}
      />
      <SurfaceBody noPadding className="px-3 py-3">
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
      </SurfaceBody>
      <SurfaceFooter>
        <span className="flex items-center gap-1.5">
          <Diff className="h-3 w-3" strokeWidth={1.5} />
          {history.past.length} past · {history.future.length} ahead
        </span>
        <SurfaceKbdHint keys="⌘⇧V" label="versions" />
      </SurfaceFooter>
    </Surface>
  );
}
