/**
 * EditorShell — the unified one-page NLE layout.
 *
 *   ┌────────────────────────────────────────────────────────────────┐
 *   │ TopStatusBar — back, project, presence, comments, export       │
 *   ├──────┬─────────────────────────────────────────────┬───────────┤
 *   │      │                                             │           │
 *   │      │              PlayerCanvas                   │           │
 *   │ Left │         (aspect-locked + HUD)               │ Inspector │
 *   │ Sc.  ├─────────────────────────────────────────────┤  (right   │
 *   │      │              Timeline                       │   rail)   │
 *   │      │        (V2 / V1 / A1 / A2)                  │           │
 *   └──────┴─────────────────────────────────────────────┴───────────┘
 *
 * Every panel is always visible. No view-switcher — the editor IS
 * the page. Script editing moves to a modal triggered by S (or 3,
 * for muscle-memory from when Script was a view). Storyboard
 * focus mode for the full scene grid is still available via 4.
 *
 * Modal overlays: ScriptModal (S), ExportPanel (E), CommentsPanel
 * (C), HelpOverlay (?), EditorPalette (⌘P).
 */
import { useEffect, useState } from "react";
import { Loader2, AlertOctagon } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TYPE_META } from "@/lib/design-system";
import { useEditor } from "@/hooks/editor/useEditor";
import { usePresence } from "@/hooks/editor/usePresence";
import { ProjectBackdrop } from "./components/ProjectBackdrop";
import { TopStatusBar } from "./components/TopStatusBar";
import { TakesDrawer } from "./components/TakesDrawer";
import { ExportPanel } from "./components/ExportPanel";
import { CommentsPanel } from "./components/CommentsPanel";
import { HelpOverlay } from "./components/HelpOverlay";
import { EditorPalette } from "./components/EditorPalette";
import { LeftScenes } from "./components/LeftScenes";
import { PlayerCanvas } from "./components/PlayerCanvas";
import { RenderQueuePanel } from "./components/RenderQueuePanel";
import { Timeline } from "./views/Timeline";
import { Script } from "./views/Script";
import { Storyboard } from "./views/Storyboard";

type FocusMode = "edit" | "storyboard";

