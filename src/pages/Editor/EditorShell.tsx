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
import { useEffect, useRef, useState } from "react";
import { Loader2, AlertOctagon } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TYPE_META } from "@/lib/design-system";
import { useEditor } from "@/hooks/editor/useEditor";
import { usePresence } from "@/hooks/editor/usePresence";
import type { EditorProject } from "@/lib/editor/types";
import { ProjectBackdrop } from "./components/ProjectBackdrop";
import { TopStatusBar } from "./components/TopStatusBar";
import { TakesDrawer } from "./components/TakesDrawer";

/**
 * Synthetic empty project — used when no real project is loaded
 * (fresh /editor visit, sign-out, query-still-loading, etc).
 * Every region of the editor renders against this so the user
 * ALWAYS sees the NLE surface — never a separate empty page.
 */
const EMPTY_PROJECT: EditorProject = {
  id: "no-project",
  title: "Open a project",
  aspectRatio: "16:9",
  status: "empty",
  thumbnailUrl: null,
  durationSec: 0,
  scriptContent: null,
  mood: null,
  genre: null,
  setting: null,
  scenes: [],
  transitions: [],
};
import { ExportPanel } from "./components/ExportPanel";
import { DirectorChat } from "./components/DirectorChat";
import { VersionsPanel } from "./components/VersionsPanel";
import { StudioLibrary } from "./components/StudioLibrary";
import { Surface } from "./components/Surface";
import { CreatePanel } from "./components/CreatePanel";
import { CommentsPanel } from "./components/CommentsPanel";
import { HelpOverlay } from "./components/HelpOverlay";
import { EditorPalette } from "./components/EditorPalette";
import { LeftScenes } from "./components/LeftScenes";
import { PlayerCanvas } from "./components/PlayerCanvas";
import { RenderQueuePanel } from "./components/RenderQueuePanel";
import { StatusBar } from "./components/StatusBar";
import { MarkersPanel } from "./components/MarkersPanel";
import { EffectsPalette } from "./components/EffectsPalette";
import { AudioMixer } from "./components/AudioMixer";
import { switchActiveTake } from "@/lib/editor/store";
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
    theaterMode,
    toggleTheaterMode,
  } = useEditor();
  void view;
  void setView;

  // Synthetic project keeps the four-region layout always rendered.
  // Components see empty scenes/clips and render their inline empty
  // states; nothing about the user's "I am in the editor" feeling
  // ever depends on whether a row was returned by supabase yet.
  const displayProject = project ?? EMPTY_PROJECT;

  const [exportOpen, setExportOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [scriptOpen, setScriptOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [markersPanelOpen, setMarkersPanelOpen] = useState(false);
  const [effectsOpen, setEffectsOpen] = useState(false);
  const [mixerOpen, setMixerOpen] = useState(false);
  const [directorOpen, setDirectorOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [focus, setFocus] = useState<FocusMode>("edit");
  const presence = usePresence(project?.id);

  /**
   * URL ↔ tab sync. The editor presents four logical tabs (stage,
   * timeline, script, storyboard) even though it's a single page —
   * deep-linking via `?tab=...` lets Studio hand off straight into
   * the right lens, lets the user bookmark a view, and survives a
   * page refresh.
   *
   * Mapping:
   *   stage|timeline → focus=edit + scriptOpen=false (Stage and
   *     Timeline cohabit the same edit canvas; the timeline is a
   *     panel below the player rather than its own focus mode)
   *   script        → focus=edit + scriptOpen=true (modal overlay)
   *   storyboard    → focus=storyboard
   */
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get("tab");

  // Read URL → state on mount + every URL change.
  useEffect(() => {
    if (urlTab === "script") {
      setScriptOpen(true);
      setFocus("edit");
    } else if (urlTab === "storyboard") {
      setFocus("storyboard");
      setScriptOpen(false);
    } else if (urlTab === "stage" || urlTab === "timeline" || urlTab === null) {
      setFocus("edit");
      setScriptOpen(false);
    }
  }, [urlTab]);

  // Write state → URL when the user navigates via keyboard / buttons.
  // Guard with the current URL value so we don't push duplicate
  // history entries, and use `replace: true` to keep the back button
  // returning to the previous route rather than the previous tab.
  useEffect(() => {
    const next: string = scriptOpen
      ? "script"
      : focus === "storyboard"
      ? "storyboard"
      : urlTab === "timeline"
      ? "timeline"
      : "stage";
    if (next === urlTab) return;
    const params = new URLSearchParams(searchParams);
    params.set("tab", next);
    setSearchParams(params, { replace: true });
  }, [focus, scriptOpen, urlTab, searchParams, setSearchParams]);

  /**
   * `currentView` — derived from state + URL. The ViewSwitcher uses
   * this to render the active underline. There are 4 logical views;
   * we resolve precedence: script > storyboard > URL-tab-explicit >
   * default-stage.
   */
  const currentView: import("@/lib/editor/types").EditorView = scriptOpen
    ? "script"
    : focus === "storyboard"
    ? "storyboard"
    : urlTab === "timeline"
    ? "timeline"
    : "stage";

  /**
   * Single source of truth for tab switches. Used by:
   *   - ViewSwitcher click handler in the TopStatusBar
   *   - the 1/2/3/4 keyboard map below
   * Always routes the change through the URL — the read-effect then
   * picks it up and updates focus/scriptOpen consistently, so we
   * can't get out of sync with the URL bar.
   *
   * Stored on a ref because the keydown effect binds once with
   * [] deps; without the ref, the closure would capture a stale
   * switchView and clicking 2 would route through the wrong
   * useSearchParams snapshot.
   */
  const switchView = (next: import("@/lib/editor/types").EditorView) => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", next);
    setSearchParams(params, { replace: true });
  };
  const switchViewRef = useRef(switchView);
  switchViewRef.current = switchView;
  const currentViewRef = useRef(currentView);
  currentViewRef.current = currentView;

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
      // Shift+M opens the markers panel (M without shift drops a
      // marker — handled in Timeline view).
      if ((e.key === "M") && e.shiftKey) {
        e.preventDefault();
        setMarkersPanelOpen((o) => !o);
        return;
      }
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        setEffectsOpen((o) => !o);
        return;
      }
      if (e.key === "x" || e.key === "X") {
        e.preventDefault();
        setMixerOpen((o) => !o);
        return;
      }
      // Multicam — Shift+1..9 switches the active take of the
      // selected clip. Shift is required because plain 1/4 are
      // focus-mode keys. Useful for quickly comparing takes during
      // playback without opening the Inspector.
      if (
        e.shiftKey &&
        /^Digit[1-9]$/.test(e.code) &&
        selectedClipId &&
        project
      ) {
        const angleIdx = parseInt(e.code.slice(-1), 10) - 1;
        const clip = project.scenes
          .flatMap((s) => s.clips)
          .find((c) => c.id === selectedClipId);
        const target = clip?.takes[angleIdx];
        if (clip && target && target.videoUrl) {
          e.preventDefault();
          switchActiveTake(clip.id, target.id);
          toast.message(
            `Take ${target.takeNumber} — angle ${angleIdx + 1}`,
            { description: target.promptUsed ?? undefined },
          );
        }
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
      // View tabs — 1 / 2 / 3 / 4 map to Stage / Timeline / Script /
      // Storyboard. All four route through `switchView` so click +
      // keyboard go through the same write path and the URL bar
      // always matches the visible state. Read latest via refs so
      // the bound-once effect sees the current state.
      if (e.code === "Digit1" || e.code === "Numpad1") {
        e.preventDefault();
        switchViewRef.current("stage");
        return;
      }
      if (e.code === "Digit2" || e.code === "Numpad2") {
        e.preventDefault();
        switchViewRef.current("timeline");
        return;
      }
      if (e.code === "Digit3" || e.code === "Numpad3") {
        e.preventDefault();
        switchViewRef.current("script");
        return;
      }
      if (e.code === "Digit4" || e.code === "Numpad4") {
        e.preventDefault();
        // 4 toggles Storyboard ↔ Stage so a second press returns
        // the user to the canvas without hunting for the right tab.
        switchViewRef.current(
          currentViewRef.current === "storyboard" ? "stage" : "storyboard",
        );
        return;
      }
      // Cmd+/ — open the Director Chat. Input-aware skip already
      // handled above. Slash without modifier is the help-overlay
      // key elsewhere so we require the meta.
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        setDirectorOpen((o) => !o);
        return;
      }
      // Cmd+Shift+V — open Versions panel.
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === "V" || e.key === "v")) {
        e.preventDefault();
        setVersionsOpen((o) => !o);
        return;
      }
      // Shift+L — open the Studio Library (curated effects + templates).
      if (!(e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === "L")) {
        e.preventDefault();
        setLibraryOpen((o) => !o);
        return;
      }
      // N — open the Create panel (add a clip without leaving the
      // editor). No-modifier `n` is the cleanest key here; the
      // input-aware skip above means typing N in a text field still
      // types the letter.
      if (!(e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key === "n" || e.key === "N")) {
        e.preventDefault();
        setCreateOpen((o) => !o);
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
          view={currentView}
          onViewChange={switchView}
          onOpenExport={() => setExportOpen(true)}
          onToggleComments={() => setCommentsOpen((o) => !o)}
          onOpenDirector={() => setDirectorOpen(true)}
          onOpenVersions={() => setVersionsOpen(true)}
          onOpenLibrary={() => setLibraryOpen(true)}
          onOpenCreate={() => setCreateOpen(true)}
          presenceCount={presence.count}
        />

        {/* MAIN — three-column layout, ALWAYS visible (even with no
            project). Each component handles empty scenes/clips with
            its own inline empty state so the user is "in the editor"
            from the first paint. */}
        <div className="relative flex-1 min-h-0 flex">
          {focus === "edit" && (
            <>
              {/* LEFT — scenes (hidden in theater mode) */}
              {!theaterMode && (
                <LeftScenes
                  project={displayProject}
                  selectedSceneId={selectedSceneId}
                />
              )}

              {/* CENTER — player + timeline split.
                  In theater mode the player expands and the timeline
                  drops to a thin scrub strip so the audience-vs-editor
                  split stays useful. Esc or Shift+T returns. */}
              <div className="flex-1 min-w-0 flex flex-col">
                <div className="flex-1 min-h-0">
                  <PlayerCanvas
                    project={displayProject}
                    selectedClipId={selectedClipId}
                    playheadSec={playheadSec}
                  />
                </div>
                {/* Timeline strip — height adapts to the active view:
                      • Stage view  → 120px (thin scrub strip, player
                        gets the lion's share of the canvas)
                      • Timeline view → flex-1 (timeline takes the
                        majority so the editor is the workhorse)
                      • Theater     → 120px (overrides everything;
                        the program monitor is the room)
                    Smooth transition between states matches the
                    foundation's motion language. */}
                <div
                  className={cn(
                    "shrink-0 border-t border-white/[0.04] bg-[hsl(220_30%_4%/0.30)]",
                    "transition-[height,flex] duration-300 ease-out",
                    currentView === "timeline" && !theaterMode && "flex-1",
                  )}
                  style={{
                    height:
                      theaterMode
                        ? 120
                        : currentView === "stage"
                        ? 120
                        : currentView === "timeline"
                        ? undefined /* let flex-1 take over */
                        : 320,
                  }}
                >
                  <Timeline
                    project={displayProject}
                    selectedClipId={selectedClipId}
                    selectedClipIds={selectedClipIds}
                    playheadSec={playheadSec}
                    pxPerSec={pxPerSec}
                  />
                </div>
              </div>

              {/* RIGHT — inspector (hidden in theater mode) */}
              {!theaterMode && (
                <TakesDrawer
                  project={displayProject}
                  selectedClipId={selectedClipId}
                  embedded
                />
              )}
            </>
          )}

          {/* Theater-mode exit chip — shows top-left when chrome is hidden. */}
          {theaterMode && (
            <button
              type="button"
              onClick={toggleTheaterMode}
              className={cn(
                "absolute top-3 left-3 z-40 inline-flex items-center gap-1.5 px-3 h-7 rounded-md",
                "bg-[hsl(220_30%_4%/0.78)] backdrop-blur border border-white/[0.10]",
                "text-[11px] font-mono uppercase tracking-[0.18em] text-foreground/85 hover:text-foreground",
                "transition-colors",
              )}
              title="Exit theater (Shift+T)"
              aria-label="Exit theater mode"
            >
              <span className="text-accent">◆</span>
              <span>Exit theater</span>
            </button>
          )}

          {focus === "storyboard" && (
            <div className="flex-1 min-w-0 flex flex-col">
              <Storyboard
                project={displayProject}
                selectedSceneId={selectedSceneId}
                onOpenCreate={() => setCreateOpen(true)}
                onLeaveToEdit={() => setFocus("edit")}
              />
            </div>
          )}

          {/* Soft loading shimmer in the center when fetching the
              project — keeps the four-region layout visible behind
              while the network catches up. */}
          {loading && !project && (
            <div
              className="absolute inset-0 z-30 pointer-events-none flex items-start justify-center pt-10"
              aria-hidden
            >
              <div className="rounded-md px-3 py-1.5 bg-[hsl(220_30%_4%/0.70)] backdrop-blur border border-white/[0.06] flex items-center gap-2 text-[12px] text-muted-foreground/70 pointer-events-auto">
                <Loader2 className="h-3 w-3 text-accent animate-spin" strokeWidth={1.5} />
                <span>Opening project…</span>
              </div>
            </div>
          )}

          {/* Error banner — non-blocking, sits above the layout. */}
          {error && !project && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
              <div className="rounded-md px-3 py-1.5 bg-rose-500/15 border border-rose-400/30 flex items-center gap-2 text-[12px] text-rose-200">
                <AlertOctagon className="h-3 w-3" strokeWidth={1.5} />
                <span>Project didn&rsquo;t load: {error}</span>
              </div>
            </div>
          )}
        </div>

        {/* Persistent bottom status bar — always visible */}
        {(
          <StatusBar
            project={displayProject}
            playheadSec={playheadSec}
            selectedClipIds={selectedClipIds}
            presenceCount={presence.count}
          />
        )}
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

      {/* Markers panel — ⇧M to toggle */}
      <MarkersPanel
        open={markersPanelOpen}
        onClose={() => setMarkersPanelOpen(false)}
      />

      {/* Effects palette — F to toggle */}
      {project && (
        <EffectsPalette
          project={project}
          selectedClipIds={selectedClipIds}
          open={effectsOpen}
          onClose={() => setEffectsOpen(false)}
        />
      )}

      {/* Audio mixer — X to toggle. Reads global isPlaying from store. */}
      <AudioMixer open={mixerOpen} onClose={() => setMixerOpen(false)} />

      {/* Director Chat — Cmd+/ */}
      <DirectorChat
        project={displayProject}
        open={directorOpen}
        onClose={() => setDirectorOpen(false)}
      />

      {/* Versions panel — Cmd+Shift+V */}
      <VersionsPanel
        open={versionsOpen}
        onClose={() => setVersionsOpen(false)}
      />

      {/* Studio Library — Shift+L */}
      <StudioLibrary
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
      />

      {/* Create panel — N */}
      <CreatePanel
        project={displayProject}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
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
  return (
    <Surface
      open={open}
      onClose={onClose}
      size="xl"
      // The screenplay editor wants Esc for its own use (close
      // a slug-line edit etc), but Surface's default Esc is fine
      // here — the inner editor doesn't actually consume Esc yet.
      className="!h-[min(78vh,820px)]"
    >
      <Script project={project} />
    </Surface>
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
