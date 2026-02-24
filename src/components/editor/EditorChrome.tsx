import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Download, Loader2, FolderOpen, Check, Save, X, Monitor, Film,
  Keyboard, Sparkles, Layers, Clock, Zap, ExternalLink
} from "lucide-react";
import { mergeVideoClips, downloadBlob } from "@/lib/video/browserVideoMerger";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useEditorClips, EditorClip, EditorImage, ProjectSummary } from "@/hooks/useEditorClips";
import { useEditorStitch } from "@/hooks/useEditorStitch";
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
import { VideoPreviewPlayer } from "@/components/editor/VideoPreviewPlayer";
import { CustomTimeline } from "@/components/editor/CustomTimeline";
import { MediaSidebar } from "@/components/editor/MediaSidebar";
import { ClipPropertiesPanel } from "@/components/editor/ClipPropertiesPanel";
import { TextClipDialog } from "@/components/editor/TextClipDialog";
import {
  useCustomTimeline,
  toProjectJSON,
  fromProjectJSON,
  generateClipId,
  generateTrackId,
  TimelineClip,
} from "@/hooks/useCustomTimeline";

interface EditorChromeProps {
  /** Still passed for WebCodecs export — SDK render engine kept */
  useBrowserRenderer?: any;
  navigate: any;
}

