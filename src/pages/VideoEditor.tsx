import { useState, useCallback } from "react";
import {
  TwickStudio,
  LivePlayerProvider,
  TimelineProvider,
  INITIAL_TIMELINE_DATA,
} from "@twick/studio";
import { useBrowserRenderer } from "@twick/browser-render";
import "@twick/studio/dist/studio.css";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function VideoEditor() {
  const navigate = useNavigate();
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
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      {/* Top bar */}
      <div className="h-12 flex items-center justify-between px-4 border-b border-border/40 bg-background/90 backdrop-blur-xl shrink-0 z-10">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/projects")}
          className="text-muted-foreground hover:text-foreground gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>

        <span className="text-[13px] font-semibold text-foreground/70 tracking-tight">
          Video Editor
        </span>

        <Button
          size="sm"
          onClick={onExportVideo}
          disabled={isRendering}
          className="h-8 px-4 text-[12px] font-semibold rounded-full bg-primary text-primary-foreground hover:bg-primary/90 border-0 gap-1.5"
        >
          {isRendering ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              {Math.round(progress * 100)}%
            </>
          ) : (
            <>
              <Download className="w-3 h-3" />
              Export MP4
            </>
          )}
        </Button>
      </div>

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

      {/* Export error */}
      {error && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-destructive text-destructive-foreground text-sm px-4 py-2 rounded-xl backdrop-blur-sm z-20">
          Export error: {error.message}
        </div>
      )}

      {/* Success indicator */}
      {showSuccess && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-green-600 text-white text-sm px-4 py-2 rounded-xl backdrop-blur-sm z-20">
          ✓ Video downloaded successfully
        </div>
      )}
    </div>
  );
}
