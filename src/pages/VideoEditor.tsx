import { useState, useCallback, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { EditorTimeline } from "@/components/editor/EditorTimeline";
import { EditorPreview } from "@/components/editor/EditorPreview";
import { EditorSidebar } from "@/components/editor/EditorSidebar";
import { EditorMediaBrowser } from "@/components/editor/EditorMediaBrowser";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Film, Sparkles } from "lucide-react";
import { useEditorHistory } from "@/hooks/useEditorHistory";
import type { EditorState, TimelineTrack, TimelineClip } from "@/components/editor/types";

const VideoEditor = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("project") || searchParams.get("projectId");

  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const [editorState, setEditorState] = useState<EditorState>({
    sessionId: null,
    projectId: projectId || null,
    title: "Untitled Edit",
    tracks: [
      { id: "video-0", name: "Video", type: "video", clips: [], muted: false, locked: false },
      { id: "audio-0", name: "Audio", type: "audio", clips: [], muted: false, locked: false },
      { id: "text-0", name: "Text", type: "text", clips: [], muted: false, locked: false },
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

  // Undo/Redo history
  const history = useEditorHistory({
    tracks: editorState.tracks,
    duration: editorState.duration,
    selectedClipId: editorState.selectedClipId,
  });

  // Keep history in sync
  useEffect(() => {
    history.syncCurrent({
      tracks: editorState.tracks,
      duration: editorState.duration,
      selectedClipId: editorState.selectedClipId,
    });
  }, [editorState.tracks, editorState.duration, editorState.selectedClipId]);

  // Listen for keyboard undo/redo events
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

  // Push state before mutations
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

  // Split clip at playhead
  const handleSplit = useCallback(() => {
    const { currentTime, tracks, selectedClipId } = editorState;
    // Find clip under playhead (prefer selected, fallback to any on video track)
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

  // Split keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "s" && !e.ctrlKey && !e.metaKey && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        handleSplit();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSplit]);

  // Can we split?
  const canSplit = editorState.tracks.some((t) =>
    t.clips.some((c) => editorState.currentTime > c.start && editorState.currentTime < c.end)
  );

  // Load project clips on mount — auto-detect latest project if none specified
  useEffect(() => {
    if (!user) return;

    const loadLatestOrSpecified = async () => {
      let targetProjectId = projectId;
      let projectTitle = "Untitled Edit";

      if (!targetProjectId) {
        // No project specified — find the most recent project with completed clips
        const { data: recentProject } = await supabase
          .from("movie_projects")
          .select("id, title")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(10);

        if (recentProject?.length) {
          // Find first project that actually has completed clips
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

        if (!targetProjectId) return; // No projects with clips found
      } else {
        // Fetch the project title for the specified project
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

    if (error || !clips?.length) {
      toast.error("No completed clips found for this project");
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

  // Move clip between tracks (drag-and-drop)
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

  const pollRenderStatus = async (jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const { data } = await supabase.functions.invoke("render-video", { body: { action: "status", jobId } });
        if (data?.status === "completed") {
          clearInterval(interval);
          setEditorState((prev) => ({ ...prev, renderStatus: "completed", renderProgress: 100 }));
          toast.success("Render complete!");
        } else if (data?.status === "failed") {
          clearInterval(interval);
          setEditorState((prev) => ({ ...prev, renderStatus: "failed" }));
          toast.error("Render failed");
        } else {
          setEditorState((prev) => ({ ...prev, renderProgress: data?.progress || prev.renderProgress }));
        }
      } catch { clearInterval(interval); }
    }, 5000);
  };

  const handleDeleteClip = useCallback((clipId: string) => {
    withHistory((prev) => ({
      ...prev,
      tracks: prev.tracks.map((track) => ({ ...track, clips: track.clips.filter((c) => c.id !== clipId) })),
      selectedClipId: prev.selectedClipId === clipId ? null : prev.selectedClipId,
    }));
  }, [withHistory]);

  const handleAddTransition = useCallback((clipId: string, type: string) => {
    handleUpdateClip(clipId, { effects: [{ type: "transition", name: type, duration: 0.5 }] });
  }, [handleUpdateClip]);

  const handleApplyTemplate = useCallback((templateId: string) => {
    withHistory((prev) => {
      const now = prev.currentTime;
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
        case "slideshow": {
          // Add crossfade to all existing video clips
          return {
            ...prev,
            tracks: prev.tracks.map((t) =>
              t.type === "video"
                ? { ...t, clips: t.clips.map((c) => ({ ...c, effects: [{ type: "transition" as const, name: "crossfade", duration: 0.5 }] })) }
                : t
            ),
          };
        }
        default:
          toast.info(`Template "${templateId}" applied`);
          return prev;
      }
    });
    toast.success("Template applied");
  }, [withHistory]);

  const hasClips = editorState.tracks.some((t) => t.clips.length > 0);

  return (
    <div className="h-screen flex flex-col bg-[hsl(260,15%,4%)] overflow-hidden">
      <EditorToolbar
        title={editorState.title}
        onTitleChange={(title) => setEditorState((prev) => ({ ...prev, title }))}
        onSave={handleSave}
        onExport={handleExport}
        onBack={() => navigate(-1)}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onSplit={handleSplit}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        canSplit={canSplit}
        isSaving={isSaving}
        renderStatus={editorState.renderStatus}
        renderProgress={editorState.renderProgress}
      />

      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={18} minSize={14} maxSize={28}>
            <EditorMediaBrowser onAddClip={handleAddClipFromBrowser} />
          </ResizablePanel>

          <ResizableHandle className="w-px bg-white/[0.04] hover:bg-primary/30 transition-colors data-[resize-handle-active]:bg-primary/50" />

          <ResizablePanel defaultSize={57} minSize={40}>
            <ResizablePanelGroup direction="vertical">
              <ResizablePanel defaultSize={60} minSize={30}>
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
                  <div className="h-full flex flex-col items-center justify-center bg-[hsl(260,15%,4%)] gap-5">
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
              </ResizablePanel>

              <ResizableHandle className="h-px bg-white/[0.04] hover:bg-primary/30 transition-colors data-[resize-handle-active]:bg-primary/50" />

              <ResizablePanel defaultSize={40} minSize={20}>
                <EditorTimeline
                  tracks={editorState.tracks}
                  currentTime={editorState.currentTime}
                  duration={editorState.duration}
                  zoom={editorState.zoom}
                  selectedClipId={editorState.selectedClipId}
                  onTimeChange={handleTimeChange}
                  onSelectClip={handleSelectClip}
                  onUpdateClip={handleUpdateClip}
                  onReorderClip={handleReorderClip}
                  onZoomChange={handleZoomChange}
                  onDeleteClip={handleDeleteClip}
                  onMoveClipToTrack={handleMoveClipToTrack}
                />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>

          <ResizableHandle className="w-px bg-white/[0.04] hover:bg-primary/30 transition-colors data-[resize-handle-active]:bg-primary/50" />

          <ResizablePanel defaultSize={25} minSize={15} maxSize={35}>
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
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
};

export default VideoEditor;
