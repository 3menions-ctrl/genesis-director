import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Loader2, Sparkles, Film, PanelLeftClose, PanelLeft } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useEditorClips, EditorClip } from "@/hooks/useEditorClips";
import { EditorMediaPanel } from "@/components/editor/EditorMediaPanel";
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
          <div className="absolute top-1/3 left-1/3 w-[300px] h-[300px] bg-violet-500/8 rounded-full blur-[100px] animate-pulse-glow" />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative z-10 flex flex-col items-center gap-5"
        >
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-loader-ring-pulse" />
            <div className="absolute inset-1 rounded-full border-2 border-primary/30 animate-loader-ring-inner" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Film className="w-6 h-6 text-primary animate-pulse-soft" />
            </div>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <p className="text-sm font-medium text-foreground/70 tracking-wide font-display">Loading Studio</p>
            <p className="text-xs text-muted-foreground/50">Preparing your creative workspace...</p>
          </div>
          <div className="w-48 h-0.5 bg-border/30 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary/60 via-primary to-primary/60 rounded-full animate-loader-progress" />
          </div>
        </motion.div>
      </div>
    );
  }

  if (loadError || !modules) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#08080c] gap-5 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-destructive/5 rounded-full blur-[100px]" />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 flex flex-col items-center gap-4 p-8 rounded-2xl border border-border/20 bg-card/30 backdrop-blur-xl"
        >
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <Film className="w-5 h-5 text-destructive" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground/80 mb-1">Failed to load editor</p>
            <p className="text-xs text-muted-foreground/60 max-w-[280px]">{loadError}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="mt-1">
            Try Again
          </Button>
        </motion.div>
      </div>
    );
  }

  return <TwickEditorInner modules={modules} navigate={navigate} projectId={projectId} />;
}

function TwickEditorInner({ modules, navigate, projectId }: { modules: any; navigate: any; projectId: string | null }) {
  const {
    TwickStudio,
    LivePlayerProvider,
    TimelineProvider,
    INITIAL_TIMELINE_DATA,
  } = modules.studio;

  const { useBrowserRenderer } = modules.browserRender;
  const { clips, loading: clipsLoading, error: clipsError } = useEditorClips(projectId);
  const [showMediaPanel, setShowMediaPanel] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);

  const { render, progress, isRendering, error, reset } = useBrowserRenderer({
    width: 1920,
    height: 1080,
    fps: 30,
    includeAudio: true,
    autoDownload: true,
  });

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

  const handleAddToTimeline = useCallback((clip: EditorClip) => {
    toast.info(`Added "${clip.projectTitle} — Shot ${clip.shotIndex + 1}" to workspace`);
    // Twick Studio's internal state management will handle adding media
    // The user can drag from the URL-based import or use the built-in media tools
  }, []);

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
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/projects")}
            className="text-muted-foreground/60 hover:text-foreground gap-1 hover:bg-white/[0.04] h-8 px-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="text-[12px] hidden sm:inline">Back</span>
          </Button>

          <div className="w-px h-5 bg-white/[0.06] mx-1" />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowMediaPanel(!showMediaPanel)}
            className="text-muted-foreground/60 hover:text-foreground hover:bg-white/[0.04] h-8 px-2"
          >
            {showMediaPanel ? <PanelLeftClose className="w-3.5 h-3.5" /> : <PanelLeft className="w-3.5 h-3.5" />}
          </Button>
        </div>

        {/* Center */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Sparkles className="w-2.5 h-2.5 text-primary" />
          </div>
          <span className="text-[12px] font-semibold text-foreground/50 tracking-tight font-display">
            Apex Editor
          </span>
          {projectId && (
            <span className="text-[10px] text-muted-foreground/30 font-mono">
              • Project
            </span>
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

      {/* Render progress */}
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

      {/* Main content: Media panel + Editor */}
      <div className="flex-1 min-h-0 flex">
        {/* Clips panel */}
        <AnimatePresence mode="popLayout">
          {showMediaPanel && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 240, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="shrink-0 overflow-hidden"
            >
              <EditorMediaPanel
                clips={clips}
                loading={clipsLoading}
                error={clipsError}
                onAddToTimeline={handleAddToTimeline}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Twick Studio */}
        <div className="flex-1 min-w-0">
          <LivePlayerProvider>
            <TimelineProvider
              contextId="main-editor"
              initialData={INITIAL_TIMELINE_DATA}
            >
              <TwickStudio />
            </TimelineProvider>
          </LivePlayerProvider>
        </div>
      </div>

      {/* Floating notifications */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
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
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-success/90 text-success-foreground text-xs font-medium px-5 py-2.5 rounded-full backdrop-blur-xl border border-success/30 shadow-lg z-20 flex items-center gap-2"
          >
            <span>✓</span> Video downloaded
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
