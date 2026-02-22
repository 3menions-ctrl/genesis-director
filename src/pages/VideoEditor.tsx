import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Loader2, Sparkles, Film } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

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
  const { modules, loading, error: loadError } = useTwickModules();

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#08080c] gap-6 relative overflow-hidden">
        {/* Ambient glow */}
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
          {/* Loader ring */}
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-loader-ring-pulse" />
            <div className="absolute inset-1 rounded-full border-2 border-primary/30 animate-loader-ring-inner" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Film className="w-6 h-6 text-primary animate-pulse-soft" />
            </div>
          </div>

          <div className="flex flex-col items-center gap-1.5">
            <p className="text-sm font-medium text-foreground/70 tracking-wide font-display">
              Loading Studio
            </p>
            <p className="text-xs text-muted-foreground/50">
              Preparing your creative workspace...
            </p>
          </div>

          {/* Progress bar */}
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

  return <TwickEditorInner modules={modules} navigate={navigate} />;
}

function TwickEditorInner({ modules, navigate }: { modules: any; navigate: any }) {
  const {
    TwickStudio,
    LivePlayerProvider,
    TimelineProvider,
    INITIAL_TIMELINE_DATA,
  } = modules.studio;

  const { useBrowserRenderer } = modules.browserRender;

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

  return (
    <div className="h-screen w-screen flex flex-col bg-[#08080c] overflow-hidden relative">
      {/* Subtle top ambient line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent z-20" />

      {/* Top bar */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="h-13 flex items-center justify-between px-4 border-b border-border/10 bg-[#0a0a10]/80 backdrop-blur-2xl shrink-0 z-10 relative"
      >
        {/* Left: Back */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/projects")}
          className="text-muted-foreground/70 hover:text-foreground gap-1.5 hover:bg-white/[0.04] transition-all duration-200"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-[13px]">Back</span>
        </Button>

        {/* Center: Title */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Sparkles className="w-3 h-3 text-primary" />
          </div>
          <span className="text-[13px] font-semibold text-foreground/60 tracking-tight font-display">
            Video Studio
          </span>
        </div>

        {/* Right: Export */}
        <Button
          size="sm"
          onClick={onExportVideo}
          disabled={isRendering}
          className="h-8 px-4 text-[12px] font-semibold rounded-full gap-1.5 relative overflow-hidden group"
          style={{
            background: isRendering
              ? 'hsl(var(--muted))'
              : 'linear-gradient(135deg, hsl(var(--primary)), hsl(270 80% 60%))',
            color: 'white',
            border: 'none',
          }}
        >
          {/* Shimmer effect */}
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
              <span>Export MP4</span>
            </>
          )}
        </Button>
      </motion.div>

      {/* Render progress bar */}
      <AnimatePresence>
        {isRendering && (
          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            exit={{ opacity: 0 }}
            className="h-0.5 bg-muted/20 shrink-0 z-10 origin-left"
          >
            <div
              className="h-full bg-gradient-to-r from-primary via-violet-400 to-primary transition-all duration-300 ease-out"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Editor */}
      <div className="flex-1 min-h-0">
        <LivePlayerProvider>
          <TimelineProvider
            contextId="main-editor"
            initialData={INITIAL_TIMELINE_DATA}
          >
            <TwickStudio />
          </TimelineProvider>
        </LivePlayerProvider>
      </div>

      {/* Floating notifications */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-destructive/90 text-destructive-foreground text-xs font-medium px-5 py-2.5 rounded-full backdrop-blur-xl border border-destructive/30 shadow-lg shadow-destructive/20 z-20"
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
            className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-success/90 text-success-foreground text-xs font-medium px-5 py-2.5 rounded-full backdrop-blur-xl border border-success/30 shadow-lg shadow-success/20 z-20 flex items-center gap-2"
          >
            <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-[10px]">✓</span>
            </div>
            Video downloaded successfully
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
