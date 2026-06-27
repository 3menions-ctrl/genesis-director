/**
 * Timeline — the workhorse view.
 *
 * Magnetic, ripple-by-default. Clips render as horizontally-arranged
 * blocks sized by their durationSec * pxPerSec. Drag a clip body to
 * reorder (framer-motion's Reorder gives the magnetic feel for free).
 * Drag a clip's left/right edge to trim (pointer-events, clamped to
 * 0.5s minimum, ripples every later clip's timelineStartSec). Click
 * an empty stretch of track to scrub the playhead. Wheel-cmd zooms.
 *
 * Keyboard:
 *   +  /  -  · zoom in / out
 *   Delete   · ripple-delete selected clip
 *   ← / →    · step playhead 1s (Shift = 0.1s, Alt = 5s)
 *
 * The playhead is driven by editor-store.playheadSec, which Stage
 * pushes to whenever its <video> fires timeupdate. So switching
 * Stage→Timeline mid-play keeps the position; switching back finds
 * the same frame.
 *
 * This file is intentionally one screen. Sub-components are small
 * and tightly coupled to the timeline's pointer math.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  motion,
  AnimatePresence,
  Reorder,
  useReducedMotion,
} from "framer-motion";
import {
  Film,
  ZoomIn,
  ZoomOut,
  Trash2,
  Scissors,
  Lock,
  VolumeX,
  Volume2,
  Eye,
  EyeOff,
  Music2,
  Type as TypeIcon,
  Video,
  Disc3,
  Upload as UploadIcon,
  Plus as PlusIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TYPE_META, EASE_PREMIUM } from "@/lib/design-system";
import type {
  ClipTransition,
  EditorClip,
  EditorMarker,
  EditorProject,
  TransitionKind,
} from "@/lib/editor/types";
import { TRANSITION_KINDS, TRANSITION_LABELS } from "@/lib/editor/types";
import {
  moveClip as moveClipMut,
  trimClip as trimClipMut,
  deleteClip as deleteClipMut,
  splitAtPlayhead as splitAtPlayheadMut,
  insertTitleAtPlayhead as insertTitleAtPlayheadMut,
  setPlayhead,
  setPxPerSec,
  selectClip,
  extendClipSelection,
  toggleClipSelection,
  setTool,
  toggleSnap as toggleSnapMut,
  addMarkerAtPlayhead,
  setInPoint,
  setOutPoint,
  removeMarker,
  addTransition as addTransitionMut,
  updateTransition as updateTransitionMut,
  removeTransition as removeTransitionMut,
  selectTransition as selectTransitionMut,
  setTrackProps,
  rollEdit as rollEditMut,
  slipClip as slipClipMut,
  slideClip as slideClipMut,
  replaceClip as replaceClipMut,
} from "@/lib/editor/store";
import { useEditor } from "@/hooks/editor/useEditor";
import { useAudioWaveform } from "@/hooks/editor/useAudioWaveform";
import { Toolbar } from "../components/Toolbar";
import { toast } from "sonner";
import { confirmAsync } from "@/components/ui/global-confirm";
import { supabase } from "@/integrations/supabase/client";
import { useSyncExternalStore as useSyncExternalStoreForPills } from "react";
import {
  getDocumentState as getDocStateForPill,
  subscribeDocument as subDocForPill,
} from "@/lib/editor/document-store";
import { findShot as findShotForPill } from "@/lib/editor/script-document";
import { latestEventForShot as latestEventForShotPill } from "@/lib/editor/generation/status-bus";
import {
  Sparkles as SparklesIconPill,
  Loader2 as Loader2Pill,
  Check as CheckPill,
  AlertTriangle as AlertPill,
  XCircle as XCirclePill,
} from "lucide-react";
import {
  ingestUpload as ingestUploadFn,
  describeIngestError as describeIngestErrorFn,
  validateUploadFile as validateUploadFileFn,
  uploadValidated as uploadValidatedFn,
  ingestMusicUrl as ingestMusicUrlFn,
} from "@/lib/editor/upload-ingest";
import { flushNow as flushDocNow } from "@/lib/editor/document-store";
import { useAuth as useAuthForUpload } from "@/contexts/AuthContext";
import { ClipFilmstrip } from "../components/ClipFilmstrip";
import { TextOverlayTrack } from "../components/TextOverlayTrack";
import { getClipProperty } from "@/lib/editor/types";

interface Props {
  project: EditorProject;
  selectedClipId: string | null;
  selectedClipIds: string[];
  playheadSec: number;
  pxPerSec: number;
  /** Optional — opens the EditorShell's CreatePanel. The Timeline
   *  header surfaces a Create button when this is wired so users can
   *  start a new generation without leaving the editor. */
  onCreateClick?: () => void;
}

const V_TRACK_HEIGHT = 72;     // V1 (the workhorse video track)
const V_OVERLAY_HEIGHT = 38;   // V2 — title cards / overlays
const V_TEXT_HEIGHT = 32;      // V3 — broadcast text overlays
const A_TRACK_HEIGHT = 44;     // A1 — clip audio
const A_MUSIC_HEIGHT = 38;     // A2 — music / score
const TRACK_GAP = 4;
const TRACK_HEADER_W = 132;
const TRACK_PADDING_PX = 32;
const TRIM_HANDLE_PX = 10;
const MIN_CLIP_PX = 22;

interface TrackDef {
  id: string;
  label: string;
  kind: "video" | "audio";
  height: number;
  Icon: typeof Film;
  muted?: boolean;
  locked?: boolean;
  soloed?: boolean;
}

/** Pick the rail icon for a track. System tracks have semantic icons;
 *  user-added tracks get a generic per-kind icon. */
function trackIcon(t: { id: string; kind: "video" | "audio"; label?: string }): typeof Film {
  if (t.id === "sys:V3" || t.id === "sys:V2") return TypeIcon;
  if (t.id === "sys:V1") return Video;
  if (t.id === "sys:A2") return Music2;
  if (t.id === "sys:A1") return Disc3;
  return t.kind === "video" ? Video : Disc3;
}

