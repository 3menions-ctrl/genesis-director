import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { RotateCcw, Gauge } from "lucide-react";
import type { TimelineClip } from "./types";
import { cn } from "@/lib/utils";

interface SpeedControlPanelProps {
  clip: TimelineClip;
  onUpdateClip: (clipId: string, updates: Partial<TimelineClip>) => void;
}

const SPEED_PRESETS = [0.1, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4, 8, 16];

export const SpeedControlPanel = ({ clip, onUpdateClip }: SpeedControlPanelProps) => {
  const speed = clip.speed || 1;

  const update = (newSpeed: number) => {
    const ratio = speed / newSpeed;
    const newDuration = (clip.end - clip.start) * ratio;
    onUpdateClip(clip.id, {
      speed: newSpeed,
      end: clip.start + newDuration,
    });
  };

  const reset = () => {
    if (speed !== 1) update(1);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/30">
          Speed
        </span>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-5 w-5 rounded transition-all", speed !== 1 ? "text-white hover:text-white hover:bg-white/[0.1]" : "text-white/15")}
          onClick={reset}
          disabled={speed === 1}
        >
          <RotateCcw className="h-2.5 w-2.5" />
        </Button>
      </div>

      {/* Speed value display */}
      <div className="flex items-center justify-center py-3 bg-black/20 rounded-lg border border-white/[0.04]">
        <Gauge className={cn("h-4 w-4 mr-2", speed !== 1 ? "text-white" : "text-white/20")} />
        <span className={cn("text-2xl font-mono tabular-nums font-bold", speed !== 1 ? "text-white" : "text-white/40")}>
          {speed}
        </span>
        <span className="text-[11px] text-white/30 ml-1">×</span>
      </div>

      {/* Continuous slider */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-white/25">0.1x</span>
          <span className="text-[9px] text-white/25">16x</span>
        </div>
        <Slider
          value={[Math.log2(speed)]}
          min={Math.log2(0.1)}
          max={Math.log2(16)}
          step={0.01}
          onValueChange={([v]) => {
            const newSpeed = Math.round(Math.pow(2, v) * 100) / 100;
            update(newSpeed);
          }}
          className="h-4"
        />
      </div>

      {/* Preset buttons */}
      <div className="grid grid-cols-4 gap-0.5">
        {SPEED_PRESETS.map((s) => (
          <button
            key={s}
            className={cn(
              "py-1.5 rounded text-[9px] font-mono transition-all",
              speed === s
                ? "bg-white text-black font-semibold"
                : "text-white/30 hover:text-white hover:bg-white/[0.06]"
            )}
            onClick={() => update(s)}
          >
            {s}x
          </button>
        ))}
      </div>

      {speed !== 1 && (
        <div className="p-2 rounded-md bg-black/20 border border-white/[0.04]">
          <span className="text-[8px] text-white/25 font-mono">
            {speed < 1 ? "Slow motion" : speed <= 2 ? "Fast forward" : "Speed ramp"} • Duration adjusted
          </span>
        </div>
      )}
    </div>
  );
};