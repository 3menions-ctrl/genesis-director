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
  Music2,
  Type as TypeIcon,
  Video,
  Disc3,
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
} from "@/lib/editor/store";
import { useEditor } from "@/hooks/editor/useEditor";
import { useAudioWaveform } from "@/hooks/editor/useAudioWaveform";
import { Toolbar } from "../components/Toolbar";
import { toast } from "sonner";
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
import { ingestUpload as ingestUploadFn, describeIngestError as describeIngestErrorFn } from "@/lib/editor/upload-ingest";
import { useAuth as useAuthForUpload } from "@/contexts/AuthContext";
import { ClipFilmstrip } from "../components/ClipFilmstrip";

interface Props {
  project: EditorProject;
  selectedClipId: string | null;
  selectedClipIds: string[];
  playheadSec: number;
  pxPerSec: number;
}

const V_TRACK_HEIGHT = 72;     // V1 (the workhorse video track)
const V_OVERLAY_HEIGHT = 38;   // V2 — title cards / overlays
const A_TRACK_HEIGHT = 44;     // A1 — clip audio
const A_MUSIC_HEIGHT = 38;     // A2 — music / score
const TRACK_GAP = 4;
const TRACK_HEADER_W = 132;
const TRACK_PADDING_PX = 32;
const TRIM_HANDLE_PX = 10;
const MIN_CLIP_PX = 22;

interface TrackDef {
  id: "V2" | "V1" | "A1" | "A2";
  label: string;
  kind: "video" | "audio";
  height: number;
  Icon: typeof Film;
}

const TRACKS: TrackDef[] = [
  { id: "V2", label: "V2 · Overlay",  kind: "video", height: V_OVERLAY_HEIGHT, Icon: TypeIcon },
  { id: "V1", label: "V1 · Video",    kind: "video", height: V_TRACK_HEIGHT,   Icon: Video },
  { id: "A1", label: "A1 · Audio",    kind: "audio", height: A_TRACK_HEIGHT,   Icon: Disc3 },
  { id: "A2", label: "A2 · Music",    kind: "audio", height: A_MUSIC_HEIGHT,   Icon: Music2 },
];

