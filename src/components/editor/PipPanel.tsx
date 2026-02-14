import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { RotateCcw, PictureInPicture2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TimelineClip } from "./types";

interface PipPanelProps {
  clip: TimelineClip;
  onUpdateClip: (clipId: string, updates: Partial<TimelineClip>) => void;
}

const PIP_PRESETS = [
  { label: "Top-Left", x: 5, y: 5, w: 30, h: 30 },
  { label: "Top-Right", x: 65, y: 5, w: 30, h: 30 },
  { label: "Bottom-Left", x: 5, y: 65, w: 30, h: 30 },
  { label: "Bottom-Right", x: 65, y: 65, w: 30, h: 30 },
  { label: "Center Small", x: 35, y: 35, w: 30, h: 30 },
  { label: "Side-by-Side", x: 50, y: 0, w: 50, h: 100 },
];

export const PipPanel = ({ clip, onUpdateClip }: PipPanelProps) => {
  const pip = clip.pip || { enabled: false, x: 65, y: 65, width: 30, height: 30 };

  const update = (updates: Partial<typeof pip>) => {
    onUpdateClip(clip.id, { pip: { ...pip, ...updates } });
  };

  const reset = () => {
    onUpdateClip(clip.id, { pip: { enabled: false, x: 65, y: 65, width: 30, height: 30 } });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/30">Picture in Picture</span>
        <Button
          variant="ghost" size="icon"
          className={cn("h-5 w-5 rounded transition-all", pip.enabled ? "text-white hover:text-white hover:bg-white/[0.1]" : "text-white/15")}
          onClick={reset} disabled={!pip.enabled}
        >
          <RotateCcw className="h-2.5 w-2.5" />
        </Button>
      </div>

      {/* Toggle */}
      <button
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2.5 rounded-md border transition-all text-[10px]",
          pip.enabled
            ? "bg-white text-black border-white/20 font-semibold"
            : "bg-white/[0.03] border-white/[0.06] text-white/40 hover:text-white hover:bg-white/[0.06]"
        )}
        onClick={() => update({ enabled: !pip.enabled })}
      >
        <PictureInPicture2 className="h-3.5 w-3.5" />
        {pip.enabled ? "PiP Enabled" : "Enable PiP Mode"}
      </button>

      {pip.enabled && (
        <>
          {/* Visual preview */}
          <div className="aspect-video bg-black/30 rounded-md border border-white/[0.06] relative overflow-hidden">
            <div className="absolute inset-0 bg-white/[0.02]" />
            <div
              className="absolute bg-white/20 border border-white/40 rounded-sm transition-all"
              style={{
                left: `${pip.x}%`,
                top: `${pip.y}%`,
                width: `${pip.width}%`,
                height: `${pip.height}%`,
              }}
            >
              <span className="absolute inset-0 flex items-center justify-center text-[7px] text-white/60 font-mono">PiP</span>
            </div>
          </div>

          {/* Presets */}
          <div className="grid grid-cols-3 gap-0.5">
            {PIP_PRESETS.map((preset) => (
              <button
                key={preset.label}
                className="px-1.5 py-1 rounded text-[8px] text-white/30 hover:text-white hover:bg-white/[0.06] transition-all"
                onClick={() => update({ x: preset.x, y: preset.y, width: preset.w, height: preset.h })}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Position & Size sliders */}
          {[
            { key: "x", label: "X Position", val: pip.x },
            { key: "y", label: "Y Position", val: pip.y },
            { key: "width", label: "Width", val: pip.width },
            { key: "height", label: "Height", val: pip.height },
          ].map(({ key, label, val }) => (
            <div key={key} className="space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-white/30">{label}</span>
                <span className="text-[8px] tabular-nums font-mono text-white/20">{val}%</span>
              </div>
              <Slider
                value={[val]}
                min={0} max={100} step={1}
                onValueChange={([v]) => update({ [key]: v } as any)}
                className="h-3"
              />
            </div>
          ))}
        </>
      )}
    </div>
  );
};
