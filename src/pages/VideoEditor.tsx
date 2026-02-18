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
import type { EditorState, TimelineTrack, TimelineClip, MusicTrack } from "@/components/editor/types";

/**
 * Extract a clean, human-readable label from the raw AI generation prompt.
 * Raw prompts contain injection blocks like [CRITICAL: SAME EXACT PERSON...],
 * [═══ PRIMARY SUBJECT ═══], and long boilerplate suffixes.
 */
function extractClipLabel(rawPrompt: string | null | undefined, shotIndex: number): string {
  if (!rawPrompt) return `Shot ${shotIndex + 1}`;
  let clean = rawPrompt
    .replace(/\[═+[^\]]*═+\]/g, '')
    .replace(/\[[^\]]{0,300}\]/g, '')
    .replace(/cinematic lighting.*$/i, '')
    .replace(/,\s*8K resolution.*/i, '')
    .replace(/ARRI Alexa.*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return `Shot ${shotIndex + 1}`;
  const sentence = clean.split(/[.!?]/)[0].trim();
  if (sentence.length > 2) return sentence.length > 60 ? sentence.slice(0, 57) + '…' : sentence;
  return clean.slice(0, 60) || `Shot ${shotIndex + 1}`;
}



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

  // NOTE: clip auto-load is handled by the single useEffect at line ~430 (loadLatestOrSpecified).
  // A duplicate effect that used to live here raced against it on [projectId, user],
  // causing double loads and the second always overwriting the first.

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
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "z") {
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
          .maybeSingle();
        if (proj?.title) projectTitle = proj.title;
      }
      loadProjectClips(targetProjectId, projectTitle);
    };
    loadLatestOrSpecified();
  }, [projectId, user]);

  const loadProjectClips = async (pid: string, projectTitle?: string) => {
    // First try the video_clips table (text-to-video projects)
    const { data: clips, error } = await supabase
      .from("video_clips")
      .select("id, shot_index, video_url, duration_seconds, prompt")
      .eq("project_id", pid)
      .eq("status", "completed")
      .not("video_url", "is", null)
      .order("shot_index")
      .limit(1000);

    if (error) {
      console.error('[VideoEditor] Failed to load clips:', error.message);
      toast.error("Couldn't load clips. Please try again.");
      return;
    }

    // If clips found in video_clips table, use them (text-to-video projects)
    if (clips?.length) {
      const timelineClips: TimelineClip[] = [];
      let startTime = 0;
      for (let i = 0; i < clips.length; i++) {
        const clip = clips[i];
        const dur = clip.duration_seconds || 6;
        const effects: TimelineClip['effects'] = i < clips.length - 1
          ? [{ type: "transition" as const, name: "crossfade", duration: 0.5 }]
          : [];
        timelineClips.push({
          id: clip.id,
          trackId: "video-0",
          start: startTime,
          end: startTime + dur,
          type: "video",
          sourceUrl: clip.video_url || "",
          label: extractClipLabel(clip.prompt, clip.shot_index),
          effects,
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
      toast.success(`Loaded ${clips.length} clips`);
      return;
    }

    // Fallback: avatar projects store clips in movie_projects.video_clips (JSON array)
    // and movie_projects.pending_video_tasks.predictions[].videoUrl
    const { data: proj } = await supabase
      .from("movie_projects")
      .select("video_clips, pending_video_tasks, mode")
      .eq("id", pid)
      .maybeSingle();

    // Build clip URL list from avatar project data
    const avatarClipUrls: string[] = [];

    // Primary source: pending_video_tasks.predictions (has per-clip segmentText for naming)
    const tasks = proj?.pending_video_tasks as any;
    const predictions: any[] = tasks?.predictions || [];
    if (predictions.length > 0) {
      predictions
        .filter((p: any) => p.status === 'completed' && p.videoUrl)
        .sort((a: any, b: any) => (a.clipIndex ?? 0) - (b.clipIndex ?? 0))
        .forEach((p: any) => avatarClipUrls.push(p.videoUrl));
    }

    // Secondary source: movie_projects.video_clips JSON array
    if (avatarClipUrls.length === 0 && Array.isArray(proj?.video_clips)) {
      (proj!.video_clips as string[]).forEach((url) => url && avatarClipUrls.push(url));
    }

    if (!avatarClipUrls.length) {
      toast.info("No completed clips found for this project yet");
      return;
    }

    const timelineClips: TimelineClip[] = [];
    let startTime = 0;
    for (let i = 0; i < avatarClipUrls.length; i++) {
      const url = avatarClipUrls[i];
      const pred = predictions[i];
      const dur = tasks?.clipDuration || 10;
      // Use segmentText (the spoken dialogue) as the label for avatar clips
      const label = pred?.segmentText
        ? (pred.segmentText.length > 60 ? pred.segmentText.slice(0, 57) + '…' : pred.segmentText)
        : `Clip ${i + 1}`;
      const effects: TimelineClip['effects'] = i < avatarClipUrls.length - 1
        ? [{ type: "transition" as const, name: "crossfade", duration: 0.5 }]
        : [];
      timelineClips.push({
        id: `avatar-clip-${pid}-${i}`,
        trackId: "video-0",
        start: startTime,
        end: startTime + dur,
        type: "video",
        sourceUrl: url,
        label,
        effects,
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

    toast.success(`Loaded ${timelineClips.length} clips`);
  };

  const handleAddClipFromBrowser = useCallback((clip: {
    id: string; prompt: string; video_url: string; duration_seconds: number; shot_index: number;
  }) => {
    const dur = clip.duration_seconds || 6;
    withHistory((prev) => {
      const videoTrack = prev.tracks.find((t) => t.id === "video-0");
      const existingClips = videoTrack?.clips || [];
      const lastEnd = existingClips.reduce((max, c) => Math.max(max, c.end), 0);
      const hasPrevClip = existingClips.length > 0;
      
      // HLS-style: auto-apply crossfade transition to previous clip (matches HLS #EXT-X-DISCONTINUITY + transitionOut: 'fade')
      const updatedExistingClips = hasPrevClip
        ? existingClips.map((c) => {
            if (c.end === lastEnd && !c.effects.some(e => e.type === "transition")) {
              return { ...c, effects: [...c.effects, { type: "transition" as const, name: "crossfade", duration: 0.5 }] };
            }
            return c;
          })
        : existingClips;

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
        tracks: prev.tracks.map((t) => (t.id === "video-0" ? { ...t, clips: [...updatedExistingClips, newClip] } : t)),
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

  const handleAddMusic = useCallback((track: MusicTrack) => {
    const audioTrack = editorState.tracks.find((t) => t.type === "audio");
    if (!audioTrack) { toast.error("Add an audio track first"); return; }
    const newClip: TimelineClip = {
      id: `music-${Date.now()}`, trackId: audioTrack.id, start: editorState.currentTime,
      end: editorState.currentTime + Math.min(track.duration, 30), type: "audio", sourceUrl: "",
      label: `♪ ${track.title}`, effects: [], volume: 80,
    };
    withHistory((prev) => ({ ...prev, tracks: prev.tracks.map((t) => (t.id === audioTrack.id ? { ...t, clips: [...t.clips, newClip] } : t)), selectedClipId: newClip.id }));
    toast.success(`Added "${track.title}" to audio track`);
  }, [editorState.tracks, editorState.currentTime, withHistory]);

  const handleAddSticker = useCallback((stickerId: string, content: string, category: string) => {
    const textTrack = editorState.tracks.find((t) => t.type === "text");
    if (!textTrack) { toast.error("Add a text track first"); return; }
    const newClip: TimelineClip = {
      id: `sticker-${Date.now()}`, trackId: textTrack.id, start: editorState.currentTime,
      end: editorState.currentTime + 3, type: "text", sourceUrl: "", label: content, effects: [],
      textContent: content, textStyle: { fontSize: category === "cta" ? 32 : 64, color: "#FFFFFF", fontWeight: "bold" },
    };
    withHistory((prev) => ({ ...prev, tracks: prev.tracks.map((t) => (t.id === textTrack.id ? { ...t, clips: [...t.clips, newClip] } : t)), selectedClipId: newClip.id }));
  }, [editorState.tracks, editorState.currentTime, withHistory]);

  const handleApplyEffect = useCallback((effectId: string) => {
    if (!editorState.selectedClipId) { toast.error("Select a clip first"); return; }
    handleUpdateClip(editorState.selectedClipId, { filter: effectId });
    toast.success(`Applied "${effectId}" effect`);
  }, [editorState.selectedClipId, handleUpdateClip]);

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
    const videoClips = editorState.tracks
      .filter((t) => t.type === "video")
      .flatMap((t) => t.clips)
      .sort((a, b) => a.start - b.start);

    if (videoClips.length === 0) {
      toast.error("No clips in timeline to export");
      return;
    }

    setEditorState((prev) => ({ ...prev, renderStatus: "rendering", renderProgress: 10 }));

    try {
      // If we have a project ID, use simple-stitch for server-side manifest
      if (editorState.projectId && user) {
        setEditorState((prev) => ({ ...prev, renderProgress: 30 }));
        
        const { data, error } = await supabase.functions.invoke("simple-stitch", {
          body: { projectId: editorState.projectId, userId: user.id },
        });

        if (error) throw error;
        
        setEditorState((prev) => ({ ...prev, renderProgress: 80 }));

        if (data?.success && data?.finalVideoUrl) {
          toast.success("Manifest created! Starting download...");
          setEditorState((prev) => ({ ...prev, renderStatus: "completed", renderProgress: 100 }));
          
          // Download each clip individually
          await downloadEditorClips(videoClips);
          return;
        }
      }

      // Fallback: download clips individually from timeline
      await downloadEditorClips(videoClips);
      setEditorState((prev) => ({ ...prev, renderStatus: "completed", renderProgress: 100 }));
      toast.success("Download complete!");
    } catch (err) {
      console.error("[Editor Export] Error:", err);
      setEditorState((prev) => ({ ...prev, renderStatus: "failed" }));
      toast.error("Export failed. Try downloading clips individually.");
    }
  };

  const downloadEditorClips = async (clips: TimelineClip[]) => {
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      if (!clip.sourceUrl) continue;

      setEditorState((prev) => ({
        ...prev,
        renderProgress: Math.round(((i + 1) / clips.length) * 100),
      }));

      try {
        const response = await fetch(clip.sourceUrl, { mode: "cors" });
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${editorState.title.replace(/[^a-zA-Z0-9]/g, "_")}_clip_${i + 1}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Small delay between downloads to avoid browser throttling
        if (i < clips.length - 1) {
          await new Promise((r) => setTimeout(r, 500));
        }
      } catch (err) {
        console.warn(`[Editor Export] Failed to download clip ${i + 1}:`, err);
        toast.error(`Failed to download clip ${i + 1}`);
      }
    }
  };


  // handleDeleteClip defined above keyboard handler

  const handleAddTransition = useCallback((clipId: string, type: string) => {
    handleUpdateClip(clipId, { effects: [{ type: "transition", name: type, duration: 0.5 }] });
  }, [handleUpdateClip]);

  const handleApplyTemplate = useCallback((templateId: string) => {
    withHistory((prev) => {
      const textTrack = prev.tracks.find(t => t.type === 'text') || prev.tracks[2];
      const textTrackId = textTrack?.id || 'text-0';
      const now = Date.now();
      const dur = prev.duration || 10;

      // Helper to make a text clip
      const mkText = (id: string, start: number, end: number, content: string, fontSize = 48): TimelineClip => ({
        id: `tpl-${id}-${now}`, trackId: textTrackId, start, end,
        type: 'text', sourceUrl: '', label: content, effects: [],
        textContent: content, textStyle: { fontSize, color: '#FFFFFF', fontWeight: 'bold' },
      });

      // Helper to apply crossfade to all video clips
      const withCrossfades = (tracks: TimelineTrack[]): TimelineTrack[] =>
        tracks.map(t => t.type === 'video' ? {
          ...t, clips: t.clips.map((c, i, arr) => i < arr.length - 1
            ? { ...c, effects: [{ type: 'transition' as const, name: 'crossfade', duration: 0.5 }] }
            : c)
        } : t);

      switch (templateId) {
        case 'intro-outro': {
          const introClip = mkText('intro', 0, 3, 'YOUR TITLE', 72);
          const outroClip = mkText('outro', Math.max(dur - 3, 3), Math.max(dur, 6), 'THANKS FOR WATCHING');
          return {
            ...prev,
            tracks: prev.tracks.map(t => t.id === textTrackId ? { ...t, clips: [...t.clips, introClip, outroClip] } : t),
            duration: Math.max(dur, 6),
          };
        }
        case 'slideshow':
          return { ...prev, tracks: withCrossfades(prev.tracks) };

        case 'tiktok-vertical':
        case 'ig-reel':
        case 'yt-shorts': {
          // Add hook text + CTA
          const hookClip = mkText('hook', 0, 2, '✨ HOOK TEXT HERE', 56);
          const ctaClip = mkText('cta', Math.max(dur - 3, 2), Math.max(dur, 5), '👉 FOLLOW FOR MORE', 36);
          return {
            ...prev,
            tracks: withCrossfades(prev.tracks).map(t => t.id === textTrackId ? { ...t, clips: [...t.clips, hookClip, ctaClip] } : t),
            duration: Math.max(dur, 5),
          };
        }
        case 'story-slides': {
          // Add slide title overlays at intervals
          const slideCount = Math.max(3, Math.ceil(dur / 5));
          const slideDur = dur / slideCount;
          const slides = Array.from({ length: slideCount }, (_, i) =>
            mkText(`slide-${i}`, i * slideDur, i * slideDur + 2, `SLIDE ${i + 1}`, 40)
          );
          return { ...prev, tracks: withCrossfades(prev.tracks).map(t => t.id === textTrackId ? { ...t, clips: [...t.clips, ...slides] } : t) };
        }
        case 'reaction': {
          const reactText = mkText('react', 0, dur, '😮', 72);
          return { ...prev, tracks: prev.tracks.map(t => t.id === textTrackId ? { ...t, clips: [...t.clips, reactText] } : t) };
        }
        case 'movie-trailer': {
          const title = mkText('title', 0, 3, 'COMING SOON', 72);
          const tagline = mkText('tag', 3, 6, 'A STORY LIKE NO OTHER', 36);
          const date = mkText('date', Math.max(dur - 4, 6), Math.max(dur, 10), 'IN THEATERS EVERYWHERE', 32);
          return {
            ...prev,
            tracks: withCrossfades(prev.tracks).map(t => t.id === textTrackId ? { ...t, clips: [...t.clips, title, tagline, date] } : t),
            duration: Math.max(dur, 10),
          };
        }
        case 'documentary': {
          const lower = mkText('lower', 1, 5, 'INTERVIEW SUBJECT — Title', 28);
          const chapter = mkText('chapter', 0, 3, 'CHAPTER ONE', 56);
          return { ...prev, tracks: prev.tracks.map(t => t.id === textTrackId ? { ...t, clips: [...t.clips, chapter, lower] } : t) };
        }
        case 'music-video':
          return { ...prev, tracks: withCrossfades(prev.tracks) };
        case 'short-film': {
          const act1 = mkText('act1', 0, 3, 'ACT I', 64);
          const act2 = mkText('act2', dur * 0.33, dur * 0.33 + 3, 'ACT II', 64);
          const act3 = mkText('act3', dur * 0.66, dur * 0.66 + 3, 'ACT III', 64);
          return { ...prev, tracks: withCrossfades(prev.tracks).map(t => t.id === textTrackId ? { ...t, clips: [...t.clips, act1, act2, act3] } : t) };
        }
        case 'product-showcase': {
          const hero = mkText('hero', 0, 3, '✨ PRODUCT NAME', 56);
          const price = mkText('price', Math.max(dur - 3, 3), Math.max(dur, 6), 'SHOP NOW — $XX.XX', 40);
          return { ...prev, tracks: withCrossfades(prev.tracks).map(t => t.id === textTrackId ? { ...t, clips: [...t.clips, hero, price] } : t), duration: Math.max(dur, 6) };
        }
        case 'testimonial': {
          const quote = mkText('quote', 1, 5, '"This changed everything."', 36);
          const name = mkText('name', 5, 8, '— Customer Name', 28);
          return { ...prev, tracks: prev.tracks.map(t => t.id === textTrackId ? { ...t, clips: [...t.clips, quote, name] } : t) };
        }
        case 'before-after': {
          const beforeLabel = mkText('before', 0, dur / 2, 'BEFORE', 48);
          const afterLabel = mkText('after', dur / 2, dur, 'AFTER', 48);
          return { ...prev, tracks: prev.tracks.map(t => t.id === textTrackId ? { ...t, clips: [...t.clips, beforeLabel, afterLabel] } : t) };
        }
        case 'countdown': {
          const count = 5;
          const segDur = dur / count;
          const numbers = Array.from({ length: count }, (_, i) =>
            mkText(`num-${i}`, i * segDur, i * segDur + 2, `#${count - i}`, 72)
          );
          return { ...prev, tracks: withCrossfades(prev.tracks).map(t => t.id === textTrackId ? { ...t, clips: [...t.clips, ...numbers] } : t) };
        }
        case 'promo': {
          const headline = mkText('hl', 0, 2, '🔥 LIMITED TIME', 48);
          const cta = mkText('cta', Math.max(dur - 3, 2), Math.max(dur, 5), 'GET YOURS NOW', 40);
          return { ...prev, tracks: withCrossfades(prev.tracks).map(t => t.id === textTrackId ? { ...t, clips: [...t.clips, headline, cta] } : t), duration: Math.max(dur, 5) };
        }
        case 'vlog': {
          const intro = mkText('intro', 0, 3, 'WHAT\'S UP EVERYONE', 48);
          return { ...prev, tracks: prev.tracks.map(t => t.id === textTrackId ? { ...t, clips: [...t.clips, intro] } : t) };
        }
        case 'tutorial': {
          const step1 = mkText('s1', 0, 3, 'STEP 1', 48);
          const step2 = mkText('s2', dur * 0.33, dur * 0.33 + 3, 'STEP 2', 48);
          const step3 = mkText('s3', dur * 0.66, dur * 0.66 + 3, 'STEP 3', 48);
          return { ...prev, tracks: prev.tracks.map(t => t.id === textTrackId ? { ...t, clips: [...t.clips, step1, step2, step3] } : t) };
        }
        case 'podcast': {
          const title = mkText('title', 0, 5, '🎙️ PODCAST TITLE', 48);
          return { ...prev, tracks: prev.tracks.map(t => t.id === textTrackId ? { ...t, clips: [...t.clips, title] } : t) };
        }
        case 'montage':
          return { ...prev, tracks: withCrossfades(prev.tracks) };
        default:
          return prev;
      }
    });
    toast.success('Template applied');
  }, [withHistory]);

  const hasClips = editorState.tracks.some((t) => t.clips.length > 0);

  return (
    <div className="h-screen w-screen flex flex-col bg-[hsl(0,0%,5%)] overflow-hidden" style={{ contain: 'layout size' }}>
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
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[hsl(0,0%,4%)] gap-6">
                <div className="relative">
                  <div className="absolute inset-0 rounded-3xl bg-primary/[0.04] blur-[40px]" />
                  <div className="relative w-20 h-20 rounded-3xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-center">
                    <Film className="w-8 h-8 text-white/10" />
                    <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center">
                      <Sparkles className="w-2.5 h-2.5 text-primary" />
                    </div>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-[14px] text-white/40 font-medium tracking-wide">No clips in timeline</p>
                  <p className="text-[11px] text-white/15 mt-2 max-w-[260px] leading-relaxed">
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
            onAddMusic={handleAddMusic}
            onAddSticker={handleAddSticker}
            onApplyEffect={handleApplyEffect}
          />
        </div>
      </div>
    </div>
  );
};

export default VideoEditor;
