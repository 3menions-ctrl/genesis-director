/**
 * EditorShell — the surface chrome of the rebuilt Editor.
 *
 * Owns: ProjectBackdrop (cohesive atmosphere), TopStatusBar (back link,
 * project title, view switcher, aspect/runtime), and the view router.
 *
 * Keyboard:
 *   1 · Stage
 *   2 · Timeline
 *   3 · Script
 *   4 · Storyboard
 *
 * Space toggles play (handled inside Stage).
 *
 * Loading and error states render their own minimal floating
 * typography — no card containers anywhere.
 */
import { useEffect, useState } from "react";
import { Loader2, AlertOctagon } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { TYPE_META } from "@/lib/design-system";
import { useEditor } from "@/hooks/editor/useEditor";
import type { EditorView } from "@/lib/editor/types";
import { usePresence } from "@/hooks/editor/usePresence";
import { ProjectBackdrop } from "./components/ProjectBackdrop";
import { TopStatusBar } from "./components/TopStatusBar";
import { TakesDrawer } from "./components/TakesDrawer";
import { ExportPanel } from "./components/ExportPanel";
import { CommentsPanel } from "./components/CommentsPanel";
import { HelpOverlay } from "./components/HelpOverlay";
import { EditorPalette } from "./components/EditorPalette";
import { Stage } from "./views/Stage";
import { Timeline } from "./views/Timeline";
import { Script } from "./views/Script";
import { Storyboard } from "./views/Storyboard";

const VIEW_BY_KEY: Record<string, EditorView> = {
  Digit1: "stage",
  Digit2: "timeline",
  Digit3: "script",
  Digit4: "storyboard",
  Numpad1: "stage",
  Numpad2: "timeline",
  Numpad3: "script",
  Numpad4: "storyboard",
};

export function EditorShell() {
  const {
    view,
    project,
    loading,
    error,
    selectedSceneId,
    selectedClipId,
    playheadSec,
    pxPerSec,
    setView,
  } = useEditor();

  const [exportOpen, setExportOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const presence = usePresence(project?.id);

  // Global keys — ignored when an input has focus, except ⌘P which is
  // always available (since it IS the input).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // ⌘P opens the editor palette from anywhere — even inside inputs
      if ((e.metaKey || e.ctrlKey) && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) {
        return;
      }
      // ? opens the keyboard help sheet
      if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        e.preventDefault();
        setHelpOpen(true);
        return;
      }
      // E opens the export panel
      if (e.key === "e" || e.key === "E") {
        e.preventDefault();
        setExportOpen(true);
        return;
      }
      // C toggles comments
      if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        setCommentsOpen((o) => !o);
        return;
      }
      const v = VIEW_BY_KEY[e.code];
      if (v) {
        e.preventDefault();
        setView(v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setView]);

  return (
    <div className="relative min-h-[100dvh] flex flex-col overflow-hidden">
      {/* Backdrop — tied to project identity */}
      <ProjectBackdrop
        thumbnailUrl={project?.thumbnailUrl ?? null}
        projectId={project?.id ?? "loading"}
        mood={project?.mood ?? null}
      />

      {/* Chrome */}
      <div className="relative z-20 flex flex-col flex-1 min-h-0">
        <TopStatusBar
          project={project}
          view={view}
          onViewChange={setView}
          onOpenExport={() => setExportOpen(true)}
          onToggleComments={() => setCommentsOpen((o) => !o)}
          presenceCount={presence.count}
        />

        {/* View body */}
        <div className="relative z-10 flex-1 min-h-0 flex flex-col">
          {loading && !project && <LoadingState />}
          {error && !project && <ErrorState message={error} />}
          {project && view === "stage" && (
            <Stage project={project} selectedClipId={selectedClipId} />
          )}
          {project && view === "timeline" && (
            <Timeline
              project={project}
              selectedClipId={selectedClipId}
              playheadSec={playheadSec}
              pxPerSec={pxPerSec}
            />
          )}
          {project && view === "script" && <Script project={project} />}
          {project && view === "storyboard" && (
            <Storyboard project={project} selectedSceneId={selectedSceneId} />
          )}
        </div>
      </div>

      {/* Takes drawer — appears when a clip is selected; press R to
          open the regenerate composer. Floats over every view. */}
      {project && (
        <TakesDrawer project={project} selectedClipId={selectedClipId} />
      )}

      {/* Export panel — press E to render in multiple aspects */}
      {project && (
        <ExportPanel
          project={project}
          open={exportOpen}
          onClose={() => setExportOpen(false)}
        />
      )}

      {/* Comments — bottom-left, press C to toggle */}
      {project && (
        <CommentsPanel
          projectId={project.id}
          open={commentsOpen}
          onClose={() => setCommentsOpen(false)}
          playheadSec={playheadSec}
        />
      )}

      {/* Help — press ? for the keyboard sheet */}
      <HelpOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />

      {/* Palette — ⌘P for fuzzy-search everywhere */}
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
    </div>
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
