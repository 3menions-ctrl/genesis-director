import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Download, Loader2, FolderOpen, Check, Save, X, Monitor, Film,
  Keyboard, Sparkles, Layers, Clock, Zap, ExternalLink, Trash2, RectangleHorizontal,
  Edit3
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
  const [isRenamingSession, setIsRenamingSession] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  const { listProjects, loadProjectClips, loading: clipsLoading } = useEditorClips();
  const { submitStitch, isStitching, progress: stitchProgress, reset: resetStitch } = useEditorStitch();
  const [autoLoadDone, setAutoLoadDone] = useState(false);

  const { state: timelineState, dispatch } = useCustomTimeline();

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

  useEffect(() => {
    if (showSuccess) {
      const t = setTimeout(() => setShowSuccess(false), 4000);
      return () => clearTimeout(t);
    }
  }, [showSuccess]);

  useEffect(() => {
    if (timelineState.tracks.some(t => t.clips.length > 0)) {
      setHasUnsavedChanges(true);
    }
  }, [timelineState.tracks]);

  const getProjectJSON = useCallback(() => {
    return toProjectJSON(timelineState);
  }, [timelineState]);

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

    for (const clip of clipUrls) {
      try {
        const a = document.createElement("a");
        a.href = clip.url;
        a.download = clip.name;
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
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
      if (e.key === "Home") {
        e.preventDefault();
        dispatch({ type: "SET_PLAYHEAD", time: 0 });
      }
      if (e.key === "End") {
        e.preventDefault();
        dispatch({ type: "SET_PLAYHEAD", time: timelineState.duration });
      }
      if (e.key === "d" && !mod && (e.target as HTMLElement)?.tagName !== "INPUT" && (e.target as HTMLElement)?.tagName !== "TEXTAREA") {
        if (timelineState.selectedClipId && timelineState.selectedTrackId) {
          const track = timelineState.tracks.find(t => t.id === timelineState.selectedTrackId);
          const clip = track?.clips.find(c => c.id === timelineState.selectedClipId);
          if (clip) {
            dispatch({
              type: "ADD_CLIP",
              trackId: timelineState.selectedTrackId,
              clip: { ...clip, id: generateClipId(), start: clip.end, end: clip.end + (clip.end - clip.start), name: `${clip.name} (copy)` },
            });
          }
        }
      }
      if (e.key === "l" && !mod && (e.target as HTMLElement)?.tagName !== "INPUT" && (e.target as HTMLElement)?.tagName !== "TEXTAREA") {
        dispatch({ type: "SET_LOOP", looping: !timelineState.isLooping });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saveProject, exportVideo, sessionTitle, isRendering, timelineState, dispatch]);

  // ─── Auto-save ───
  useEffect(() => {
    if (!user || !hasUnsavedChanges) return;
    const timer = setInterval(() => {
      if (hasUnsavedChanges && timelineState.tracks.some(t => t.clips.length > 0)) {
        saveProject(sessionTitle).then(result => {
          if (result.status) {
            toast.info("Auto-saved", { duration: 1500 });
          }
        });
      }
    }, 60000);
    return () => clearInterval(timer);
  }, [user, hasUnsavedChanges, saveProject, sessionTitle, timelineState.tracks]);

  const handleClearTimeline = useCallback(() => {
    if (!timelineState.tracks.some(t => t.clips.length > 0)) return;
    dispatch({ type: "CLEAR_TIMELINE" });
    toast.success("Timeline cleared");
  }, [dispatch, timelineState.tracks]);

  const startRename = useCallback(() => {
    setRenameValue(sessionTitle);
    setIsRenamingSession(true);
  }, [sessionTitle]);

  const finishRename = useCallback(() => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== sessionTitle) {
      setSessionTitle(trimmed);
      setHasUnsavedChanges(true);
      toast.success("Session renamed");
    }
    setIsRenamingSession(false);
  }, [renameValue, sessionTitle]);

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

  const handleAddClipToTimeline = useCallback((clip: EditorClip) => {
    let videoTrack = timelineState.tracks.find(t => t.type === "video");
    if (!videoTrack) {
      const newTrackId = generateTrackId();
      dispatch({
        type: "ADD_TRACK",
        track: { id: newTrackId, type: "video", label: "Video 1", clips: [] },
      });
      videoTrack = { id: newTrackId, type: "video" as const, label: "Video 1", clips: [] };
    }

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
      <div className="h-screen w-screen flex flex-col overflow-hidden relative" style={{ background: 'hsl(240 25% 4%)' }}>
        {/* Apex accent line — top */}
        <div className="absolute top-0 left-0 right-0 h-px z-20">
          <div className="h-full bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
          {isRendering && (
            <motion.div
              className="absolute inset-0 h-px bg-gradient-to-r from-primary via-violet-400 to-primary"
              style={{ width: `${Math.round(renderProgress * 100)}%` }}
              transition={{ duration: 0.3 }}
            />
          )}
        </div>

        {/* ═══════════════ TOP BAR — Premium grouped header ═══════════════ */}
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="h-12 flex items-center px-3 shrink-0 z-10 relative gap-2"
          style={{
            background: 'linear-gradient(180deg, hsl(240 18% 7%) 0%, hsl(240 22% 5.5%) 100%)',
            borderBottom: '1px solid hsla(263, 70%, 58%, 0.06)',
          }}
        >
          {/* ── Left group: Back + Session name ── */}
          <div className="flex items-center gap-2 min-w-0 shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => navigate("/projects")}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground/40 hover:text-foreground hover:bg-white/[0.06] transition-all shrink-0"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[10px]">Back to Projects</TooltipContent>
            </Tooltip>

            <div className="w-px h-5 bg-white/[0.06]" />

            {/* Session name */}
            <div className="flex items-center gap-1.5 min-w-0">
              {isRenamingSession ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={finishRename}
                  onKeyDown={(e) => { if (e.key === "Enter") finishRename(); if (e.key === "Escape") setIsRenamingSession(false); }}
                  className="text-[13px] text-foreground bg-white/[0.06] border border-primary/40 rounded-lg px-2.5 py-1 max-w-[200px] outline-none focus:border-primary font-semibold"
                />
              ) : (
                <button onClick={startRename} className="flex items-center gap-1.5 group text-left min-w-0 px-1">
                  <span className="text-[13px] font-semibold text-foreground/70 max-w-[200px] truncate group-hover:text-foreground transition-colors">
                    {sessionTitle}
                  </span>
                  <Edit3 className="w-3 h-3 text-muted-foreground/20 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </button>
              )}
              {hasUnsavedChanges && (
                <motion.div
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded-md shrink-0"
                  style={{ background: 'hsla(45, 90%, 55%, 0.08)' }}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400/80" />
                  <span className="text-[9px] font-medium text-amber-400/60">Unsaved</span>
                </motion.div>
              )}
            </div>
          </div>

          {/* ── Center group: Import + Aspect + Sync status ── */}
          <div className="flex-1 flex items-center justify-center gap-1">
            <div
              className="flex items-center gap-1 px-1 py-0.5 rounded-lg"
              style={{ background: 'hsla(0,0%,100%,0.02)', border: '1px solid hsla(0,0%,100%,0.04)' }}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={openBrowser}
                    className="h-7 flex items-center gap-1.5 px-2.5 rounded-md text-muted-foreground/55 hover:text-foreground hover:bg-white/[0.06] transition-all"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-medium">{!autoLoadDone ? "Syncing…" : "Import"}</span>
                    {!autoLoadDone && <Loader2 className="w-3 h-3 animate-spin text-primary/50" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-[10px]">Import clips from your projects</TooltipContent>
              </Tooltip>

              <div className="w-px h-4 bg-white/[0.06]" />

              <select
                value={timelineState.aspectRatio}
                onChange={(e) => dispatch({ type: "SET_ASPECT_RATIO", ratio: e.target.value as any })}
                className="h-7 text-[11px] bg-transparent border-none rounded-md px-2 text-muted-foreground/55 cursor-pointer hover:text-foreground transition-colors outline-none font-medium"
              >
                <option value="16:9">16:9</option>
                <option value="9:16">9:16</option>
                <option value="1:1">1:1</option>
                <option value="4:3">4:3</option>
              </select>

              <AnimatePresence>
                {autoLoadDone && mediaCounts.videos > 0 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-semibold"
                    style={{ background: 'hsla(142, 60%, 50%, 0.08)', color: 'hsla(142, 60%, 60%, 0.8)' }}
                  >
                    <Check className="w-2.5 h-2.5" />
                    {mediaCounts.videos}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* ── Right group: Actions ── */}
          <div className="flex items-center gap-0.5 shrink-0">
            {/* Utility group */}
            <div
              className="flex items-center gap-0.5 px-0.5 rounded-lg mr-1"
              style={{ background: 'hsla(0,0%,100%,0.015)' }}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleClearTimeline}
                    className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground/30 hover:text-destructive/70 hover:bg-destructive/8 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-[10px]">Clear timeline</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setShowShortcuts(prev => !prev)}
                    className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground/30 hover:text-foreground/70 hover:bg-white/[0.04] transition-all"
                  >
                    <Keyboard className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-[10px]">Shortcuts (?)</TooltipContent>
              </Tooltip>
            </div>

            <div className="w-px h-5 bg-white/[0.06]" />

            {/* Primary actions group */}
            <div className="flex items-center gap-0.5 ml-1">
              {/* Save */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => saveProject(sessionTitle)}
                    disabled={saving}
                    className="h-8 flex items-center gap-1.5 px-3 rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-white/[0.06] transition-all disabled:opacity-40 border border-transparent hover:border-white/[0.06]"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span className="text-[11px] font-semibold hidden sm:inline">Save</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-[10px]">Save (⌘S)</TooltipContent>
              </Tooltip>

              {/* Stitch */}
              {isStitching ? (
                <button
                  onClick={() => resetStitch()}
                  className="h-8 flex items-center gap-1.5 px-3 rounded-lg text-[11px] font-semibold"
                  style={{ background: 'hsla(263, 70%, 58%, 0.1)', color: 'hsl(var(--primary))' }}
                >
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {Math.round(stitchProgress)}%
                </button>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleStitch}
                      disabled={isRendering}
                      className="h-8 flex items-center gap-1.5 px-3 rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-white/[0.06] transition-all disabled:opacity-40 border border-transparent hover:border-white/[0.06]"
                    >
                      <Film className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-semibold hidden sm:inline">Stitch</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-[10px]">Server-side stitch</TooltipContent>
                </Tooltip>
              )}

              {/* OpenReel */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleOpenInOpenReel}
                    disabled={isRendering || isStitching}
                    className="h-8 flex items-center gap-1.5 px-3 rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-white/[0.06] transition-all disabled:opacity-40 border border-transparent hover:border-white/[0.06]"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-semibold hidden lg:inline">OpenReel</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-[10px] max-w-[200px] text-center">
                  Open in OpenReel — professional browser editor
                </TooltipContent>
              </Tooltip>

              <div className="w-px h-5 bg-white/[0.06] mx-0.5" />

              {/* Export — hero CTA */}
              {isRendering ? (
                <button
                  onClick={() => renderer?.reset()}
                  className="h-8 px-4 flex items-center gap-1.5 rounded-lg text-[11px] font-bold text-destructive bg-destructive/10 border border-destructive/20"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancel {Math.round(renderProgress * 100)}%
                </button>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={exportVideo}
                      disabled={isStitching || isDownloading}
                      className="h-8 px-5 flex items-center gap-2 rounded-lg text-[11px] font-bold relative overflow-hidden group disabled:opacity-40"
                      style={{
                        background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(270 70% 55%))',
                        color: 'white',
                        boxShadow: '0 2px 16px hsla(263, 70%, 58%, 0.3), inset 0 1px 0 hsla(0,0%,100%,0.1)',
                      }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                      {isDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                      <span>{isDownloading ? "Exporting…" : "Export"}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-[10px]">Export video (⌘E)</TooltipContent>
                </Tooltip>
              )}
            </div>
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
            <VideoPreviewPlayer className="h-[40%] shrink-0" />
            <CustomTimeline className="flex-1 min-h-0" onOpenTextDialog={() => setTextDialogOpen(true)} />
          </div>

          {/* Right — Properties panel */}
          <ClipPropertiesPanel />
        </div>

        {/* ═══════════════ STATUS BAR ═══════════════ */}
        <div
          className="h-7 flex items-center px-4 shrink-0 z-10 select-none overflow-hidden gap-4"
          style={{
            background: 'linear-gradient(180deg, hsl(240 22% 5.5%) 0%, hsl(240 25% 4%) 100%)',
            borderTop: '1px solid hsla(263, 70%, 58%, 0.06)',
          }}
        >
          {/* Left stats */}
          <div className="flex items-center gap-3 text-[9px] text-muted-foreground/35 shrink-0 whitespace-nowrap font-medium">
            <span className="flex items-center gap-1">
              <Layers className="w-2.5 h-2.5 shrink-0" />
              {trackCount} track{trackCount !== 1 ? "s" : ""}
            </span>
            <span className="w-px h-3 bg-white/[0.05]" />
            <span className="flex items-center gap-1">
              <Film className="w-2.5 h-2.5 shrink-0" />
              {elementCount} clip{elementCount !== 1 ? "s" : ""}
            </span>
            {mediaCounts.videos > 0 && (
              <>
                <span className="w-px h-3 bg-white/[0.05]" />
                <span>{mediaCounts.videos} in library</span>
              </>
            )}
          </div>

          {/* Center — save indicator */}
          <div className="flex-1 min-w-0 flex items-center justify-center">
            <div className="text-[9px] font-medium">
              {hasUnsavedChanges ? (
                <span className="text-amber-400/50 flex items-center gap-1">
                  <motion.div
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Clock className="w-2.5 h-2.5 shrink-0" />
                  </motion.div>
                  Unsaved changes
                </span>
              ) : (
                <span className="text-emerald-400/40 flex items-center gap-1">
                  <Check className="w-2.5 h-2.5 shrink-0" /> All changes saved
                </span>
              )}
            </div>
          </div>

          {/* Right — tech info */}
          <div className="flex items-center gap-3 text-[9px] text-muted-foreground/30 shrink-0 whitespace-nowrap font-mono">
            <span>1920×1080</span>
            <span className="w-px h-3 bg-white/[0.05]" />
            <span>30fps</span>
            <span className="w-px h-3 bg-white/[0.05]" />
            <span className="flex items-center gap-1">
              <Zap className="w-2.5 h-2.5 text-primary/30 shrink-0" />
              WebCodecs
            </span>
          </div>
        </div>

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
                    { keys: "⌘ A", label: "Select all clips" },
                    { keys: "Delete", label: "Remove selected clip" },
                    { keys: "Home", label: "Go to start" },
                    { keys: "End", label: "Go to end" },
                    { keys: "D", label: "Duplicate selected clip" },
                    { keys: "L", label: "Toggle loop" },
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
              className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-destructive/90 text-destructive-foreground text-xs font-medium px-5 py-2.5 rounded-full backdrop-blur-xl border border-destructive/30 shadow-lg z-20"
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
              className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-emerald-500/90 text-white text-xs font-medium px-5 py-2.5 rounded-full backdrop-blur-xl border border-emerald-400/30 shadow-lg z-20 flex items-center gap-2"
            >
              <Check className="w-3 h-3" /> Video downloaded
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </TooltipProvider>
  );
}
