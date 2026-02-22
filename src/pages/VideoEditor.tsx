import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Loader2, Sparkles, Film, Check } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useEditorClips, EditorClip } from "@/hooks/useEditorClips";
import "@twick/studio/dist/studio.css";

/**
 * Writes clips directly to the IndexedDB store that Twick's BrowserMediaManager reads from.
 * This must complete BEFORE TwickStudio mounts so the MediaProvider sees the items on init.
 */
async function prePopulateMediaStore(clips: EditorClip[]): Promise<number> {
  const DB_NAME = "mediaStore";
  const STORE_NAME = "mediaItems";

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      const db = request.result;

      // Ensure the store exists
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.close();
        // Re-open with version bump to create the store
        const version = db.version + 1;
        const upgradeReq = indexedDB.open(DB_NAME, version);
        upgradeReq.onupgradeneeded = () => {
          const udb = upgradeReq.result;
          if (!udb.objectStoreNames.contains(STORE_NAME)) {
            udb.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
          }
        };
        upgradeReq.onsuccess = () => {
          writeClips(upgradeReq.result, clips).then(resolve).catch(reject);
        };
        upgradeReq.onerror = () => reject(upgradeReq.error);
        return;
      }

      writeClips(db, clips).then(resolve).catch(reject);
    };
  });
}

async function writeClips(db: IDBDatabase, clips: EditorClip[]): Promise<number> {
  const STORE_NAME = "mediaItems";

  // First read existing URLs to avoid duplicates
  const existingUrls = await new Promise<Set<string>>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      const urls = new Set((req.result || []).map((item: any) => item.url));
      resolve(urls);
    };
    req.onerror = () => reject(req.error);
  });

  const newClips = clips.filter(c => c.videoUrl && !existingUrls.has(c.videoUrl));
  if (newClips.length === 0) {
    db.close();
    return 0;
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    let added = 0;

    for (const clip of newClips) {
      const item = {
        name: `Shot ${clip.shotIndex + 1} – ${clip.projectTitle}`,
        url: clip.videoUrl,
        type: "video",
        thumbnail: clip.thumbnailUrl || undefined,
        duration: clip.durationSeconds || undefined,
        size: 0,
        width: 1920,
        height: 1080,
        createdAt: new Date(),
        metadata: {
          name: `Shot ${clip.shotIndex + 1}`,
          source: "apex",
          projectId: clip.projectId,
          prompt: clip.prompt,
        },
      };
      const req = store.add(item);
      req.onsuccess = () => { added++; };
    }

    tx.oncomplete = () => {
      db.close();
      resolve(added);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

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

/**
 * Phase-based editor loading:
 * 1. Load Twick modules + fetch clips from DB (parallel)
 * 2. Pre-populate IndexedDB with clips
 * 3. Mount TwickStudio (reads clips from IndexedDB on init)
 */
export default function VideoEditor() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("project");

  const { modules, loading: modulesLoading, error: loadError } = useTwickModules();
  const { clips, loading: clipsLoading } = useEditorClips(projectId);
  const [mediaReady, setMediaReady] = useState(false);
  const [clipCount, setClipCount] = useState(0);
  const populatedRef = useRef(false);

  // Phase 2: Once clips are fetched, write them to IndexedDB before mounting studio
  useEffect(() => {
    if (clipsLoading || populatedRef.current) return;
    populatedRef.current = true;

    if (clips.length === 0) {
      setMediaReady(true);
      return;
    }

    prePopulateMediaStore(clips)
      .then((count) => {
        setClipCount(count);
        if (count > 0) {
          console.log(`[Apex] Pre-loaded ${count} clips into media library`);
        }
        setMediaReady(true);
      })
      .catch((err) => {
        console.error("[Apex] Failed to pre-populate media store:", err);
        // Still mount the studio even if pre-population fails
        setMediaReady(true);
      });
  }, [clips, clipsLoading]);

  const isLoading = modulesLoading || clipsLoading || !mediaReady;

  if (isLoading) {
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
          <p className="text-sm font-medium text-foreground/70 font-display">
            {!modulesLoading && !clipsLoading ? "Preparing media library…" : 
             clipsLoading ? "Loading your clips…" : "Loading Studio…"}
          </p>
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

  // Phase 3: Mount studio — media is already in IndexedDB
  return <StudioShell modules={modules} navigate={navigate} clipCount={clipCount} />;
}

/**
 * Thin wrapper that sets up Twick providers and renders the studio.
 */
function StudioShell({ modules, navigate, clipCount }: { modules: any; navigate: any; clipCount: number }) {
  const {
    TwickStudio,
    LivePlayerProvider,
    TimelineProvider,
    INITIAL_TIMELINE_DATA,
  } = modules.studio;

  const { useBrowserRenderer } = modules.browserRender;

  return (
    <LivePlayerProvider>
      <TimelineProvider
        contextId="main-editor"
        initialData={INITIAL_TIMELINE_DATA}
        analytics={{ enabled: false }}
      >
        <EditorChrome
          TwickStudio={TwickStudio}
          useBrowserRenderer={useBrowserRenderer}
          navigate={navigate}
          clipCount={clipCount}
        />
      </TimelineProvider>
    </LivePlayerProvider>
  );
}

/**
 * Editor chrome: top bar, export controls, and TwickStudio.
 */
function EditorChrome({
  TwickStudio,
  useBrowserRenderer,
  navigate,
  clipCount,
}: {
  TwickStudio: any;
  useBrowserRenderer: any;
  navigate: any;
  clipCount: number;
}) {
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
          {clipCount > 0 && (
            <div className="flex items-center gap-1 ml-2 text-[10px] text-emerald-400/60">
              <Check className="w-2.5 h-2.5" />
              {clipCount} clips in library
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

      {/* Full Twick Studio — clips are already in its IndexedDB media library */}
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
