import { useState, useCallback, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { EditorTimeline } from "@/components/editor/EditorTimeline";
import { EditorPreview } from "@/components/editor/EditorPreview";
import { EditorSidebar } from "@/components/editor/EditorSidebar";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import type { EditorState, TimelineTrack, TimelineClip } from "@/components/editor/types";

const VideoEditor = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("project");

  const [editorState, setEditorState] = useState<EditorState>({
    sessionId: null,
    projectId: projectId || null,
    title: "Untitled Edit",
    tracks: [],
    currentTime: 0,
    duration: 0,
    isPlaying: false,
    selectedClipId: null,
    zoom: 1,
    renderStatus: "idle",
    renderProgress: 0,
  });

  const [isSaving, setIsSaving] = useState(false);

  // Load project clips into tracks on mount
  useEffect(() => {
    if (!projectId || !user) return;
    loadProjectClips(projectId);
  }, [projectId, user]);

  const loadProjectClips = async (pid: string) => {
    const { data: clips, error } = await supabase
      .from("video_clips")
      .select("id, shot_index, video_url, duration_seconds, prompt")
      .eq("project_id", pid)
      .eq("status", "completed")
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

    const videoTrack: TimelineTrack = {
      id: "video-0",
      name: "Video",
      type: "video",
      clips: timelineClips,
      muted: false,
      locked: false,
    };

    const textTrack: TimelineTrack = {
      id: "text-0",
      name: "Text",
      type: "text",
      clips: [],
      muted: false,
      locked: false,
    };

    setEditorState((prev) => ({
      ...prev,
      tracks: [videoTrack, textTrack],
      duration: startTime,
    }));
  };

  const handleUpdateClip = useCallback((clipId: string, updates: Partial<TimelineClip>) => {
    setEditorState((prev) => ({
      ...prev,
      tracks: prev.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) =>
          clip.id === clipId ? { ...clip, ...updates } : clip
        ),
      })),
    }));
  }, []);

  const handleReorderClip = useCallback((clipId: string, newStart: number) => {
    handleUpdateClip(clipId, { start: newStart });
  }, [handleUpdateClip]);

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

    setEditorState((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) =>
        t.id === textTrack.id ? { ...t, clips: [...t.clips, newClip] } : t
      ),
      selectedClipId: newClip.id,
    }));
  }, [editorState.tracks, editorState.currentTime]);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const timelineData = {
        tracks: editorState.tracks,
        duration: editorState.duration,
      };

      if (editorState.sessionId) {
        await supabase
          .from("edit_sessions")
          .update({
            title: editorState.title,
            timeline_data: timelineData as any,
          })
          .eq("id", editorState.sessionId);
      } else {
        const { data, error } = await supabase
          .from("edit_sessions")
          .insert({
            user_id: user.id,
            project_id: editorState.projectId,
            title: editorState.title,
            timeline_data: timelineData as any,
          })
          .select("id")
          .single();

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
    if (!editorState.sessionId) {
      await handleSave();
    }

    setEditorState((prev) => ({ ...prev, renderStatus: "rendering", renderProgress: 0 }));

    try {
      const { data, error } = await supabase.functions.invoke("render-video", {
        body: {
          sessionId: editorState.sessionId,
          timeline: {
            tracks: editorState.tracks,
            duration: editorState.duration,
          },
          settings: { resolution: "1080p", fps: 30, format: "mp4" },
        },
      });

      if (error) throw error;

      if (data?.jobId) {
        toast.success("Render job submitted! You'll be notified when complete.");
        // Poll for completion
        pollRenderStatus(data.jobId);
      }
    } catch (err) {
      setEditorState((prev) => ({ ...prev, renderStatus: "failed" }));
      toast.error("Failed to start render");
    }
  };

  const pollRenderStatus = async (jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const { data } = await supabase.functions.invoke("render-video", {
          body: { action: "status", jobId },
        });

        if (data?.status === "completed") {
          clearInterval(interval);
          setEditorState((prev) => ({
            ...prev,
            renderStatus: "completed",
            renderProgress: 100,
          }));
          toast.success("Render complete!");
        } else if (data?.status === "failed") {
          clearInterval(interval);
          setEditorState((prev) => ({ ...prev, renderStatus: "failed" }));
          toast.error("Render failed");
        } else {
          setEditorState((prev) => ({
            ...prev,
            renderProgress: data?.progress || prev.renderProgress,
          }));
        }
      } catch {
        clearInterval(interval);
      }
    }, 5000);
  };

  const handleDeleteClip = useCallback((clipId: string) => {
    setEditorState((prev) => ({
      ...prev,
      tracks: prev.tracks.map((track) => ({
        ...track,
        clips: track.clips.filter((c) => c.id !== clipId),
      })),
      selectedClipId: prev.selectedClipId === clipId ? null : prev.selectedClipId,
    }));
  }, []);

  const handleAddTransition = useCallback((clipId: string, type: string) => {
    handleUpdateClip(clipId, {
      effects: [{ type: "transition", name: type, duration: 0.5 }],
    });
  }, [handleUpdateClip]);

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Top toolbar */}
      <EditorToolbar
        title={editorState.title}
        onTitleChange={(title) => setEditorState((prev) => ({ ...prev, title }))}
        onSave={handleSave}
        onExport={handleExport}
        onBack={() => navigate(-1)}
        isSaving={isSaving}
        renderStatus={editorState.renderStatus}
        renderProgress={editorState.renderProgress}
      />

      {/* Main content area */}
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal">
          {/* Preview + Properties */}
          <ResizablePanel defaultSize={75} minSize={50}>
            <ResizablePanelGroup direction="vertical">
              {/* Preview */}
              <ResizablePanel defaultSize={60} minSize={30}>
                <EditorPreview
                  tracks={editorState.tracks}
                  currentTime={editorState.currentTime}
                  isPlaying={editorState.isPlaying}
                  onPlayPause={handlePlayPause}
                  onTimeChange={handleTimeChange}
                  duration={editorState.duration}
                />
              </ResizablePanel>

              <ResizableHandle withHandle />

              {/* Timeline */}
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
                />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right sidebar - clip properties */}
          <ResizablePanel defaultSize={25} minSize={15} maxSize={35}>
            <EditorSidebar
              tracks={editorState.tracks}
              selectedClipId={editorState.selectedClipId}
              onUpdateClip={handleUpdateClip}
              onAddTextOverlay={handleAddTextOverlay}
              onAddTransition={handleAddTransition}
              onDeleteClip={handleDeleteClip}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
};

export default VideoEditor;
