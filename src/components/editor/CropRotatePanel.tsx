import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { RotateCcw, Crop, RotateCw, FlipHorizontal, FlipVertical } from "lucide-react";
import type { TimelineClip } from "./types";
import { cn } from "@/lib/utils";

interface CropRotatePanelProps {
  clip: TimelineClip;
  onUpdateClip: (clipId: string, updates: Partial<TimelineClip>) => void;
}

const ASPECT_PRESETS = [
  { label: "Free", value: null },
  { label: "16:9", value: 16 / 9 },
  { label: "9:16", value: 9 / 16 },
  { label: "4:3", value: 4 / 3 },
  { label: "1:1", value: 1 },
];

export const CropRotatePanel = ({ clip, onUpdateClip }: CropRotatePanelProps) => {
  const transform = clip.transform || { rotation: 0, flipH: false, flipV: false, cropAspect: null };

  const update = (updates: Partial<typeof transform>) => {
    onUpdateClip(clip.id, { transform: { ...transform, ...updates } });
  };

  const reset = () => {
    onUpdateClip(clip.id, { transform: { rotation: 0, flipH: false, flipV: false, cropAspect: null } });
  };

  const isModified = transform.rotation !== 0 || transform.flipH || transform.flipV || transform.cropAspect !== null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/30">
          Crop & Rotate
        </span>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-5 w-5 rounded transition-all", isModified ? "text-white hover:text-white hover:bg-white/[0.1]" : "text-white/15")}
          onClick={reset}
          disabled={!isModified}
        >
          <RotateCcw className="h-2.5 w-2.5" />
        </Button>
      </div>

      {/* Rotation */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <RotateCw className={cn("h-3 w-3", transform.rotation !== 0 ? "text-white" : "text-white/20")} />
            <span className={cn("text-[10px]", transform.rotation !== 0 ? "text-white/60" : "text-white/30")}>Rotation</span>
          </div>
          <span className={cn("text-[9px] tabular-nums font-mono", transform.rotation !== 0 ? "text-white/40" : "text-white/15")}>
            {transform.rotation}°
          </span>
        </div>
        <Slider
          value={[transform.rotation]}
          min={-180}
          max={180}
          step={1}
          onValueChange={([v]) => update({ rotation: v })}
          className="h-4"
        />
      </div>

      {/* Quick rotate buttons */}
      <div className="flex gap-1">
        {[-90, -45, 0, 45, 90].map((deg) => (
          <button
            key={deg}
            className={cn(
              "flex-1 py-1 rounded text-[9px] font-mono transition-all",
              transform.rotation === deg
                ? "bg-white text-black font-semibold"
                : "text-white/30 hover:text-white hover:bg-white/[0.06]"
            )}
            onClick={() => update({ rotation: deg })}
          >
            {deg}°
          </button>
        ))}
      </div>

      <div className="h-px bg-white/[0.04]" />

      {/* Flip */}
      <div className="space-y-1.5">
        <span className="text-[9px] text-white/30 uppercase tracking-[0.15em] font-semibold">Flip</span>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "flex-1 h-7 text-[9px] gap-1.5 rounded-md border transition-all",
              transform.flipH ? "bg-white text-black border-white/20" : "text-white border-white/[0.06] hover:text-white hover:bg-white/[0.06]"
            )}
            onClick={() => update({ flipH: !transform.flipH })}
          >
            <FlipHorizontal className="h-3 w-3" /> Horizontal
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "flex-1 h-7 text-[9px] gap-1.5 rounded-md border transition-all",
              transform.flipV ? "bg-white text-black border-white/20" : "text-white border-white/[0.06] hover:text-white hover:bg-white/[0.06]"
            )}
            onClick={() => update({ flipV: !transform.flipV })}
          >
            <FlipVertical className="h-3 w-3" /> Vertical
          </Button>
        </div>
      </div>

      <div className="h-px bg-white/[0.04]" />

      {/* Crop Aspect Ratio */}
      <div className="space-y-1.5">
        <span className="text-[9px] text-white/30 uppercase tracking-[0.15em] font-semibold flex items-center gap-1.5">
          <Crop className="h-2.5 w-2.5" /> Aspect Ratio
        </span>
        <div className="grid grid-cols-5 gap-0.5">
          {ASPECT_PRESETS.map((preset) => (
            <button
              key={preset.label}
              className={cn(
                "py-1.5 rounded text-[9px] font-medium transition-all",
                (transform.cropAspect === preset.value || (transform.cropAspect === null && preset.value === null))
                  ? "bg-white text-black font-semibold"
                  : "text-white/30 hover:text-white hover:bg-white/[0.06]"
              )}
              onClick={() => update({ cropAspect: preset.value })}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};