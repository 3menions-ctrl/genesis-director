/**
 * CompositorPanel — Multi-track compositing controls
 * Blend modes, transform (position/scale/rotation), z-ordering
 */

import { memo, useCallback } from "react";
import {
  Layers, Move, RotateCw, Maximize, ArrowUp, ArrowDown, Blend,
  FlipHorizontal, Square, Anchor
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { useCustomTimeline, TimelineClip } from "@/hooks/useCustomTimeline";
import { cn } from "@/lib/utils";

const BLEND_MODES: { value: NonNullable<TimelineClip["blendMode"]>; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "multiply", label: "Multiply" },
  { value: "screen", label: "Screen" },
  { value: "overlay", label: "Overlay" },
  { value: "softlight", label: "Soft Light" },
  { value: "hardlight", label: "Hard Light" },
  { value: "difference", label: "Difference" },
  { value: "add", label: "Add" },
];

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "hsla(0,0%,100%,0.02)", border: "1px solid hsla(0,0%,100%,0.05)" }}>
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: "1px solid hsla(0,0%,100%,0.04)" }}>
        <span className="text-[hsla(215,100%,60%,0.6)]">{icon}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-[hsla(0,0%,100%,0.45)]">{title}</span>
      </div>
      <div className="p-3 space-y-3">{children}</div>
    </div>
  );
}

function TransformSlider({ label, value, min, max, step, unit, onChange, icon }: {
  label: string; value: number; min: number; max: number; step: number; unit: string;
  onChange: (v: number) => void; icon?: React.ReactNode;
}) {
  const displayVal = unit === "°" ? `${value.toFixed(0)}${unit}` : unit === "%" ? `${value.toFixed(0)}${unit}` : `${value.toFixed(2)}`;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-[hsla(0,0%,100%,0.4)] flex items-center gap-1">{icon}{label}</span>
        <span className="text-[9px] font-mono text-[hsla(215,100%,60%,0.7)] px-1.5 py-0.5 rounded-md bg-[hsla(215,100%,50%,0.08)]">{displayVal}</span>
      </div>
      <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={min} max={max} step={step} className="w-full" />
    </div>
  );
}

export const CompositorPanel = memo(function CompositorPanel() {
  const { state, dispatch } = useCustomTimeline();
  const track = state.tracks.find(t => t.id === state.selectedTrackId);
  const clip = track?.clips.find(c => c.id === state.selectedClipId);

  const update = useCallback((updates: Partial<TimelineClip>) => {
    if (!state.selectedClipId || !state.selectedTrackId) return;
    dispatch({ type: "UPDATE_CLIP", trackId: state.selectedTrackId, clipId: state.selectedClipId, updates });
  }, [state.selectedClipId, state.selectedTrackId, dispatch]);

  if (!clip) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-3">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "hsla(215,100%,50%,0.06)", border: "1px dashed hsla(215,100%,50%,0.12)" }}>
          <Layers className="w-6 h-6 text-[hsla(215,100%,60%,0.25)]" />
        </div>
        <p className="text-[11px] font-semibold text-[hsla(0,0%,100%,0.35)]">No Clip Selected</p>
        <p className="text-[9px] text-[hsla(0,0%,100%,0.2)] text-center max-w-[180px]">Select a clip to access compositing controls</p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 min-h-0">
      <div className="p-2.5 space-y-2.5">
        {/* Blend Mode */}
        <Section title="Blend Mode" icon={<Blend className="w-3 h-3" />}>
          <div className="grid grid-cols-2 gap-1">
            {BLEND_MODES.map(bm => (
              <button
                key={bm.value}
                onClick={() => update({ blendMode: bm.value })}
                className={cn(
                  "py-1.5 rounded-lg text-[10px] font-medium transition-all",
                  (clip.blendMode || "normal") === bm.value
                    ? "bg-[hsla(215,100%,50%,0.2)] text-[hsl(215,100%,70%)] shadow-sm border border-[hsla(215,100%,50%,0.3)]"
                    : "text-[hsla(0,0%,100%,0.4)] hover:text-[hsla(0,0%,100%,0.7)] hover:bg-[hsla(0,0%,100%,0.05)] border border-[hsla(0,0%,100%,0.04)]"
                )}
              >
                {bm.label}
              </button>
            ))}
          </div>
        </Section>

        {/* Transform */}
        <Section title="Transform" icon={<Move className="w-3 h-3" />}>
          <div className="grid grid-cols-2 gap-3">
            <TransformSlider label="X" value={clip.posX ?? 0} min={-100} max={100} step={1} unit="%" onChange={v => update({ posX: v })} icon={<span className="text-[8px] font-mono text-[hsla(0,100%,60%,0.6)]">X</span>} />
            <TransformSlider label="Y" value={clip.posY ?? 0} min={-100} max={100} step={1} unit="%" onChange={v => update({ posY: v })} icon={<span className="text-[8px] font-mono text-[hsla(120,100%,60%,0.6)]">Y</span>} />
          </div>
          <TransformSlider label="Scale" value={(clip.scale ?? 1) * 100} min={10} max={400} step={1} unit="%" onChange={v => update({ scale: v / 100 })} icon={<Maximize className="w-2.5 h-2.5" />} />
          <TransformSlider label="Rotation" value={clip.rotation ?? 0} min={-360} max={360} step={1} unit="°" onChange={v => update({ rotation: v })} icon={<RotateCw className="w-2.5 h-2.5" />} />
          <div className="flex items-center gap-1 pt-1">
            <button onClick={() => update({ posX: 0, posY: 0, scale: 1, rotation: 0 })} className="flex-1 py-1.5 rounded-lg text-[9px] font-semibold text-[hsla(0,0%,100%,0.4)] hover:text-[hsla(0,0%,100%,0.7)] bg-[hsla(0,0%,100%,0.03)] hover:bg-[hsla(0,0%,100%,0.06)] border border-[hsla(0,0%,100%,0.05)] transition-all">Reset Transform</button>
          </div>
        </Section>

        {/* Z-Order */}
        <Section title="Layer Order" icon={<Layers className="w-3 h-3" />}>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-[hsla(0,0%,100%,0.4)] flex-1">Z-Index</span>
            <span className="text-[10px] font-mono text-[hsla(215,100%,60%,0.7)] px-2 py-0.5 rounded-md bg-[hsla(215,100%,50%,0.08)]">{clip.zIndex ?? 0}</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => update({ zIndex: (clip.zIndex ?? 0) + 1 })} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[9px] font-semibold text-[hsla(0,0%,100%,0.5)] hover:text-[hsla(0,0%,100%,0.8)] bg-[hsla(0,0%,100%,0.03)] hover:bg-[hsla(0,0%,100%,0.06)] border border-[hsla(0,0%,100%,0.05)] transition-all">
              <ArrowUp className="w-3 h-3" />Bring Forward
            </button>
            <button onClick={() => update({ zIndex: Math.max(0, (clip.zIndex ?? 0) - 1) })} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[9px] font-semibold text-[hsla(0,0%,100%,0.5)] hover:text-[hsla(0,0%,100%,0.8)] bg-[hsla(0,0%,100%,0.03)] hover:bg-[hsla(0,0%,100%,0.06)] border border-[hsla(0,0%,100%,0.05)] transition-all">
              <ArrowDown className="w-3 h-3" />Send Back
            </button>
          </div>
        </Section>
      </div>
    </ScrollArea>
  );
});
