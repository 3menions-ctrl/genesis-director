import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { RotateCcw, Sun, Contrast, Palette, Droplets, Eye } from "lucide-react";
import type { ColorGrading, TimelineClip } from "./types";
import { DEFAULT_COLOR_GRADING } from "./types";

interface ColorGradingPanelProps {
  clip: TimelineClip;
  onUpdateClip: (clipId: string, updates: Partial<TimelineClip>) => void;
}

const SLIDERS = [
  { key: "brightness" as const, label: "Brightness", icon: Sun, min: 0, max: 200, color: "text-amber-400" },
  { key: "contrast" as const, label: "Contrast", icon: Contrast, min: 0, max: 200, color: "text-blue-400" },
  { key: "saturation" as const, label: "Saturation", icon: Droplets, min: 0, max: 200, color: "text-emerald-400" },
  { key: "hue" as const, label: "Hue Rotate", icon: Palette, min: 0, max: 360, color: "text-pink-400" },
  { key: "opacity" as const, label: "Opacity", icon: Eye, min: 0, max: 100, color: "text-white/60" },
];

export const ColorGradingPanel = ({ clip, onUpdateClip }: ColorGradingPanelProps) => {
  const grading = clip.colorGrading || DEFAULT_COLOR_GRADING;

  const update = (key: keyof ColorGrading, value: number) => {
    onUpdateClip(clip.id, {
      colorGrading: { ...grading, [key]: value },
    });
  };

  const reset = () => {
    onUpdateClip(clip.id, { colorGrading: { ...DEFAULT_COLOR_GRADING } });
  };

  const isModified = JSON.stringify(grading) !== JSON.stringify(DEFAULT_COLOR_GRADING);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/30">
          Color Grading
        </span>
        <Button
          variant="ghost"
          size="icon"
          className={`h-5 w-5 rounded transition-all ${isModified ? 'text-primary/60 hover:text-primary hover:bg-primary/10' : 'text-white/15'}`}
          onClick={reset}
          disabled={!isModified}
        >
          <RotateCcw className="h-2.5 w-2.5" />
        </Button>
      </div>

      {SLIDERS.map(({ key, label, icon: Icon, min, max, color }) => {
        const val = grading[key];
        const defaultVal = DEFAULT_COLOR_GRADING[key];
        const isChanged = val !== defaultVal;

        return (
          <div key={key} className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Icon className={`h-3 w-3 ${isChanged ? color : 'text-white/20'} transition-colors`} />
                <span className={`text-[10px] ${isChanged ? 'text-white/60' : 'text-white/30'} transition-colors`}>{label}</span>
              </div>
              <span className={`text-[9px] tabular-nums font-mono ${isChanged ? 'text-white/40' : 'text-white/15'} transition-colors`}>
                {val}{key === "hue" ? "°" : "%"}
              </span>
            </div>
            <Slider
              value={[val]}
              min={min}
              max={max}
              step={1}
              onValueChange={([v]) => update(key, v)}
              className="h-4"
            />
          </div>
        );
      })}

      {/* Filter preview */}
      <div className="mt-2 p-2 rounded-md bg-black/20 border border-white/[0.04]">
        <span className="text-[7px] text-white/15 font-mono break-all leading-relaxed">
          {buildFilterString(grading)}
        </span>
      </div>
    </div>
  );
};

export function buildFilterString(g: ColorGrading): string {
  const parts: string[] = [];
  if (g.brightness !== 100) parts.push(`brightness(${g.brightness}%)`);
  if (g.contrast !== 100) parts.push(`contrast(${g.contrast}%)`);
  if (g.saturation !== 100) parts.push(`saturate(${g.saturation}%)`);
  if (g.hue !== 0) parts.push(`hue-rotate(${g.hue}deg)`);
  if (g.opacity !== 100) parts.push(`opacity(${g.opacity}%)`);
  return parts.length > 0 ? parts.join(" ") : "none";
}