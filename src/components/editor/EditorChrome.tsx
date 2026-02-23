import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Download, Loader2, FolderOpen, Check, Save, X, Monitor, Film,
  Keyboard, Sparkles, Layers, Clock, Zap
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useEditorClips, EditorClip, EditorImage, ProjectSummary } from "@/hooks/useEditorClips";
import { useEditorStitch } from "@/hooks/useEditorStitch";
import { useStudioLayoutFix } from "@/hooks/useStudioLayoutFix";
import { ProjectBrowser } from "@/components/editor/ProjectBrowser";
import { Logo } from "@/components/ui/Logo";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  const [showShortcuts, setShowShortcuts] = useState(false);

  const { listProjects, loadProjectClips, loading: clipsLoading } = useEditorClips();
  const { submitStitch, isStitching, progress: stitchProgress, reset: resetStitch } = useEditorStitch();
  const [autoLoadDone, setAutoLoadDone] = useState(false);

  // ─── Get timeline context for real ProjectJSON access ───
  const { editor, present } = useTimelineContext();

  // ─── Apply element colors via SDK API ───
  useEffect(() => {
    if (setElementColors) {
      try { setElementColors(APEX_ELEMENT_COLORS); } catch {}
    }
  }, [setElementColors]);

  // ─── Force timeline layout fix (SDK uses hardcoded 80dvh) ───
  useStudioLayoutFix('.studio-container');

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
    if (present && present.tracks?.length > 0) return present;
    return null;
  }, [present]);

  // ─── Track count from timeline ───
  const trackCount = present?.tracks?.length || 0;
  const elementCount = present?.tracks?.reduce((sum: number, t: any) => sum + (t.elements?.length || 0), 0) || 0;

  // ─── StudioConfig callbacks ───

  const saveProject = useCallback(async (project: any, fileName: string) => {
    if (!user) return { status: false, message: "Not signed in" };
    setSaving(true);
    try {
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

  // ─── Server-side crossfade stitch ───
  const handleStitch = useCallback(async () => {
    if (!sessionId) {
      const project = getProjectJSON();
      const result = await saveProject(project, sessionTitle);
      if (!result.status) return;
    }

    const projectData = getProjectJSON();
    if (!projectData?.tracks?.length) {
      toast.error("No clips on timeline to stitch");
      return;
    }

    const clips: { url: string; duration: number }[] = [];
    for (const track of projectData.tracks) {
      for (const element of track.elements || []) {
        if (element.type === "video" && element.props?.src) {
          clips.push({
            url: element.props.src,
            duration: (element.e - element.s) || 6,
          });
        }
      }
    }

    if (clips.length < 2) {
      toast.error("Need at least 2 video clips on the timeline to stitch");
      return;
    }

    const currentSessionId = new URLSearchParams(window.location.search).get("session") || sessionId;
    if (!currentSessionId) {
      toast.error("Please save the project first");
      return;
    }

    await submitStitch(currentSessionId, clips, {
      crossfadeDuration: 0.5,
      transition: "fade",
    });
  }, [sessionId, getProjectJSON, saveProject, sessionTitle, submitStitch]);

  // ─── Auto-load all project clips into media library on mount ───
  useEffect(() => {
    if (!user || autoLoadDone) return;
    let cancelled = false;

    (async () => {
      try {
        const projectList = await listProjects();
        if (cancelled || projectList.length === 0) {
          setAutoLoadDone(true);
          return;
        }
        setProjects(projectList);
        setProjectsLoaded(true);

        let totalVideos = 0;
        let totalImages = 0;
        const loaded = new Set<string>();

        for (const project of projectList) {
          if (cancelled) break;
          const { clips, images } = await loadProjectClips(project.id);
          const counts = await loadClipsIntoLibrary(clips, images, BrowserMediaManager);
          totalVideos += counts.videos;
          totalImages += counts.images;
          loaded.add(project.id);
        }

        if (!cancelled) {
          setLoadedProjectIds(loaded);
          setMediaCounts({ videos: totalVideos, images: totalImages });
          if (totalVideos > 0) {
            toast.success(`Loaded ${totalVideos} clips from ${loaded.size} project${loaded.size !== 1 ? "s" : ""}`);
          }
        }
      } catch (err) {
        console.error("[Apex] Auto-load clips failed:", err);
      } finally {
        if (!cancelled) setAutoLoadDone(true);
      }
    })();

    return () => { cancelled = true; };
  }, [user, autoLoadDone, listProjects, loadProjectClips, BrowserMediaManager]);

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
      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        // Don't trigger if typing in an input
        if ((e.target as HTMLElement)?.tagName !== "INPUT" && (e.target as HTMLElement)?.tagName !== "TEXTAREA") {
          setShowShortcuts(prev => !prev);
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
    <TooltipProvider delayDuration={300}>
      <div className="h-screen w-screen flex flex-col bg-[hsl(var(--background))] overflow-hidden relative">
        {/* Apex accent line — top */}
        <div className="absolute top-0 left-0 right-0 h-px z-20">
          <div className="h-full bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          {isRendering && (
            <motion.div
              className="absolute inset-0 h-px bg-gradient-to-r from-primary via-violet-400 to-primary"
              style={{ width: `${Math.round(progress * 100)}%` }}
              transition={{ duration: 0.3 }}
            />
          )}
        </div>

        {/* ═══════════════ PREMIUM TOP BAR ═══════════════ */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="h-14 flex items-center justify-between px-4 border-b border-border/20 shrink-0 z-10 relative"
          style={{
            background: 'linear-gradient(180deg, hsla(240, 25%, 6%, 0.98) 0%, hsla(240, 25%, 4%, 0.95) 100%)',
            backdropFilter: 'blur(24px) saturate(1.5)',
          }}
        >
          {/* Left section — Navigation + Import */}
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/projects")}
                  className="text-muted-foreground/50 hover:text-foreground gap-1.5 hover:bg-muted/50"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Back to Projects</TooltipContent>
            </Tooltip>

            <div className="w-px h-5 bg-border/20 mx-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openBrowser}
                  className="gap-2 border-border/30 hover:border-primary/30 hover:bg-primary/5"
                >
                  <FolderOpen className="w-4 h-4" />
                  <span>{!autoLoadDone ? "Syncing…" : "Import"}</span>
                  {!autoLoadDone && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary/60" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Import clips from your projects</TooltipContent>
            </Tooltip>

            {/* Media count badge */}
            <AnimatePresence>
              {autoLoadDone && mediaCounts.videos > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/10 border border-success/20"
                >
                  <Check className="w-3.5 h-3.5 text-success" />
                  <span className="text-xs font-medium text-success/80">
                    {mediaCounts.videos} clips
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Center — Branding + Session Title */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <Logo size="sm" />
              <div className="flex flex-col items-start">
                <span className="text-xs font-bold tracking-tight font-display bg-gradient-to-r from-primary via-violet-400 to-primary bg-clip-text text-transparent leading-tight">
                  APEX STUDIO
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground/50 max-w-[180px] truncate leading-tight">
                    {sessionTitle}
                  </span>
                  {hasUnsavedChanges && (
                    <motion.span
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="w-1.5 h-1.5 rounded-full bg-warning"
                      title="Unsaved changes"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right — Actions */}
          <div className="flex items-center gap-1.5">
            {/* Shortcuts toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowShortcuts(prev => !prev)}
                  className="w-9 h-9 p-0 text-muted-foreground/40 hover:text-foreground"
                >
                  <Keyboard className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Keyboard shortcuts (?)</TooltipContent>
            </Tooltip>

            <div className="w-px h-5 bg-border/20 mx-0.5" />

            {/* Save */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const project = getProjectJSON();
                    saveProject(project, sessionTitle);
                  }}
                  disabled={saving}
                  className="gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span className="hidden sm:inline">Save</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Save project (⌘S)</TooltipContent>
            </Tooltip>

            {/* Stitch */}
            <Tooltip>
              <TooltipTrigger asChild>
                {isStitching ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => resetStitch()}
                    className="font-semibold gap-1.5 border-primary/30 text-primary bg-primary/5"
                  >
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Stitching {Math.round(stitchProgress)}%</span>
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleStitch}
                    disabled={isRendering}
                    className="gap-1.5 border-border/30 hover:border-primary/30 hover:bg-primary/5 text-muted-foreground hover:text-foreground"
                  >
                    <Film className="w-4 h-4" />
                    <span className="hidden sm:inline">Stitch</span>
                  </Button>
                )}
              </TooltipTrigger>
              <TooltipContent side="bottom">Server-side stitch with crossfade</TooltipContent>
            </Tooltip>

            {/* Export */}
            {isRendering ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => reset()}
                className="font-semibold gap-1.5 border-destructive/30 text-destructive bg-destructive/5"
              >
                <X className="w-4 h-4" />
                <span>Cancel {Math.round(progress * 100)}%</span>
              </Button>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    onClick={() => {
                      const project = getProjectJSON();
                      exportVideo(project, {});
                    }}
                    disabled={isStitching}
                    className="px-5 font-semibold gap-2 relative overflow-hidden group border-0 shadow-lg shadow-primary/20"
                    style={{
                      background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(270 80% 60%))',
                      color: 'white',
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                    <Download className="w-4 h-4" />
                    <span>Export MP4</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Export video (⌘E)</TooltipContent>
              </Tooltip>
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
              className="h-0.5 bg-muted/20 shrink-0 z-10 relative"
            >
              <motion.div
                className="h-full bg-gradient-to-r from-primary via-violet-400 to-primary"
                style={{ width: `${Math.round(progress * 100)}%` }}
                transition={{ duration: 0.3 }}
              />
              <div className="absolute right-0 top-0 w-8 h-full bg-gradient-to-l from-primary/40 to-transparent animate-pulse" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Twick Studio */}
        <div className="flex-1 min-h-0 studio-container">
          <TwickStudio studioConfig={studioConfig} />
        </div>

        {/* ═══════════════ PREMIUM STATUS BAR ═══════════════ */}
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="h-7 flex items-center justify-between px-4 border-t border-border/15 shrink-0 z-10 select-none"
          style={{
            background: 'hsla(240, 25%, 5%, 0.95)',
          }}
        >
          {/* Left — Timeline stats */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground/40">
            <div className="flex items-center gap-1">
              <Layers className="w-3 h-3" />
              <span>{trackCount} track{trackCount !== 1 ? 's' : ''}</span>
            </div>
            <div className="w-px h-3 bg-border/15" />
            <div className="flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              <span>{elementCount} element{elementCount !== 1 ? 's' : ''}</span>
            </div>
            {mediaCounts.videos > 0 && (
              <>
                <div className="w-px h-3 bg-border/15" />
                <div className="flex items-center gap-1">
                  <Film className="w-3 h-3" />
                  <span>{mediaCounts.videos} in library</span>
                </div>
              </>
            )}
          </div>

          {/* Center — Session status */}
          <div className="flex items-center gap-2 text-xs">
            {hasUnsavedChanges ? (
              <span className="text-warning/60 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Unsaved changes
              </span>
            ) : (
              <span className="text-success/40 flex items-center gap-1">
                <Check className="w-3 h-3" />
                Saved
              </span>
            )}
          </div>

          {/* Right — Render info */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground/40">
            <span>1920×1080</span>
            <div className="w-px h-3 bg-border/15" />
            <span>30fps</span>
            <div className="w-px h-3 bg-border/15" />
            <div className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-primary/40" />
              <span>WebCodecs</span>
            </div>
          </div>
        </motion.div>

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

        {/* ═══════════════ KEYBOARD SHORTCUTS PANEL ═══════════════ */}
        <AnimatePresence>
          {showShortcuts && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
              onClick={() => setShowShortcuts(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 12 }}
                transition={{ duration: 0.2 }}
                className="w-full max-w-sm rounded-2xl border border-border/20 bg-card/95 backdrop-blur-2xl shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-5 py-4 border-b border-border/20">
                  <div className="flex items-center gap-2">
                    <Keyboard className="w-4 h-4 text-primary" />
                    <h2 className="text-sm font-semibold text-foreground font-display">Keyboard Shortcuts</h2>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setShowShortcuts(false)} className="h-7 w-7 p-0">
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="p-5 space-y-3">
                  {[
                    { keys: "⌘ S", label: "Save project" },
                    { keys: "⌘ E", label: "Export video" },
                    { keys: "⌘ Z", label: "Undo" },
                    { keys: "⌘ ⇧ Z", label: "Redo" },
                    { keys: "Space", label: "Play / Pause" },
                    { keys: "?", label: "Toggle shortcuts" },
                  ].map((shortcut) => (
                    <div key={shortcut.keys} className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground/70">{shortcut.label}</span>
                      <kbd className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted/30 border border-border/20 text-muted-foreground/60">
                        {shortcut.keys}
                      </kbd>
                    </div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating notifications */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8 }}
              className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-destructive/90 text-destructive-foreground text-xs font-medium px-5 py-2.5 rounded-full backdrop-blur-xl border border-destructive/30 shadow-lg z-20"
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
              className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-emerald-500/90 text-white text-xs font-medium px-5 py-2.5 rounded-full backdrop-blur-xl border border-emerald-400/30 shadow-lg z-20 flex items-center gap-2"
            >
              <Check className="w-3 h-3" /> Video downloaded
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </TooltipProvider>
  );
}
