import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Loader2, FolderOpen, Check, Save, X, Monitor } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useEditorClips, EditorClip, EditorImage, ProjectSummary } from "@/hooks/useEditorClips";
import { ProjectBrowser } from "@/components/editor/ProjectBrowser";
import { Logo } from "@/components/ui/Logo";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// ─── Full Apex element color palette (all 14 SDK keys) ───
const APEX_ELEMENT_COLORS = {
  video: "#7c3aed",
  audio: "#06b6d4",
  image: "#f59e0b",
  text: "#a78bfa",
  caption: "#8b5cf6",
  icon: "#ec4899",
  circle: "#14b8a6",
  rect: "#f97316",
  element: "#6366f1",
  fragment: "#1e1e2e",
  frameEffect: "#22d3ee",
  filters: "#e879f9",
  transition: "#818cf8",
  animation: "#34d399",
};

const APEX_TIMELINE_TICK_CONFIGS = [
  { durationThreshold: 30, majorInterval: 5, minorTicks: 5 },
  { durationThreshold: 120, majorInterval: 15, minorTicks: 3 },
  { durationThreshold: 600, majorInterval: 60, minorTicks: 6 },
];

const APEX_TIMELINE_ZOOM = {
  min: 0.25,
  max: 4.0,
  step: 0.25,
  default: 1.0,
};

/**
 * Load a single project's clips into Twick's media library on demand.
 */
async function loadClipsIntoLibrary(
  clips: EditorClip[],
  images: EditorImage[],
  BrowserMediaManager: any
): Promise<{ videos: number; images: number }> {
  const manager = new BrowserMediaManager();

  const videoItems = clips
    .filter(c => c.videoUrl)
    .sort((a, b) => a.shotIndex - b.shotIndex)
    .map(clip => ({
      name: `Shot ${clip.shotIndex + 1} – ${clip.projectTitle}`,
      type: "video" as const,
      url: clip.videoUrl,
      thumbnail: clip.thumbnailUrl || undefined,
      duration: clip.durationSeconds || undefined,
      width: 1920,
      height: 1080,
      metadata: {
        title: `Shot ${clip.shotIndex + 1} – ${clip.projectTitle}`,
        source: "apex",
        projectId: clip.projectId,
        prompt: clip.prompt,
        shotIndex: clip.shotIndex,
      },
    }));

  const imageItems = images.map(img => ({
    name: img.label,
    type: "image" as const,
    url: img.url,
    width: 1920,
    height: 1080,
    metadata: {
      title: img.label,
      source: img.source,
      shotIndex: img.shotIndex,
    },
  }));

  let videosAdded = 0;
  let imagesAdded = 0;

  if (videoItems.length > 0) {
    const added = await manager.addItems(videoItems);
    videosAdded = added.length;
  }
  if (imageItems.length > 0) {
    const added = await manager.addItems(imageItems);
    imagesAdded = added.length;
  }

  return { videos: videosAdded, images: imagesAdded };
}

interface EditorChromeProps {
  TwickStudio: any;
  useBrowserRenderer: any;
  BrowserMediaManager: any;
  useTimelineContext: any;
  setElementColors?: any;
  navigate: any;
}

