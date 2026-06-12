import { useState, useEffect, useCallback, useRef } from "react";
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
import { useSeamlessStitch } from "@/hooks/useSeamlessStitch";
import { ProjectBrowser } from "@/components/editor/ProjectBrowser";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/utils";
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
import { RightSidebarPanel } from "@/components/editor/RightSidebarPanel";
import { TextClipDialog } from "@/components/editor/TextClipDialog";
import { PlayerTimecodeHUD } from "@/components/editor/PlayerTimecodeHUD";
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

  const { listProjects, loadProjectClips, loadAllUserClips, loading: clipsLoading } = useEditorClips();
  const { stitchEditorAndDownload, stitching: isStitching } = useSeamlessStitch();
  const [autoLoadDone, setAutoLoadDone] = useState(false);

  const { state: timelineState, dispatch, undo, redo } = useCustomTimeline();

  // Track sessions we've just created via save, so the load-effect doesn't
  // immediately re-hydrate (and clobber) the in-memory timeline.
  const justSavedSessionIds = useRef<Set<string>>(new Set());

  const renderer = useBrowserRenderer?.({
    width: 1920,
    height: 1080,
    fps: 30,
    quality: "high" as const,
    includeAudio: true,
    autoDownload: true,
    downloadFilename: `Small Bridges_${sessionTitle.replace(/\s+/g, "_")}.mp4`,
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
          justSavedSessionIds.current.add(data.id);
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
    // Skip reload for sessions we just created via Save — the in-memory
    // timeline is already authoritative and reloading would clobber edits.
    if (justSavedSessionIds.current.has(sessionId)) {
      justSavedSessionIds.current.delete(sessionId);
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        const { data, error: err } = await supabase
          .from("edit_sessions")
          .select("timeline_data, title")
          .eq("id", sessionId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (err || cancelled || !data) return;
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
        if ((el.type === "video" || el.type === "image") && el.props?.src) {
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
    const clips: { url: string; duration: number; volume?: number; speed?: number; fadeIn?: number; fadeOut?: number; brightness?: number; contrast?: number; saturation?: number; transition?: string; transitionDuration?: number }[] = [];
    for (const track of projectData.tracks || []) {
      for (const el of track.elements || []) {
        if ((el.type === "video" || el.type === "image") && el.props?.src) {
          clips.push({
            url: el.props.src,
            duration: (el.e - el.s) || 6,
            volume: el.props.volume,
            speed: el.props.speed,
            fadeIn: el.props.fadeIn,
            fadeOut: el.props.fadeOut,
            brightness: el.props.brightness,
            contrast: el.props.contrast,
            saturation: el.props.saturation,
            transition: el.props.transition,
            transitionDuration: el.props.transitionDuration,
          });
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

    // seamless-stitcher always crossfades; honor per-clip transition duration if any.
    const xfade = clips.find(c => c.transition && c.transition !== "none" && (c.transitionDuration ?? 0) > 0)?.transitionDuration ?? 0.4;
    await stitchEditorAndDownload({
      sessionId: currentSessionId,
      clips: clips.map(c => ({ url: c.url, duration: c.duration })),
      title: sessionTitle,
      transitionDuration: xfade,
      transitionType: "fade",
    });
  }, [sessionId, getProjectJSON, saveProject, sessionTitle, stitchEditorAndDownload]);

  // ─── Auto-load clips from all projects (or a specific project via ?project=) ───
  const projectParam = searchParams.get("project");
  
  useEffect(() => {
    if (!user || autoLoadDone) return;
    let cancelled = false;

    (async () => {
      try {
        // If a specific project is requested via URL param, load it first
        if (projectParam) {
          const { clips } = await loadProjectClips(projectParam);
          if (!cancelled && clips.length > 0) {
            setAvailableClips(clips);
            setLoadedProjectIds(new Set([projectParam]));
            setMediaCounts({ videos: clips.length, images: 0 });
            
            // Auto-add clips to timeline if empty
            if (timelineState.tracks.every(t => t.clips.length === 0)) {
              const trackId = timelineState.tracks[0]?.id || generateTrackId();
              if (!timelineState.tracks[0]) {
                dispatch({ type: "ADD_TRACK", track: { id: trackId, label: "V1", type: "video", clips: [], muted: false, locked: false } });
              }
              let offset = 0;
              for (const clip of clips) {
                const dur = clip.durationSeconds || 6;
                dispatch({
                  type: "ADD_CLIP",
                  trackId: timelineState.tracks[0]?.id || trackId,
                  clip: {
                    id: generateClipId(),
                    type: "video",
                    name: `Shot ${clip.shotIndex + 1}`,
                    start: offset,
                    end: offset + dur,
                    trimStart: 0,
                    trimEnd: dur,
                    src: clip.videoUrl,
                    thumbnail: clip.thumbnailUrl || undefined,
                    volume: 1,
                    speed: 1,
                    opacity: 1,
                  },
                });
                offset += dur;
              }
              setSessionTitle(clips[0]?.projectTitle || "Untitled Session");
              toast.success(`Loaded ${clips.length} clips from project into timeline`);
            } else {
              toast.success(`Loaded ${clips.length} clips from project`);
            }
          }
          // Also load the full project list for the browser
          const projectList = await listProjects();
          if (!cancelled) {
            setProjects(projectList);
            setProjectsLoaded(true);
          }
        } else {
          // Default: load all projects
          const projectList = await listProjects();
          if (cancelled || projectList.length === 0) {
            setAutoLoadDone(true);
            return;
          }
          setProjects(projectList);
          setProjectsLoaded(true);

          // Single-shot fetch: load every completed clip in ONE round trip
          // (replaces the previous N+1 per-project loop).
          const allClips = await loadAllUserClips();
          const loaded = new Set(allClips.map(c => c.projectId));

          if (!cancelled) {
            setAvailableClips(allClips);
            setLoadedProjectIds(loaded);
            setMediaCounts({ videos: allClips.length, images: 0 });
            if (allClips.length > 0) {
              toast.success(`Loaded ${allClips.length} clip${allClips.length !== 1 ? "s" : ""} from ${loaded.size} project${loaded.size !== 1 ? "s" : ""}`);
            }
          }
        }
      } catch (err) {
        console.error("[Small Bridges] Auto-load clips failed:", err);
      } finally {
        if (!cancelled) setAutoLoadDone(true);
      }
    })();

    return () => { cancelled = true; };
  }, [user, autoLoadDone, listProjects, loadProjectClips, loadAllUserClips, projectParam]);

  // ─── Keyboard shortcuts ───
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA";

      if (mod && e.key === "s") {
        e.preventDefault();
        saveProject(sessionTitle);
      }
      if (mod && e.key === "e") {
        e.preventDefault();
        if (!isRendering) exportVideo();
      }
      if (mod && e.key === "z") {
        e.preventDefault();
        undo();
      }
      if (mod && (e.key === "y" || (e.shiftKey && e.key === "z"))) {
        e.preventDefault();
        redo();
      }
      if (mod && e.key === "a") {
        e.preventDefault();
        dispatch({ type: "SELECT_ALL_CLIPS" });
      }
      if (e.key === " " && !isInput) {
        e.preventDefault();
        dispatch({ type: "SET_PLAYING", playing: !timelineState.isPlaying });
      }
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !isInput) {
        setShowShortcuts(prev => !prev);
      }
      if ((e.key === "Delete" || e.key === "Backspace") && !isInput) {
        if (timelineState.selectedClipId && timelineState.selectedTrackId) {
          dispatch({ type: "REMOVE_CLIP", trackId: timelineState.selectedTrackId, clipId: timelineState.selectedClipId });
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
      // Duplicate
      if (e.key === "d" && !mod && !isInput) {
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
      // Loop toggle
      if (e.key === "l" && !mod && !isInput) {
        dispatch({ type: "SET_LOOP", looping: !timelineState.isLooping });
      }
      // Split at playhead
      if (e.key === "s" && !mod && !isInput) {
        if (timelineState.selectedClipId && timelineState.selectedTrackId) {
          const track = timelineState.tracks.find(t => t.id === timelineState.selectedTrackId);
          const clip = track?.clips.find(c => c.id === timelineState.selectedClipId);
          if (clip && timelineState.playheadTime > clip.start && timelineState.playheadTime < clip.end) {
            dispatch({ type: "TRIM_CLIP", trackId: timelineState.selectedTrackId, clipId: clip.id, edge: "end", newTime: timelineState.playheadTime });
            const offsetIntoSource = timelineState.playheadTime - clip.start;
            dispatch({
              type: "ADD_CLIP",
              trackId: timelineState.selectedTrackId,
              clip: {
                ...clip, id: generateClipId(), start: timelineState.playheadTime, end: clip.end,
                trimStart: clip.trimStart + offsetIntoSource, name: `${clip.name} (split)`,
              },
            });
          }
        }
      }
      // Tool switching
      if (e.key === "v" && !mod && !isInput) {
        dispatch({ type: "SET_ACTIVE_TOOL", tool: "select" });
      }
      if (e.key === "c" && !mod && !isInput) {
        dispatch({ type: "SET_ACTIVE_TOOL", tool: "razor" });
      }
      if (e.key === "b" && !mod && !isInput) {
        dispatch({ type: "SET_ACTIVE_TOOL", tool: "ripple" });
      }
      // Add marker at playhead
      if (e.key === "m" && !mod && !isInput) {
        dispatch({
          type: "ADD_MARKER",
          marker: {
            id: `marker-${Date.now()}`,
            time: timelineState.playheadTime,
            label: `Marker`,
            color: "#f59e0b",
          },
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saveProject, exportVideo, sessionTitle, isRendering, timelineState, dispatch, undo, redo]);

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
      console.error("[Small Bridges] Failed to load project clips:", err);
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
      <div className="h-screen w-screen flex flex-col items-center justify-center gap-5 p-6">
        <Logo size="lg" />
        <div className="text-center space-y-2">
          <div className="flex items-center gap-2 justify-center text-muted-foreground">
            <Monitor className="w-5 h-5" />
            <h2 className="text-sm font-semibold text-foreground">Desktop Required</h2>
          </div>
          <p className="text-xs text-muted-foreground/70 max-w-[280px]">
            Small Bridges requires a desktop browser for the best editing experience.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate("/library")}>
          Back to Library
        </Button>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="h-screen w-screen flex flex-col overflow-hidden relative text-foreground">
        {/* Backdrop is mounted by VideoEditor via FoundationShell bare —
            the SpineBackdrop reads through this transparent container so
            the Editor sits in the same room as Studio / Library. */}
        {isRendering && (
          <div className="absolute top-0 left-0 right-0 h-px z-20">
            <motion.div
              className="h-full bg-accent"
              style={{ width: `${Math.round(renderProgress * 100)}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        )}

        {/* ═══════════════ TOP BAR — Clean 3-section header ═══════════════ */}
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="h-[78px] flex items-center px-4 md:px-6 gap-3 md:gap-4 shrink-0 z-10 relative"
        >
          {/* floating hairline — no hard border, just a luminous thread */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
          {/* ── Left: Navigation + Session ── */}
          <div className="flex items-center gap-3 min-w-0 shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => navigate("/library")}
                  className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors border border-border/30 bg-[hsl(var(--foreground)/0.02)] backdrop-blur-xl hover:border-accent/40"
                >
                  <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[10px]">Back to Library</TooltipContent>
            </Tooltip>

            {/* Brand mark — restrained Foundation glass, not the loud
                Studio v2 glow. Same atmosphere as Library / Studio. */}
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/30 bg-[hsl(var(--foreground)/0.02)] backdrop-blur-xl">
              <Film
                className="h-3.5 w-3.5 text-accent"
                strokeWidth={1.5}
              />
            </div>

            <div className="flex flex-col min-w-0 leading-tight">
              {/* Live eyebrow — Foundation mono uppercase with accent ping. */}
              <div className="hidden md:flex items-center gap-1.5 mb-0.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inset-0 rounded-full bg-accent animate-ping opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-muted-foreground/70">
                  ◆ Small Bridges · editor · Live
                </span>
              </div>
              {isRenamingSession ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={finishRename}
                  onKeyDown={(e) => { if (e.key === "Enter") finishRename(); if (e.key === "Escape") setIsRenamingSession(false); }}
                  className="bg-transparent font-display text-base italic tracking-tight bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent outline-none placeholder:text-muted-foreground/40 md:text-lg max-w-[200px] md:max-w-[260px]"
                />
              ) : (
                <button onClick={startRename} className="group flex items-center gap-1.5 text-left min-w-0">
                  <span className="font-display italic text-base md:text-lg tracking-tight bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent max-w-[220px] md:max-w-[280px] truncate transition-colors">
                    {sessionTitle}
                  </span>
                  <Edit3 className="w-3 h-3 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </button>
              )}
              {hasUnsavedChanges && (
                <div className="hidden font-mono text-[9px] uppercase tracking-[0.32em] text-muted-foreground/50 xl:flex items-center gap-2">
                  <span className="flex items-center gap-1 text-amber-400/70">
                    <span className="h-1 w-1 rounded-full bg-amber-400/80 animate-pulse" />
                    unsaved
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ── Center: Import + Aspect — Foundation glass pill ── */}
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center gap-1 rounded-full px-1.5 py-1 border border-border/30 bg-[hsl(var(--foreground)/0.02)] backdrop-blur-xl">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={openBrowser}
                    className="h-7 flex items-center gap-1.5 px-3 rounded-full text-muted-foreground hover:text-foreground hover:bg-glass-hover transition-colors"
                  >
                    <FolderOpen className="w-3.5 h-3.5" strokeWidth={1.5} />
                    <span className="font-mono text-[10px] uppercase tracking-[0.22em]">{!autoLoadDone ? "Syncing" : "Import"}</span>
                    {!autoLoadDone && <Loader2 className="w-3 h-3 animate-spin text-accent/60" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-[10px]">Import clips from your projects</TooltipContent>
              </Tooltip>

              <div className="w-px h-4 bg-white/10" />

              <select
                value={timelineState.aspectRatio}
                onChange={(e) => dispatch({ type: "SET_ASPECT_RATIO", ratio: e.target.value as any })}
                className="h-7 bg-transparent border-none rounded-full px-2.5 text-muted-foreground cursor-pointer hover:text-foreground transition-colors outline-none font-mono text-[10px] uppercase tracking-[0.22em]"
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
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[9px] tabular-nums uppercase tracking-[0.18em] text-accent border border-accent/30 bg-[hsl(var(--accent)/0.08)]"
                  >
                    <Check className="w-2.5 h-2.5" />
                    {mediaCounts.videos}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* ── Right: Credits + Primary actions ── */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Credits badge */}
            {user && (
              <EditorCreditsBadge userId={user.id} />
            )}
            {/* Secondary: Clear + Shortcuts */}
            <div className="flex items-center gap-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleClearTimeline}
                    className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
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
                    className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Keyboard className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-[10px]">Shortcuts (?)</TooltipContent>
              </Tooltip>
            </div>

            <div className="w-px h-5 bg-white/10" />

            {/* Primary action group — Foundation glass pill */}
            <div className="flex items-center gap-0.5 rounded-full px-1 py-1 border border-border/30 bg-[hsl(var(--foreground)/0.02)] backdrop-blur-xl">
              {/* Save */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => saveProject(sessionTitle)}
                    disabled={saving}
                    className="h-7 flex items-center gap-1.5 rounded-full px-3 text-muted-foreground hover:text-foreground hover:bg-glass-hover transition-colors disabled:opacity-40"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" strokeWidth={1.5} />}
                    <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-[0.22em]">Save</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-[10px]">Save (⌘S)</TooltipContent>
              </Tooltip>

              {/* Stitch */}
              {isStitching ? (
                <div className="h-7 flex items-center gap-1.5 rounded-full px-3 font-mono text-[10px] uppercase tracking-[0.22em] tabular-nums text-accent border border-accent/30 bg-[hsl(var(--accent)/0.08)]">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Stitching
                </div>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleStitch}
                      disabled={isRendering}
                      className="h-7 flex items-center gap-1.5 rounded-full px-3 text-muted-foreground hover:text-foreground hover:bg-glass-hover transition-colors disabled:opacity-40"
                    >
                      <Film className="w-3.5 h-3.5" strokeWidth={1.5} />
                      <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-[0.22em]">Stitch</span>
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
                    className="hidden lg:flex h-7 items-center gap-1.5 rounded-full px-3 text-muted-foreground hover:text-foreground hover:bg-glass-hover transition-colors disabled:opacity-40"
                  >
                    <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.5} />
                    <span className="font-mono text-[10px] uppercase tracking-[0.22em]">OpenReel</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-[10px] max-w-[200px] text-center">
                  Open in OpenReel — professional browser editor
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Export — hero CTA, flat accent pill (matches Create page) */}
            <div className="ml-1">
              {isRendering ? (
                <button
                  onClick={() => renderer?.reset()}
                  className="h-9 px-4 flex items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/10 font-mono text-[10px] uppercase tracking-[0.22em] text-destructive"
                >
                  <X className="w-3.5 h-3.5" />
                  <span className="tabular-nums">Cancel {Math.round(renderProgress * 100)}%</span>
                </button>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={exportVideo}
                      disabled={isStitching || isDownloading}
                      className="group relative inline-flex h-9 items-center gap-1.5 overflow-hidden rounded-full px-5 text-[12px] tracking-tight text-foreground transition-all disabled:cursor-not-allowed disabled:opacity-30 border border-accent/40 bg-gradient-to-br from-accent/15 to-accent/5 hover:border-accent/60 hover:from-accent/25"
                    >
                      {isDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" /> : <Download className="w-3.5 h-3.5 text-accent" strokeWidth={1.5} />}
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
              className="h-0.5 bg-border/40 shrink-0 z-10 relative"
            >
              <motion.div
                className="h-full bg-accent"
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
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden relative">
            {/* Player stage with cinematic letterbox feel */}
            <div className="h-[42%] shrink-0 relative px-4 pt-4 pb-2.5">
              {/* Ambient accent halo behind the player — subtle, not loud.
                  Foundation tokens, not hardcoded hsla. */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-10 top-2 bottom-0 rounded-[28px] opacity-60"
                style={{
                  background:
                    'radial-gradient(60% 80% at 50% 50%, hsl(var(--accent) / 0.14), transparent 70%)',
                  filter: 'blur(40px)',
                }}
              />
              <div
                className="relative w-full h-full rounded-2xl overflow-hidden bg-black ring-1 ring-inset ring-border/40"
                style={{
                  boxShadow:
                    '0 30px 80px -24px hsl(0 0% 0% / 0.75), 0 0 60px -10px hsl(var(--accent) / 0.14)',
                }}
              >
                <VideoPreviewPlayer className="absolute inset-0" />
                {/* Premium Timecode HUD — top-center floating chip */}
                <PlayerTimecodeHUD
                  time={timelineState.playheadTime}
                  fps={timelineState.fps}
                  width={timelineState.width}
                  height={timelineState.height}
                  isRendering={isRendering}
                />
                {/* Brand watermark — subliminal, bottom-right */}
                <div className="pointer-events-none absolute bottom-3 right-4 z-20 font-mono text-[9px] uppercase tracking-[0.32em] text-foreground/25 select-none">
                  Small Bridges
                </div>
              </div>
            </div>
            <div className="h-px shrink-0 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
            <CustomTimeline className="flex-1 min-h-0" onOpenTextDialog={() => setTextDialogOpen(true)} />
          </div>

          {/* Right — Properties & Templates panel */}
          <RightSidebarPanel />
        </div>

        {/* ═══════════════ STATUS BAR ═══════════════ */}
        <div className="h-7 flex items-center px-4 md:px-6 shrink-0 z-10 select-none overflow-hidden gap-4 relative">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
          {/* Left stats */}
          <div className="flex items-center gap-3 font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground/70 shrink-0 whitespace-nowrap">
            <span className="flex items-center gap-1.5">
              <Layers className="w-2.5 h-2.5 shrink-0" />
              <span className="tabular-nums">{trackCount}</span> track{trackCount !== 1 ? "s" : ""}
            </span>
            <span className="w-px h-3 bg-border/60" />
            <span className="flex items-center gap-1.5">
              <Film className="w-2.5 h-2.5 shrink-0" />
              <span className="tabular-nums">{elementCount}</span> clip{elementCount !== 1 ? "s" : ""}
            </span>
            {mediaCounts.videos > 0 && (
              <>
                <span className="w-px h-3 bg-border/60" />
                <span><span className="tabular-nums">{mediaCounts.videos}</span> in library</span>
              </>
            )}
          </div>

          {/* Center — save indicator */}
          <div className="flex-1 min-w-0 flex items-center justify-center">
            <div className="font-mono text-[9px] uppercase tracking-[0.22em]">
              {hasUnsavedChanges ? (
                <span className="text-amber-400/70 flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-amber-400/80 animate-pulse" />
                  Unsaved changes
                </span>
              ) : (
                <span className="text-accent/70 flex items-center gap-1.5">
                  <Check className="w-2.5 h-2.5 shrink-0" strokeWidth={1.5} /> All changes saved
                </span>
              )}
            </div>
          </div>

          {/* Right — tech info */}
          <div className="flex items-center gap-3 font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground/70 shrink-0 whitespace-nowrap">
            <span className="tabular-nums">{timelineState.width}×{timelineState.height}</span>
            <span className="w-px h-3 bg-border/60" />
            <span className="tabular-nums">{timelineState.fps}fps</span>
            <span className="w-px h-3 bg-border/60" />
            <span className="flex items-center gap-1.5">
              <Zap className="w-2.5 h-2.5 text-accent/70 shrink-0" />
              WebCodecs
            </span>
            <span className="w-px h-3 bg-border/60" />
            <span className="text-muted-foreground/50">Small Bridges Pro</span>
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
                    { keys: "S", label: "Split at playhead" },
                    { keys: "L", label: "Toggle loop" },
                    { keys: "V", label: "Select tool" },
                    { keys: "C", label: "Razor tool" },
                    { keys: "B", label: "Ripple tool" },
                    { keys: "M", label: "Add marker at playhead" },
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
              className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-accent text-accent-foreground font-mono text-[10px] tracking-[0.22em] uppercase px-5 py-2.5 rounded-full z-20 flex items-center gap-2 shadow-lg"
            >
              <Check className="w-3 h-3" strokeWidth={1.8} /> Video downloaded
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </TooltipProvider>
  );
}

/** Compact credits badge for editor header */
function EditorCreditsBadge({ userId }: { userId: string }) {
  const [balance, setBalance] = useState<number | null>(null);
  
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("credits_balance")
        .eq("id", userId)
        .maybeSingle();
      if (!cancelled && data) setBalance(data.credits_balance);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  if (balance === null) return null;
  
  const isLow = balance < 100;
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "h-9 flex items-center gap-1.5 rounded-full border bg-background/40 px-3 cursor-default transition-colors",
            isLow ? "border-destructive/40 text-destructive" : "border-border/60 text-muted-foreground"
          )}
        >
          <Zap className={cn("w-3 h-3", isLow ? "text-destructive" : "text-accent")} strokeWidth={1.5} />
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] tabular-nums">
            {balance.toLocaleString()}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-[10px]">
        {balance.toLocaleString()} credits remaining
      </TooltipContent>
    </Tooltip>
  );
}

