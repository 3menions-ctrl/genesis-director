import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TimelineClip } from "./types";

interface ChromaKeyPanelProps {
  clip: TimelineClip;
  onUpdateClip: (clipId: string, updates: Partial<TimelineClip>) => void;
}

const COLOR_PRESETS = [
  { label: "Green", color: "#00FF00" },
  { label: "Blue", color: "#0000FF" },
  { label: "White", color: "#FFFFFF" },
  { label: "Black", color: "#000000" },
];

export const ChromaKeyPanel = ({ clip, onUpdateClip }: ChromaKeyPanelProps) => {
  const chroma = clip.chromaKey || { enabled: false, color: "#00FF00", similarity: 40, smoothness: 10 };

  const update = (updates: Partial<typeof chroma>) => {
    onUpdateClip(clip.id, { chromaKey: { ...chroma, ...updates } });
  };

  const reset = () => {
    onUpdateClip(clip.id, { chromaKey: { enabled: false, color: "#00FF00", similarity: 40, smoothness: 10 } });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/30">Green Screen</span>
        <Button
          variant="ghost" size="icon"
          className={cn("h-5 w-5 rounded transition-all", chroma.enabled ? "text-white hover:text-white hover:bg-white/[0.1]" : "text-white/15")}
          onClick={reset} disabled={!chroma.enabled}
        >
          <RotateCcw className="h-2.5 w-2.5" />
        </Button>
      </div>

      {/* Toggle */}
      <button
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2.5 rounded-md border transition-all text-[10px]",
          chroma.enabled
            ? "bg-white text-black border-white/20 font-semibold"
            : "bg-white/[0.03] border-white/[0.06] text-white/40 hover:text-white hover:bg-white/[0.06]"
        )}
        onClick={() => update({ enabled: !chroma.enabled })}
      >
        <div className="w-3.5 h-3.5 rounded-sm border" style={{ backgroundColor: chroma.color, borderColor: 'rgba(255,255,255,0.2)' }} />
        {chroma.enabled ? "Chroma Key Active" : "Enable Chroma Key"}
      </button>

      {chroma.enabled && (
        <>
          {/* Key color */}
          <div className="space-y-1.5">
            <span className="text-[9px] text-white/30 uppercase tracking-[0.15em] font-semibold">Key Color</span>
            <div className="flex gap-1">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  className={cn(
                    "flex-1 flex flex-col items-center gap-1 py-1.5 rounded-md border transition-all",
                    chroma.color === preset.color ? "border-white/30 bg-white/[0.06]" : "border-white/[0.04] hover:border-white/[0.1]"
                  )}
                  onClick={() => update({ color: preset.color })}
                >
                  <div className="w-4 h-4 rounded-sm border border-white/20" style={{ backgroundColor: preset.color }} />
                  <span className="text-[7px] text-white/30">{preset.label}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-1">
              <input
                type="color" value={chroma.color}
                onChange={(e) => update({ color: e.target.value })}
                className="w-7 h-7 rounded border border-white/10 cursor-pointer bg-transparent"
              />
              <Input
                value={chroma.color}
                onChange={(e) => update({ color: e.target.value })}
                className="flex-1 h-7 text-[10px] bg-white/[0.03] border-white/[0.06] text-white/50 font-mono"
              />
            </div>
          </div>

          {/* Similarity */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-white/30">Similarity</span>
              <span className="text-[9px] tabular-nums font-mono text-white/20">{chroma.similarity}%</span>
            </div>
            <Slider value={[chroma.similarity]} min={0} max={100} step={1} onValueChange={([v]) => update({ similarity: v })} className="h-4" />
          </div>

          {/* Smoothness */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-white/30">Edge Smoothness</span>
              <span className="text-[9px] tabular-nums font-mono text-white/20">{chroma.smoothness}%</span>
            </div>
            <Slider value={[chroma.smoothness]} min={0} max={100} step={1} onValueChange={([v]) => update({ smoothness: v })} className="h-4" />
          </div>

          <p className="text-[8px] text-white/20 px-1">
            Chroma keying removes the selected color from the video, creating a transparent background. Applied during export.
          </p>
        </>
      )}
    </div>
  );
};