export function EditorChrome({
  useBrowserRenderer,
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
  const [availableClips, setAvailableClips] = useState<EditorClip[]>([]);
  const [textDialogOpen, setTextDialogOpen] = useState(false);

  const { listProjects, loadProjectClips, loading: clipsLoading } = useEditorClips();
  const { submitStitch, isStitching, progress: stitchProgress, reset: resetStitch } = useEditorStitch();
  const [autoLoadDone, setAutoLoadDone] = useState(false);

  // ─── Custom timeline state ───
  const { state: timelineState, dispatch } = useCustomTimeline();

  // ─── WebCodecs renderer (optional — kept for export) ───
  const renderer = useBrowserRenderer?.({
    width: 1920,
    height: 1080,
    fps: 30,
    quality: "high" as const,
    includeAudio: true,
    autoDownload: true,
    downloadFilename: `Apex_${sessionTitle.replace(/\s+/g, "_")}.mp4`,
  });
  const isRendering = renderer?.isRendering ?? false;
  const renderProgress = renderer?.progress ?? 0;
  const renderError = renderer?.error ?? null;

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
    if (timelineState.tracks.some(t => t.clips.length > 0)) {
      setHasUnsavedChanges(true);
    }
  }, [timelineState.tracks]);

  // ─── Helper: get current project JSON ───
  const getProjectJSON = useCallback(() => {
    return toProjectJSON(timelineState);
  }, [timelineState]);

  // ─── Track/element counts ───
  const trackCount = timelineState.tracks.length;
  const elementCount = timelineState.tracks.reduce((sum, t) => sum + t.clips.length, 0);

  // ─── Save ───
  const saveProject = useCallback(async (fileName?: string) => {
    if (!user) return { status: false, message: "Not signed in" };
    setSaving(true);
    try {
      const projectData = getProjectJSON();
      if (!projectData.tracks?.length || !projectData.tracks.some((t: any) => t.elements?.length > 0)) {
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

  // ─── Load session ───
  useEffect(() => {
    if (!user || !sessionId) return;
    let cancelled = false;

    (async () => {
      try {
        const { data, error: err } = await supabase
          .from("edit_sessions")
          .select("timeline_data, title")
          .eq("id", sessionId)
          .eq("user_id", user.id)
          .single();
        if (err || cancelled) return;
        if (data.title) setSessionTitle(data.title);

        const parsed = fromProjectJSON(data.timeline_data);
        if (parsed.tracks) {
          dispatch({ type: "LOAD_PROJECT", state: parsed });
        }
        setHasUnsavedChanges(false);
        toast.success("Session restored");
      } catch (err) {
        console.error("Load failed:", err);
      }
    })();

    return () => { cancelled = true; };
  }, [user, sessionId, dispatch]);

  // ─── Export ───
  const [isDownloading, setIsDownloading] = useState(false);

  // ─── Open in OpenReel ───
  const handleOpenInOpenReel = useCallback(async () => {
    const projectData = getProjectJSON();
    const clipUrls: { url: string; name: string }[] = [];
    let idx = 0;
    for (const track of projectData.tracks || []) {
      for (const el of track.elements || []) {
        if (el.type === "video" && el.props?.src) {
          idx++;
          clipUrls.push({ url: el.props.src, name: `${sessionTitle.replace(/\s+/g, "_")}_clip_${idx}.mp4` });
        }
      }
    }

    if (clipUrls.length === 0) {
      toast.error("No video clips to export — add clips first");
      return;
    }

    toast.info(`Downloading ${clipUrls.length} clip${clipUrls.length > 1 ? "s" : ""} before opening OpenReel…`);

    // Download each clip individually
    for (const clip of clipUrls) {
      try {
        const a = document.createElement("a");
        a.href = clip.url;
        a.download = clip.name;
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        // Small delay between downloads to avoid browser blocking
        await new Promise(r => setTimeout(r, 400));
      } catch (err) {
        console.warn("Failed to download clip:", clip.name, err);
      }
    }

    toast.success("Clips downloaded! Import them into OpenReel to continue editing.");
    window.open("https://openreel.video", "_blank", "noopener,noreferrer");
  }, [getProjectJSON, sessionTitle]);

  const exportVideo = useCallback(async () => {
    const projectData = getProjectJSON();
    if (!projectData.tracks?.length) {
      toast.error("Nothing to export — add clips first");
      return;
    }

    // Collect clip URLs from timeline
    const clipUrls: string[] = [];
    for (const track of projectData.tracks || []) {
      for (const el of track.elements || []) {
        if (el.type === "video" && el.props?.src) {
          clipUrls.push(el.props.src);
        }
      }
    }

    if (clipUrls.length === 0) {
      toast.error("No video clips to export");
      return;
    }

    setIsDownloading(true);
    toast.info(`Downloading ${clipUrls.length} clip${clipUrls.length > 1 ? "s" : ""}…`);

    try {
      const result = await mergeVideoClips({
        clipUrls,
        projectName: sessionTitle.replace(/\s+/g, "_"),
        onProgress: (p) => {
          if (p.stage === "error") toast.error(p.message || "Download failed");
        },
      });

      if (result.success && result.blob && result.filename) {
        downloadBlob(result.blob, result.filename);
        setShowSuccess(true);
        toast.success("Export complete!");
      } else {
        toast.error(result.error || "Export failed");
      }
    } catch (err) {
      console.error("Export download failed:", err);
      toast.error("Export failed. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  }, [getProjectJSON, sessionTitle]);

  // ─── Stitch ───
  const handleStitch = useCallback(async () => {
    if (!sessionId) {
      const result = await saveProject(sessionTitle);
      if (!result.status) return;
    }

    const projectData = getProjectJSON();
    const clips: { url: string; duration: number }[] = [];
    for (const track of projectData.tracks || []) {
      for (const el of track.elements || []) {
        if (el.type === "video" && el.props?.src) {
          clips.push({ url: el.props.src, duration: (el.e - el.s) || 6 });
        }
      }
    }

    if (clips.length < 2) {
      toast.error("Need at least 2 video clips to stitch");
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

  // ─── Auto-load clips from all projects ───
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

        const allClips: EditorClip[] = [];
        const loaded = new Set<string>();

        for (const project of projectList) {
          if (cancelled) break;
          const { clips } = await loadProjectClips(project.id);
          allClips.push(...clips);
          loaded.add(project.id);
        }

        if (!cancelled) {
          setAvailableClips(allClips);
          setLoadedProjectIds(loaded);
          setMediaCounts({ videos: allClips.length, images: 0 });
          if (allClips.length > 0) {
            toast.success(`Loaded ${allClips.length} clips from ${loaded.size} project${loaded.size !== 1 ? "s" : ""}`);
          }
        }
      } catch (err) {
        console.error("[Apex] Auto-load clips failed:", err);
      } finally {
        if (!cancelled) setAutoLoadDone(true);
      }
    })();

    return () => { cancelled = true; };
  }, [user, autoLoadDone, listProjects, loadProjectClips]);

  // ─── Keyboard shortcuts ───
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "s") {
        e.preventDefault();
        saveProject(sessionTitle);
      }
      if (mod && e.key === "e") {
        e.preventDefault();
        if (!isRendering) exportVideo();
      }
      if (e.key === " " && (e.target as HTMLElement)?.tagName !== "INPUT") {
        e.preventDefault();
        dispatch({ type: "SET_PLAYING", playing: !timelineState.isPlaying });
      }
      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        if ((e.target as HTMLElement)?.tagName !== "INPUT" && (e.target as HTMLElement)?.tagName !== "TEXTAREA") {
          setShowShortcuts(prev => !prev);
        }
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (timelineState.selectedClipId && timelineState.selectedTrackId) {
          if ((e.target as HTMLElement)?.tagName !== "INPUT" && (e.target as HTMLElement)?.tagName !== "TEXTAREA") {
            dispatch({ type: "REMOVE_CLIP", trackId: timelineState.selectedTrackId, clipId: timelineState.selectedClipId });
          }
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saveProject, exportVideo, sessionTitle, isRendering, timelineState.isPlaying, timelineState.selectedClipId, timelineState.selectedTrackId, dispatch]);

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
      const { clips } = await loadProjectClips(projectId);
      setAvailableClips(prev => [...prev, ...clips]);
      setLoadedProjectIds(prev => new Set(prev).add(projectId));
      setMediaCounts(prev => ({ ...prev, videos: prev.videos + clips.length }));

      const project = projects.find(p => p.id === projectId);
      toast.success(`Loaded ${clips.length} clips from "${project?.title || "project"}"`);
    } catch (err) {
      console.error("[Apex] Failed to load project clips:", err);
      toast.error("Failed to load clips. Please try again.");
    }
  }, [loadedProjectIds, loadProjectClips, projects]);

  // ─── Add clip to timeline from media sidebar ───
  const handleAddClipToTimeline = useCallback((clip: EditorClip) => {
    // Find the first video track, or create one
    let videoTrack = timelineState.tracks.find(t => t.type === "video");
    if (!videoTrack) {
      const newTrackId = generateTrackId();
      dispatch({
        type: "ADD_TRACK",
        track: { id: newTrackId, type: "video", label: "Video 1", clips: [] },
      });
      videoTrack = { id: newTrackId, type: "video" as const, label: "Video 1", clips: [] };
    }

    // Place clip at end of track
    const lastEnd = videoTrack.clips.length > 0
      ? Math.max(...videoTrack.clips.map(c => c.end))
      : 0;
    const duration = clip.durationSeconds || 6;

    const newClip: TimelineClip = {
      id: generateClipId(),
      type: "video",
      src: clip.videoUrl,
      start: lastEnd,
      end: lastEnd + duration,
      trimStart: 0,
      trimEnd: duration,
      name: `Shot ${clip.shotIndex + 1}`,
      thumbnail: clip.thumbnailUrl || undefined,
      sourceDuration: clip.durationSeconds || undefined,
    };

    dispatch({ type: "ADD_CLIP", trackId: videoTrack.id, clip: newClip });
    toast.success(`Added "${newClip.name}" to timeline`);
  }, [timelineState.tracks, dispatch]);

  // ─── Mobile guard ───
  if (isMobile) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-background gap-5 p-6">
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
      <div className="h-screen w-screen flex flex-col bg-background overflow-hidden relative">
        {/* Apex accent line — top */}
        <div className="absolute top-0 left-0 right-0 h-px z-20">
          <div className="h-full bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          {isRendering && (
            <motion.div
              className="absolute inset-0 h-px bg-gradient-to-r from-primary via-violet-400 to-primary"
              style={{ width: `${Math.round(renderProgress * 100)}%` }}
              transition={{ duration: 0.3 }}
            />
          )}
        </div>

        {/* ═══════════════ TOP BAR ═══════════════ */}
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
          {/* Left — Nav + Import */}
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

          {/* Center — Branding (uses flex spacer, not absolute positioning) */}
          <div className="flex-1 min-w-0 flex items-center justify-center">
            <div className="flex items-center gap-2.5 min-w-0">
              <Logo size="sm" />
              <div className="flex flex-col items-start min-w-0">
                <span className="text-xs font-bold tracking-tight font-display bg-gradient-to-r from-primary via-violet-400 to-primary bg-clip-text text-transparent leading-tight whitespace-nowrap">
                  APEX STUDIO
                </span>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs text-muted-foreground/50 max-w-[160px] truncate leading-tight">
                    {sessionTitle}
                  </span>
                  {hasUnsavedChanges && (
                    <motion.span
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="w-1.5 h-1.5 rounded-full bg-warning shrink-0"
                      title="Unsaved changes"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right — Actions */}
          <div className="flex items-center gap-1.5">
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

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => saveProject(sessionTitle)}
                  disabled={saving}
                  className="gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span className="hidden sm:inline">Save</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Save project (⌘S)</TooltipContent>
            </Tooltip>

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

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleOpenInOpenReel}
                  disabled={isRendering || isStitching}
                  className="gap-1.5 border-border/30 hover:border-primary/30 hover:bg-primary/5 text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span className="hidden sm:inline">OpenReel</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[220px] text-center">
                Open your clips in OpenReel Video — a professional open-source browser editor with full export support
              </TooltipContent>
            </Tooltip>

            {isRendering ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => renderer?.reset()}
                className="font-semibold gap-1.5 border-destructive/30 text-destructive bg-destructive/5"
              >
                <X className="w-4 h-4" />
                <span>Cancel {Math.round(renderProgress * 100)}%</span>
              </Button>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    onClick={exportVideo}
                    disabled={isStitching || isDownloading}
                    className="px-5 font-semibold gap-2 relative overflow-hidden group border-0 shadow-lg shadow-primary/20"
                    style={{
                      background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(270 80% 60%))',
                      color: 'white',
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                    {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    <span>{isDownloading ? "Downloading…" : "Export MP4"}</span>
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
                style={{ width: `${Math.round(renderProgress * 100)}%` }}
                transition={{ duration: 0.3 }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══════════════ MAIN EDITOR LAYOUT ═══════════════ */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* Left — Media sidebar */}
          <MediaSidebar
            clips={availableClips}
            loading={!autoLoadDone}
            onAddClip={handleAddClipToTimeline}
          />

          {/* Center — Player + Timeline */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            {/* Video player — top 40% */}
            <VideoPreviewPlayer className="h-[40%] shrink-0" />

            {/* Timeline — bottom 60% (permanently raised) */}
            <CustomTimeline className="flex-1 min-h-0" onOpenTextDialog={() => setTextDialogOpen(true)} />
          </div>

          {/* Right — Properties panel */}
          <ClipPropertiesPanel />
        </div>

        {/* ═══════════════ STATUS BAR ═══════════════ */}
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="h-7 flex items-center px-4 border-t border-border/15 shrink-0 z-10 select-none overflow-hidden"
          style={{ background: 'hsla(240, 25%, 5%, 0.95)' }}
        >
          {/* Left stats */}
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground/40 shrink-0 whitespace-nowrap">
            <span className="flex items-center gap-1">
              <Layers className="w-3 h-3 shrink-0" />
              {trackCount} track{trackCount !== 1 ? "s" : ""}
            </span>
            <span className="text-border/20">·</span>
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 shrink-0" />
              {elementCount} clip{elementCount !== 1 ? "s" : ""}
            </span>
            {mediaCounts.videos > 0 && (
              <>
                <span className="text-border/20">·</span>
                <span>{mediaCounts.videos} in library</span>
              </>
            )}
          </div>

          {/* Center status */}
          <div className="flex-1 min-w-0 flex items-center justify-center">
            <div className="text-[10px]">
              {hasUnsavedChanges ? (
                <span className="text-warning/60 flex items-center gap-1">
                  <Clock className="w-3 h-3 shrink-0" />
                  Unsaved
                </span>
              ) : (
                <span className="text-success/40 flex items-center gap-1">
                  <Check className="w-3 h-3 shrink-0" />
                  Saved
                </span>
              )}
            </div>
          </div>

          {/* Right info */}
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground/40 shrink-0 whitespace-nowrap">
            <span>1920×1080</span>
            <span className="text-border/20">·</span>
            <span>30fps</span>
            <span className="text-border/20">·</span>
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-primary/40 shrink-0" />
              WebCodecs
            </span>
          </div>
        </motion.div>

        {/* Text Clip Dialog */}
        <TextClipDialog open={textDialogOpen} onOpenChange={setTextDialogOpen} />

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

        {/* Keyboard shortcuts panel */}
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
                <div className="p-5 space-y-2.5">
                  {[
                    { keys: "⌘ S", label: "Save project" },
                    { keys: "⌘ E", label: "Export video" },
                    { keys: "Space", label: "Play / Pause" },
                    { keys: "⌘ Z", label: "Undo" },
                    { keys: "⌘ Y", label: "Redo" },
                    { keys: "Delete", label: "Remove selected clip" },
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
          {renderError && (
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8 }}
              className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-destructive/90 text-destructive-foreground text-xs font-medium px-5 py-2.5 rounded-full backdrop-blur-xl border border-destructive/30 shadow-lg z-20"
            >
              Export error: {renderError.message}
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