const TOTAL_TRACK_AREA =
  V_OVERLAY_HEIGHT + V_TRACK_HEIGHT + A_TRACK_HEIGHT + A_MUSIC_HEIGHT + TRACK_GAP * 3;

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
}: Props) {
  const reducedMotion = useReducedMotion();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const { tool, snapEnabled, markers, inSec, outSec, selectedTransitionId } = useEditor();

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
      } else if (e.key === "b" || e.key === "B") {
        // Razor blade — toggle blade tool + split at playhead
        e.preventDefault();
        setTool("blade");
        const ok = splitAtPlayheadMut();
        if (!ok) {
          toast.message("Move the playhead inside a clip to split", {
            description: "Razor needs at least 0.1s of clip on each side",
          });
        }
      } else if (e.key === "v" || e.key === "V") {
        e.preventDefault();
        setTool("select");
      } else if (e.key === "h" || e.key === "H") {
        e.preventDefault();
        setTool("hand");
      } else if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        toggleSnapMut();
      } else if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        const id = addMarkerAtPlayhead();
        toast.message("Marker dropped", {
          description: `at ${fmtTC(playheadSec)} · double-click on the ruler to rename or remove`,
        });
        void id;
      } else if (e.key === "i" || e.key === "I") {
        e.preventDefault();
        setInPoint(playheadSec);
      } else if (e.key === "o" || e.key === "O") {
        e.preventDefault();
        setOutPoint(playheadSec);
      } else if (e.key === "t" || e.key === "T") {
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

  // Wheel + cmd/ctrl zooms; pinned to cursor position
  const onWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1 / 1.1 : 1.1;
      setPxPerSec(pxPerSec * factor);
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

  return (
    <section className="relative flex-1 flex flex-col min-h-0">
      <TimelineHeader
        clipCount={clips.length}
        totalSec={totalSec}
        pxPerSec={pxPerSec}
        selectedClipId={selectedClipId}
        tool={tool}
        snapEnabled={snapEnabled}
        hasInOut={inSec !== null || outSec !== null}
        playheadSec={playheadSec}
      />

      {clips.length === 0 ? (
        <EmptyTimeline />
      ) : (
        <div className="flex-1 flex min-h-0">
          {/* Track headers column — pinned left, doesn't scroll
              horizontally with the track body. Mirrors the height
              of every track so the labels line up exactly. */}
          <div
            className="shrink-0 border-r border-white/[0.04] flex flex-col"
            style={{ width: TRACK_HEADER_W }}
          >
            {/* Spacer matching ruler height */}
            <div className="h-6" />
            <div className="mt-3" style={{ height: TOTAL_TRACK_AREA }}>
              <div className="flex flex-col h-full">
                {TRACKS.map((t, i) => (
                  <TrackHeader
                    key={t.id}
                    track={t}
                    addGap={i < TRACKS.length - 1}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Scrolling track body */}
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
                {/* V2 — overlay track for title cards */}
                <div
                  className="absolute left-0 right-0 rounded-md border border-dashed border-white/[0.05] bg-white/[0.008] overflow-hidden"
                  style={{ top: 0, height: V_OVERLAY_HEIGHT, width: trackWidthPx }}
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
                    top: V_OVERLAY_HEIGHT + TRACK_GAP,
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
                  top={V_OVERLAY_HEIGHT + TRACK_GAP}
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
                    top: V_OVERLAY_HEIGHT + TRACK_GAP + V_TRACK_HEIGHT + TRACK_GAP,
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

                {/* A2 — music / score track. Procedural soft band that
                    spans the whole timeline width so the user reads
                    "here's where music goes" even when empty. Will
                    render real music clips when the music ingest
                    pipeline lands. */}
                <MusicTrack
                  top={
                    V_OVERLAY_HEIGHT +
                    TRACK_GAP +
                    V_TRACK_HEIGHT +
                    TRACK_GAP +
                    A_TRACK_HEIGHT +
                    TRACK_GAP
                  }
                  height={A_MUSIC_HEIGHT}
                  width={trackWidthPx}
                />

                {/* Playhead spans every track */}
                <Playhead positionPx={playheadPx + 1} trackHeight={TOTAL_TRACK_AREA} />

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
}: {
  clipCount: number;
  totalSec: number;
  pxPerSec: number;
  selectedClipId: string | null;
  tool: import("@/lib/editor/types").TimelineTool;
  snapEnabled: boolean;
  hasInOut: boolean;
  playheadSec: number;
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

      <div className="flex items-center gap-4">
        {/* Zoom */}
        <div className="flex items-center gap-1.5 text-foreground/80">
          <button
            type="button"
            onClick={() => setPxPerSec(pxPerSec / 1.25)}
            className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground/65 hover:text-foreground hover:bg-white/[0.04] transition-colors"
            aria-label="Zoom out"
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
            aria-label="Zoom in"
          >
            <ZoomIn className="h-3.5 w-3.5" strokeWidth={1.5} />
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

  return (
    <div className="relative h-6" style={{ width: totalSec * pxPerSec }}>
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

  const onClipPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    // Modifier keys = multi-select; plain click = single select.
    if (e.shiftKey) {
      extendClipSelection(clip.id);
    } else if (e.metaKey || e.ctrlKey) {
      toggleClipSelection(clip.id);
    } else {
      selectClip(clip.id);
    }
  };

  // Trim with pointer events. We capture the pointer and update the
  // clip's draft duration on move. Commit on up.
  const onTrimPointerDown = (
    e: React.PointerEvent,
    side: "left" | "right",
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.button !== 0) return;
    selectClip(clip.id);
    setTrimming(side);
    draftDurationRef.current = clip.durationSec;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    const startX = e.clientX;
    const startDur = clip.durationSec;

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const deltaSec = dx / pxPerSec;
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
      initial={reducedMotion ? false : { opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.25, ease: EASE_PREMIUM }}
      className={cn(
        "group/clip relative h-full overflow-hidden select-none",
        "rounded-md transition-shadow",
        "ring-1 ring-inset",
        isActive
          ? "ring-accent/85 shadow-[0_8px_24px_-12px_hsl(var(--accent)/0.6)]"
          : isInSelection
            ? "ring-accent/55"
            : "ring-white/[0.08] hover:ring-white/[0.20]",
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
          Extracts sample frames from the clip's video on first
          paint, then renders them as a tiled background image
          strip. Falls back to the static thumbnail while loading. */}
      <ClipFilmstrip
        clipId={clip.id}
        videoUrl={clip.videoUrl}
        durationSec={clip.durationSec}
        widthPx={widthPx}
        fallbackThumbnailUrl={clip.thumbnailUrl}
      />

      {/* Tinted overlay over the filmstrip so the index + duration
          chips stay legible. Stronger when the clip is in active
          state so its frames feel "focused" rather than washed out. */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 pointer-events-none transition-opacity",
          isActive
            ? "bg-gradient-to-b from-[hsl(220_30%_4%/0.20)] to-[hsl(220_30%_4%/0.55)]"
            : "bg-gradient-to-b from-[hsl(220_30%_4%/0.35)] to-[hsl(220_30%_4%/0.75)]",
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
// TrackHeader — left-column label per track with mute/lock toggles.
// Toggles are visual-only for v1 so the editor LOOKS like an NLE
// without committing to behavior that isn't wired yet. The mute/lock
// state will move into the store when V2/A2 actually carry clips.
// ─────────────────────────────────────────────────────────────────────────────
function TrackHeader({
  track,
  addGap,
}: {
  track: TrackDef;
  addGap: boolean;
}) {
  const [muted, setMuted] = useState(false);
  const [locked, setLocked] = useState(false);
  const Icon = track.Icon;
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
        <div className={cn(TYPE_META, "text-foreground/85 tracking-[0.22em] truncate")}>
          {track.label}
        </div>
      </div>
      {track.kind === "audio" && (
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          className={cn(
            "shrink-0 inline-flex items-center justify-center h-5 w-5 rounded transition-colors",
            muted ? "text-rose-300/85" : "text-muted-foreground/45 hover:text-foreground/80",
          )}
          aria-label={muted ? "Unmute track" : "Mute track"}
        >
          {muted ? (
            <VolumeX className="h-3 w-3" strokeWidth={1.6} />
          ) : (
            <Volume2 className="h-3 w-3" strokeWidth={1.6} />
          )}
        </button>
      )}
      <button
        type="button"
        onClick={() => setLocked((l) => !l)}
        className={cn(
          "shrink-0 inline-flex items-center justify-center h-5 w-5 rounded transition-colors",
          locked ? "text-amber-300/85" : "text-muted-foreground/45 hover:text-foreground/80",
        )}
        aria-label={locked ? "Unlock track" : "Lock track"}
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
}: {
  top: number;
  height: number;
  width: number;
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
      <span
        className={cn(
          TYPE_META,
          "absolute left-3 top-1/2 -translate-y-1/2 text-amber-200/55 tracking-[0.30em]",
        )}
      >
        ◆ Music · score
      </span>
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
}: {
  positionPx: number;
  trackHeight: number;
}) {
  return (
    <div
      aria-hidden
      className="absolute top-0 pointer-events-none z-20"
      style={{
        left: positionPx,
        height: trackHeight,
      }}
    >
      {/* Triangle handle */}
      <div
        className="absolute -top-2 -translate-x-1/2"
        style={{ left: 0 }}
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
function EmptyTimeline() {
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
        <p className={cn(TYPE_META, "mt-3 text-muted-foreground/55 max-w-md mx-auto")}>
          Render clips in Studio to populate the timeline
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
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("video/"),
    );
    if (files.length === 0) {
      toast.error("Drop a video file (MP4, MOV, WebM)");
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
