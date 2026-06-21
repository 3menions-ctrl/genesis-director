/**
 * TextOverlayTrack — V3 row on the timeline showing project.textOverlays
 * as drag-able bars.
 *
 * Three interactions on each bar:
 *   • Drag the body to move (changes startSec)
 *   • Drag the right edge to trim (changes durationSec)
 *   • Click to focus the right rail's Text tab on this overlay
 *
 * Drop target: the row accepts drag-and-drop from TextStudio preset
 * tiles (transferData: text/x-overlay-template). Drop at cursor X
 * instantiates the preset at that startSec.
 *
 * Why this lives in its own file: keeps Timeline.tsx focused on V1/V2
 * and avoids any bundler hoisting ambiguity when the component is
 * referenced inside Timeline's JSX.
 */
import { useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TYPE_META } from "@/lib/design-system";
import type { TextOverlay } from "@/lib/editor/text-overlays";
import { TEXT_TEMPLATES } from "@/lib/editor/text-overlays";
import { addTextOverlay, updateTextOverlay } from "@/lib/editor/store";

interface Props {
  overlays: TextOverlay[];
  pxPerSec: number;
  trackWidthPx: number;
  top: number;
  height: number;
  totalSec: number;
  onSelect: (id: string) => void;
}

export function TextOverlayTrack({
  overlays, pxPerSec, trackWidthPx, top, height, totalSec, onSelect,
}: Props) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [dropX, setDropX] = useState<number | null>(null);

  const onDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes("text/x-overlay-template")) return;
    e.preventDefault();
    const rect = trackRef.current?.getBoundingClientRect();
    if (rect) setDropX(e.clientX - rect.left);
  };
  const onDragLeave = () => setDropX(null);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDropX(null);
    const templateId = e.dataTransfer.getData("text/x-overlay-template");
    if (!templateId) return;
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const startSec = Math.max(0, Math.min(totalSec, x / pxPerSec));
    const t = TEXT_TEMPLATES.find((x) => x.id === templateId);
    if (!t) return;
    const o = t.build("Your text here", startSec);
    addTextOverlay(o);
    onSelect(o.id);
    toast.success(`${t.name} dropped at ${fmtTimecodeShort(startSec)}`);
  };

  return (
    <div
      ref={trackRef}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className="absolute left-0 right-0 rounded-md border border-dashed border-white/[0.05] bg-white/[0.005] overflow-visible"
      style={{ top, height, width: trackWidthPx }}
    >
      {overlays.length === 0 && (
        <span className={cn(TYPE_META, "absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/30 tracking-[0.30em]")}>
          V3 · drag a text preset here from the right rail
        </span>
      )}
      {overlays.map((o) => (
        <TextOverlayBar
          key={o.id}
          overlay={o}
          pxPerSec={pxPerSec}
          height={height}
          totalSec={totalSec}
          onSelect={onSelect}
        />
      ))}
      {dropX !== null && (
        <div
          className="absolute top-0 bottom-0 w-px bg-accent pointer-events-none"
          style={{ left: dropX, boxShadow: "0 0 10px hsl(var(--accent) / 0.85)" }}
        />
      )}
    </div>
  );
}

function TextOverlayBar({
  overlay: o, pxPerSec, height, totalSec, onSelect,
}: {
  overlay: TextOverlay;
  pxPerSec: number;
  height: number;
  totalSec: number;
  onSelect: (id: string) => void;
}) {
  const leftPx = o.startSec * pxPerSec;
  const widthPx = Math.max(24, o.durationSec * pxPerSec);

  const onBodyPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const startX = e.clientX;
    const initialStart = o.startSec;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const candidate = Math.max(0, Math.min(totalSec - o.durationSec, initialStart + dx / pxPerSec));
      updateTextOverlay(o.id, { startSec: candidate });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const onTrimPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const initialDur = o.durationSec;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const candidate = Math.max(0.2, Math.min(totalSec - o.startSec, initialDur + dx / pxPerSec));
      updateTextOverlay(o.id, { durationSec: candidate });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(e) => { e.stopPropagation(); onSelect(o.id); }}
      onPointerDown={onBodyPointerDown}
      title={o.text}
      className={cn(
        "absolute rounded-md ring-1 ring-inset transition-all cursor-grab active:cursor-grabbing select-none",
        "bg-gradient-to-br from-[hsl(45_95%_60%/0.18)] to-[hsl(45_95%_60%/0.06)]",
        "ring-amber-300/30 hover:ring-amber-300/55",
      )}
      style={{
        left: leftPx,
        top: 2,
        width: widthPx,
        height: height - 4,
      }}
    >
      <div className="absolute inset-0 flex items-center gap-2 px-2 overflow-hidden">
        <span className="text-amber-200/80 text-[10px] font-mono uppercase tracking-[0.22em] shrink-0">◆</span>
        <span className="text-amber-50 text-[11px] truncate">{o.text || "(empty)"}</span>
      </div>
      <div
        onPointerDown={onTrimPointerDown}
        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-amber-300/60 transition-colors"
        title="Drag to trim"
      />
    </div>
  );
}

function fmtTimecodeShort(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
