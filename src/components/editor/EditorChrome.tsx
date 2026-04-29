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
import { RightSidebarPanel } from "@/components/editor/RightSidebarPanel";
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

  const { state: timelineState, dispatch, undo, redo } = useCustomTimeline();

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

    // Determine crossfade: use per-clip transitions if set, otherwise seamless join (0)
    const hasTransitions = clips.some(c => c.transition && c.transition !== "none" && (c.transitionDuration ?? 0) > 0);
    await submitStitch(currentSessionId, clips, {
      crossfadeDuration: hasTransitions ? 0.5 : 0,
      transition: "fade",
    });
  }, [sessionId, getProjectJSON, saveProject, sessionTitle, submitStitch]);

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
        }
      } catch (err) {
        console.error("[Apex] Auto-load clips failed:", err);
      } finally {
        if (!cancelled) setAutoLoadDone(true);
      }
    })();

    return () => { cancelled = true; };
  }, [user, autoLoadDone, listProjects, loadProjectClips, projectParam]);

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
      <div
        className="h-screen w-screen flex flex-col overflow-hidden relative"
        style={{
          background:
            'radial-gradient(1400px 700px at 50% -15%, hsla(215, 95%, 26%, 0.22), transparent 62%), radial-gradient(900px 560px at 100% 110%, hsla(210, 85%, 20%, 0.14), transparent 58%), radial-gradient(700px 500px at 0% 100%, hsla(220, 70%, 14%, 0.16), transparent 60%), linear-gradient(180deg, hsl(220, 16%, 3.4%) 0%, hsl(220, 14%, 2.4%) 100%)',
        }}
      >
        {/* Aurora light wash — soft chromatic depth */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 opacity-[0.55]"
          style={{
            background:
              'radial-gradient(60% 40% at 12% 8%, hsla(210, 100%, 50%, 0.06), transparent 70%), radial-gradient(50% 35% at 88% 92%, hsla(220, 100%, 55%, 0.05), transparent 70%)',
            mixBlendMode: 'screen',
          }}
        />
        {/* Subtle film-grain veil for premium texture */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 opacity-[0.035] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.5 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
          }}
        />
        {/* Edge vignette — frames the chrome like a high-end display */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background:
              'radial-gradient(120% 90% at 50% 50%, transparent 55%, hsla(220, 30%, 0%, 0.55) 100%)',
          }}
        />
        {/* Luminous accent line — top */}
        <div className="absolute top-0 left-0 right-0 h-px z-20">
          <div className="h-full bg-gradient-to-r from-transparent via-[hsla(215,100%,55%,0.55)] to-transparent" />
          <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-transparent via-[hsla(215,100%,55%,0.18)] to-transparent blur-sm" />
          {isRendering && (
            <motion.div
              className="absolute inset-0 h-px bg-gradient-to-r from-[hsl(215,100%,55%)] via-[hsl(195,100%,75%)] to-[hsl(215,100%,55%)] shadow-[0_0_12px_hsla(215,100%,55%,0.6)]"
              style={{ width: `${Math.round(renderProgress * 100)}%` }}
              transition={{ duration: 0.3 }}
            />
          )}
        </div>

        {/* ═══════════════ TOP BAR — Clean 3-section header ═══════════════ */}
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="h-12 flex items-center px-4 shrink-0 z-10 relative backdrop-blur-2xl"
          style={{
            background:
              'linear-gradient(180deg, hsla(220, 16%, 10%, 0.86) 0%, hsla(220, 14%, 4%, 0.82) 100%)',
            borderBottom: '1px solid hsla(0, 0%, 100%, 0.06)',
            boxShadow:
              'inset 0 1px 0 hsla(0,0%,100%,0.06), inset 0 -1px 0 hsla(0,0%,0%,0.5), 0 12px 32px -14px hsla(215, 100%, 30%, 0.32), 0 1px 0 hsla(0,0%,0%,0.5)',
          }}
        >
          {/* ── Left: Navigation + Session ── */}
          <div className="flex items-center gap-2.5 min-w-0 shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => navigate("/projects")}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-white/[0.06] transition-all shrink-0 ring-1 ring-inset ring-white/[0.04] hover:ring-white/[0.08]"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[10px]">Back to Projects</TooltipContent>
            </Tooltip>

            {/* Apex Studio Pro wordmark */}
            <div className="flex items-center gap-2 pl-1 pr-2 select-none">
              <div
                className="relative w-5 h-5 rounded-[6px] flex items-center justify-center shrink-0"
                style={{
                  background: 'linear-gradient(135deg, hsl(215,100%,55%) 0%, hsl(200,100%,45%) 100%)',
                  boxShadow:
                    '0 0 0 1px hsla(215,100%,70%,0.35) inset, 0 4px 14px -4px hsla(215,100%,50%,0.55)',
                }}
              >
                <Sparkles className="w-3 h-3 text-white drop-shadow-[0_0_4px_hsla(0,0%,100%,0.6)]" />
              </div>
              <div className="flex items-baseline gap-1.5 leading-none">
                <span className="font-display text-[12px] font-semibold tracking-[0.14em] uppercase text-foreground/85">
                  Apex
                </span>
                <span className="font-display text-[10px] font-medium tracking-[0.32em] uppercase text-muted-foreground/40">
                  Studio
                </span>
                <span
                  className="text-[8px] font-bold tracking-[0.18em] uppercase px-1.5 py-[2px] rounded-[4px]"
                  style={{
                    background:
                      'linear-gradient(180deg, hsla(215,100%,55%,0.18), hsla(215,100%,45%,0.08))',
                    color: 'hsl(200, 100%, 80%)',
                    border: '1px solid hsla(215,100%,55%,0.25)',
                  }}
                >
                  Pro
                </span>
              </div>
            </div>

            <div className="w-px h-5 bg-gradient-to-b from-transparent via-white/[0.10] to-transparent" />

            <div className="flex items-center gap-1.5 min-w-0">
              {isRenamingSession ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={finishRename}
                  onKeyDown={(e) => { if (e.key === "Enter") finishRename(); if (e.key === "Escape") setIsRenamingSession(false); }}
                  className="text-[12.5px] text-foreground bg-white/[0.06] border border-primary/40 rounded-lg px-2.5 py-1 max-w-[200px] outline-none focus:border-primary font-medium tracking-tight"
                />
              ) : (
                <button onClick={startRename} className="flex items-center gap-1.5 group text-left min-w-0 px-1">
                  <span className="text-[12.5px] font-medium tracking-tight text-foreground/75 max-w-[220px] truncate group-hover:text-foreground transition-colors">
                    {sessionTitle}
                  </span>
                  <Edit3 className="w-3 h-3 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
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

          {/* ── Center: Import + Aspect ── */}
          <div className="flex-1 flex items-center justify-center">
            <div
              className="flex items-center gap-0.5 px-1 py-0.5 rounded-lg"
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

          {/* ── Right: Credits + Primary actions ── */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Credits badge */}
            {user && (
              <EditorCreditsBadge userId={user.id} />
            )}
            {/* Secondary: Clear + Shortcuts */}
            <div className="flex items-center gap-0.5 mr-1">
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

            {/* Primary action group */}
            <div
              className="flex items-center gap-0.5 ml-1 px-0.5 py-0.5 rounded-lg"
              style={{ background: 'hsla(0,0%,100%,0.02)', border: '1px solid hsla(0,0%,100%,0.04)' }}
            >
              {/* Save */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => saveProject(sessionTitle)}
                    disabled={saving}
                    className="h-7 flex items-center gap-1.5 px-2.5 rounded-md text-muted-foreground/55 hover:text-foreground hover:bg-white/[0.06] transition-all disabled:opacity-40"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span className="text-[11px] font-semibold hidden sm:inline">Save</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-[10px]">Save (⌘S)</TooltipContent>
              </Tooltip>

              <div className="w-px h-4 bg-white/[0.06]" />

              {/* Stitch */}
              {isStitching ? (
                <button
                  onClick={() => resetStitch()}
                  className="h-7 flex items-center gap-1.5 px-2.5 rounded-md text-[11px] font-semibold"
                  style={{ background: 'hsla(0, 0%, 100%, 0.06)', color: 'hsl(0, 0%, 80%)' }}
                >
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {Math.round(stitchProgress)}%
                </button>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleStitch}
                      disabled={isRendering}
                      className="h-7 flex items-center gap-1.5 px-2.5 rounded-md text-muted-foreground/55 hover:text-foreground hover:bg-white/[0.06] transition-all disabled:opacity-40"
                    >
                      <Film className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-semibold hidden sm:inline">Stitch</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-[10px]">Server-side stitch</TooltipContent>
                </Tooltip>
              )}

              <div className="w-px h-4 bg-white/[0.06]" />

              {/* OpenReel */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleOpenInOpenReel}
                    disabled={isRendering || isStitching}
                    className="h-7 flex items-center gap-1.5 px-2.5 rounded-md text-muted-foreground/55 hover:text-foreground hover:bg-white/[0.06] transition-all disabled:opacity-40"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-semibold hidden lg:inline">OpenReel</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-[10px] max-w-[200px] text-center">
                  Open in OpenReel — professional browser editor
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Export — hero CTA, visually separated */}
            <div className="ml-2 relative">
              {/* Luminous halo */}
              {!isRendering && (
                <div
                  aria-hidden
                  className="absolute inset-0 rounded-lg blur-md opacity-60 pointer-events-none"
                  style={{
                    background:
                      'radial-gradient(60% 100% at 50% 50%, hsla(215,100%,55%,0.55), transparent 70%)',
                  }}
                />
              )}
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
                      className="relative h-8 px-5 flex items-center gap-2 rounded-lg text-[11px] font-bold tracking-[0.08em] uppercase overflow-hidden group disabled:opacity-40"
                       style={{
                        background:
                          'linear-gradient(180deg, hsl(210, 100%, 60%) 0%, hsl(215, 100%, 48%) 50%, hsl(218, 100%, 42%) 100%)',
                        color: 'hsl(0, 0%, 100%)',
                        boxShadow:
                          '0 1px 0 hsla(0,0%,100%,0.18) inset, 0 -1px 0 hsla(0,0%,0%,0.25) inset, 0 6px 22px -6px hsla(215, 100%, 50%, 0.65), 0 0 0 1px hsla(215,100%,75%,0.18)',
                      }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-[900ms] ease-out" />
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
                className="h-full bg-gradient-to-r from-[hsl(215,100%,50%)] via-[hsl(215,100%,65%)] to-[hsl(215,100%,50%)]"
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
            <div
              className="h-[42%] shrink-0 relative px-4 pt-4 pb-2.5"
              style={{
                background:
                  'radial-gradient(70% 100% at 50% 0%, hsla(215, 85%, 20%, 0.22), transparent 72%), radial-gradient(40% 60% at 50% 100%, hsla(215, 70%, 14%, 0.10), transparent 70%), hsla(220, 16%, 1.6%, 0.7)',
              }}
            >
              {/* Soft top key-light streak — gives the stage a "spotlight" feel */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-10 top-0 h-px"
                style={{
                  background:
                    'linear-gradient(90deg, transparent, hsla(215,100%,70%,0.35), transparent)',
                  filter: 'blur(0.5px)',
                }}
              />
              <div
                className="w-full h-full rounded-2xl overflow-hidden relative"
                style={{
                  background: 'hsl(0, 0%, 0%)',
                  boxShadow:
                    '0 0 0 1px hsla(0,0%,100%,0.08) inset, 0 0 0 1px hsla(0,0%,0%,0.7), 0 1px 0 hsla(0,0%,100%,0.04) inset, 0 30px 80px -24px hsla(0,0%,0%,0.95), 0 0 100px -8px hsla(215,100%,42%,0.24), 0 0 0 6px hsla(220,14%,2%,0.6)',
                }}
              >
                <VideoPreviewPlayer className="absolute inset-0" />
                {/* corner crosshairs */}
                <div className="pointer-events-none absolute inset-0">
                  {[
                    'top-3 left-3 border-t border-l',
                    'top-3 right-3 border-t border-r',
                    'bottom-3 left-3 border-b border-l',
                    'bottom-3 right-3 border-b border-r',
                  ].map((cls) => (
                    <span
                      key={cls}
                      className={`absolute w-3.5 h-3.5 ${cls}`}
                      style={{ borderColor: 'hsla(215,100%,80%,0.22)' }}
                    />
                  ))}
                </div>
                {/* Subtle vignette inside the stage for cinematic depth */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      'radial-gradient(120% 90% at 50% 50%, transparent 60%, hsla(0,0%,0%,0.4) 100%)',
                  }}
                />
              </div>
            </div>
            {/* hairline divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-[hsla(215,100%,55%,0.28)] to-transparent shrink-0" />
            <CustomTimeline className="flex-1 min-h-0" onOpenTextDialog={() => setTextDialogOpen(true)} />
          </div>

          {/* Right — Properties & Templates panel */}
          <RightSidebarPanel />
        </div>

        {/* ═══════════════ STATUS BAR ═══════════════ */}
        <div
          className="h-7 flex items-center px-4 shrink-0 z-10 select-none overflow-hidden gap-4 backdrop-blur-xl relative"
          style={{
            background:
              'linear-gradient(180deg, hsla(220, 16%, 7%, 0.9) 0%, hsla(220, 14%, 2%, 0.95) 100%)',
            borderTop: '1px solid hsla(0, 0%, 100%, 0.06)',
            boxShadow:
              'inset 0 1px 0 hsla(0,0%,100%,0.05), 0 -8px 24px -12px hsla(215, 100%, 30%, 0.18)',
          }}
        >
          {/* Hairline luminous divider above status bar */}
          <div
            aria-hidden
            className="absolute top-0 inset-x-0 h-px"
            style={{
              background:
                'linear-gradient(90deg, transparent, hsla(215,100%,60%,0.22), transparent)',
            }}
          />
          {/* Left stats */}
          <div className="flex items-center gap-3 text-[9px] text-muted-foreground/45 shrink-0 whitespace-nowrap font-medium">
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
          <div className="flex items-center gap-3 text-[9px] text-muted-foreground/45 shrink-0 whitespace-nowrap font-mono">
            <span className="tabular-nums">{timelineState.width}×{timelineState.height}</span>
            <span className="w-px h-3 bg-foreground/[0.06]" />
            <span className="tabular-nums">{timelineState.fps}fps</span>
            <span className="w-px h-3 bg-foreground/[0.06]" />
            <span className="flex items-center gap-1">
              <Zap className="w-2.5 h-2.5 text-[hsl(215,100%,65%)]/60 shrink-0" />
              WebCodecs
            </span>
            <span className="w-px h-3 bg-foreground/[0.06]" />
            <span className="text-[9px] tracking-[0.22em] uppercase text-muted-foreground/30">
              Apex Pro
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
        .single();
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
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full mr-1 cursor-default backdrop-blur-md transition-all hover:scale-[1.02]"
          style={{
            background: isLow
              ? 'linear-gradient(180deg, hsla(0, 70%, 55%, 0.14), hsla(0, 70%, 40%, 0.06))'
              : 'linear-gradient(180deg, hsla(215, 90%, 60%, 0.14), hsla(215, 90%, 40%, 0.05))',
            border: `1px solid ${isLow ? 'hsla(0, 70%, 55%, 0.22)' : 'hsla(215, 90%, 60%, 0.22)'}`,
            boxShadow: isLow
              ? '0 0 14px -4px hsla(0, 70%, 55%, 0.35), inset 0 1px 0 hsla(0,0%,100%,0.06)'
              : '0 0 14px -4px hsla(215, 100%, 55%, 0.45), inset 0 1px 0 hsla(0,0%,100%,0.08)',
          }}
        >
          <Zap
            className="w-3 h-3"
            style={{
              color: isLow ? 'hsl(0, 80%, 70%)' : 'hsl(200, 100%, 75%)',
              filter: `drop-shadow(0 0 4px ${isLow ? 'hsla(0,80%,60%,0.6)' : 'hsla(215,100%,60%,0.7)'})`,
            }}
          />
          <span
            className="text-[10px] font-semibold tabular-nums tracking-wide"
            style={{ color: isLow ? 'hsl(0, 85%, 78%)' : 'hsl(200, 100%, 82%)' }}
          >
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
