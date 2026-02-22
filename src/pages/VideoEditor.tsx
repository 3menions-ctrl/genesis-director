import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Loader2, Sparkles, Film, Check } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useEditorClips } from "@/hooks/useEditorClips";
import "@twick/studio/dist/studio.css";

// Dynamically import Twick to avoid 504 bundling timeouts
function useTwickModules() {
  const [modules, setModules] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      import("@twick/studio"),
      import("@twick/browser-render"),
    ])
      .then(([studio, browserRender]) => {
        if (!cancelled) {
          setModules({ studio, browserRender });
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Failed to load Twick modules:", err);
          setError(err.message || "Failed to load editor modules");
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  return { modules, loading, error };
}

export default function VideoEditor() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("project");
  const { modules, loading, error: loadError } = useTwickModules();

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#08080c] gap-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px]" />
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 flex flex-col items-center gap-5"
        >
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-loader-ring-pulse" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Film className="w-6 h-6 text-primary animate-pulse-soft" />
            </div>
          </div>
          <p className="text-sm font-medium text-foreground/70 font-display">Loading Studio</p>
          <div className="w-48 h-0.5 bg-border/30 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary/60 via-primary to-primary/60 rounded-full animate-loader-progress" />
          </div>
        </motion.div>
      </div>
    );
  }

  if (loadError || !modules) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#08080c] gap-5">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-4 p-8 rounded-2xl border border-border/20 bg-card/30 backdrop-blur-xl">
          <Film className="w-6 h-6 text-destructive" />
          <p className="text-sm text-foreground/80">Failed to load editor</p>
          <p className="text-xs text-muted-foreground/60">{loadError}</p>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Try Again</Button>
        </motion.div>
      </div>
    );
  }

  return <TwickEditorInner modules={modules} navigate={navigate} projectId={projectId} />;
}

/**
 * Inner component that sets up Twick providers and injects clips into the media library.
 */
function TwickEditorInner({ modules, navigate, projectId }: { modules: any; navigate: any; projectId: string | null }) {
  const {
    TwickStudio,
    LivePlayerProvider,
    TimelineProvider,
    INITIAL_TIMELINE_DATA,
    BrowserMediaManager,
  } = modules.studio;

  const { useBrowserRenderer } = modules.browserRender;

  return (
    <LivePlayerProvider>
      <TimelineProvider
        contextId="main-editor"
        initialData={INITIAL_TIMELINE_DATA}
        analytics={{ enabled: false }}
      >
        <EditorWithMediaInjection
          TwickStudio={TwickStudio}
          BrowserMediaManager={BrowserMediaManager}
          useBrowserRenderer={useBrowserRenderer}
          navigate={navigate}
          projectId={projectId}
        />
      </TimelineProvider>
    </LivePlayerProvider>
  );
}

/**
 * Main editor component that injects user clips into Twick's BrowserMediaManager (IndexedDB).
 * Clips appear in the studio's built-in Video panel so users can drag them to the timeline.
 */