export function EditorChrome({
  TwickStudio,
  useBrowserRenderer,
  BrowserMediaManager,
  useTimelineContext,
  setElementColors,
  navigate,
}: EditorChromeProps) {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const sessionId = searchParams.get("session");

  const [showSuccess, setShowSuccess] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [loadedProjectIds, setLoadedProjectIds] = useState<Set<string>>(new Set());
  const [mediaCounts, setMediaCounts] = useState({ videos: 0, images: 0 });
  const [saving, setSaving] = useState(false);
  const [sessionTitle, setSessionTitle] = useState("Untitled Session");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const { listProjects, loadProjectClips, loading: clipsLoading } = useEditorClips();

  // ─── Get timeline context for real ProjectJSON access ───
  const { editor, present } = useTimelineContext();

  // ─── Apply element colors via SDK API ───
  useEffect(() => {
    if (setElementColors) {
      try { setElementColors(APEX_ELEMENT_COLORS); } catch {}
    }
  }, [setElementColors]);

  // ─── Mobile detection ───
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ─── Beforeunload guard ───
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges]);

  // ─── Auto-dismiss success toast ───
  useEffect(() => {
    if (showSuccess) {
      const t = setTimeout(() => setShowSuccess(false), 4000);
      return () => clearTimeout(t);
    }
  }, [showSuccess]);

  // ─── Mark unsaved on timeline changes ───
  useEffect(() => {
    if (present && present.tracks?.length > 0) {
      setHasUnsavedChanges(true);
    }
  }, [present]);

  const { render, progress, isRendering, error, reset, videoBlob } = useBrowserRenderer({
    width: 1920,
    height: 1080,
    fps: 30,
    quality: "high" as const,
    includeAudio: true,
    autoDownload: true,
    downloadFilename: `Apex_${sessionTitle.replace(/\s+/g, "_")}.mp4`,
  });

  // ─── Helper: get current project JSON from timeline context ───
  const getProjectJSON = useCallback(() => {
    // `present` holds the live ProjectJSON from the timeline context
    if (present && present.tracks?.length > 0) return present;
    return null;
  }, [present]);

  // ─── StudioConfig callbacks ───

  const saveProject = useCallback(async (project: any, fileName: string) => {
    if (!user) return { status: false, message: "Not signed in" };
    setSaving(true);
    try {
      // Use provided project (from Twick) or extract from timeline context
      const projectData = (project && project.tracks?.length > 0) ? project : getProjectJSON();
      if (!projectData) {
        toast.error("Nothing to save — add clips to the timeline first");
        return { status: false, message: "Empty timeline" };
      }
      const title = fileName || sessionTitle;

      const payload = {
        user_id: user.id,
        title,
        timeline_data: projectData,
        status: "draft",
        updated_at: new Date().toISOString(),
      };

      if (sessionId) {
        const { error: err } = await supabase
          .from("edit_sessions")
          .update(payload)
          .eq("id", sessionId)
          .eq("user_id", user.id);
        if (err) throw err;
      } else {
        const { data, error: err } = await supabase
          .from("edit_sessions")
          .insert(payload)
          .select("id")
          .single();
        if (err) throw err;
        if (data?.id) {
          setSearchParams({ session: data.id }, { replace: true });
        }
      }

      setSessionTitle(title);
      setHasUnsavedChanges(false);
      toast.success("Project saved");
      return { status: true, message: "Saved" };
    } catch (err: any) {
      console.error("Save failed:", err);
      toast.error("Failed to save project");
      return { status: false, message: err.message };
    } finally {
      setSaving(false);
    }
  }, [user, sessionId, setSearchParams, getProjectJSON, sessionTitle]);

  const loadProject = useCallback(async () => {
    if (!user || !sessionId) {
      return { tracks: [], version: 1 };
    }
    try {
      const { data, error: err } = await supabase
        .from("edit_sessions")
        .select("timeline_data, title")
        .eq("id", sessionId)
        .eq("user_id", user.id)
        .single();
      if (err) throw err;
      if (data.title) setSessionTitle(data.title);
      setHasUnsavedChanges(false);

      // Restore timeline into the editor
      const projectData = data.timeline_data as any;
      if (projectData && projectData.tracks?.length > 0 && editor) {
        try {
          editor.loadProject({ tracks: projectData.tracks, version: projectData.version || 1 });
        } catch (e) {
          console.warn("editor.loadProject fallback:", e);
        }
      }

      toast.success("Session restored");
      return projectData || { tracks: [], version: 1 };
    } catch (err: any) {
      console.error("Load failed:", err);
      toast.error("Failed to load session");
      return { tracks: [], version: 1 };
    }
  }, [user, sessionId, editor]);

  const exportVideo = useCallback(async (project: any, videoSettings: any) => {
    try {
      setShowSuccess(false);
      reset();
      // Use provided project or extract from timeline context
      const projectData = (project && project.tracks?.length > 0) ? project : getProjectJSON();
      if (!projectData || !projectData.tracks?.length) {
        toast.error("Nothing to export — add clips to the timeline first");
        return { status: false, message: "Empty timeline" };
      }
      await render({ input: projectData });
      setShowSuccess(true);
      toast.success("Video exported successfully!");
      return { status: true, message: "Exported" };
    } catch (err: any) {
      console.error("Export failed:", err);
      toast.error("Export failed. Please try again.");
      return { status: false, message: err.message };
    }
  }, [render, reset, getProjectJSON]);

  // ─── Keyboard shortcuts ───
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "s") {
        e.preventDefault();
        const project = getProjectJSON();
        saveProject(project, sessionTitle);
      }
      if (mod && e.key === "e") {
        e.preventDefault();
        if (!isRendering) {
          const project = getProjectJSON();
          exportVideo(project, {});
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [getProjectJSON, saveProject, exportVideo, sessionTitle, isRendering]);

  // ─── Complete Apex studioConfig ───

  const studioConfig = {
    videoProps: { width: 1920, height: 1080, backgroundColor: "#000000" },
    playerProps: { quality: 1, maxWidth: 1920, maxHeight: 1080 },
    canvasMode: true,
    canvasConfig: { enableShiftAxisLock: true, lockAspectRatio: true },
    fps: 30,
    elementColors: APEX_ELEMENT_COLORS,
    timelineTickConfigs: APEX_TIMELINE_TICK_CONFIGS,
    timelineZoomConfig: APEX_TIMELINE_ZOOM,
    saveProject,
    loadProject,
    exportVideo,
  };

  // ─── Project browser ───

  const openBrowser = useCallback(async () => {
    setBrowserOpen(true);
    if (!projectsLoaded) {
      const result = await listProjects();
      setProjects(result);
      setProjectsLoaded(true);
    }
  }, [listProjects, projectsLoaded]);

  const handleSelectProject = useCallback(async (projectId: string) => {
    if (loadedProjectIds.has(projectId)) return;

    try {
      const { clips, images } = await loadProjectClips(projectId);
      const counts = await loadClipsIntoLibrary(clips, images, BrowserMediaManager);

      setLoadedProjectIds(prev => new Set(prev).add(projectId));
      setMediaCounts(prev => ({
        videos: prev.videos + counts.videos,
        images: prev.images + counts.images,
      }));

      const project = projects.find(p => p.id === projectId);
      toast.success(`Loaded ${counts.videos} clips from "${project?.title || "project"}"`);
    } catch (err) {
      console.error("[Apex] Failed to load project clips:", err);
      toast.error("Failed to load clips. Please try again.");
    }
  }, [loadedProjectIds, loadProjectClips, BrowserMediaManager, projects]);

  // ─── Mobile guard ───
  if (isMobile) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[hsl(var(--background))] gap-5 p-6">
        <Logo size="lg" />
        <div className="text-center space-y-2">
          <div className="flex items-center gap-2 justify-center text-muted-foreground">
            <Monitor className="w-5 h-5" />
            <h2 className="text-sm font-semibold text-foreground">Desktop Required</h2>
          </div>
          <p className="text-xs text-muted-foreground/70 max-w-[280px]">
            Apex Studio requires a desktop browser for the best editing experience.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate("/projects")}>
          Back to Projects
        </Button>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-[hsl(var(--background))] overflow-hidden relative">
      {/* Apex accent line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent z-20" />

      {/* Apex top bar */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="h-12 flex items-center justify-between px-3 border-b border-border/30 bg-card/90 backdrop-blur-2xl shrink-0 z-10"
      >
        {/* Left */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/projects")}
            className="text-muted-foreground/60 hover:text-foreground gap-1 hover:bg-accent/50 h-8 px-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="text-[12px] hidden sm:inline">Back</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={openBrowser}
            className="h-8 px-3 text-[11px] gap-1.5 rounded-full border-border/30 hover:border-primary/30 hover:bg-primary/5"
          >
            <FolderOpen className="w-3 h-3" />
            <span>Import Clips</span>
          </Button>
        </div>

        {/* Center — Apex branding + title */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2.5">
          <Logo size="sm" />
          <span className="text-[12px] font-semibold tracking-tight font-display bg-gradient-to-r from-primary to-violet-400 bg-clip-text text-transparent">
            Apex Studio
          </span>
          <span className="text-[10px] text-muted-foreground/40 mx-1">|</span>
          <span className="text-[11px] text-muted-foreground/60 max-w-[160px] truncate">
            {sessionTitle}
          </span>
          {hasUnsavedChanges && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400/80" title="Unsaved changes" />
          )}
          {(mediaCounts.videos > 0 || mediaCounts.images > 0) && (
            <div className="flex items-center gap-1 ml-2 text-[10px] text-emerald-400/60">
              <Check className="w-2.5 h-2.5" />
              {mediaCounts.videos} clips, {mediaCounts.images} images
            </div>
          )}
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-muted-foreground/30 hidden lg:inline mr-1">
            Ctrl+S save · Ctrl+E export
          </span>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const project = getProjectJSON();
              saveProject(project, sessionTitle);
            }}
            disabled={saving}
            className="h-8 px-3 text-[11px] gap-1.5 text-muted-foreground hover:text-foreground"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            <span className="hidden sm:inline">Save</span>
          </Button>

          {isRendering ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => reset()}
              className="h-8 px-4 text-[11px] font-semibold rounded-full gap-1.5 border-destructive/30 text-destructive"
            >
              <X className="w-3 h-3" />
              <span>{Math.round(progress * 100)}%</span>
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => {
                const project = getProjectJSON();
                exportVideo(project, {});
              }}
              className="h-8 px-4 text-[11px] font-semibold rounded-full gap-1.5 relative overflow-hidden group border-0"
              style={{
                background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(270 80% 60%))',
                color: 'white',
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              <Download className="w-3 h-3" />
              <span>Export</span>
            </Button>
          )}
        </div>
      </motion.div>

      {/* Render progress bar */}
      <AnimatePresence>
        {isRendering && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-0.5 bg-muted/30 shrink-0 z-10"
          >
            <div
              className="h-full bg-gradient-to-r from-primary via-violet-400 to-primary transition-all duration-300"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Twick Studio with full Apex config */}
      <div className="flex-1 min-h-0">
        <TwickStudio studioConfig={studioConfig} />
      </div>

      {/* Project Browser overlay */}
      <ProjectBrowser
        open={browserOpen}
        onClose={() => setBrowserOpen(false)}
        projects={projects}
        loadingProjects={!projectsLoaded && clipsLoading}
        onSelectProject={handleSelectProject}
        loadingClips={clipsLoading}
        loadedProjectIds={loadedProjectIds}
      />

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
