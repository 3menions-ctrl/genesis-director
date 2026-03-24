/**
 * KeyframePanel — Animate clip properties over time with keyframes
 * Position, scale, rotation, opacity, volume with visual timeline
 */

import { memo, useCallback, useState } from "react";
import { Diamond, Plus, Trash2, Move, Maximize, RotateCw, Eye, Volume2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { useCustomTimeline, ClipKeyframe } from "@/hooks/useCustomTimeline";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type AnimProperty = ClipKeyframe["property"];

const PROPERTIES: { key: AnimProperty; label: string; icon: React.ReactNode; min: number; max: number; step: number; unit: string; default: number }[] = [
  { key: "posX", label: "Position X", icon: <span className="text-[8px] font-mono text-[hsla(0,100%,60%,0.7)]">X</span>, min: -100, max: 100, step: 1, unit: "%", default: 0 },
  { key: "posY", label: "Position Y", icon: <span className="text-[8px] font-mono text-[hsla(120,100%,60%,0.7)]">Y</span>, min: -100, max: 100, step: 1, unit: "%", default: 0 },
  { key: "scale", label: "Scale", icon: <Maximize className="w-3 h-3" />, min: 0.1, max: 4, step: 0.01, unit: "×", default: 1 },
  { key: "rotation", label: "Rotation", icon: <RotateCw className="w-3 h-3" />, min: -360, max: 360, step: 1, unit: "°", default: 0 },
  { key: "opacity", label: "Opacity", icon: <Eye className="w-3 h-3" />, min: 0, max: 1, step: 0.01, unit: "", default: 1 },
  { key: "volume", label: "Volume", icon: <Volume2 className="w-3 h-3" />, min: 0, max: 1, step: 0.01, unit: "", default: 1 },
];

const EASINGS: { value: ClipKeyframe["easing"]; label: string }[] = [
  { value: "linear", label: "Linear" },
  { value: "ease-in", label: "Ease In" },
  { value: "ease-out", label: "Ease Out" },
  { value: "ease-in-out", label: "Ease I/O" },
];

export const KeyframePanel = memo(function KeyframePanel() {
  const { state, dispatch } = useCustomTimeline();
  const track = state.tracks.find(t => t.id === state.selectedTrackId);
  const clip = track?.clips.find(c => c.id === state.selectedClipId);
  const [selectedProp, setSelectedProp] = useState<AnimProperty>("posX");
  const [selectedEasing, setSelectedEasing] = useState<ClipKeyframe["easing"]>("ease-in-out");

  const keyframes = clip?.keyframes || [];
  const clipDuration = clip ? clip.end - clip.start : 0;
  const propKeyframes = keyframes.filter(k => k.property === selectedProp).sort((a, b) => a.time - b.time);
  const currentRelTime = clip ? Math.max(0, Math.min(state.playheadTime - clip.start, clipDuration)) : 0;

  const update = useCallback((updates: Partial<typeof clip>) => {
    if (!state.selectedClipId || !state.selectedTrackId) return;
    dispatch({ type: "UPDATE_CLIP", trackId: state.selectedTrackId, clipId: state.selectedClipId, updates: updates as any });
  }, [state.selectedClipId, state.selectedTrackId, dispatch]);

  const addKeyframe = useCallback(() => {
    if (!clip) return;
    const prop = PROPERTIES.find(p => p.key === selectedProp)!;
    const currentVal = (clip as any)[selectedProp] ?? prop.default;
    const kf: ClipKeyframe = {
      id: `kf-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      time: currentRelTime,
      property: selectedProp,
      value: currentVal,
      easing: selectedEasing,
    };
    update({ keyframes: [...keyframes, kf] });
    toast.success(`Keyframe added at ${currentRelTime.toFixed(1)}s`);
  }, [clip, selectedProp, currentRelTime, selectedEasing, keyframes, update]);

  const removeKeyframe = useCallback((kfId: string) => {
    update({ keyframes: keyframes.filter(k => k.id !== kfId) });
  }, [keyframes, update]);

  const updateKeyframe = useCallback((kfId: string, updates: Partial<ClipKeyframe>) => {
    update({ keyframes: keyframes.map(k => k.id === kfId ? { ...k, ...updates } : k) });
  }, [keyframes, update]);

  if (!clip) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-3">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "hsla(30,100%,50%,0.06)", border: "1px dashed hsla(30,100%,50%,0.12)" }}>
          <Diamond className="w-6 h-6 text-[hsla(30,100%,50%,0.25)]" />
        </div>
        <p className="text-[11px] font-semibold text-[hsla(0,0%,100%,0.35)]">No Clip Selected</p>
        <p className="text-[9px] text-[hsla(0,0%,100%,0.2)] text-center max-w-[180px]">Select a clip to animate with keyframes</p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 min-h-0">
      <div className="p-2.5 space-y-2.5">
        {/* Property Selector */}
        <div className="rounded-xl overflow-hidden" style={{ background: "hsla(0,0%,100%,0.02)", border: "1px solid hsla(0,0%,100%,0.05)" }}>
          <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: "1px solid hsla(0,0%,100%,0.04)" }}>
            <Diamond className="w-3 h-3 text-[hsla(30,100%,50%,0.6)]" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-[hsla(0,0%,100%,0.45)]">Property</span>
          </div>
          <div className="p-2 grid grid-cols-3 gap-1">
            {PROPERTIES.map(p => (
              <button
                key={p.key}
                onClick={() => setSelectedProp(p.key)}
                className={cn(
                  "flex items-center justify-center gap-1 py-2 rounded-lg text-[9px] font-semibold transition-all",
                  selectedProp === p.key
                    ? "bg-[hsla(30,100%,50%,0.15)] text-[hsl(30,100%,65%)] border border-[hsla(30,100%,50%,0.3)]"
                    : "text-[hsla(0,0%,100%,0.4)] hover:text-[hsla(0,0%,100%,0.7)] hover:bg-[hsla(0,0%,100%,0.04)] border border-transparent"
                )}
              >
                {p.icon}
                <span className="hidden xl:inline">{p.label.split(" ").pop()}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Easing Selector */}
        <div className="rounded-xl overflow-hidden" style={{ background: "hsla(0,0%,100%,0.02)", border: "1px solid hsla(0,0%,100%,0.05)" }}>
          <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: "1px solid hsla(0,0%,100%,0.04)" }}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[hsla(0,0%,100%,0.45)]">Easing</span>
          </div>
          <div className="p-2 flex gap-1">
            {EASINGS.map(e => (
              <button
                key={e.value}
                onClick={() => setSelectedEasing(e.value)}
                className={cn(
                  "flex-1 py-1.5 rounded-lg text-[9px] font-semibold transition-all",
                  selectedEasing === e.value
                    ? "bg-[hsla(215,100%,50%,0.15)] text-[hsl(215,100%,70%)] border border-[hsla(215,100%,50%,0.3)]"
                    : "text-[hsla(0,0%,100%,0.4)] hover:bg-[hsla(0,0%,100%,0.04)] border border-transparent"
                )}
              >
                {e.label}
              </button>
            ))}
          </div>
        </div>

        {/* Add Keyframe Button */}
        <button
          onClick={addKeyframe}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-bold transition-all bg-[hsla(30,100%,50%,0.12)] text-[hsl(30,100%,65%)] hover:bg-[hsla(30,100%,50%,0.2)] border border-[hsla(30,100%,50%,0.2)]"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Keyframe at {currentRelTime.toFixed(1)}s
        </button>

        {/* Visual Keyframe Lane */}
        <div className="rounded-xl overflow-hidden" style={{ background: "hsla(0,0%,100%,0.02)", border: "1px solid hsla(0,0%,100%,0.05)" }}>
          <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: "1px solid hsla(0,0%,100%,0.04)" }}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[hsla(0,0%,100%,0.45)]">
              {PROPERTIES.find(p => p.key === selectedProp)?.label} — {propKeyframes.length} keyframes
            </span>
          </div>
          <div className="p-3">
            {/* Mini timeline */}
            <div className="relative h-8 rounded-lg overflow-hidden" style={{ background: "hsla(0,0%,100%,0.03)", border: "1px solid hsla(0,0%,100%,0.05)" }}>
              {/* Playhead indicator */}
              <div className="absolute top-0 bottom-0 w-px bg-[hsl(215,100%,60%)]" style={{ left: `${clipDuration > 0 ? (currentRelTime / clipDuration) * 100 : 0}%` }} />
              {/* Keyframe diamonds */}
              {propKeyframes.map(kf => (
                <button
                  key={kf.id}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-[hsl(30,100%,55%)] hover:bg-[hsl(30,100%,65%)] border border-[hsla(30,100%,50%,0.5)] transition-all hover:scale-125 shadow-lg"
                  style={{ left: `${clipDuration > 0 ? (kf.time / clipDuration) * 100 : 0}%` }}
                  title={`t=${kf.time.toFixed(1)}s val=${kf.value.toFixed(2)}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Keyframe List */}
        {propKeyframes.length > 0 && (
          <div className="rounded-xl overflow-hidden" style={{ background: "hsla(0,0%,100%,0.02)", border: "1px solid hsla(0,0%,100%,0.05)" }}>
            <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: "1px solid hsla(0,0%,100%,0.04)" }}>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[hsla(0,0%,100%,0.45)]">Edit Keyframes</span>
            </div>
            <div className="p-2 space-y-1">
              {propKeyframes.map(kf => {
                const prop = PROPERTIES.find(p => p.key === selectedProp)!;
                return (
                  <div key={kf.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-[hsla(0,0%,100%,0.02)] border border-[hsla(0,0%,100%,0.04)]">
                    <Diamond className="w-2.5 h-2.5 text-[hsl(30,100%,55%)]" />
                    <span className="text-[9px] font-mono text-[hsla(0,0%,100%,0.5)] w-10">{kf.time.toFixed(1)}s</span>
                    <div className="flex-1">
                      <Slider
                        value={[kf.value]}
                        onValueChange={([v]) => updateKeyframe(kf.id, { value: v })}
                        min={prop.min} max={prop.max} step={prop.step}
                        className="w-full"
                      />
                    </div>
                    <span className="text-[8px] font-mono text-[hsla(215,100%,60%,0.7)] w-8 text-right">
                      {kf.value.toFixed(prop.step < 1 ? 2 : 0)}{prop.unit}
                    </span>
                    <button onClick={() => removeKeyframe(kf.id)} className="text-[hsla(0,70%,50%,0.5)] hover:text-[hsla(0,70%,50%,0.9)] transition-colors">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
});
