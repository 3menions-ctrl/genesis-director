import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import type { TimelineClip, TextAnimation, TextAnimationType } from "./types";
import { TEXT_ANIMATION_PRESETS, DEFAULT_TEXT_ANIMATION } from "./types";

interface TextAnimationPanelProps {
  clip: TimelineClip;
  onUpdateClip: (id: string, updates: Partial<TimelineClip>) => void;
}

export const TextAnimationPanel = ({ clip, onUpdateClip }: TextAnimationPanelProps) => {
  const anim = clip.textAnimation || DEFAULT_TEXT_ANIMATION;

  const update = (updates: Partial<TextAnimation>) => {
    onUpdateClip(clip.id, { textAnimation: { ...anim, ...updates } });
  };

  const categories = ["fade", "slide", "scale", "special"] as const;

  return (
    <div className="space-y-4">
      {/* Enter Animation */}
      <div>
        <Label className="text-[9px] text-muted-foreground uppercase tracking-[0.15em] font-semibold">
          Enter Animation
        </Label>
        <div className="grid grid-cols-3 gap-1 mt-2">
          {TEXT_ANIMATION_PRESETS.map((preset) => (
            <button
              key={`enter-${preset.id}`}
              className={cn(
                "text-[8px] px-2 py-1.5 rounded-md border transition-all font-medium",
                anim.enter === preset.id
                  ? "bg-primary text-primary-foreground border-primary/20"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
              onClick={() => update({ enter: preset.id })}
            >
              {preset.name}
            </button>
          ))}
        </div>
        {anim.enter !== "none" && (
          <div className="mt-2">
            <div className="flex items-center justify-between">
              <span className="text-[8px] text-muted-foreground">Duration</span>
              <span className="text-[8px] text-muted-foreground font-mono">{anim.enterDuration.toFixed(1)}s</span>
            </div>
            <Slider
              value={[anim.enterDuration]}
              min={0.1} max={2} step={0.1}
              onValueChange={([v]) => update({ enterDuration: v })}
              className="mt-1"
            />
          </div>
        )}
      </div>

      <div className="h-px bg-border/50" />

      {/* Exit Animation */}
      <div>
        <Label className="text-[9px] text-muted-foreground uppercase tracking-[0.15em] font-semibold">
          Exit Animation
        </Label>
        <div className="grid grid-cols-3 gap-1 mt-2">
          {TEXT_ANIMATION_PRESETS.map((preset) => (
            <button
              key={`exit-${preset.id}`}
              className={cn(
                "text-[8px] px-2 py-1.5 rounded-md border transition-all font-medium",
                anim.exit === preset.id
                  ? "bg-primary text-primary-foreground border-primary/20"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
              onClick={() => update({ exit: preset.id })}
            >
              {preset.name}
            </button>
          ))}
        </div>
        {anim.exit !== "none" && (
          <div className="mt-2">
            <div className="flex items-center justify-between">
              <span className="text-[8px] text-muted-foreground">Duration</span>
              <span className="text-[8px] text-muted-foreground font-mono">{anim.exitDuration.toFixed(1)}s</span>
            </div>
            <Slider
              value={[anim.exitDuration]}
              min={0.1} max={2} step={0.1}
              onValueChange={([v]) => update({ exitDuration: v })}
              className="mt-1"
            />
          </div>
        )}
      </div>

      {/* Quick Presets */}
      <div className="h-px bg-border/50" />
      <div>
        <Label className="text-[9px] text-muted-foreground uppercase tracking-[0.15em] font-semibold">
          Quick Presets
        </Label>
        <div className="grid grid-cols-2 gap-1 mt-2">
          {[
            { label: "Fade In/Out", enter: "fade-in" as TextAnimationType, exit: "fade-out" as TextAnimationType },
            { label: "Slide Up", enter: "slide-up" as TextAnimationType, exit: "slide-down" as TextAnimationType },
            { label: "Scale Pop", enter: "scale-up" as TextAnimationType, exit: "scale-down" as TextAnimationType },
            { label: "Typewriter", enter: "typewriter" as TextAnimationType, exit: "fade-out" as TextAnimationType },
            { label: "Bounce In", enter: "bounce" as TextAnimationType, exit: "fade-out" as TextAnimationType },
            { label: "Cinematic", enter: "blur-in" as TextAnimationType, exit: "fade-out" as TextAnimationType },
          ].map((preset) => (
            <button
              key={preset.label}
              className="text-[8px] px-2 py-2 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-all font-medium"
              onClick={() => update({ enter: preset.enter, exit: preset.exit, enterDuration: 0.5, exitDuration: 0.5 })}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
