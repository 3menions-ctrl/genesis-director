import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { RotateCcw, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TimelineClip } from "./types";

interface AudioFadePanelProps {
  clip: TimelineClip;
  onUpdateClip: (clipId: string, updates: Partial<TimelineClip>) => void;
}

export const AudioFadePanel = ({ clip, onUpdateClip }: AudioFadePanelProps) => {
  const fade = clip.audioFade || { fadeIn: 0, fadeOut: 0 };
  const clipDuration = clip.end - clip.start;
  const noiseSuppression = clip.noiseSuppression ?? false;

  const update = (updates: Partial<typeof fade>) => {
    onUpdateClip(clip.id, { audioFade: { ...fade, ...updates } });
  };

  const reset = () => {
    onUpdateClip(clip.id, { audioFade: { fadeIn: 0, fadeOut: 0 } });
  };

  const isModified = fade.fadeIn > 0 || fade.fadeOut > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/30">Audio Fades</span>
        <Button
          variant="ghost" size="icon"
          className={cn("h-5 w-5 rounded transition-all", isModified ? "text-white hover:text-white hover:bg-white/[0.1]" : "text-white/15")}
          onClick={reset} disabled={!isModified}
        >
          <RotateCcw className="h-2.5 w-2.5" />
        </Button>
      </div>

      {/* Visual fade representation */}
      <div className="h-8 bg-black/20 rounded-md border border-white/[0.04] relative overflow-hidden">
        <div className="absolute inset-0 bg-white/10" />
        {/* Fade in ramp */}
        {fade.fadeIn > 0 && (
          <div
            className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-black to-transparent"
            style={{ width: `${(fade.fadeIn / clipDuration) * 100}%` }}
          />
        )}
        {/* Fade out ramp */}
        {fade.fadeOut > 0 && (
          <div
            className="absolute right-0 top-0 bottom-0 bg-gradient-to-l from-black to-transparent"
            style={{ width: `${(fade.fadeOut / clipDuration) * 100}%` }}
          />
        )}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[8px] text-white/30 font-mono">
            {fade.fadeIn > 0 && `↗${fade.fadeIn.toFixed(1)}s`}
            {fade.fadeIn > 0 && fade.fadeOut > 0 && " · "}
            {fade.fadeOut > 0 && `${fade.fadeOut.toFixed(1)}s↘`}
            {!fade.fadeIn && !fade.fadeOut && "No fades"}
          </span>
        </div>
      </div>

      {/* Fade In */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Volume2 className={cn("h-3 w-3", fade.fadeIn > 0 ? "text-white" : "text-white/20")} />
            <span className={cn("text-[10px]", fade.fadeIn > 0 ? "text-white/60" : "text-white/30")}>Fade In</span>
          </div>
          <span className={cn("text-[9px] tabular-nums font-mono", fade.fadeIn > 0 ? "text-white/40" : "text-white/15")}>
            {fade.fadeIn.toFixed(1)}s
          </span>
        </div>
        <Slider
          value={[fade.fadeIn]}
          min={0} max={Math.min(clipDuration / 2, 10)} step={0.1}
          onValueChange={([v]) => update({ fadeIn: v })}
          className="h-4"
        />
      </div>

      {/* Fade Out */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <VolumeX className={cn("h-3 w-3", fade.fadeOut > 0 ? "text-white" : "text-white/20")} />
            <span className={cn("text-[10px]", fade.fadeOut > 0 ? "text-white/60" : "text-white/30")}>Fade Out</span>
          </div>
          <span className={cn("text-[9px] tabular-nums font-mono", fade.fadeOut > 0 ? "text-white/40" : "text-white/15")}>
            {fade.fadeOut.toFixed(1)}s
          </span>
        </div>
        <Slider
          value={[fade.fadeOut]}
          min={0} max={Math.min(clipDuration / 2, 10)} step={0.1}
          onValueChange={([v]) => update({ fadeOut: v })}
          className="h-4"
        />
      </div>

      <div className="h-px bg-white/[0.04]" />

      {/* Noise Suppression toggle */}
      <div className="space-y-1.5">
        <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/30">Audio Processing</span>
        <button
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 rounded-md border transition-all text-[10px]",
            noiseSuppression
              ? "bg-white text-black border-white/20 font-semibold"
              : "bg-white/[0.03] border-white/[0.06] text-white/40 hover:text-white hover:bg-white/[0.06]"
          )}
          onClick={() => onUpdateClip(clip.id, { noiseSuppression: !noiseSuppression })}
        >
          <div className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all",
            noiseSuppression ? "border-black bg-black" : "border-white/30"
          )}>
            {noiseSuppression && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
          </div>
          Noise Suppression
        </button>
        <p className="text-[8px] text-white/20 px-1">
          Reduces background noise from audio. Applied during export.
        </p>
      </div>
    </div>
  );
};
