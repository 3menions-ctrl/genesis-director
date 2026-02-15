import { useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useSafeNavigation } from "@/lib/navigation";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { EditorTimeline } from "@/components/editor/EditorTimeline";
import { EditorPreview } from "@/components/editor/EditorPreview";
import { EditorSidebar } from "@/components/editor/EditorSidebar";
import { EditorMediaBrowser } from "@/components/editor/EditorMediaBrowser";
import { Film, Sparkles } from "lucide-react";
import { useEditorHistory } from "@/hooks/useEditorHistory";
import type { EditorState, TimelineTrack, TimelineClip } from "@/components/editor/types";

const VideoEditor = () => {
  const { user } = useAuth();
  const { navigate } = useSafeNavigation();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("project") || searchParams.get("projectId");

  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showMediaBrowser, setShowMediaBrowser] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);

  const [editorState, setEditorState] = useState<EditorState>({
    sessionId: null,
    projectId: projectId || null,
    title: "Untitled Edit",
    tracks: [
      { id: "video-0", name: "Video 1", type: "video", clips: [], muted: false, locked: false },
      { id: "audio-0", name: "Audio 1", type: "audio", clips: [], muted: false, locked: false },
      { id: "text-0", name: "Text 1", type: "text", clips: [], muted: false, locked: false },
    ],
    currentTime: 0,
    duration: 0,
    isPlaying: false,
    selectedClipId: null,
    zoom: 1,
    renderStatus: "idle",
    renderProgress: 0,
  });

  const [isSaving, setIsSaving] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const history = useEditorHistory({
    tracks: editorState.tracks,
    duration: editorState.duration,
    selectedClipId: editorState.selectedClipId,
  });

  useEffect(() => {
    history.syncCurrent({
      tracks: editorState.tracks,
      duration: editorState.duration,
      selectedClipId: editorState.selectedClipId,
    });
  }, [editorState.tracks, editorState.duration, editorState.selectedClipId]);

  useEffect(() => {
    const onUndo = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) setEditorState((prev) => ({ ...prev, ...detail }));
    };
    const onRedo = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) setEditorState((prev) => ({ ...prev, ...detail }));
    };
    window.addEventListener("editor-undo", onUndo);
    window.addEventListener("editor-redo", onRedo);
    return () => {
      window.removeEventListener("editor-undo", onUndo);
      window.removeEventListener("editor-redo", onRedo);
    };
  }, []);

  const withHistory = useCallback(
    (mutator: (prev: EditorState) => EditorState) => {
      setEditorState((prev) => {
        history.pushState({
          tracks: prev.tracks,
          duration: prev.duration,
          selectedClipId: prev.selectedClipId,
        });
        return mutator(prev);
      });
    },
    [history]
  );

  const handleUndo = useCallback(() => {
    const snapshot = history.undo();
    if (snapshot) setEditorState((prev) => ({ ...prev, ...snapshot }));
  }, [history]);

  const handleRedo = useCallback(() => {
    const snapshot = history.redo();
    if (snapshot) setEditorState((prev) => ({ ...prev, ...snapshot }));
  }, [history]);

  // === SPLIT ===
  const handleSplit = useCallback(() => {
    const { currentTime, tracks, selectedClipId } = editorState;
    let targetClip: TimelineClip | undefined;
    let targetTrack: TimelineTrack | undefined;

    for (const track of tracks) {
      for (const clip of track.clips) {
        if (currentTime > clip.start && currentTime < clip.end) {
          if (clip.id === selectedClipId || !targetClip) {
            targetClip = clip;
            targetTrack = track;
          }
        }
      }
    }

    if (!targetClip || !targetTrack) {
      toast.error("No clip at playhead to split");
      return;
    }

    const splitPoint = currentTime;
    const leftClip: TimelineClip = { ...targetClip, id: `${targetClip.id}-L`, end: splitPoint };
    const rightClip: TimelineClip = {
      ...targetClip,
      id: `${targetClip.id}-R`,
      start: splitPoint,
      trimStart: (targetClip.trimStart || 0) + (splitPoint - targetClip.start),
    };

    withHistory((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) =>
        t.id === targetTrack!.id
          ? { ...t, clips: t.clips.flatMap((c) => (c.id === targetClip!.id ? [leftClip, rightClip] : [c])) }
          : t
      ),
      selectedClipId: rightClip.id,
    }));

    toast.success("Clip split at playhead");
  }, [editorState, withHistory]);

  // === DUPLICATE ===
  const handleDuplicate = useCallback(() => {
    const { selectedClipId, tracks } = editorState;
    if (!selectedClipId) {
      toast.error("Select a clip to duplicate");
      return;
    }

    let sourceClip: TimelineClip | undefined;
    let sourceTrackId: string | undefined;
    for (const track of tracks) {
      const clip = track.clips.find((c) => c.id === selectedClipId);
      if (clip) {
        sourceClip = clip;
        sourceTrackId = track.id;
        break;
      }
    }

    if (!sourceClip || !sourceTrackId) return;

    const dur = sourceClip.end - sourceClip.start;
    const newClip: TimelineClip = {
      ...sourceClip,
      id: `dup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      start: sourceClip.end,
      end: sourceClip.end + dur,
    };

    withHistory((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) =>
        t.id === sourceTrackId ? { ...t, clips: [...t.clips, newClip] } : t
      ),
      duration: Math.max(prev.duration, newClip.end),
      selectedClipId: newClip.id,
    }));
    toast.success("Clip duplicated");
  }, [editorState, withHistory]);

  // === RIPPLE DELETE ===
  const handleRippleDelete = useCallback((clipId: string) => {
    withHistory((prev) => {
      let deletedClip: TimelineClip | undefined;
      let deletedTrackId: string | undefined;

      for (const track of prev.tracks) {
        const clip = track.clips.find((c) => c.id === clipId);
        if (clip) {
          deletedClip = clip;
          deletedTrackId = track.id;
          break;
        }
      }

      if (!deletedClip || !deletedTrackId) return prev;

      const gap = deletedClip.end - deletedClip.start;

      return {
        ...prev,
        tracks: prev.tracks.map((t) => {
          if (t.id !== deletedTrackId) return t;
          const remaining = t.clips.filter((c) => c.id !== clipId);
          // Shift all clips after the deleted one to close the gap
          return {
            ...t,
            clips: remaining.map((c) =>
              c.start >= deletedClip!.end
                ? { ...c, start: c.start - gap, end: c.end - gap }
                : c
            ),
          };
        }),
        selectedClipId: prev.selectedClipId === clipId ? null : prev.selectedClipId,
        duration: Math.max(0, prev.duration - gap),
      };
    });
    toast.success("Clip removed (ripple)");
  }, [withHistory]);

  // === ADD TRACK ===
  const handleAddTrack = useCallback((type: "video" | "audio" | "text") => {
    const existingCount = editorState.tracks.filter((t) => t.type === type).length;
    const newTrack: TimelineTrack = {
      id: `${type}-${Date.now()}`,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${existingCount + 1}`,
      type,
      clips: [],
      muted: false,
      locked: false,
    };
    withHistory((prev) => ({
      ...prev,
      tracks: [...prev.tracks, newTrack],
    }));
    toast.success(`${newTrack.name} track added`);
  }, [editorState.tracks, withHistory]);

  // === FIT TO VIEW ===
  const handleFitToView = useCallback(() => {
    if (editorState.duration <= 0) return;
    // Assume ~800px timeline visible width; target zoom so duration fills it
    const targetZoom = 800 / (editorState.duration * 60);
    setEditorState((prev) => ({ ...prev, zoom: Math.max(0.1, Math.min(10, targetZoom)) }));
  }, [editorState.duration]);

  // === Recalculate duration ===
  const recalcDuration = useCallback((tracks: TimelineTrack[]) => {
    let maxEnd = 0;
    for (const t of tracks) {
      for (const c of t.clips) {
        if (c.end > maxEnd) maxEnd = c.end;
      }
    }
    return maxEnd;
  }, []);

  const handleDeleteClip = useCallback((clipId: string) => {
    withHistory((prev) => ({
      ...prev,
      tracks: prev.tracks.map((track) => ({ ...track, clips: track.clips.filter((c) => c.id !== clipId) })),
      selectedClipId: prev.selectedClipId === clipId ? null : prev.selectedClipId,
    }));
  }, [withHistory]);

  // === Toggle Track Mute ===
  const handleToggleTrackMute = useCallback((trackId: string) => {
    setEditorState((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) =>
        t.id === trackId ? { ...t, muted: !t.muted } : t
      ),
    }));
  }, []);

  // === Toggle Track Lock ===
  const handleToggleTrackLock = useCallback((trackId: string) => {
    setEditorState((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) =>
        t.id === trackId ? { ...t, locked: !t.locked } : t
      ),
    }));
  }, []);

  // === Keyboard shortcuts ===
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;

      // Split: S
      if (e.key === "s" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleSplit();
      }
      // Delete: Del or Backspace
      if ((e.key === "Delete" || e.key === "Backspace") && editorState.selectedClipId) {
        e.preventDefault();
        if (e.shiftKey) {
          handleRippleDelete(editorState.selectedClipId);
        } else {
          handleDeleteClip(editorState.selectedClipId);
        }
      }
      // Duplicate: Ctrl/Cmd+D
      if ((e.ctrlKey || e.metaKey) && e.key === "d") {
        e.preventDefault();
        handleDuplicate();
      }
      // Fit to view: Ctrl/Cmd+Shift+F
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "F") {
        e.preventDefault();
        handleFitToView();
      }
      // Toggle snap: N
      if (e.key === "n" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setSnapEnabled((prev) => !prev);
        toast.info(`Snap ${!snapEnabled ? 'on' : 'off'}`);
      }
      // Toggle media browser: M
      if (e.key === "m" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowMediaBrowser((prev) => !prev);
      }
      // Undo: Ctrl/Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      // Redo: Ctrl/Cmd+Shift+Z
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "z") {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSplit, handleDuplicate, handleFitToView, handleDeleteClip, handleRippleDelete, handleUndo, handleRedo, editorState.selectedClipId, snapEnabled]);

  const canSplit = editorState.tracks.some((t) =>
    t.clips.some((c) => editorState.currentTime > c.start && editorState.currentTime < c.end)
  );

  // Load project clips on mount
  useEffect(() => {
    if (!user) return;
    const loadLatestOrSpecified = async () => {
      let targetProjectId = projectId;
      let projectTitle = "Untitled Edit";
      if (!targetProjectId) {
        const { data: recentProject } = await supabase
          .from("movie_projects")
          .select("id, title")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(10);
        if (recentProject?.length) {
          for (const proj of recentProject) {
            const { count } = await supabase
              .from("video_clips")
              .select("id", { count: "exact", head: true })
              .eq("project_id", proj.id)
              .eq("status", "completed")
              .not("video_url", "is", null);
            if (count && count > 0) {
              targetProjectId = proj.id;
              projectTitle = proj.title || "Untitled Edit";
              break;
            }
          }
        }
        if (!targetProjectId) return;
        const newParams = new URLSearchParams(searchParams);
        newParams.set("project", targetProjectId);
        window.history.replaceState(null, "", `?${newParams.toString()}`);
      } else {
        const { data: proj } = await supabase
          .from("movie_projects")
          .select("title")
          .eq("id", targetProjectId)
          .single();
        if (proj?.title) projectTitle = proj.title;
      }
      loadProjectClips(targetProjectId, projectTitle);
    };
    loadLatestOrSpecified();
  }, [projectId, user]);

  const loadProjectClips = async (pid: string, projectTitle?: string) => {
    const { data: clips, error } = await supabase
      .from("video_clips")
      .select("id, shot_index, video_url, duration_seconds, prompt")
      .eq("project_id", pid)
      .eq("status", "completed")
      .not("video_url", "is", null)
      .order("shot_index");

    if (error) {
      console.error('[VideoEditor] Failed to load clips:', error.message);
      toast.error("Couldn't load clips. Please try again.");
      return;
    }
    if (!clips?.length) {
      toast.info("No completed clips found for this project yet");
      return;
    }

    const timelineClips: TimelineClip[] = [];
    let startTime = 0;
    for (const clip of clips) {
      const dur = clip.duration_seconds || 6;
      timelineClips.push({
        id: clip.id,
        trackId: "video-0",
        start: startTime,
        end: startTime + dur,
        type: "video",
        sourceUrl: clip.video_url || "",
        label: clip.prompt?.substring(0, 40) || `Shot ${clip.shot_index + 1}`,
        effects: [],
      });
      startTime += dur;
    }

    setEditorState((prev) => ({
      ...prev,
      projectId: pid,
      title: projectTitle || prev.title,
      tracks: prev.tracks.map((t) => (t.id === "video-0" ? { ...t, clips: timelineClips } : t)),
      duration: startTime,
    }));
  };

  const handleAddClipFromBrowser = useCallback((clip: {
    id: string; prompt: string; video_url: string; duration_seconds: number; shot_index: number;
  }) => {
    const dur = clip.duration_seconds || 6;
    withHistory((prev) => {
      const videoTrack = prev.tracks.find((t) => t.id === "video-0");
      const lastEnd = videoTrack?.clips.reduce((max, c) => Math.max(max, c.end), 0) || 0;
      const newClip: TimelineClip = {
        id: `imported-${clip.id}-${Date.now()}`,
        trackId: "video-0",
        start: lastEnd,
        end: lastEnd + dur,
        type: "video",
        sourceUrl: clip.video_url,
        label: clip.prompt?.substring(0, 40) || `Shot ${clip.shot_index + 1}`,
        effects: [],
      };
      return {
        ...prev,
        tracks: prev.tracks.map((t) => (t.id === "video-0" ? { ...t, clips: [...t.clips, newClip] } : t)),
        duration: Math.max(prev.duration, lastEnd + dur),
      };
    });
    toast.success("Clip added to timeline");
  }, [withHistory]);

  const handleUpdateClip = useCallback((clipId: string, updates: Partial<TimelineClip>) => {
    withHistory((prev) => ({
      ...prev,
      tracks: prev.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => (clip.id === clipId ? { ...clip, ...updates } : clip)),
      })),
    }));
  }, [withHistory]);

  const handleReorderClip = useCallback((clipId: string, newStart: number) => {
    handleUpdateClip(clipId, { start: newStart });
  }, [handleUpdateClip]);

  const handleMoveClipToTrack = useCallback((clipId: string, targetTrackId: string) => {
    withHistory((prev) => {
      let movedClip: TimelineClip | undefined;
      const tracksWithout = prev.tracks.map((track) => {
        const clip = track.clips.find((c) => c.id === clipId);
        if (clip) {
          movedClip = { ...clip, trackId: targetTrackId };
          return { ...track, clips: track.clips.filter((c) => c.id !== clipId) };
        }
        return track;
      });
      if (!movedClip) return prev;
      return {
        ...prev,
        tracks: tracksWithout.map((track) =>
          track.id === targetTrackId ? { ...track, clips: [...track.clips, movedClip!] } : track
        ),
      };
    });
    toast.success("Clip moved to track");
  }, [withHistory]);

  const handleSelectClip = useCallback((clipId: string | null) => {
    setEditorState((prev) => ({ ...prev, selectedClipId: clipId }));
  }, []);

  const handleTimeChange = useCallback((time: number) => {
    setEditorState((prev) => ({ ...prev, currentTime: time }));
  }, []);

  const handlePlayPause = useCallback(() => {
    setEditorState((prev) => ({ ...prev, isPlaying: !prev.isPlaying }));
  }, []);

  const handleZoomChange = useCallback((zoom: number) => {
    setEditorState((prev) => ({ ...prev, zoom }));
  }, []);

  const handleAddTextOverlay = useCallback(() => {
    const textTrack = editorState.tracks.find((t) => t.type === "text");
    if (!textTrack) return;
    const newClip: TimelineClip = {
      id: `text-${Date.now()}`,
      trackId: textTrack.id,
      start: editorState.currentTime,
      end: editorState.currentTime + 3,
      type: "text",
      sourceUrl: "",
      label: "New Text",
      effects: [],
      textContent: "Your text here",
      textStyle: { fontSize: 48, color: "#FFFFFF", fontWeight: "bold" },
    };
    withHistory((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => (t.id === textTrack.id ? { ...t, clips: [...t.clips, newClip] } : t)),
      selectedClipId: newClip.id,
    }));
  }, [editorState.tracks, editorState.currentTime, withHistory]);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const timelineData = { tracks: editorState.tracks, duration: editorState.duration };
      if (editorState.sessionId) {
        await supabase.from("edit_sessions").update({ title: editorState.title, timeline_data: timelineData as any }).eq("id", editorState.sessionId);
      } else {
        const { data, error } = await supabase.from("edit_sessions").insert({
          user_id: user.id, project_id: editorState.projectId, title: editorState.title, timeline_data: timelineData as any,
        }).select("id").single();
        if (error) throw error;
        setEditorState((prev) => ({ ...prev, sessionId: data.id }));
      }
      toast.success("Session saved");
    } catch (err) {
      toast.error("Failed to save session");
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = async () => {
    if (!editorState.sessionId) await handleSave();
    setEditorState((prev) => ({ ...prev, renderStatus: "rendering", renderProgress: 0 }));
    try {
      const { data, error } = await supabase.functions.invoke("render-video", {
        body: {
          sessionId: editorState.sessionId,
          timeline: { tracks: editorState.tracks, duration: editorState.duration },
          settings: { resolution: "1080p", fps: 30, format: "mp4" },
        },
      });
      if (error) throw error;
      if (data?.jobId) {
        toast.success("Render job submitted!");
        pollRenderStatus(data.jobId);
      }
    } catch {
      setEditorState((prev) => ({ ...prev, renderStatus: "failed" }));
      toast.error("Failed to start render");
    }
  };

  const pollRenderStatus = useCallback((jobId: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(async () => {
      try {
        const { data } = await supabase.functions.invoke("render-video", { body: { action: "status", jobId } });
        if (data?.status === "completed") {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          setEditorState((prev) => ({ ...prev, renderStatus: "completed", renderProgress: 100 }));
          toast.success("Render complete!");
        } else if (data?.status === "failed") {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          setEditorState((prev) => ({ ...prev, renderStatus: "failed" }));
          toast.error("Render failed");
        } else {
          setEditorState((prev) => ({ ...prev, renderProgress: data?.progress || prev.renderProgress }));
        }
      } catch {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }, 5000);
  }, []);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // handleDeleteClip defined above keyboard handler

  const handleAddTransition = useCallback((clipId: string, type: string) => {
    handleUpdateClip(clipId, { effects: [{ type: "transition", name: type, duration: 0.5 }] });
  }, [handleUpdateClip]);

  const handleApplyTemplate = useCallback((templateId: string) => {
    withHistory((prev) => {
      switch (templateId) {
        case "intro-outro": {
          const introClip: TimelineClip = {
            id: `text-intro-${Date.now()}`, trackId: "text-0", start: 0, end: 3,
            type: "text", sourceUrl: "", label: "Intro Title", effects: [],
            textContent: "YOUR TITLE", textStyle: { fontSize: 72, color: "#FFFFFF", fontWeight: "bold" },
          };
          const outroClip: TimelineClip = {
            id: `text-outro-${Date.now()}`, trackId: "text-0", start: Math.max(prev.duration - 3, 3), end: Math.max(prev.duration, 6),
            type: "text", sourceUrl: "", label: "End Card", effects: [],
            textContent: "THANKS FOR WATCHING", textStyle: { fontSize: 48, color: "#FFFFFF", fontWeight: "bold" },
          };
          return {
            ...prev,
            tracks: prev.tracks.map((t) =>
              t.id === "text-0" ? { ...t, clips: [...t.clips, introClip, outroClip] } : t
            ),
            duration: Math.max(prev.duration, 6),
          };
        }
        case "slideshow":
          return {
            ...prev,
            tracks: prev.tracks.map((t) =>
              t.type === "video"
                ? { ...t, clips: t.clips.map((c) => ({ ...c, effects: [{ type: "transition" as const, name: "crossfade", duration: 0.5 }] })) }
                : t
            ),
          };
        default:
          toast.info(`Template "${templateId}" applied`);
          return prev;
      }
    });
    toast.success("Template applied");
  }, [withHistory]);

  const hasClips = editorState.tracks.some((t) => t.clips.length > 0);

  return (
    <div className="h-screen w-screen flex flex-col bg-[hsl(260,15%,4%)] overflow-hidden" style={{ contain: 'layout size' }}>
      <EditorToolbar
        title={editorState.title}
        onTitleChange={(title) => setEditorState((prev) => ({ ...prev, title }))}
        onSave={handleSave}
        onExport={handleExport}
        onBack={() => window.history.back()}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onSplit={handleSplit}
        onDuplicate={handleDuplicate}
        onFitToView={handleFitToView}
        onToggleSnap={() => setSnapEnabled((prev) => !prev)}
        onToggleMediaBrowser={() => setShowMediaBrowser((prev) => !prev)}
        onAddTrack={handleAddTrack}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        canSplit={canSplit}
        canDuplicate={!!editorState.selectedClipId}
        snapEnabled={snapEnabled}
        showMediaBrowser={showMediaBrowser}
        isSaving={isSaving}
        renderStatus={editorState.renderStatus}
        renderProgress={editorState.renderProgress}
      />

      <div className="flex-1 flex min-h-0 min-w-0" style={{ height: 'calc(100vh - 44px)', contain: 'strict' }}>
        {showMediaBrowser && (
          <div className="w-64 shrink-0 border-r border-white/[0.06] overflow-hidden" style={{ maxHeight: '100%' }}>
            <EditorMediaBrowser onAddClip={handleAddClipFromBrowser} />
          </div>
        )}

        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-hidden relative" style={{ contain: 'strict' }}>
            {hasClips ? (
              <EditorPreview
                tracks={editorState.tracks}
                currentTime={editorState.currentTime}
                isPlaying={editorState.isPlaying}
                onPlayPause={handlePlayPause}
                onTimeChange={handleTimeChange}
                duration={editorState.duration}
                playbackSpeed={playbackSpeed}
                onPlaybackSpeedChange={setPlaybackSpeed}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[hsl(260,15%,4%)] gap-5">
                <div className="w-16 h-16 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-center relative">
                  <Film className="w-7 h-7 text-white/15" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                    <Sparkles className="w-2 h-2 text-primary" />
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-[13px] text-white/50 font-medium tracking-wide">No clips in timeline</p>
                  <p className="text-[11px] text-white/20 mt-1.5 max-w-[240px] leading-relaxed">
                    Browse clips in the media panel and click to add them to your edit
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="h-px bg-white/[0.06]" />
          <div className="shrink-0 overflow-hidden" style={{ height: '35%', minHeight: 180, maxHeight: 320 }}>
            <EditorTimeline
              tracks={editorState.tracks}
              currentTime={editorState.currentTime}
              duration={editorState.duration}
              zoom={editorState.zoom}
              selectedClipId={editorState.selectedClipId}
              snapEnabled={snapEnabled}
              onTimeChange={handleTimeChange}
              onSelectClip={handleSelectClip}
              onUpdateClip={handleUpdateClip}
              onReorderClip={handleReorderClip}
              onZoomChange={handleZoomChange}
              onDeleteClip={handleDeleteClip}
              onRippleDelete={handleRippleDelete}
              onMoveClipToTrack={handleMoveClipToTrack}
              onToggleTrackMute={handleToggleTrackMute}
              onToggleTrackLock={handleToggleTrackLock}
            />
          </div>
        </div>

        <div className="w-72 shrink-0 border-l border-white/[0.06] overflow-hidden" style={{ maxHeight: '100%' }}>
          <EditorSidebar
            tracks={editorState.tracks}
            selectedClipId={editorState.selectedClipId}
            currentTime={editorState.currentTime}
            onUpdateClip={handleUpdateClip}
            onAddTextOverlay={handleAddTextOverlay}
            onAddTransition={handleAddTransition}
            onDeleteClip={handleDeleteClip}
            onApplyTemplate={handleApplyTemplate}
          />
        </div>
      </div>
    </div>
  );
};

export default VideoEditor;
