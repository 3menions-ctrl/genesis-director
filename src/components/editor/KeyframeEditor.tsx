import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Plus, Trash2, Diamond, Move, ZoomIn, RotateCw, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Keyframe, TimelineClip } from "./types";

interface KeyframeEditorProps {
  clip: TimelineClip;
  currentTime: number;
  onUpdateClip: (clipId: string, updates: Partial<TimelineClip>) => void;
}

export const KeyframeEditor = ({ clip, currentTime, onUpdateClip }: KeyframeEditorProps) => {
  const keyframes = clip.keyframes || [];
  const clipDuration = clip.end - clip.start;
  const relativeTime = Math.max(0, Math.min(currentTime - clip.start, clipDuration));
  const [selectedKfIndex, setSelectedKfIndex] = useState<number | null>(null);

  const addKeyframe = () => {
    const newKf: Keyframe = { time: relativeTime, properties: { x: 0, y: 0, scale: 100, rotation: 0, opacity: 100 }, easing: "ease-in-out" };
    const updated = [...keyframes, newKf].sort((a, b) => a.time - b.time);
    onUpdateClip(clip.id, { keyframes: updated });
    setSelectedKfIndex(updated.findIndex((k) => k.time === relativeTime));
  };

  const removeKeyframe = (index: number) => {
    onUpdateClip(clip.id, { keyframes: keyframes.filter((_, i) => i !== index) });
    setSelectedKfIndex(null);
  };

  const updateKfProp = (index: number, prop: string, value: number) => {
    const updated = keyframes.map((kf, i) => i === index ? { ...kf, properties: { ...kf.properties, [prop]: value } } : kf);
    onUpdateClip(clip.id, { keyframes: updated });
  };

  const updateKfEasing = (index: number, easing: Keyframe["easing"]) => {
    const updated = keyframes.map((kf, i) => (i === index ? { ...kf, easing } : kf));
    onUpdateClip(clip.id, { keyframes: updated });
  };

  const selectedKf = selectedKfIndex !== null ? keyframes[selectedKfIndex] : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/30">Keyframes</span>
        <Button variant="ghost" size="icon" className="h-5 w-5 text-white hover:text-white hover:bg-white/[0.1] rounded transition-all" onClick={addKeyframe}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      <div className="relative h-8 bg-black/20 rounded-md border border-white/[0.04] overflow-hidden">
        <div className="absolute inset-0 flex">
          {Array.from({ length: 10 }, (_, i) => (<div key={i} className="flex-1 border-r border-white/[0.03]" />))}
        </div>
        {keyframes.map((kf, i) => {
          const pct = (kf.time / clipDuration) * 100;
          return (
            <button key={i}
              className={cn("absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all z-10",
                selectedKfIndex === i ? "text-white scale-125 drop-shadow-[0_0_4px_rgba(255,255,255,0.5)]" : "text-white/30 hover:text-white/70 hover:scale-110")}
              style={{ left: `${pct}%` }} onClick={() => setSelectedKfIndex(i)}>
              <Diamond className="h-3.5 w-3.5" fill={selectedKfIndex === i ? "currentColor" : "none"} />
            </button>
          );
        })}
        <div className="absolute top-0 bottom-0 w-px bg-white/40 z-5" style={{ left: `${(relativeTime / clipDuration) * 100}%` }} />
      </div>

      {keyframes.length === 0 && (
        <p className="text-[10px] text-white/20 text-center py-3">
          No keyframes yet. Click <span className="text-white/60">+</span> to add at playhead.
        </p>
      )}

      {selectedKf && selectedKfIndex !== null && (
        <div className="space-y-2.5 p-2.5 rounded-lg bg-black/20 border border-white/[0.04]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Diamond className="h-2.5 w-2.5 text-white" fill="currentColor" />
              <span className="text-[9px] text-white/40 font-mono">{selectedKf.time.toFixed(2)}s</span>
            </div>
            <Button variant="ghost" size="icon" className="h-4 w-4 text-red-400/40 hover:text-red-400 hover:bg-red-500/10 rounded transition-all"
              onClick={() => removeKeyframe(selectedKfIndex)}>
              <Trash2 className="h-2.5 w-2.5" />
            </Button>
          </div>

          {[
            { key: "x", label: "Position X", icon: Move, min: -500, max: 500 },
            { key: "y", label: "Position Y", icon: Move, min: -500, max: 500 },
            { key: "scale", label: "Scale", icon: ZoomIn, min: 10, max: 300 },
            { key: "rotation", label: "Rotation", icon: RotateCw, min: -360, max: 360 },
            { key: "opacity", label: "Opacity", icon: Eye, min: 0, max: 100 },
          ].map(({ key, label, icon: Icon, min, max }) => (
            <div key={key} className="space-y-0.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Icon className="h-2.5 w-2.5 text-white/30" />
                  <span className="text-[9px] text-white/35">{label}</span>
                </div>
                <span className="text-[8px] tabular-nums text-white/20 font-mono">
                  {(selectedKf.properties as any)[key] ?? 0}
                </span>
              </div>
              <Slider
                value={[(selectedKf.properties as any)[key] ?? (key === "scale" || key === "opacity" ? 100 : 0)]}
                min={min} max={max} step={key === "opacity" || key === "scale" ? 1 : 0.5}
                onValueChange={([v]) => updateKfProp(selectedKfIndex, key, v)} className="h-3"
              />
            </div>
          ))}

          <div className="flex gap-0.5 mt-1">
            {(["linear", "ease-in", "ease-out", "ease-in-out"] as const).map((e) => (
              <button key={e}
                className={cn("px-2 py-0.5 rounded text-[8px] transition-all font-medium",
                  selectedKf.easing === e ? "bg-white text-black font-semibold" : "text-white/20 hover:text-white hover:bg-white/[0.06]")}
                onClick={() => updateKfEasing(selectedKfIndex, e)}>
                {e}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/** Interpolate keyframe properties at a given time */
export function interpolateKeyframes(keyframes: Keyframe[], time: number) {
  if (!keyframes.length) return { x: 0, y: 0, scale: 100, rotation: 0, opacity: 100 };
  if (time <= keyframes[0].time) return { x: 0, y: 0, scale: 100, rotation: 0, opacity: 100, ...keyframes[0].properties };
  if (time >= keyframes[keyframes.length - 1].time)
    return { x: 0, y: 0, scale: 100, rotation: 0, opacity: 100, ...keyframes[keyframes.length - 1].properties };

  let a = keyframes[0], b = keyframes[1];
  for (let i = 0; i < keyframes.length - 1; i++) {
    if (time >= keyframes[i].time && time <= keyframes[i + 1].time) { a = keyframes[i]; b = keyframes[i + 1]; break; }
  }

  const t = (time - a.time) / (b.time - a.time);
  const eased = applyEasing(t, b.easing || "linear");
  const lerp = (from: number, to: number) => from + (to - from) * eased;

  return {
    x: lerp(a.properties.x ?? 0, b.properties.x ?? 0),
    y: lerp(a.properties.y ?? 0, b.properties.y ?? 0),
    scale: lerp(a.properties.scale ?? 100, b.properties.scale ?? 100),
    rotation: lerp(a.properties.rotation ?? 0, b.properties.rotation ?? 0),
    opacity: lerp(a.properties.opacity ?? 100, b.properties.opacity ?? 100),
  };
}

function applyEasing(t: number, easing: string): number {
  switch (easing) {
    case "ease-in": return t * t;
    case "ease-out": return t * (2 - t);
    case "ease-in-out": return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    default: return t;
  }
}