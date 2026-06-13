/**
 * StatusBar — persistent bottom bar that holds every "at a glance"
 * datum the user wants to see without moving their eyes off the
 * timeline: timecode, selection count, undo state, snap state, zoom,
 * project meta, presence, render queue health.
 *
 * Pure typography. Floats over the SpineBackdrop with a hairline
 * top border. Mono numerals everywhere a number lives.
 */
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { TYPE_META } from "@/lib/design-system";
import { Eye, ListChecks, Undo2, Redo2, Magnet, Layers } from "lucide-react";
import type { EditorProject } from "@/lib/editor/types";
import { ASPECT_RATIOS } from "@/lib/editor/types";
import { useEditor } from "@/hooks/editor/useEditor";
import { useRenderQueue } from "@/hooks/editor/useRenderQueue";

interface Props {
  project: EditorProject;
  playheadSec: number;
  selectedClipIds: string[];
  presenceCount: number;
}

function fmtTC(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ff = Math.floor((sec - Math.floor(sec)) * 30);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}:${ff.toString().padStart(2, "0")}`;
}

export function StatusBar({
  project,
  playheadSec,
  selectedClipIds,
  presenceCount,
}: Props) {
  const { history, snapEnabled, pxPerSec, tool } = useEditor();
  const { jobs } = useRenderQueue();

  const renderingCount = useMemo(
    () =>
      jobs.filter((j) => j.status === "queued" || j.status === "rendering")
        .length,
    [jobs],
  );

  const aspect = ASPECT_RATIOS[project.aspectRatio];

  return (
    <footer
      role="status"
      aria-label="Editor status"
      className={cn(
        "shrink-0 flex items-center justify-between gap-4 px-4 py-2",
        "border-t border-white/[0.06] bg-[hsl(220_30%_4%/0.55)] backdrop-blur",
      )}
      style={{ height: 32 }}
    >
      {/* Left cluster — selection / project meta */}
      <div className="flex items-center gap-4 min-w-0">
        <span className={cn(TYPE_META, "text-muted-foreground/55 flex items-center gap-1.5")}>
          <Layers className="h-3 w-3" strokeWidth={1.5} />
          <span className="font-mono tabular-nums text-foreground/80">
            {project.scenes.length}
          </span>
          <span className="text-muted-foreground/45">scenes</span>
        </span>
        <span className={cn(TYPE_META, "text-muted-foreground/55 flex items-center gap-1.5")}>
          <span className="font-mono tabular-nums text-foreground/80">
            {project.scenes.reduce((sum, s) => sum + s.clips.length, 0)}
          </span>
          <span className="text-muted-foreground/45">clips</span>
        </span>
        <span className={cn(TYPE_META, "text-muted-foreground/55 flex items-center gap-1.5")}>
          {selectedClipIds.length > 0 && (
            <>
              <span className="font-mono tabular-nums text-accent">
                {selectedClipIds.length}
              </span>
              <span className="text-accent/70">selected</span>
            </>
          )}
          {selectedClipIds.length === 0 && (
            <span className="text-muted-foreground/35">—</span>
          )}
        </span>
      </div>

      {/* Center — timecode (the most-glanced datum, so it gets prominence) */}
      <div className="flex items-center gap-3">
        <div className={cn("font-mono tabular-nums text-[13px] text-foreground")}>
          {fmtTC(playheadSec)}
        </div>
        <span className="text-muted-foreground/35">/</span>
        <div className={cn("font-mono tabular-nums text-[12px] text-muted-foreground/65")}>
          {fmtTC(project.durationSec)}
        </div>
      </div>

      {/* Right cluster — tool / snap / undo / zoom / aspect / presence / render */}
      <div className="flex items-center gap-3 min-w-0">
        <span className={cn(TYPE_META, "text-muted-foreground/60 font-mono uppercase")}>
          {tool}
        </span>

        <span
          className={cn(
            "inline-flex items-center gap-1",
            snapEnabled ? "text-accent" : "text-muted-foreground/35",
          )}
          title={snapEnabled ? "Snap on" : "Snap off"}
        >
          <Magnet className="h-3 w-3" strokeWidth={1.5} />
        </span>

        <span
          className={cn(
            "inline-flex items-center gap-0.5",
            history.past.length > 0 ? "text-foreground/75" : "text-muted-foreground/30",
          )}
          title={`${history.past.length} undo · ${history.future.length} redo`}
        >
          <Undo2 className="h-3 w-3" strokeWidth={1.5} />
          <span className={cn(TYPE_META, "font-mono tabular-nums")}>
            {history.past.length}
          </span>
          <Redo2
            className={cn(
              "h-3 w-3 ml-1",
              history.future.length > 0 ? "text-foreground/75" : "text-muted-foreground/30",
            )}
            strokeWidth={1.5}
          />
          <span className={cn(TYPE_META, "font-mono tabular-nums")}>
            {history.future.length}
          </span>
        </span>

        <span className={cn(TYPE_META, "text-muted-foreground/55 font-mono tabular-nums")}>
          {Math.round(pxPerSec)} px/s
        </span>

        <span className={cn(TYPE_META, "text-muted-foreground/55 font-mono")}>
          {project.aspectRatio}{" "}
          <span className="text-muted-foreground/40">{aspect.label.toLowerCase()}</span>
        </span>

        {presenceCount > 1 && (
          <span className="inline-flex items-center gap-1 text-accent">
            <Eye className="h-3 w-3" strokeWidth={1.5} />
            <span className={cn(TYPE_META, "font-mono tabular-nums")}>
              {presenceCount}
            </span>
          </span>
        )}

        {renderingCount > 0 && (
          <span className="inline-flex items-center gap-1 text-accent">
            <ListChecks className="h-3 w-3" strokeWidth={1.5} />
            <span className={cn(TYPE_META, "font-mono tabular-nums")}>
              {renderingCount}
            </span>
          </span>
        )}
      </div>
    </footer>
  );
}