export function EditorShell() {
  const {
    view,
    project,
    loading,
    error,
    selectedSceneId,
    selectedClipId,
    selectedClipIds,
    playheadSec,
    pxPerSec,
    setView,
    undo,
    redo,
    copySelected,
    pasteFromClipboard,
    deleteSelected,
    clearSelection,
  } = useEditor();
  void view;
  void setView;
  void selectedClipIds;

  const [exportOpen, setExportOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [scriptOpen, setScriptOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [focus, setFocus] = useState<FocusMode>("edit");
  const presence = usePresence(project?.id);

  // Global keys — input-aware. The view-switcher numbers now flip
  // between focus modes since every panel is already visible.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }
      // ⌘Z / ⌘⇧Z — undo / redo. Available even when an input has
      // focus (matches every editor).
      if ((e.metaKey || e.ctrlKey) && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) {
          const ok = redo();
          if (ok) toast.message("Redo");
        } else {
          const ok = undo();
          if (ok) toast.message("Undo");
        }
        return;
      }
      // ⌘C / ⌘V — copy / paste. Skipped inside inputs/textareas so
      // the user can still copy-paste text normally.
      const focusedEditable =
        (() => {
          const t = e.target as HTMLElement | null;
          const tag = t?.tagName;
          return tag === "INPUT" || tag === "TEXTAREA" || t?.isContentEditable;
        })();
      if (
        !focusedEditable &&
        (e.metaKey || e.ctrlKey) &&
        (e.key === "c" || e.key === "C")
      ) {
        e.preventDefault();
        const ok = copySelected();
        if (ok) toast.message("Copied to clipboard");
        return;
      }
      if (
        !focusedEditable &&
        (e.metaKey || e.ctrlKey) &&
        (e.key === "v" || e.key === "V")
      ) {
        e.preventDefault();
        const ok = pasteFromClipboard();
        if (ok) toast.message("Pasted");
        return;
      }
      if (!focusedEditable && (e.key === "Escape")) {
        // Esc clears multi-selection when no modal is open
        if (!exportOpen && !commentsOpen && !helpOpen && !paletteOpen && !scriptOpen && !queueOpen) {
          clearSelection();
        }
      }
      // Delete supports multi-selection
      if (
        !focusedEditable &&
        (e.key === "Delete" || e.key === "Backspace")
      ) {
        // The Timeline view also handles ⌫ — but only when no input is
        // focused AND only for single selection. Multi-select delete
        // lives here at the shell level so it works regardless of
        // which panel has focus.
        if (selectedClipIds.length > 1) {
          e.preventDefault();
          const ok = deleteSelected();
          if (ok) toast.message(`Deleted ${selectedClipIds.length} clips`);
          return;
        }
      }
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        e.preventDefault();
        setHelpOpen(true);
        return;
      }
      if (e.key === "e" || e.key === "E") {
        e.preventDefault();
        setExportOpen(true);
        return;
      }
      if (e.key === "q" || e.key === "Q") {
        e.preventDefault();
        setQueueOpen((o) => !o);
        return;
      }
      if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        setCommentsOpen((o) => !o);
        return;
      }
      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        setScriptOpen((o) => !o);
        return;
      }
      // Focus modes — 1 edit (default), 4 storyboard
      if (e.code === "Digit1" || e.code === "Numpad1") {
        e.preventDefault();
        setFocus("edit");
        return;
      }
      if (e.code === "Digit4" || e.code === "Numpad4") {
        e.preventDefault();
        setFocus((f) => (f === "storyboard" ? "edit" : "storyboard"));
        return;
      }
      // Legacy: 2 = timeline-focus (just removes script modal),
      // 3 = script modal.
      if (e.code === "Digit2" || e.code === "Numpad2") {
        e.preventDefault();
        setFocus("edit");
        setScriptOpen(false);
        return;
      }
      if (e.code === "Digit3" || e.code === "Numpad3") {
        e.preventDefault();
        setScriptOpen(true);
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="relative h-[100dvh] flex flex-col overflow-hidden">
      <ProjectBackdrop
        thumbnailUrl={project?.thumbnailUrl ?? null}
        projectId={project?.id ?? "loading"}
        mood={project?.mood ?? null}
      />

      {/* Chrome */}
      <div className="relative z-20 flex flex-col h-full min-h-0">
        <TopStatusBar
          project={project}
          view="stage"
          onViewChange={() => {}}
          onOpenExport={() => setExportOpen(true)}
          onToggleComments={() => setCommentsOpen((o) => !o)}
          presenceCount={presence.count}
        />

        {/* MAIN — three-column layout, always visible */}
        <div className="relative flex-1 min-h-0 flex">
          {loading && !project && <LoadingState />}
          {error && !project && <ErrorState message={error} />}

          {project && focus === "edit" && (
            <>
              {/* LEFT — scenes */}
              <LeftScenes
                project={project}
                selectedSceneId={selectedSceneId}
              />

              {/* CENTER — player + timeline split */}
              <div className="flex-1 min-w-0 flex flex-col">
                <div className="flex-1 min-h-0">
                  <PlayerCanvas
                    project={project}
                    selectedClipId={selectedClipId}
                    playheadSec={playheadSec}
                  />
                </div>
                <div
                  className="shrink-0 border-t border-white/[0.04] bg-[hsl(220_30%_4%/0.30)]"
                  style={{ height: 320 }}
                >
                  <Timeline
                    project={project}
                    selectedClipId={selectedClipId}
                    selectedClipIds={selectedClipIds}
                    playheadSec={playheadSec}
                    pxPerSec={pxPerSec}
                  />
                </div>
              </div>

              {/* RIGHT — inspector */}
              <TakesDrawer
                project={project}
                selectedClipId={selectedClipId}
                embedded
              />
            </>
          )}

          {project && focus === "storyboard" && (
            <div className="flex-1 min-w-0 flex flex-col">
              <Storyboard project={project} selectedSceneId={selectedSceneId} />
            </div>
          )}
        </div>
      </div>

      {/* Floating modal overlays */}
      <HelpOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />
      {project && (
        <CommentsPanel
          projectId={project.id}
          open={commentsOpen}
          onClose={() => setCommentsOpen(false)}
          playheadSec={playheadSec}
        />
      )}
      {project && (
        <ExportPanel
          project={project}
          open={exportOpen}
          onClose={() => setExportOpen(false)}
        />
      )}
      {project && (
        <EditorPalette
          project={project}
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          onOpenExport={() => {
            setPaletteOpen(false);
            setExportOpen(true);
          }}
          onOpenComments={() => {
            setPaletteOpen(false);
            setCommentsOpen(true);
          }}
          onOpenHelp={() => {
            setPaletteOpen(false);
            setHelpOpen(true);
          }}
        />
      )}
      {project && (
        <ScriptModal
          open={scriptOpen}
          onClose={() => setScriptOpen(false)}
          project={project}
        />
      )}

      <RenderQueuePanel open={queueOpen} onClose={() => setQueueOpen(false)} />
    </div>
  );
}

function ScriptModal({
  open,
  onClose,
  project,
}: {
  open: boolean;
  onClose: () => void;
  project: import("@/lib/editor/types").EditorProject;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 bg-[hsl(220_30%_2%/0.55)] backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-label="Script"
        className={cn(
          "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50",
          "w-[min(900px,92vw)] h-[min(78vh,820px)] overflow-hidden flex flex-col",
          "rounded-3xl border border-white/[0.08]",
          "bg-[hsl(220_30%_4%/0.92)] backdrop-blur-2xl",
          "shadow-[0_60px_140px_-30px_hsl(0_0%_0%/0.85)]",
        )}
      >
        <Script project={project} />
      </div>
    </>
  );
}

function LoadingState() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-6 w-6 text-accent animate-spin mx-auto" strokeWidth={1.5} />
        <p className={cn(TYPE_META, "mt-5 text-muted-foreground/55 tracking-[0.32em]")}>
          Loading the cutting room
        </p>
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex-1 flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <AlertOctagon className="h-7 w-7 text-rose-300/80 mx-auto" strokeWidth={1.4} />
        <p
          className="mt-5 font-display italic text-[22px] font-light text-foreground/90"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          Project didn&rsquo;t load.
        </p>
        <p className={cn(TYPE_META, "mt-3 text-muted-foreground/55 max-w-md mx-auto")}>
          {message}
        </p>
        <div className="mt-7">
          <Link
            to="/library"
            className="group/back inline-flex items-center gap-2 text-[13.5px] text-accent"
          >
            <span className="relative">
              Back to Library
              <span
                aria-hidden
                className="absolute -bottom-1 left-0 right-0 h-px origin-left scale-x-0 bg-accent/60 transition-transform duration-500 group-hover/back:scale-x-100"
              />
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