function fmtTC(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ff = Math.floor((sec - Math.floor(sec)) * 30);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}:${ff.toString().padStart(2, "0")}`;
}

export function Timeline({
  project,
  selectedClipId,
  selectedClipIds,
  playheadSec,
  pxPerSec,
  onCreateClick,
}: Props) {
  const reducedMotion = useReducedMotion();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const { tool, snapEnabled, markers, inSec, outSec, selectedTransitionId, clearAllClips, addTrack, removeTrack, renameTrack } = useEditor();

  // Dynamic tracks — fall back to the system defaults when the project
  // doesn't carry an explicit array (pre-Phase-A projects).
  const tracks: TrackDef[] = useMemo(() => {
    const raw = (project.tracks ?? []).slice().sort((a, b) => a.position - b.position);
    if (raw.length === 0) {
      const defaults = [
        { id: "sys:V3", kind: "video" as const, label: "V3 · Text",    height: V_TEXT_HEIGHT },
        { id: "sys:V2", kind: "video" as const, label: "V2 · Overlay", height: V_OVERLAY_HEIGHT },
        { id: "sys:V1", kind: "video" as const, label: "V1 · Video",   height: V_TRACK_HEIGHT },
        { id: "sys:A1", kind: "audio" as const, label: "A1 · Audio",   height: A_TRACK_HEIGHT },
        { id: "sys:A2", kind: "audio" as const, label: "A2 · Music",   height: A_MUSIC_HEIGHT },
      ];
      return defaults.map((d) => ({ ...d, Icon: trackIcon(d) }));
    }
    return raw.map((t) => ({
      id: t.id,
      kind: t.kind,
      label: t.label,
      height: t.height,
      Icon: trackIcon(t),
      muted: t.muted,
      locked: t.locked,
      soloed: t.soloed,
    }));
  }, [project.tracks]);

  // Stack the system tracks at known offsets so existing inline track
  // bodies (V3 TextOverlayTrack, V2 titles, V1 clips, A1 audio shadows,
  // A2 music) keep working. The track headers map dynamically; the
  // bodies are still indexed by the system id.
  const trackOffsets = useMemo(() => {
    const offsets = new Map<string, number>();
    let y = 0;
    for (const t of tracks) {
      offsets.set(t.id, y);
      y += t.height + TRACK_GAP;
    }
    return { map: offsets, total: Math.max(0, y - TRACK_GAP) };
  }, [tracks]);
  const TOTAL_TRACK_AREA = trackOffsets.total;
  const offsetOf = (id: string) => trackOffsets.map.get(id) ?? 0;

  // Live hover state — floating timecode + faint shadow line while
  // the mouse is over the track. Null when not hovering.
  const [hoverSec, setHoverSec] = useState<number | null>(null);

  const allClips: EditorClip[] = useMemo(
    () => project.scenes.flatMap((s) => s.clips),
    [project],
  );
  const clips: EditorClip[] = useMemo(
    () => allClips.filter((c) => c.kind !== "title"),
    [allClips],
  );
  const titleClips: EditorClip[] = useMemo(
    () => allClips.filter((c) => c.kind === "title"),
    [allClips],
  );
  // Clips routed to the music track. upload-ingest sets
  // properties.trackId = "sys:A2" for any audio-MIME upload. Without
  // this derivation the MusicTrack band stayed visually empty even
  // when the user had successfully dropped an MP3 — they had no
  // signal the upload landed.
  const musicClips: EditorClip[] = useMemo(
    () => allClips.filter((c) => (c.properties as { trackId?: string } | undefined)?.trackId === "sys:A2"),
    [allClips],
  );
  const totalSec = project.durationSec || 1;
  const trackWidthPx = Math.max(totalSec * pxPerSec, 320);
  const playheadPx = playheadSec * pxPerSec;

  // Reorder via framer-motion: feed it the full clip array, write back
  // the new order via moveClip per-clip moves derived from the diff.
  const [localOrder, setLocalOrder] = useState<EditorClip[]>(clips);
  useEffect(() => {
    setLocalOrder(clips);
  }, [clips]);

  const onReorder = (next: EditorClip[]) => {
    setLocalOrder(next); // optimistic — frame-motion drives the visual
    // Compute first-difference move and commit.
    for (let i = 0; i < next.length; i++) {
      if (next[i].id !== clips[i]?.id) {
        moveClipMut(next[i].id, i);
        return;
      }
    }
  };

  // Click on empty track scrubs
  const onTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current) return;
    if ((e.target as HTMLElement).closest("[data-clip]")) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    setPlayhead(Math.max(0, x / pxPerSec));
  };

  // Live hover: floating timecode + shadow line on the track
  const onTrackMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    setHoverSec(Math.max(0, x / pxPerSec));
  };
  const onTrackLeave = () => setHoverSec(null);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      // Every plain-letter shortcut below MUST early-return when a
      // modifier is held — otherwise Cmd+B (Budget panel) ALSO
      // razor-splits the clip, Cmd+S (save) toggles tool+view, Shift+L
      // (Studio library) ALSO fires JKL-forward in another listener.
      // The Timeline owns plain B/V/H/N/M/I/O/T; modified variants
      // belong to other handlers and we must not steal them.
      const hasMod = e.metaKey || e.ctrlKey || e.altKey || e.shiftKey;

      // Cmd+0 / Ctrl+0 — fit timeline to viewport. Picks the largest
      // pxPerSec such that the whole project fits horizontally inside
      // the visible scroller width. Universal NLE shortcut.
      if ((e.metaKey || e.ctrlKey) && (e.key === "0" || e.code === "Digit0")) {
        e.preventDefault();
        const sc = scrollerRef.current;
        if (sc && totalSec > 0) {
          const fitPx = Math.max(10, (sc.clientWidth - 24) / totalSec);
          setPxPerSec(fitPx);
          sc.scrollTo({ left: 0, behavior: "smooth" });
        }
        return;
      }
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setPxPerSec(pxPerSec * 1.25);
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        setPxPerSec(pxPerSec / 1.25);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedClipId) {
          e.preventDefault();
          deleteClipMut(selectedClipId);
        }
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const step = e.shiftKey ? 0.1 : e.altKey ? 5 : 1;
        const next = e.key === "ArrowLeft"
          ? Math.max(0, playheadSec - step)
          : Math.min(totalSec, playheadSec + step);
        setPlayhead(next);
      } else if (e.key === "," || e.key === ".") {
        // Frame-step at the project's assumed 30fps. Pro editors
        // need this all day; the keys are unshifted so it's
        // ergonomic for repeated taps.
        e.preventDefault();
        const frame = 1 / 30;
        const next = e.key === ","
          ? Math.max(0, playheadSec - frame)
          : Math.min(totalSec, playheadSec + frame);
        setPlayhead(next);
      } else if (!hasMod && (e.key === "b" || e.key === "B")) {
        // Razor blade — toggle blade tool + split at playhead
        e.preventDefault();
        setTool("blade");
        const ok = splitAtPlayheadMut();
        if (!ok) {
          toast.message("Move the playhead inside a clip to split", {
            description: "Razor needs at least 0.1s of clip on each side",
          });
        }
      } else if (!hasMod && (e.key === "v" || e.key === "V")) {
        e.preventDefault();
        setTool("select");
      } else if (!hasMod && (e.key === "h" || e.key === "H")) {
        e.preventDefault();
        setTool("hand");
      } else if (!hasMod && (e.key === "n" || e.key === "N")) {
        e.preventDefault();
        toggleSnapMut();
      } else if (!hasMod && (e.key === "m" || e.key === "M")) {
        e.preventDefault();
        const id = addMarkerAtPlayhead();
        toast.message("Marker dropped", {
          description: `at ${fmtTC(playheadSec)} · double-click on the ruler to rename or remove`,
        });
        void id;
      } else if (!hasMod && (e.key === "i" || e.key === "I")) {
        e.preventDefault();
        setInPoint(playheadSec);
      } else if (!hasMod && (e.key === "o" || e.key === "O")) {
        e.preventDefault();
        setOutPoint(playheadSec);
      } else if (!hasMod && (e.key === "t" || e.key === "T")) {
        // Drop a title card at the playhead on V2.
        e.preventDefault();
        insertTitleAtPlayheadMut("Title");
        toast.message("Title card dropped on V2", {
          description: "Inspector → edit the text & background colour",
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pxPerSec, playheadSec, totalSec, selectedClipId]);

  // Cmd/Ctrl+wheel zooms — pinned to the cursor. The cursor's
  // timeline position (the time UNDER the mouse pointer) stays fixed
  // while pxPerSec changes, so zooming feels like a magnifier
  // anchored to where you're looking. Previously the scroll position
  // didn't move and the user's reference point drifted off-screen.
  const onWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      const scroller = scrollerRef.current;
      const factor = e.deltaY > 0 ? 1 / 1.1 : 1.1;
      const nextPxPerSec = pxPerSec * factor;
      if (scroller) {
        const rect = scroller.getBoundingClientRect();
        const xInScroller = e.clientX - rect.left;
        const cursorSec = (scroller.scrollLeft + xInScroller) / pxPerSec;
        setPxPerSec(nextPxPerSec);
        // Run the scroll adjust on the next frame after React applies
        // the new track width (driven by pxPerSec); scrollLeft can't
        // exceed scrollWidth so we have to wait for the layout pass.
        requestAnimationFrame(() => {
          if (!scrollerRef.current) return;
          const target = cursorSec * nextPxPerSec - xInScroller;
          scrollerRef.current.scrollLeft = Math.max(0, target);
        });
      } else {
        setPxPerSec(nextPxPerSec);
      }
    },
    [pxPerSec],
  );

  // Auto-scroll horizontal scroller to keep playhead in view during play
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const visibleLeft = scroller.scrollLeft;
    const visibleRight = visibleLeft + scroller.clientWidth;
    if (playheadPx < visibleLeft + 80) {
      scroller.scrollTo({ left: Math.max(0, playheadPx - 80), behavior: "smooth" });
    } else if (playheadPx > visibleRight - 120) {
      scroller.scrollTo({ left: playheadPx - scroller.clientWidth + 120, behavior: "smooth" });
    }
  }, [playheadPx]);

  const dropzone = useTimelineDropzone(project.id);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Clear-all wipes every clip from the in-memory project AND from the
  // video_clips DB table so the timeline stays empty across reload.
  // This is permanent — the DB rows are deleted and cannot be restored
  // by undo — so the confirm copy says so explicitly.
  const onClearAll = async () => {
    if (clips.length === 0) return;
    const ok = await confirmAsync({
      title: `Clear all ${clips.length} clip${clips.length === 1 ? "" : "s"}?`,
      description:
        "This permanently deletes every clip from the timeline, including from the database. This cannot be undone.",
      confirmLabel: "Clear timeline",
      destructive: true,
    });
    if (!ok) return;
    clearAllClips();
    try {
      await supabase.from("video_clips").delete().eq("project_id", project.id);
      toast.success("Timeline cleared");
    } catch (e) {
      toast.warning("Timeline cleared locally — DB cleanup failed", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  };

  const onPickFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // allow re-picking the same file
    if (!files.length) return;
    const fakeEvent = {
      preventDefault: () => {},
      dataTransfer: { files, types: ["Files"] as readonly string[] },
    } as unknown as React.DragEvent;
    await dropzone.onDrop(fakeEvent);
  };

  // ── A2 (Music) track actions ───────────────────────────────────────
  const { user: musicUser } = useAuthForUpload();
  const musicFileInputRef = useRef<HTMLInputElement | null>(null);
  // null = idle, "generating" = score render in flight. Disables the
  // A2 action buttons + shows a spinner while a generation runs.
  const [musicBusy, setMusicBusy] = useState(false);
  const currentMusicClipId = musicClips[0]?.id ?? null;

  // Upload music — routes through the same hidden file input + ingest
  // path already wired for the timeline. The accept list is audio-only
  // so the picker pre-filters to music files.
  const onUploadMusic = () => musicFileInputRef.current?.click();

  const onPickMusicFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    if (!musicUser || !project.id) {
      toast.error("Sign in + open a project to add music");
      return;
    }
    const doc = getDocStateForPill().doc;
    if (!doc) {
      toast.error("Document still loading — try again");
      return;
    }
    const file = files[0];
    const toastId = toast.loading(`Adding ${file.name} to the Music track…`);
    try {
      await ingestUploadFn({ file, userId: musicUser.id, projectId: project.id, doc });
      toast.success("Music added to A2", { id: toastId });
    } catch (err) {
      const m = describeIngestErrorFn(err);
      toast.error("Couldn't add music", { id: toastId, description: m.description ?? m.message });
    }
  };

  // Generate score — calls the generate-music edge function, then
  // ingests the returned musicUrl onto A2 (DB row + store + doc).
  const onGenerateScore = async () => {
    if (musicBusy) return;
    if (!musicUser || !project.id) {
      toast.error("Sign in + open a project to generate a score");
      return;
    }
    const doc = getDocStateForPill().doc;
    if (!doc) {
      toast.error("Document still loading — try again");
      return;
    }
    setMusicBusy(true);
    const toastId = toast.loading("Composing a score…", {
      description: "Hans Zimmer-grade cinematic music — this can take a minute.",
    });
    try {
      // Cap the requested bed at the edge function's 30s ceiling, but
      // never below 5s, and bias toward the project's own length.
      const durationSec = Math.max(5, Math.min(30, Math.round(project.durationSec || 30)));
      const { data, error } = await supabase.functions.invoke("generate-music", {
        body: {
          projectId: project.id,
          mood: project.mood ?? "cinematic",
          genre: project.genre ?? undefined,
          durationSec,
          duration: durationSec,
        },
      });
      if (error) throw error;
      const musicUrl: string | null = (data as { musicUrl?: string | null } | null)?.musicUrl ?? null;
      if (!musicUrl) {
        toast.warning("No score was generated", {
          id: toastId,
          description: "Music generation is unavailable right now — try again later.",
        });
        return;
      }
      await ingestMusicUrlFn({
        musicUrl,
        userId: musicUser.id,
        projectId: project.id,
        doc,
        title: `Score — ${project.mood ?? "cinematic"}`,
        durationSec,
      });
      await flushDocNow();
      toast.success("Score added to A2", { id: toastId });
    } catch (err) {
      toast.error("Couldn't generate a score", {
        id: toastId,
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setMusicBusy(false);
    }
  };

  // Replace music — delete the current A2 clip, then re-open the file
  // picker so the user lands a fresh upload. (Generate-as-replace is a
  // delete + Generate score.)
  const onReplaceMusic = () => {
    if (musicBusy) return;
    if (currentMusicClipId) deleteClipMut(currentMusicClipId);
    musicFileInputRef.current?.click();
  };

  return (
    <section
      className="relative flex-1 flex flex-col min-h-0"
      onDragOver={dropzone.onDragOver}
      onDragLeave={dropzone.onDragLeave}
      onDrop={dropzone.onDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,video/x-matroska,audio/mpeg,audio/mp4,audio/wav,audio/wave,audio/x-wav,audio/aac,audio/ogg,audio/flac,audio/x-m4a"
        multiple
        className="hidden"
        onChange={onPickFiles}
      />
      {/* Audio-only picker for the A2 Music track actions. */}
      <input
        ref={musicFileInputRef}
        type="file"
        accept="audio/mpeg,audio/mp4,audio/wav,audio/wave,audio/x-wav,audio/aac,audio/ogg,audio/flac,audio/x-m4a"
        className="hidden"
        onChange={onPickMusicFiles}
      />
      <TimelineHeader
        clipCount={clips.length}
        totalSec={totalSec}
        pxPerSec={pxPerSec}
        selectedClipId={selectedClipId}
        tool={tool}
        snapEnabled={snapEnabled}
        hasInOut={inSec !== null || outSec !== null}
        playheadSec={playheadSec}
        setPxPerSec={setPxPerSec}
        scrollerRef={scrollerRef}
        onUploadClick={() => fileInputRef.current?.click()}
        onCreateClick={onCreateClick}
        onClearAll={onClearAll}
      />

      {dropzone.dragOver && (
        <div
          aria-hidden
          className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center bg-[hsl(220_28%_8%/0.78)] backdrop-blur-sm ring-1 ring-inset ring-accent/50"
        >
          <div className="text-center">
            <p className="text-[22px] font-display italic text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>
              Drop video to add as a clip
            </p>
            <p className={cn(TYPE_META, "mt-2 text-muted-foreground/70")}>
              MP4 · MOV · WebM · MKV — up to 500 MB
            </p>
          </div>
        </div>
      )}

      {clips.length === 0 ? (
        <EmptyTimeline onUploadClick={() => fileInputRef.current?.click()} />
      ) : (
        // Outer: vertical scroll OWNS the whole track area so the
        // header column and body column move together as the user
        // wheels up/down. The "+ Track" buttons live OUTSIDE this
        // scroll so they stay reachable even with many tracks.
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
            <div className="flex min-h-full">
              {/* Track headers column — pinned left, doesn't scroll
                  horizontally with the track body. Each header has the
                  exact same height + bottom margin as its corresponding
                  body row, so labels line up to the pixel. */}
              <div
                className="shrink-0 border-r border-white/[0.04] flex flex-col"
                style={{ width: TRACK_HEADER_W }}
              >
                {/* Spacer matching ruler height */}
                <div className="h-6 shrink-0" />
                <div className="mt-3 shrink-0" style={{ height: TOTAL_TRACK_AREA }}>
                  <div className="flex flex-col">
                    {tracks.map((t, i) => (
                      <TrackHeader
                        key={t.id}
                        track={t}
                        addGap={i < tracks.length - 1}
                        onRename={(label) => renameTrack(t.id, label)}
                        onRemove={async () => {
                          if (t.id.startsWith("sys:")) {
                            toast.message("System tracks can't be removed");
                            return;
                          }
                          const ok = await confirmAsync({
                            title: `Delete "${t.label}"?`,
                            description: "This removes the track and its clips from the timeline.",
                            confirmLabel: "Delete track",
                            destructive: true,
                          });
                          if (!ok) return;
                          removeTrack(t.id);
                        }}
                        // A2 (Music) track gets dedicated score actions.
                        music={
                          t.id === "sys:A2"
                            ? {
                                busy: musicBusy,
                                hasMusic: !!currentMusicClipId,
                                onUpload: onUploadMusic,
                                onGenerate: onGenerateScore,
                                onReplace: onReplaceMusic,
                              }
                            : undefined
                        }
                      />
                    ))}
                  </div>
                </div>
              </div>

          {/* Horizontal-scrolling track body */}
          <div
            ref={scrollerRef}
            className="relative flex-1 overflow-x-auto overflow-y-hidden"
            onWheel={onWheel}
            style={{ scrollbarWidth: "thin" }}
          >
            <div
              className="relative"
              style={{
                width: `${trackWidthPx + TRACK_PADDING_PX * 2}px`,
                paddingLeft: TRACK_PADDING_PX,
                paddingRight: TRACK_PADDING_PX,
              }}
            >
              <TimelineRuler
                totalSec={totalSec}
                pxPerSec={pxPerSec}
                markers={markers}
                inSec={inSec}
                outSec={outSec}
              />

              {/* All-tracks playhead container — the ruler + tracks
                  share one playhead column that spans the full
                  vertical extent. */}
              <div
                ref={trackRef}
                data-track
                onClick={onTrackClick}
                onMouseMove={onTrackMove}
                onMouseLeave={onTrackLeave}
                className="relative mt-3"
                style={{
                  height: TOTAL_TRACK_AREA,
                  width: trackWidthPx,
                }}
              >
                {/* V3 — broadcast text overlay track */}
                <TextOverlayTrack
                  overlays={project.textOverlays ?? []}
                  pxPerSec={pxPerSec}
                  trackWidthPx={trackWidthPx}
                  top={offsetOf("sys:V3")}
                  height={V_TEXT_HEIGHT}
                  totalSec={totalSec}
                  onSelect={(id) => {
                    // Clicking a text overlay focuses the right rail's Text
                    // tab (where it's edited). Previously this cleared clip
                    // selection and threw the id away — a dead control.
                    window.dispatchEvent(
                      new CustomEvent("editor:open-text-tab", { detail: { id } }),
                    );
                  }}
                />

                {/* V2 — overlay track for title cards */}
                <div
                  className="absolute left-0 right-0 rounded-md border border-dashed border-white/[0.05] bg-white/[0.008] overflow-hidden"
                  style={{ top: offsetOf("sys:V2"), height: V_OVERLAY_HEIGHT, width: trackWidthPx }}
                >
                  {titleClips.length === 0 ? (
                    <span className={cn(TYPE_META, "absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/30 tracking-[0.30em]")}>
                      Press T at the playhead to drop a title
                    </span>
                  ) : (
                    titleClips.map((t) => (
                      <TitleBlock
                        key={t.id}
                        clip={t}
                        pxPerSec={pxPerSec}
                        isActive={t.id === selectedClipId}
                      />
                    ))
                  )}
                </div>

                {/* V1 — the actual video clips with Reorder.Group */}
                <div
                  className={cn(
                    "absolute left-0 right-0 bg-white/[0.018] rounded-md",
                  )}
                  style={{
                    top: offsetOf("sys:V1"),
                    height: V_TRACK_HEIGHT,
                  }}
                >
                  <Reorder.Group
                    axis="x"
                    values={localOrder}
                    onReorder={onReorder}
                    className="relative flex items-stretch h-full px-1 gap-0"
                    as="div"
                  >
                    <AnimatePresence initial={false}>
                      {localOrder.map((clip) => (
                        <Reorder.Item
                          key={clip.id}
                          value={clip}
                          as="div"
                          data-clip
                          data-clip-id={clip.id}
                          style={{
                            width: Math.max(MIN_CLIP_PX, clip.durationSec * pxPerSec),
                            height: "100%",
                            flexShrink: 0,
                          }}
                          whileDrag={{ scale: 1.02, zIndex: 5 }}
                          transition={{
                            type: "spring",
                            stiffness: 480,
                            damping: 38,
                          }}
                          className="relative cursor-grab active:cursor-grabbing"
                        >
                          <ClipBlock
                            clip={clip}
                            pxPerSec={pxPerSec}
                            isActive={clip.id === selectedClipId}
                            isInSelection={selectedClipIds.includes(clip.id)}
                            reducedMotion={reducedMotion ?? false}
                          />
                        </Reorder.Item>
                      ))}
                    </AnimatePresence>
                  </Reorder.Group>
                </div>

                {/* Transition handles — overlay V1 boundaries with a
                    click-target. Click adds a default fade; click an
                    existing one selects it; drag widens; right-click
                    swaps the kind. The handles z-index above the
                    Reorder.Group via absolute positioning. */}
                <TransitionLayer
                  top={offsetOf("sys:V1")}
                  height={V_TRACK_HEIGHT}
                  clips={localOrder}
                  transitions={project.transitions ?? []}
                  pxPerSec={pxPerSec}
                  selectedTransitionId={selectedTransitionId}
                />

                {/* A1 — synthetic audio shadows matching V1 positions.
                    Bg uses a horizontal gradient so the row reads as
                    a real audio bus even at points where there is no
                    clip yet. */}
                <div
                  className={cn(
                    "absolute left-0 right-0 rounded-md",
                    "bg-gradient-to-b from-white/[0.03] to-white/[0.015]",
                    "ring-1 ring-inset ring-white/[0.04]",
                  )}
                  style={{
                    top: offsetOf("sys:A1"),
                    height: A_TRACK_HEIGHT,
                  }}
                >
                  {localOrder.map((c) => (
                    <AudioShadow
                      key={c.id}
                      clip={c}
                      pxPerSec={pxPerSec}
                      isActive={c.id === selectedClipId}
                    />
                  ))}
                </div>

                {/* A2 — music / score track. The procedural band stays
                    as a backdrop ("here's where music goes" when empty)
                    and any clip the user has routed to sys:A2 is
                    rendered on top of it as an AudioShadow tile. */}
                <MusicTrack
                  top={offsetOf("sys:A2")}
                  height={A_MUSIC_HEIGHT}
                  width={trackWidthPx}
                  clips={musicClips}
                  pxPerSec={pxPerSec}
                  selectedClipId={selectedClipId}
                />

                {/* User-added empty track placeholders. Phase A only
                    paints the row; assigning clips to non-system
                    tracks lands in Phase B. The empty-state copy
                    makes the limitation visible. */}
                {tracks.filter((t) => !t.id.startsWith("sys:")).map((t) => (
                  <div
                    key={t.id}
                    className="absolute left-0 right-0 rounded-md border border-dashed border-white/[0.05] bg-white/[0.005]"
                    style={{ top: offsetOf(t.id), height: t.height, width: trackWidthPx }}
                  >
                    <span className={cn(TYPE_META, "absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/30 tracking-[0.30em]")}>
                      {t.label} · empty (clip routing lands in Phase B)
                    </span>
                  </div>
                ))}

                {/* Playhead spans every track. Pass pxPerSec +
                    scrollerRef so the triangle handle scrubs on drag. */}
                <Playhead
                  positionPx={playheadPx + 1}
                  trackHeight={TOTAL_TRACK_AREA}
                  pxPerSec={pxPerSec}
                  scrollerRef={scrollerRef}
                />

                {/* Hover shadow + timecode chip spans every track */}
                {hoverSec !== null && (
                  <HoverIndicator
                    positionPx={hoverSec * pxPerSec}
                    sec={hoverSec}
                    trackHeight={TOTAL_TRACK_AREA}
                    clips={clips}
                  />
                )}
              </div>
            </div>
          </div>
            </div>
          </div>

          {/* Sticky add-track footer — stays visible while the user
              scrolls through tracks vertically. The left buttons sit
              under the headers column so they read as "add a row to
              this column"; the right side is intentionally blank so
              the timeline's horizontal scroll doesn't get crowded. */}
          <div className="shrink-0 border-t border-white/[0.04] bg-[hsl(220_30%_4%/0.35)] flex">
            <div className="shrink-0 flex flex-col gap-1.5 px-2 py-2" style={{ width: TRACK_HEADER_W }}>
              <button
                type="button"
                onClick={() => addTrack("video")}
                className={cn(TYPE_META, "px-2 py-1 rounded ring-1 ring-inset ring-white/[0.06] hover:ring-white/[0.18] text-muted-foreground/65 hover:text-foreground transition-all text-left tracking-[0.22em]")}
              >
                + Video track
              </button>
              <button
                type="button"
                onClick={() => addTrack("audio")}
                className={cn(TYPE_META, "px-2 py-1 rounded ring-1 ring-inset ring-white/[0.06] hover:ring-white/[0.18] text-muted-foreground/65 hover:text-foreground transition-all text-left tracking-[0.22em]")}
              >
                + Audio track
              </button>
            </div>
            <div className="flex-1 border-l border-white/[0.04]" />
          </div>
        </div>
      )}

      <TimelineFooter
        playheadSec={playheadSec}
        totalSec={totalSec}
        selectedClipId={selectedClipId}
      />
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Header — toolbar + identity row + zoom + delete. Floating, no card.
// ─────────────────────────────────────────────────────────────────────────────
function TimelineHeader({
  clipCount,
  totalSec,
  pxPerSec,
  selectedClipId,
  tool,
  snapEnabled,
  hasInOut,
  playheadSec,
  setPxPerSec,
  scrollerRef,
  onUploadClick,
  onCreateClick,
  onClearAll,
}: {
  clipCount: number;
  totalSec: number;
  pxPerSec: number;
  selectedClipId: string | null;
  tool: import("@/lib/editor/types").TimelineTool;
  snapEnabled: boolean;
  hasInOut: boolean;
  playheadSec: number;
  setPxPerSec: (px: number) => void;
  scrollerRef: React.RefObject<HTMLDivElement | null>;
  onUploadClick?: () => void;
  onCreateClick?: () => void;
  onClearAll?: () => void;
}) {
  return (
    <header className="relative z-10 px-4 sm:px-6 pt-3 pb-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-white/[0.04]">
      <div className="flex items-center gap-4">
        <div className="flex items-baseline gap-2">
          <Scissors className="h-3 w-3 text-accent/70 self-center" strokeWidth={1.5} />
          <span className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.30em]")}>
            ◆ Timeline · {clipCount} {clipCount === 1 ? "clip" : "clips"} · {fmtTC(totalSec)}
          </span>
        </div>

        {/* Divider */}
        <span className="h-5 w-px bg-white/[0.06]" />

        {/* Toolbar */}
        <Toolbar
          tool={tool}
          snapEnabled={snapEnabled}
          hasInOut={hasInOut}
          playheadSec={playheadSec}
        />
      </div>

      <div className="flex items-center gap-3">
        {/* Create — opens the CreatePanel which authors a new project,
            posts it to Studio's mode-router, and (once the new project
            id arrives) jumps the editor to it. */}
        {onCreateClick && (
          <button
            type="button"
            onClick={onCreateClick}
            title="Create a new clip in Studio"
            className={cn(
              "inline-flex items-center gap-1.5 px-3 h-7 rounded-md",
              "text-[11px] font-mono uppercase tracking-[0.16em]",
              "bg-gradient-to-br from-accent/30 to-accent/10 text-accent ring-1 ring-inset ring-accent/40",
              "hover:from-accent/45 hover:text-foreground transition-all",
              "shadow-[0_2px_10px_-4px_hsl(var(--accent)/0.65)]",
            )}
          >
            <PlusIcon className="h-3 w-3" strokeWidth={1.8} />
            Create
          </button>
        )}
        {onUploadClick && (
          <button
            type="button"
            onClick={onUploadClick}
            title="Upload a video file"
            className={cn(
              "inline-flex items-center gap-1.5 px-3 h-7 rounded-md",
              "text-[11px] font-mono uppercase tracking-[0.16em]",
              "bg-white/[0.05] text-foreground/85 ring-1 ring-inset ring-white/[0.10]",
              "hover:bg-white/[0.10] hover:text-foreground transition-colors",
            )}
          >
            <UploadIcon className="h-3 w-3" strokeWidth={1.6} />
            Upload
          </button>
        )}

        {onClearAll && clipCount > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            title="Permanently clear every clip on the timeline (cannot be undone)"
            className={cn(
              "inline-flex items-center gap-1.5 px-3 h-7 rounded-md",
              "text-[11px] font-mono uppercase tracking-[0.16em]",
              "bg-rose-500/[0.08] text-rose-200/90 ring-1 ring-inset ring-rose-400/30",
              "hover:bg-rose-500/[0.18] hover:text-rose-100 transition-colors",
            )}
          >
            <Trash2 className="h-3 w-3" strokeWidth={1.6} />
            Clear
          </button>
        )}

        {/* Zoom */}
        <div className="flex items-center gap-1.5 text-foreground/80">
          <button
            type="button"
            onClick={() => setPxPerSec(pxPerSec / 1.25)}
            className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground/65 hover:text-foreground hover:bg-white/[0.04] transition-colors"
            aria-label="Zoom out · -"
            title="Zoom out · -"
          >
            <ZoomOut className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
          <span className={cn(TYPE_META, "font-mono tabular-nums text-muted-foreground/70 min-w-[56px] text-center")}>
            {Math.round(pxPerSec)} px/s
          </span>
          <button
            type="button"
            onClick={() => setPxPerSec(pxPerSec * 1.25)}
            className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground/65 hover:text-foreground hover:bg-white/[0.04] transition-colors"
            aria-label="Zoom in · +"
            title="Zoom in · +"
          >
            <ZoomIn className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={() => {
              const sc = scrollerRef.current;
              if (sc && totalSec > 0) {
                const fitPx = Math.max(10, (sc.clientWidth - 24) / totalSec);
                setPxPerSec(fitPx);
                sc.scrollTo({ left: 0, behavior: "smooth" });
              }
            }}
            className={cn(
              TYPE_META,
              "inline-flex items-center justify-center h-7 px-2 rounded-md font-mono tabular-nums",
              "text-muted-foreground/65 hover:text-foreground hover:bg-white/[0.04] transition-colors",
            )}
            aria-label="Fit timeline to screen · Cmd-0"
            title="Fit timeline to screen · Cmd-0"
          >
            Fit
          </button>
        </div>

        {/* Delete selected */}
        <button
          type="button"
          onClick={() => selectedClipId && deleteClipMut(selectedClipId)}
          disabled={!selectedClipId}
          className={cn(
            "inline-flex items-center gap-1.5 text-[12px] transition-colors",
            "disabled:opacity-35 disabled:cursor-not-allowed",
            selectedClipId
              ? "text-rose-300/85 hover:text-rose-300"
              : "text-muted-foreground/45",
          )}
          aria-label="Ripple-delete selected clip"
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
          <span>Delete</span>
          <span className={cn(TYPE_META, "text-muted-foreground/40 font-mono tabular-nums")}>⌫</span>
        </button>
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Ruler — time marks every N seconds based on zoom + marker flags +
// In/Out brackets
// ─────────────────────────────────────────────────────────────────────────────
function TimelineRuler({
  totalSec,
  pxPerSec,
  markers,
  inSec,
  outSec,
}: {
  totalSec: number;
  pxPerSec: number;
  markers: EditorMarker[];
  inSec: number | null;
  outSec: number | null;
}) {
  // Pick a tick interval whose pixel spacing is comfortable.
  const targetPx = 80;
  const tickSec = (() => {
    const candidates = [0.5, 1, 2, 5, 10, 15, 30, 60, 120];
    for (const c of candidates) {
      if (c * pxPerSec >= targetPx) return c;
    }
    return 300;
  })();
  const ticks: number[] = [];
  for (let t = 0; t <= totalSec + tickSec; t += tickSec) ticks.push(t);

  const effectiveIn = inSec ?? 0;
  const effectiveOut = outSec ?? totalSec;

  // Ruler scrub — pointerdown anywhere on the ruler starts a drag
  // that seeks the playhead. Mirrors the NLE convention (Premiere /
  // FCP / Resolve) where the ruler is the primary "scrub" surface.
  // Previously a single click landed the playhead but holding +
  // dragging did nothing, which felt broken.
  const onRulerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const ruler = e.currentTarget;
      const seekFrom = (clientX: number) => {
        const rect = ruler.getBoundingClientRect();
        const x = clientX - rect.left;
        setPlayhead(Math.max(0, Math.min(totalSec, x / pxPerSec)));
      };
      seekFrom(e.clientX);
      const move = (ev: PointerEvent) => seekFrom(ev.clientX);
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [pxPerSec, totalSec],
  );

  return (
    <div
      className="relative h-6 cursor-ew-resize"
      style={{ width: totalSec * pxPerSec }}
      onPointerDown={onRulerDown}
    >
      {/* In/Out range tint */}
      {(inSec !== null || outSec !== null) && (
        <div
          className="absolute top-0 bottom-0 bg-[hsl(var(--accent)/0.10)] pointer-events-none"
          style={{
            left: effectiveIn * pxPerSec,
            width: Math.max(0, (effectiveOut - effectiveIn) * pxPerSec),
          }}
        />
      )}

      {/* Time ticks */}
      {ticks.map((t) => {
        const x = t * pxPerSec;
        return (
          <div
            key={t}
            className="absolute top-0 bottom-0 flex flex-col items-start"
            style={{ left: x }}
          >
            <span className="h-2 w-px bg-white/[0.10]" />
            <span
              className={cn(
                TYPE_META,
                "mt-0.5 font-mono tabular-nums text-muted-foreground/45",
              )}
            >
              {fmtTimecodeShort(t)}
            </span>
          </div>
        );
      })}

      {/* In bracket */}
      {inSec !== null && (
        <div
          className="absolute top-0 bottom-0 pointer-events-none"
          style={{ left: inSec * pxPerSec }}
          title="In point"
        >
          <span className="absolute top-0 -translate-x-1/2 font-mono text-[9px] tabular-nums tracking-[0.18em] text-accent">
            ⟦
          </span>
          <span
            className="absolute top-0 bottom-0 w-px bg-accent"
            style={{ boxShadow: "0 0 6px hsl(var(--accent) / 0.6)" }}
          />
        </div>
      )}
      {/* Out bracket */}
      {outSec !== null && (
        <div
          className="absolute top-0 bottom-0 pointer-events-none"
          style={{ left: outSec * pxPerSec }}
          title="Out point"
        >
          <span className="absolute top-0 -translate-x-1/2 font-mono text-[9px] tabular-nums tracking-[0.18em] text-accent">
            ⟧
          </span>
          <span
            className="absolute top-0 bottom-0 w-px bg-accent"
            style={{ boxShadow: "0 0 6px hsl(var(--accent) / 0.6)" }}
          />
        </div>
      )}

      {/* Markers */}
      {markers.map((m) => (
        <button
          key={m.id}
          type="button"
          title={`${m.label} · double-click to remove`}
          onDoubleClick={(e) => {
            e.stopPropagation();
            removeMarker(m.id);
          }}
          onClick={(e) => {
            e.stopPropagation();
            setPlayhead(m.timelineSec);
          }}
          className="absolute top-0 bottom-0 -translate-x-1/2 z-10"
          style={{ left: m.timelineSec * pxPerSec }}
        >
          <span
            className="absolute top-0 inline-block"
            style={{
              width: 0,
              height: 0,
              borderLeft: "5px solid transparent",
              borderRight: "5px solid transparent",
              borderTop: `7px solid ${m.color}`,
              filter: `drop-shadow(0 0 4px ${m.color})`,
            }}
          />
          <span
            className="absolute top-0 bottom-0 w-px"
            style={{ background: `${m.color}`, opacity: 0.7 }}
          />
        </button>
      ))}
    </div>
  );
}

function fmtTimecodeShort(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  if (m > 0) return `${m}:${s.toString().padStart(2, "0")}`;
  if (Number.isInteger(sec)) return `${s}s`;
  return `${sec.toFixed(1)}s`;
}

// ─────────────────────────────────────────────────────────────────────────────
// ClipBlock — the visual atom. Thumbnail wash, hover lift, trim edges.
// ─────────────────────────────────────────────────────────────────────────────
function ClipBlock({
  clip,
  pxPerSec,
  isActive,
  isInSelection,
  reducedMotion,
}: {
  clip: EditorClip;
  pxPerSec: number;
  isActive: boolean;
  isInSelection: boolean;
  reducedMotion: boolean;
}) {
  const [trimming, setTrimming] = useState<null | "left" | "right">(null);
  const [trimDelta, setTrimDelta] = useState(0); // signed seconds, live during trim
  const draftDurationRef = useRef<number>(clip.durationSec);

  const selectThisClip = (e: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }) => {
    if (e.shiftKey) {
      extendClipSelection(clip.id);
    } else if (e.metaKey || e.ctrlKey) {
      toggleClipSelection(clip.id);
    } else {
      selectClip(clip.id);
    }
  };

  /**
   * Start a slip or slide drag from the body of the clip.
   *
   *   Alt-drag                  → slide (clip stays put on its own
   *                                source, neighbors absorb the move)
   *   Shift-Alt-drag            → slip  (clip's window slides over its
   *                                source; timeline position unchanged)
   *
   * Returns true if a drag was initiated (so the caller can stop
   * propagation of the regular click→select path).
   */
  const startSlipOrSlide = (e: React.PointerEvent): boolean => {
    if (e.button !== 0) return false;
    if (!e.altKey) return false;
    const mode: "slide" | "slip" = e.shiftKey ? "slip" : "slide";
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    let lastDelta = 0;

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const deltaSec = dx / pxPerSec;
      const stepDelta = deltaSec - lastDelta;
      if (Math.abs(stepDelta) < 0.01) return;
      lastDelta = deltaSec;
      if (mode === "slide") {
        // slideClipMut shifts neighbors by stepDelta; we keep applying
        // incremental deltas so the cursor maps 1:1 to slide motion.
        slideClipMut(clip.id, stepDelta);
      } else {
        slipClipMut(clip.id, stepDelta);
      }
    };
    const onUp = (ev: PointerEvent) => {
      try { target.releasePointerCapture(ev.pointerId); } catch { /* released */ }
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return true;
  };

  const onClipPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    // Try slip / slide first — they own the drag if Alt is held.
    if (startSlipOrSlide(e)) return;
    selectThisClip(e);
  };
  // Backup: framer-motion's Reorder.Item attaches its own pointer
  // listeners for drag detection and can swallow pointerdown before
  // React's synthetic handler reaches us. The `click` event always
  // fires after a clean tap, so we wire selection here too. Without
  // this, V1 clicks could no-op and the user would think only the
  // A1 audio row was clickable.
  const onClipClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    selectThisClip(e);
  };

  // Trim with pointer events. We capture the pointer and update the
  // clip's draft duration on move. Commit on up.
  //
  // Shift+Ctrl modifies the gesture into a ROLL edit on the boundary:
  // the right trim of clip N + the left trim of clip N+1 sit at the
  // same x-coord; rollClip moves the boundary, lengthening this clip
  // and shortening the next (or vice versa) so the total V1 length
  // stays constant.
  const onTrimPointerDown = (
    e: React.PointerEvent,
    side: "left" | "right",
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.button !== 0) return;
    selectClip(clip.id);

    const rollMode = e.shiftKey && (e.metaKey || e.ctrlKey);
    setTrimming(side);
    draftDurationRef.current = clip.durationSec;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    const startX = e.clientX;
    const startDur = clip.durationSec;
    let lastDelta = 0;

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const deltaSec = dx / pxPerSec;
      // Roll edit is only implemented for the RIGHT handle (it moves this
      // clip's right boundary against the next clip). Left-handle roll was
      // never wired — it used to update the trim chip and then snap back on
      // release. Fall through to a plain trim for the left handle so the drag
      // does something real and consistent instead of a phantom roll.
      if (rollMode && side === "right") {
        // Incremental delta applied at each move so the store's history
        // coalesces under a single label and the cursor maps 1:1 to the
        // boundary motion.
        const step = deltaSec - lastDelta;
        if (Math.abs(step) >= 0.01) {
          rollEditMut(clip.id, step);
          lastDelta = deltaSec;
        }
        // Trim chip mirrors the new duration of THIS clip.
        draftDurationRef.current = Math.max(0.5, startDur + deltaSec);
        setTrimDelta(deltaSec);
        return;
      }
      const next = side === "right"
        ? startDur + deltaSec
        : startDur - deltaSec;
      const clamped = Math.max(0.5, next);
      draftDurationRef.current = clamped;
      setTrimDelta(clamped - startDur);
      trimClipMut(clip.id, clamped);
    };
    const onUp = (ev: PointerEvent) => {
      target.releasePointerCapture(ev.pointerId);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setTrimming(null);
      setTrimDelta(0);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const widthPx = Math.max(MIN_CLIP_PX, clip.durationSec * pxPerSec);

  // Background is now just a base gradient; the ClipFilmstrip
  // component renders real video frames over it. Keeps the previous
  // static thumbnail fallback for clips that don't load frames.
  const blockStyle: CSSProperties = {
    background:
      "linear-gradient(180deg, hsl(220 28% 8%) 0%, hsl(220 32% 6%) 100%)",
  };

  return (
    <motion.div
      onPointerDown={onClipPointerDown}
      onClick={onClipClick}
      initial={reducedMotion ? false : { opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.25, ease: EASE_PREMIUM }}
      className={cn(
        "group/clip relative h-full overflow-hidden select-none",
        "rounded-md transition-shadow",
        // Use ring-2 + inset glow when active so the highlight is
        // unmistakable. The old ring-1 with a tiny color shift was
        // visually lost under the filmstrip frames — users couldn't
        // tell the V1 clip was selected and assumed only the audio
        // row was responding.
        isActive
          ? "ring-2 ring-inset ring-accent shadow-[0_0_0_2px_hsl(var(--accent)/0.45),0_10px_30px_-10px_hsl(var(--accent)/0.7),inset_0_0_0_9999px_hsl(var(--accent)/0.10)]"
          : isInSelection
            ? "ring-2 ring-inset ring-accent/65"
            : "ring-1 ring-inset ring-white/[0.08] hover:ring-white/[0.20]",
      )}
      style={blockStyle}
    >
      {/* Left trim handle */}
      <span
        onPointerDown={(e) => onTrimPointerDown(e, "left")}
        className={cn(
          "absolute top-0 bottom-0 left-0 cursor-col-resize z-10",
          "transition-colors",
          trimming === "left"
            ? "bg-accent/40"
            : "bg-transparent hover:bg-accent/25",
        )}
        style={{ width: TRIM_HANDLE_PX }}
      />
      {/* Right trim handle */}
      <span
        onPointerDown={(e) => onTrimPointerDown(e, "right")}
        className={cn(
          "absolute top-0 bottom-0 right-0 cursor-col-resize z-10",
          "transition-colors",
          trimming === "right"
            ? "bg-accent/40"
            : "bg-transparent hover:bg-accent/25",
        )}
        style={{ width: TRIM_HANDLE_PX }}
      />

      {/* Filmstrip — real video frames inside the clip block.
          Wrapped in a div that applies the clip's CSS filter so the
          timeline reads the GRADED look, not the camera-original.
          Effects (Teal & Orange, Bleach Bypass, etc) now visibly
          land on every clip block in the timeline — they don't just
          affect the program monitor. */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          filter: getClipProperty(clip, "filter") || undefined,
        }}
      >
        <ClipFilmstrip
          clipId={clip.id}
          videoUrl={clip.videoUrl}
          durationSec={clip.durationSec}
          widthPx={widthPx}
          fallbackThumbnailUrl={clip.thumbnailUrl}
        />
      </div>

      {/* Subtle vignette over the filmstrip — keeps the frames
          clearly visible (the user wants to SEE the frames) while
          still giving the labels enough contrast at the top + bottom
          edges. mix-blend-difference on the labels themselves does
          the heavy lifting for legibility; the gradient is just a
          soft tonal cue. */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 pointer-events-none transition-opacity",
          isActive
            ? "bg-gradient-to-b from-transparent via-transparent to-[hsl(220_30%_4%/0.30)]"
            : "bg-gradient-to-b from-[hsl(220_30%_4%/0.12)] via-transparent to-[hsl(220_30%_4%/0.40)]",
        )}
      />

      {/* Index */}
      <div
        className="absolute top-1.5 left-2 mix-blend-difference pointer-events-none"
        style={{ opacity: widthPx > 60 ? 1 : 0 }}
      >
        <span
          className={cn(
            "font-mono text-[10px] tabular-nums tracking-[0.24em]",
            isActive ? "text-accent" : "text-foreground/70",
          )}
        >
          {String(clip.index + 1).padStart(2, "0")}
        </span>
      </div>

      {/* Approval / status pill — reads the document's Shot for this
          clip id. Surfaces the four states the editor cares about:
            draft        → no pill (default)
            ready        → ◆ accent
            rendering    → spinner amber
            completed    → ✓ emerald
            needs-regen  → ! amber
            failed       → x rose
          Hidden when block is too narrow to keep the chrome tidy. */}
      {widthPx > 76 && <ShotStatusPill clipId={clip.id} />}

      {/* Duration */}
      <div
        className="absolute bottom-1.5 right-2 mix-blend-difference pointer-events-none"
        style={{ opacity: widthPx > 64 ? 1 : 0 }}
      >
        <span
          className={cn(
            "font-mono text-[10px] tabular-nums",
            isActive ? "text-accent" : "text-foreground/75",
          )}
        >
          {clip.durationSec.toFixed(1)}s
        </span>
      </div>

      {/* Optional tiny film icon when block is too narrow for any text */}
      {widthPx <= 60 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Film className="h-3 w-3 text-foreground/55" strokeWidth={1.4} />
        </div>
      )}

      {/* Trim delta chip — appears mid-trim, floats on the edge being
          dragged so the user reads "+0.5s" / "-1.2s" without looking
          at the duration label. */}
      {trimming && (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute -top-7 z-30",
            trimming === "right" ? "right-0" : "left-0",
            "px-1.5 py-0.5 rounded",
            "border border-accent/45 bg-[hsl(220_30%_4%/0.92)] backdrop-blur",
            "font-mono text-[10.5px] tabular-nums whitespace-nowrap",
            trimDelta > 0 ? "text-emerald-300" : "text-rose-300",
          )}
        >
          {trimDelta > 0 ? "+" : ""}
          {trimDelta.toFixed(2)}s · {draftDurationRef.current.toFixed(1)}s total
        </div>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TrackHeader — left-column label per track with mute/lock/solo toggles.
// Now wired to the store via setTrackProps so a mute on V2 ACTUALLY
// hides its clips at render and a lock blocks pointer interactions on
// the track's clips. Solo (audio) routes through the same mute logic:
// if ANY audio track is soloed, every non-soloed audio track plays
// muted. The "visual-only" trap is gone.
// ─────────────────────────────────────────────────────────────────────────────
function TrackHeader({
  track,
  addGap,
  onRename,
  onRemove,
  music,
}: {
  track: TrackDef;
  addGap: boolean;
  onRename?: (label: string) => void;
  onRemove?: () => void;
  /** A2-only music actions. Present only for the sys:A2 header. */
  music?: {
    busy: boolean;
    hasMusic: boolean;
    onUpload: () => void;
    onGenerate: () => void;
    onReplace: () => void;
  };
}) {
  const [editing, setEditing] = useState(false);
  const [draftLabel, setDraftLabel] = useState(track.label);
  const isSystem = track.id.startsWith("sys:");
  const Icon = track.Icon;
  const muted = !!track.muted;
  const locked = !!track.locked;
  const soloed = !!track.soloed;
  const setMuted = (next: boolean) => setTrackProps(track.id, { muted: next });
  const setLocked = (next: boolean) => setTrackProps(track.id, { locked: next });
  const setSoloed = (next: boolean) => setTrackProps(track.id, { soloed: next });

  const commit = () => {
    setEditing(false);
    const trimmed = draftLabel.trim();
    if (trimmed && trimmed !== track.label && onRename) onRename(trimmed);
    else setDraftLabel(track.label);
  };

  return (
    <div
      className={cn(
        "relative flex items-center gap-2 pr-3 pl-1",
        "bg-white/[0.012] rounded-l-md",
      )}
      style={{ height: track.height, marginBottom: addGap ? TRACK_GAP : 0 }}
    >
      <Icon
        className={cn(
          "h-3.5 w-3.5 shrink-0",
          track.kind === "video" ? "text-accent/65" : "text-foreground/55",
        )}
        strokeWidth={1.5}
      />
      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            value={draftLabel}
            autoFocus
            onChange={(e) => setDraftLabel(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") { setDraftLabel(track.label); setEditing(false); }
            }}
            className={cn(TYPE_META, "w-full bg-transparent outline-none text-foreground tracking-[0.22em]")}
          />
        ) : (
          <button
            type="button"
            onDoubleClick={() => setEditing(true)}
            className={cn(TYPE_META, "text-foreground/85 tracking-[0.22em] truncate text-left")}
            title="Double-click to rename"
          >
            {track.label}
          </button>
        )}
      </div>
      {music && (
        <div className="shrink-0 flex items-center gap-0.5">
          {/* Generate score */}
          <button
            type="button"
            onClick={music.onGenerate}
            disabled={music.busy}
            className={cn(
              "inline-flex items-center justify-center h-5 w-5 rounded transition-colors",
              "disabled:opacity-40 disabled:cursor-not-allowed",
              "text-accent/80 hover:text-accent hover:bg-accent/10",
            )}
            aria-label="Generate a score"
            title="Generate a cinematic score onto A2"
          >
            {music.busy ? (
              <Loader2Pill className="h-3 w-3 animate-spin" strokeWidth={1.8} />
            ) : (
              <SparklesIconPill className="h-3 w-3" strokeWidth={1.7} />
            )}
          </button>
          {/* Upload / Replace music */}
          <button
            type="button"
            onClick={music.hasMusic ? music.onReplace : music.onUpload}
            disabled={music.busy}
            className={cn(
              "inline-flex items-center justify-center h-5 w-5 rounded transition-colors",
              "disabled:opacity-40 disabled:cursor-not-allowed",
              "text-muted-foreground/55 hover:text-foreground hover:bg-white/[0.06]",
            )}
            aria-label={music.hasMusic ? "Replace music" : "Upload music"}
            title={music.hasMusic ? "Replace the music on A2" : "Upload music to A2"}
          >
            <UploadIcon className="h-3 w-3" strokeWidth={1.7} />
          </button>
        </div>
      )}
      {!isSystem && onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 inline-flex items-center justify-center h-5 w-5 rounded text-rose-300/65 hover:text-rose-200 transition-colors"
          aria-label="Delete track"
          title="Delete track"
        >
          ✕
        </button>
      )}
      {track.kind === "audio" && (
        <>
          <button
            type="button"
            onClick={() => setSoloed(!soloed)}
            className={cn(
              "shrink-0 inline-flex items-center justify-center h-5 w-5 rounded transition-colors text-[10px] font-mono font-semibold",
              soloed
                ? "bg-amber-400/20 text-amber-200 ring-1 ring-inset ring-amber-400/50"
                : "text-muted-foreground/45 hover:text-foreground/80",
            )}
            aria-label={soloed ? "Un-solo track" : "Solo track"}
            title="Solo — all other audio tracks play muted"
          >
            S
          </button>
          <button
            type="button"
            onClick={() => setMuted(!muted)}
            className={cn(
              "shrink-0 inline-flex items-center justify-center h-5 w-5 rounded transition-colors",
              muted ? "text-rose-300/85" : "text-muted-foreground/45 hover:text-foreground/80",
            )}
            aria-label={muted ? "Unmute track" : "Mute track"}
            title={muted ? "Unmute" : "Mute"}
          >
            {muted ? (
              <VolumeX className="h-3 w-3" strokeWidth={1.6} />
            ) : (
              <Volume2 className="h-3 w-3" strokeWidth={1.6} />
            )}
          </button>
        </>
      )}
      {track.kind === "video" && (
        <button
          type="button"
          onClick={() => setMuted(!muted)}
          className={cn(
            "shrink-0 inline-flex items-center justify-center h-5 w-5 rounded transition-colors",
            muted ? "text-rose-300/85" : "text-muted-foreground/45 hover:text-foreground/80",
          )}
          aria-label={muted ? "Show track" : "Hide track"}
          title={muted ? "Show track" : "Hide track at render"}
        >
          {muted ? (
            <EyeOff className="h-3 w-3" strokeWidth={1.6} />
          ) : (
            <Eye className="h-3 w-3" strokeWidth={1.6} />
          )}
        </button>
      )}
      <button
        type="button"
        onClick={() => setLocked(!locked)}
        className={cn(
          "shrink-0 inline-flex items-center justify-center h-5 w-5 rounded transition-colors",
          locked ? "text-amber-300/85" : "text-muted-foreground/45 hover:text-foreground/80",
        )}
        aria-label={locked ? "Unlock track" : "Lock track"}
        title={locked ? "Unlock" : "Lock — clips on this track can't be moved or trimmed"}
      >
        <Lock
          className="h-3 w-3"
          strokeWidth={1.6}
          fill={locked ? "currentColor" : "none"}
        />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EmptyTrack — visual placeholder for V2 (overlays). A2 has its own
// MusicTrack below.
// ─────────────────────────────────────────────────────────────────────────────
function EmptyTrack({
  top,
  height,
  width,
  hint,
}: {
  top: number;
  height: number;
  width: number;
  hint: string;
}) {
  return (
    <div
      className="absolute left-0 rounded-md border border-dashed border-white/[0.05] bg-white/[0.008] overflow-hidden flex items-center"
      style={{ top, height, width }}
    >
      <span className={cn(TYPE_META, "ml-3 text-muted-foreground/30 tracking-[0.30em]")}>
        {hint}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MusicTrack — A2's continuous "music goes here" band that spans the
// full timeline width. Renders as a soft horizontal band with a
// faint pulse so the row reads as ready-to-accept-music, not "broken
// and empty." When real music clips land, they overlay this band.
// ─────────────────────────────────────────────────────────────────────────────
function MusicTrack({
  top,
  height,
  width,
  clips,
  pxPerSec,
  selectedClipId,
}: {
  top: number;
  height: number;
  width: number;
  /** Clips routed to sys:A2 — rendered as AudioShadow tiles on top
   *  of the music backdrop. Empty array = backdrop label only. */
  clips: EditorClip[];
  pxPerSec: number;
  selectedClipId: string | null;
}) {
  return (
    <div
      className={cn(
        "absolute left-0 rounded-md overflow-hidden",
        "bg-gradient-to-r from-amber-200/[0.04] via-amber-200/[0.08] to-amber-200/[0.04]",
        "ring-1 ring-inset ring-amber-200/[0.06]",
      )}
      style={{ top, height, width }}
    >
      {/* Decorative wave shimmer so the row obviously means "music" */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-50"
        style={{
          background:
            "repeating-linear-gradient(90deg, transparent 0, transparent 32px, hsl(45 80% 70% / 0.06) 32px, hsl(45 80% 70% / 0.06) 33px)",
        }}
      />
      {clips.length === 0 ? (
        <span
          className={cn(
            TYPE_META,
            "absolute left-3 top-1/2 -translate-y-1/2 text-amber-200/55 tracking-[0.30em]",
          )}
        >
          ◆ Music · drop an MP3 / WAV / AAC to add
        </span>
      ) : (
        clips.map((c) => (
          <AudioShadow
            key={c.id}
            clip={c}
            pxPerSec={pxPerSec}
            isActive={c.id === selectedClipId}
          />
        ))
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TransitionLayer — every V1 clip boundary gets a chip. Empty chips
// say "+ add transition" on hover; existing transitions render as a
// diamond glyph with their duration label, draggable to widen or
// shorten. Right-click swaps the kind.
//
// Geometry:
//   x = (fromClip.timelineStartSec + fromClip.durationSec) * pxPerSec
//   width spans [x - half, x + half] where half = (durationSec/2) * pxPerSec
// ─────────────────────────────────────────────────────────────────────────────
function TransitionLayer({
  top,
  height,
  clips,
  transitions,
  pxPerSec,
  selectedTransitionId,
}: {
  top: number;
  height: number;
  clips: EditorClip[];
  transitions: ClipTransition[];
  pxPerSec: number;
  selectedTransitionId: string | null;
}) {
  if (clips.length < 2) return null;
  const byBoundary = new Map<string, ClipTransition>();
  for (const t of transitions) byBoundary.set(`${t.fromClipId}->${t.toClipId}`, t);

  const handles: React.ReactNode[] = [];
  for (let i = 0; i < clips.length - 1; i++) {
    const from = clips[i];
    const to = clips[i + 1];
    const x = (from.timelineStartSec + from.durationSec) * pxPerSec;
    const t = byBoundary.get(`${from.id}->${to.id}`);
    handles.push(
      <TransitionHandle
        key={`${from.id}->${to.id}`}
        positionPx={x}
        height={height}
        pxPerSec={pxPerSec}
        fromClip={from}
        toClip={to}
        transition={t ?? null}
        selected={!!t && selectedTransitionId === t.id}
      />,
    );
  }
  return (
    <div
      className="absolute left-0 right-0 pointer-events-none"
      style={{ top, height, zIndex: 6 }}
    >
      {handles}
    </div>
  );
}

function TransitionHandle({
  positionPx,
  height,
  pxPerSec,
  fromClip,
  toClip,
  transition,
  selected,
}: {
  positionPx: number;
  height: number;
  pxPerSec: number;
  fromClip: EditorClip;
  toClip: EditorClip;
  transition: ClipTransition | null;
  selected: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{
    startX: number;
    startDur: number;
    id: string;
  } | null>(null);

  const widthPx = transition
    ? Math.max(18, transition.durationSec * pxPerSec)
    : 18;
  const maxDur = Math.max(0.1, Math.min(fromClip.durationSec, toClip.durationSec) / 2);

  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (menuOpen) return;
    if (transition) {
      selectTransitionMut(transition.id);
    } else {
      addTransitionMut(fromClip.id, toClip.id, "fade", 0.4);
      toast.message(`Transition added · ${fromClip.id.slice(0, 6)} → ${toClip.id.slice(0, 6)}`, {
        description: "Right-click to change kind · drag the edges to widen",
      });
    }
  };

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!transition) {
      addTransitionMut(fromClip.id, toClip.id, "fade", 0.4);
    }
    setMenuOpen(true);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!transition) return;
    e.stopPropagation();
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    setDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startDur: transition.durationSec,
      id: transition.id,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current || !transition) return;
    const dx = e.clientX - dragRef.current.startX;
    const next = Math.max(0.1, Math.min(maxDur, dragRef.current.startDur + (dx * 2) / pxPerSec));
    updateTransitionMut(dragRef.current.id, { durationSec: next });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    try {
      (e.target as Element).releasePointerCapture(e.pointerId);
    } catch {
      /* ignored */
    }
    dragRef.current = null;
    setDragging(false);
  };

  const pickKind = (k: TransitionKind) => {
    if (transition) updateTransitionMut(transition.id, { kind: k });
    setMenuOpen(false);
  };

  return (
    <div
      className="absolute pointer-events-auto"
      style={{
        left: positionPx - widthPx / 2,
        top: 0,
        width: widthPx,
        height,
      }}
    >
      <button
        type="button"
        onClick={onClick}
        onContextMenu={onContextMenu}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        title={
          transition
            ? `${TRANSITION_LABELS[transition.kind]} · ${transition.durationSec.toFixed(2)}s — drag to widen, right-click to change kind`
            : "Click to add fade · right-click for transition menu"
        }
        className={cn(
          "group absolute inset-0 flex items-center justify-center rounded-md transition-all",
          transition
            ? cn(
                "ring-1 ring-inset shadow-[0_4px_18px_-6px_hsl(220_80%_55%/0.45)]",
                selected
                  ? "bg-[hsl(212_100%_60%/0.30)] ring-accent/85"
                  : "bg-[hsl(212_100%_60%/0.18)] ring-accent/55 hover:bg-[hsl(212_100%_60%/0.26)]",
                dragging && "cursor-ew-resize",
              )
            : cn(
                "bg-white/[0.04] ring-1 ring-inset ring-white/[0.10]",
                "opacity-0 group-hover:opacity-100",
                "hover:bg-accent/15 hover:ring-accent/40 hover:opacity-100",
                "focus-visible:opacity-100",
              ),
        )}
        aria-label={transition ? `${transition.kind} transition` : "Add transition"}
      >
        {/* The diamond glyph + label */}
        <div className="flex items-center gap-1 select-none pointer-events-none">
          <span
            className={cn(
              "block",
              transition ? "text-accent" : "text-foreground/65 opacity-0 group-hover:opacity-100",
            )}
          >
            ◆
          </span>
          {transition && widthPx >= 64 && (
            <span
              className={cn(
                TYPE_META,
                "font-mono tabular-nums text-foreground/85 tracking-[0.18em]",
              )}
            >
              {transition.durationSec.toFixed(2)}s
            </span>
          )}
        </div>
      </button>

      {/* Right-click menu — kind picker */}
      {menuOpen && (
        <div
          className={cn(
            "absolute left-1/2 -translate-x-1/2 top-full mt-1 z-50",
            "min-w-[180px] rounded-md border border-white/[0.10]",
            "bg-[hsl(220_30%_6%/0.96)] backdrop-blur-sm shadow-[0_20px_50px_-12px_hsl(0_0%_0%/0.7)]",
            "py-1",
          )}
          onMouseLeave={() => setMenuOpen(false)}
        >
          <div className={cn(TYPE_META, "px-3 py-1 text-muted-foreground/65 tracking-[0.24em]")}>
            ◆ Transition
          </div>
          <div className="max-h-72 overflow-y-auto">
            {TRANSITION_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  pickKind(k);
                }}
                className={cn(
                  "w-full text-left px-3 py-1.5 flex items-center justify-between",
                  "text-[12px] font-mono uppercase tracking-[0.10em]",
                  transition?.kind === k
                    ? "bg-[hsl(212_100%_60%/0.18)] text-accent"
                    : "text-foreground/80 hover:bg-white/[0.04]",
                )}
              >
                <span>{TRANSITION_LABELS[k]}</span>
                {transition?.kind === k && (
                  <span className="text-accent">✓</span>
                )}
              </button>
            ))}
          </div>
          {transition && (
            <>
              <div className="h-px bg-white/[0.06] my-1" />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTransitionMut(transition.id);
                  setMenuOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 text-[12px] font-mono uppercase tracking-[0.10em] text-rose-300 hover:bg-rose-500/[0.10]"
              >
                Remove transition
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TitleBlock — positioned title clip on V2. Selectable; opens in
// the Inspector for text + background colour editing. Width follows
// the title's own durationSec independent of V1.
// ─────────────────────────────────────────────────────────────────────────────
function TitleBlock({
  clip,
  pxPerSec,
  isActive,
}: {
  clip: EditorClip;
  pxPerSec: number;
  isActive: boolean;
}) {
  const widthPx = Math.max(MIN_CLIP_PX, clip.durationSec * pxPerSec);
  const leftPx = clip.timelineStartSec * pxPerSec;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        selectClip(clip.id);
      }}
      className={cn(
        "absolute top-0 bottom-0 rounded-sm overflow-hidden ring-1 ring-inset transition-all",
        isActive
          ? "ring-accent/85 shadow-[0_6px_18px_-10px_hsl(var(--accent)/0.5)]"
          : "ring-white/[0.10] hover:ring-white/[0.20]",
      )}
      style={{
        left: leftPx,
        width: widthPx,
        background: clip.titleColor
          ? `linear-gradient(90deg, ${clip.titleColor}E0, ${clip.titleColor}FF)`
          : "linear-gradient(90deg, hsl(220 30% 4% / 0.85), hsl(220 30% 4%))",
      }}
    >
      <div className="absolute inset-0 flex items-center px-2">
        <span
          className="truncate font-display italic text-[12px] font-light text-foreground/95"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          {clip.titleText || "Title"}
        </span>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AudioShadow — a positioned audio "block" mirroring each video clip's
// timeline position. For v1 we paint a procedural amplitude bar set
// (deterministic per clip id) so the timeline reads as multi-track
// without a real audio decode step. When useAudioWaveform lands, this
// component is the swap-in.
// ─────────────────────────────────────────────────────────────────────────────
function AudioShadow({
  clip,
  pxPerSec,
  isActive,
}: {
  clip: EditorClip;
  pxPerSec: number;
  isActive: boolean;
}) {
  const widthPx = Math.max(MIN_CLIP_PX, clip.durationSec * pxPerSec);
  const leftPx = clip.timelineStartSec * pxPerSec;
  const real = useAudioWaveform(clip.videoUrl);
  // Real audio fetched + decoded → use it. CORS/decode failure → fall
  // back to a deterministic procedural amplitude set per clip id so
  // the row still looks like an audio track.
  const bars = useMemo(() => {
    if (real && real.length > 0) {
      // Resample the 240-bucket real waveform to fit the width in
      // ~3px-wide bars.
      const target = Math.max(6, Math.floor(widthPx / 3));
      const out = new Array<number>(target);
      const stride = real.length / target;
      for (let i = 0; i < target; i++) {
        const s = Math.floor(i * stride);
        const e = Math.floor((i + 1) * stride);
        let max = 0;
        for (let j = s; j < e; j++) if (real[j] > max) max = real[j];
        out[i] = Math.max(0.1, max); // floor so silent passages still register
      }
      return out;
    }
    return buildProceduralWaveform(clip.id, widthPx);
  }, [real, clip.id, widthPx]);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        selectClip(clip.id);
      }}
      className={cn(
        "absolute top-0 bottom-0 rounded-sm overflow-hidden ring-1 ring-inset transition-all",
        isActive
          ? "ring-accent/70 bg-[hsl(var(--accent)/0.14)]"
          : "ring-white/[0.10] hover:ring-white/[0.20] bg-white/[0.06]",
      )}
      style={{ left: leftPx, width: widthPx }}
      title={`Audio · clip ${clip.index + 1} · ${clip.durationSec.toFixed(1)}s`}
    >
      {/* Top label — clip number + duration, mix-blend-difference so
          it reads against any waveform. */}
      <div className="absolute top-0.5 left-1 pointer-events-none">
        <span
          className={cn(
            TYPE_META,
            "font-mono tabular-nums tracking-[0.18em] mix-blend-difference",
            isActive ? "text-accent" : "text-foreground/85",
          )}
        >
          A{String(clip.index + 1).padStart(2, "0")}
        </span>
      </div>
      <div className="absolute inset-0 flex items-center justify-evenly px-0.5 pt-3">
        {bars.map((h, i) => (
          <span
            key={i}
            className={cn(
              "block w-[2px] rounded-full",
              isActive ? "bg-accent/85" : "bg-foreground/55",
            )}
            style={{ height: `${h * 100}%` }}
          />
        ))}
      </div>
    </button>
  );
}

/**
 * buildProceduralWaveform — deterministic per-clip amplitude array.
 * Same clip id → same bars across renders. Bar count scales with the
 * rendered pixel width so wider zoom shows more bars.
 */
function buildProceduralWaveform(seed: string, widthPx: number): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  // 3px per bar
  const count = Math.max(6, Math.floor(widthPx / 3));
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    // Two-octave pseudo-random: mix high + low frequency so it looks
    // like waveform amplitude, not noise.
    const a = (h & 0xff) / 255;
    const b = ((h >> 8) & 0xff) / 255;
    const env = 0.35 + 0.55 * Math.sin((i / count) * Math.PI);
    bars.push(0.18 + 0.82 * env * (0.55 * a + 0.45 * b));
  }
  return bars;
}

// ─────────────────────────────────────────────────────────────────────────────
// HoverIndicator — faint vertical line + floating mono timecode chip
// + thumbnail preview of the clip currently under the mouse. Read-
// only; the playhead commits on click.
// ─────────────────────────────────────────────────────────────────────────────
function HoverIndicator({
  positionPx,
  sec,
  trackHeight,
  clips,
}: {
  positionPx: number;
  sec: number;
  trackHeight: number;
  clips: EditorClip[];
}) {
  // Find the V1 clip the cursor is hovering. Used to surface a
  // miniature thumbnail in the floating preview.
  const hoverClip = clips.find(
    (c) => sec >= c.timelineStartSec && sec < c.timelineStartSec + c.durationSec,
  );
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute top-0 z-10"
      style={{ left: positionPx, height: trackHeight }}
    >
      <div
        className="absolute top-0 bottom-0 w-px"
        style={{ background: "hsl(var(--foreground) / 0.35)" }}
      />
      {/* Floating preview — thumbnail + clip index + timecode */}
      <div
        className={cn(
          "absolute -top-24 left-2",
          "rounded-md overflow-hidden",
          "border border-white/[0.10] bg-[hsl(220_30%_4%/0.92)] backdrop-blur",
          "shadow-[0_18px_36px_-12px_hsl(0_0%_0%/0.7)]",
          "whitespace-nowrap",
        )}
        style={{ width: 160 }}
      >
        {hoverClip?.thumbnailUrl ? (
          <div className="relative w-full" style={{ aspectRatio: "16 / 9" }}>
            <img
              src={hoverClip.thumbnailUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-[hsl(220_30%_4%/0.85)] via-transparent to-transparent"
            />
            <div className="absolute bottom-1 left-2">
              <span className={cn(TYPE_META, "font-mono tabular-nums text-foreground/90 mix-blend-difference tracking-[0.18em]")}>
                CLIP {String(hoverClip.index + 1).padStart(2, "0")}
              </span>
            </div>
          </div>
        ) : (
          <div className="w-full px-3 py-2 flex items-center gap-2 text-muted-foreground/55">
            <Film className="h-3 w-3" strokeWidth={1.5} />
            <span className={cn(TYPE_META, "font-mono")}>no clip here</span>
          </div>
        )}
        <div className="px-2 py-1 flex items-center justify-between gap-3 border-t border-white/[0.05]">
          <span className={cn(TYPE_META, "font-mono tabular-nums text-foreground/85")}>
            {fmtTC(sec)}
          </span>
          {hoverClip && (
            <span className={cn(TYPE_META, "font-mono tabular-nums text-muted-foreground/55")}>
              {hoverClip.durationSec.toFixed(1)}s
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Playhead — vertical line with handle
// ─────────────────────────────────────────────────────────────────────────────
function Playhead({
  positionPx,
  trackHeight,
  pxPerSec,
  scrollerRef,
}: {
  positionPx: number;
  trackHeight: number;
  pxPerSec?: number;
  scrollerRef?: React.RefObject<HTMLDivElement | null>;
}) {
  // The triangle handle catches pointer events for drag-scrub. The
  // vertical line stays non-interactive so it doesn't steal hover
  // from clips behind it. Without this drag, every NLE-trained user
  // expected the head to follow the mouse and ended up clicking
  // around the ruler hoping something would catch.
  const onDownHandle = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!pxPerSec || !scrollerRef?.current) return;
      e.preventDefault();
      e.stopPropagation();
      const scroller = scrollerRef.current;
      const move = (ev: PointerEvent) => {
        const rect = scroller.getBoundingClientRect();
        const xInScroller = ev.clientX - rect.left;
        const sec = Math.max(0, (scroller.scrollLeft + xInScroller) / pxPerSec);
        setPlayhead(sec);
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [pxPerSec, scrollerRef],
  );
  const interactive = !!pxPerSec && !!scrollerRef;
  return (
    <div
      aria-hidden
      // pointer-events-none on the container so the line doesn't
      // block underlying clip clicks; the handle below opts back in.
      className="absolute top-0 pointer-events-none z-20"
      style={{
        left: positionPx,
        height: trackHeight,
      }}
    >
      {/* Triangle handle — pointer-events:auto + grab cursor so the
          user discovers it's draggable. */}
      <div
        className={cn(
          "absolute -top-2 -translate-x-1/2",
          interactive && "pointer-events-auto cursor-ew-resize",
        )}
        style={{ left: 0 }}
        onPointerDown={interactive ? onDownHandle : undefined}
      >
        <div
          className="w-3 h-3"
          style={{
            background: "hsl(var(--accent))",
            clipPath: "polygon(50% 100%, 0 0, 100% 0)",
          }}
        />
      </div>
      {/* Vertical line */}
      <div
        className="absolute top-0 bottom-0 w-px"
        style={{
          background: "hsl(var(--accent))",
          boxShadow: "0 0 10px hsl(var(--accent) / 0.6), 0 0 20px hsl(var(--accent) / 0.25)",
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Footer transport
// ─────────────────────────────────────────────────────────────────────────────
function TimelineFooter({
  playheadSec,
  totalSec,
  selectedClipId,
}: {
  playheadSec: number;
  totalSec: number;
  selectedClipId: string | null;
}) {
  return (
    <footer className="relative z-10 px-6 sm:px-10 lg:px-12 py-5 flex items-center justify-between gap-4">
      <div className={cn(TYPE_META, "font-mono tabular-nums text-foreground/85")}>
        {fmtTC(playheadSec)}{" "}
        <span className="text-muted-foreground/45">/ {fmtTC(totalSec)}</span>
      </div>
      <div className={cn(TYPE_META, "text-muted-foreground/45 tracking-[0.30em] hidden md:block")}>
        {selectedClipId
          ? "drag clip body to reorder · drag edges to trim · B to blade at playhead · , . step a frame"
          : "click a clip to select · B to blade at playhead · ⌘+scroll to zoom · , . step a frame"}
      </div>
    </footer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────────────────────
function EmptyTimeline(_props: { onUploadClick?: () => void }) {
  // Inline upload button intentionally removed — the canonical entry
  // points live in the timeline header toolbar (Create · Upload · Clear)
  // so users don't see a duplicate affordance in the rows area. Empty
  // state stays minimal: a hint pointing them at the header buttons.
  void _props;
  return (
    <div className="flex-1 flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <Scissors className="h-7 w-7 text-muted-foreground/55 mx-auto" strokeWidth={1.4} />
        <p
          className="mt-5 font-display italic text-[22px] font-light text-foreground/90"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          Nothing on the timeline yet.
        </p>
        <p className={cn(TYPE_META, "mt-3 text-muted-foreground/55")}>
          Click <span className="text-accent">Create</span> to generate one in Studio,
          or <span className="text-accent">Upload</span> a video — both up in the toolbar.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ShotStatusPill — reads the document store for this clip's Shot
// and surfaces its approval state as a corner pill on every V1
// clip block.
// ─────────────────────────────────────────────────────────────────────────────
function ShotStatusPill({ clipId }: { clipId: string }) {
  const docState = useSyncExternalStoreForPills(
    subDocForPill,
    getDocStateForPill,
    getDocStateForPill,
  );
  const doc = docState.doc;
  if (!doc) return null;
  const shot = findShotForPill(doc, clipId);
  if (!shot) return null;
  // Status bus override — live in-flight rendering beats the
  // persisted approval state.
  const event = latestEventForShotPill(shot.id);
  const stateForUi =
    event &&
    (event.stage === "queued" ||
      event.stage === "preparing" ||
      event.stage === "submitting" ||
      event.stage === "rendering" ||
      event.stage === "post-processing")
      ? "rendering"
      : shot.approval.state;

  let icon: React.ReactNode;
  let bg: string;
  let ring: string;
  let title = stateForUi;

  switch (stateForUi) {
    case "draft":
      return null; // no pill — keeps draft clips clean
    case "ready":
      icon = <SparklesIconPill className="h-2.5 w-2.5" strokeWidth={1.8} />;
      bg = "bg-[hsl(var(--accent)/0.20)]";
      ring = "ring-accent/55";
      title = "Approved — ready to render";
      break;
    case "rendering":
      icon = <Loader2Pill className="h-2.5 w-2.5 animate-spin" strokeWidth={1.8} />;
      bg = "bg-amber-500/[0.22]";
      ring = "ring-amber-400/55";
      title = "Rendering…";
      break;
    case "post-processing":
      icon = <Loader2Pill className="h-2.5 w-2.5 animate-spin" strokeWidth={1.8} />;
      bg = "bg-amber-500/[0.22]";
      ring = "ring-amber-400/55";
      title = "Finalising…";
      break;
    case "completed":
      icon = <CheckPill className="h-2.5 w-2.5" strokeWidth={2} />;
      bg = "bg-emerald-500/[0.22]";
      ring = "ring-emerald-400/55";
      title = "Completed";
      break;
    case "needs-regen":
      icon = <AlertPill className="h-2.5 w-2.5" strokeWidth={1.8} />;
      bg = "bg-amber-500/[0.18]";
      ring = "ring-amber-400/45";
      title = "Edited after approval — re-render to refresh";
      break;
    case "failed":
      icon = <XCirclePill className="h-2.5 w-2.5" strokeWidth={1.8} />;
      bg = "bg-rose-500/[0.20]";
      ring = "ring-rose-400/55";
      title = "Generation failed";
      break;
  }

  return (
    <div
      className={cn(
        "absolute top-1.5 right-1.5 z-10 pointer-events-none",
        "inline-flex items-center justify-center h-4 w-4 rounded-full",
        "ring-1 ring-inset",
        bg,
        ring,
      )}
      title={title}
    >
      <span className="text-foreground">{icon}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// useTimelineDropzone — drag-drop video files onto the timeline.
// Returns drop handlers that the Timeline's outer container binds.
// ─────────────────────────────────────────────────────────────────────────────
export function useTimelineDropzone(projectId: string | undefined) {
  const { user } = useAuthForUpload();
  const [dragOver, setDragOver] = useState(false);

  const onDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("Files")) {
      e.preventDefault();
      setDragOver(true);
    }
  };
  const onDragLeave = () => setDragOver(false);
  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (!user || !projectId) {
      toast.error("Sign in + open a project to upload clips");
      return;
    }
    const doc = getDocStateForPill().doc;
    if (!doc) {
      toast.error("Document still loading — try again");
      return;
    }
    // Accept both video and audio. Previously this filter rejected MP3 /
    // WAV / etc., even though the file input's accept list claims to
    // support them and the upload-ingest pipeline routes audio to the
    // sys:A2 track. Net effect was that the only entry point for music
    // was completely blocked.
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("video/") || f.type.startsWith("audio/"),
    );
    if (files.length === 0) {
      toast.error("Drop a video or audio file (MP4, MOV, WebM, MP3, WAV, AAC)");
      return;
    }

    // Detect drop-on-clip: walk up from the event target looking for a
    // [data-clip-id] node. When found, REPLACE the source media of
    // that clip instead of inserting new ones. Empty area falls
    // through to the regular ingest flow that adds clips to the end.
    let targetClipId: string | null = null;
    const targetEl = e.target as HTMLElement | null;
    if (targetEl) {
      const clipEl = targetEl.closest?.("[data-clip-id]") as HTMLElement | null;
      if (clipEl) targetClipId = clipEl.getAttribute("data-clip-id");
    }

    if (targetClipId) {
      // Replace flow — single file only, the rest are ignored. We use
      // the same validation + upload pipeline as ingest so file
      // probing / thumbnail extraction / storage upload all reuse the
      // existing code paths.
      const file = files[0];
      const toastId = toast.loading(`Replacing clip with ${file.name}…`);
      try {
        const validated = await validateUploadFileFn(file);
        const urls = await uploadValidatedFn(validated, user.id, projectId);
        const ok = replaceClipMut(targetClipId, {
          videoUrl: urls.videoUrl,
          thumbnailUrl: urls.thumbnailUrl,
          durationSec: validated.durationSec,
        });
        if (!ok) throw new Error("replace_blocked_by_locked_track_or_missing_clip");
        toast.success("Clip replaced", { id: toastId });
      } catch (err) {
        const m = describeIngestErrorFn(err);
        toast.error("Couldn't replace clip", {
          id: toastId,
          description: m.description ?? m.message,
        });
      }
      return;
    }

    const toastId = toast.loading(`Uploading ${files.length} clip${files.length === 1 ? "" : "s"}…`);
    let ok = 0;
    let failed = 0;
    for (const f of files) {
      try {
        await ingestUploadFn({ file: f, userId: user.id, projectId, doc });
        ok += 1;
      } catch (err) {
        failed += 1;
        const m = describeIngestErrorFn(err);
        // eslint-disable-next-line no-console
        console.warn("[upload]", f.name, m.message, m.description);
      }
    }
    if (ok > 0 && failed === 0) {
      toast.success(`Uploaded ${ok} clip${ok === 1 ? "" : "s"}`, { id: toastId });
    } else if (ok > 0 && failed > 0) {
      toast.warning(`${ok} uploaded, ${failed} failed`, { id: toastId });
    } else {
      toast.error("All uploads failed", { id: toastId });
    }
  };
  return { dragOver, onDragOver, onDragLeave, onDrop };
}