function EditorWithMediaInjection({
  TwickStudio,
  BrowserMediaManager,
  useBrowserRenderer,
  navigate,
  projectId,
}: {
  TwickStudio: any;
  BrowserMediaManager: any;
  useBrowserRenderer: any;
  navigate: any;
  projectId: string | null;
}) {
  const { clips, loading: clipsLoading } = useEditorClips(projectId);
  const [clipsInjected, setClipsInjected] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const injectedRef = useRef(false);

  const { render, progress, isRendering, error, reset } = useBrowserRenderer({
    width: 1920,
    height: 1080,
    fps: 30,
    includeAudio: true,
    autoDownload: true,
  });

  // Inject clips into the BrowserMediaManager so they appear in the Video panel
  useEffect(() => {
    if (clipsLoading || clips.length === 0 || injectedRef.current) return;

    async function injectIntoMediaLibrary() {
      try {
        // BrowserMediaManager uses IndexedDB "mediaStore" / "mediaItems" — 
        // same DB as the singleton inside TwickStudio, so items show up in the Video panel.
        const manager = new BrowserMediaManager();
        let addedCount = 0;

        for (const clip of clips) {
          if (!clip.videoUrl) continue;

          try {
            await manager.addItem({
              name: `Shot ${clip.shotIndex + 1} – ${clip.projectTitle}`,
              type: "video",
              url: clip.videoUrl,
              thumbnail: clip.thumbnailUrl || undefined,
              duration: clip.durationSeconds || undefined,
              size: 0,
              width: 1920,
              height: 1080,
              createdAt: new Date(),
            });
            addedCount++;
          } catch (err) {
            console.warn(`Failed to add clip ${clip.id} to media library:`, err);
          }
        }

        if (addedCount > 0) {
          toast.success(`${addedCount} clip${addedCount > 1 ? "s" : ""} loaded into media library`);
        }

        injectedRef.current = true;
        setClipsInjected(true);
      } catch (err) {
        console.error("Failed to inject clips into media library:", err);
      }
    }

    injectIntoMediaLibrary();
  }, [clips, clipsLoading, BrowserMediaManager]);

  const onExportVideo = useCallback(async () => {
    try {
      setShowSuccess(false);
      reset();
      await render({
        input: {
          properties: { width: 1920, height: 1080, fps: 30 },
          tracks: [],
        },
      });
      setShowSuccess(true);
      toast.success("Video exported successfully!");
    } catch (err) {
      console.error("Export failed:", err);
      toast.error("Export failed. Please try again.");
    }
  }, [render, reset]);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#08080c] overflow-hidden relative">
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent z-20" />

      {/* Top bar */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="h-12 flex items-center justify-between px-3 border-b border-white/[0.06] bg-[#0a0a10]/90 backdrop-blur-2xl shrink-0 z-10"
      >
        {/* Left */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/projects")}
          className="text-muted-foreground/60 hover:text-foreground gap-1 hover:bg-white/[0.04] h-8 px-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span className="text-[12px] hidden sm:inline">Back</span>
        </Button>

        {/* Center */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Sparkles className="w-2.5 h-2.5 text-primary" />
          </div>
          <span className="text-[12px] font-semibold text-foreground/50 tracking-tight font-display">
            Apex Editor
          </span>
          {clipsLoading && (
            <div className="flex items-center gap-1 ml-2 text-[10px] text-muted-foreground/40">
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
              Loading clips...
            </div>
          )}
          {clipsInjected && (
            <div className="flex items-center gap-1 ml-2 text-[10px] text-emerald-400/60">
              <Check className="w-2.5 h-2.5" />
              {clips.length} clips in library
            </div>
          )}
        </div>

        {/* Right */}
        <Button
          size="sm"
          onClick={onExportVideo}
          disabled={isRendering}
          className="h-8 px-4 text-[11px] font-semibold rounded-full gap-1.5 relative overflow-hidden group border-0"
          style={{
            background: isRendering
              ? 'hsl(var(--muted))'
              : 'linear-gradient(135deg, hsl(var(--primary)), hsl(270 80% 60%))',
            color: 'white',
          }}
        >
          {!isRendering && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
          )}
          {isRendering ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>{Math.round(progress * 100)}%</span>
            </>
          ) : (
            <>
              <Download className="w-3 h-3" />
              <span>Export</span>
            </>
          )}
        </Button>
      </motion.div>

      {/* Render progress bar */}
      <AnimatePresence>
        {isRendering && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-0.5 bg-white/[0.03] shrink-0 z-10"
          >
            <div
              className="h-full bg-gradient-to-r from-primary via-violet-400 to-primary transition-all duration-300"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full Twick Studio — clips are in the Video panel's media library */}
      <div className="flex-1 min-h-0">
        <TwickStudio />
      </div>

      {/* Floating notifications */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-destructive/90 text-destructive-foreground text-xs font-medium px-5 py-2.5 rounded-full backdrop-blur-xl border border-destructive/30 shadow-lg z-20"
          >
            Export error: {error.message}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-emerald-500/90 text-white text-xs font-medium px-5 py-2.5 rounded-full backdrop-blur-xl border border-emerald-400/30 shadow-lg z-20 flex items-center gap-2"
          >
            <span>✓</span> Video downloaded
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
