import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { RotateCcw, Sun, Contrast, Palette, Droplets } from "lucide-react";
import type { ColorGrading, TimelineClip } from "./types";
import { DEFAULT_COLOR_GRADING } from "./types";

interface ColorGradingPanelProps {
  clip: TimelineClip;
  onUpdateClip: (clipId: string, updates: Partial<TimelineClip>) => void;
}

const SLIDERS = [
  { key: "brightness" as const, label: "Brightness", icon: Sun, min: 0, max: 200 },
  { key: "contrast" as const, label: "Contrast", icon: Contrast, min: 0, max: 200 },
  { key: "saturation" as const, label: "Saturation", icon: Droplets, min: 0, max: 200 },
  { key: "hue" as const, label: "Hue Rotate", icon: Palette, min: 0, max: 360 },
  { key: "opacity" as const, label: "Opacity", icon: Sun, min: 0, max: 100 },
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Color Grading
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 text-muted-foreground hover:text-foreground"
          onClick={reset}
        >
          <RotateCcw className="h-3 w-3" />
        </Button>
      </div>

      {SLIDERS.map(({ key, label, icon: Icon, min, max }) => (
        <div key={key} className="space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Icon className="h-3 w-3 text-muted-foreground/60" />
              <span className="text-[10px] text-muted-foreground">{label}</span>
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground/50">
              {grading[key]}{key === "hue" ? "°" : "%"}
            </span>
          </div>
          <Slider
            value={[grading[key]]}
            min={min}
            max={max}
            step={1}
            onValueChange={([v]) => update(key, v)}
            className="h-4"
          />
        </div>
      ))}

      {/* Preview CSS filter string */}
      <div className="mt-2 p-2 rounded bg-surface-1 border border-border">
        <span className="text-[8px] text-muted-foreground/40 font-mono break-all">
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
