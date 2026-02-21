import { useState, useCallback } from "react";
import { Music, Zap, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { TimelineTrack, TimelineClip } from "./types";
import { MUSIC_LIBRARY } from "./types";

interface BeatSyncPanelProps {
  tracks: TimelineTrack[];
  onAutocut: (cutPoints: number[]) => void;
}

/**
 * Detects beats from BPM and generates cut points.
 * In production, this would use Web Audio API onset detection.
 * For now, uses the BPM from MUSIC_LIBRARY for deterministic beat grid.
 */
function generateBeatGrid(bpm: number, duration: number, divisor: number = 1): number[] {
  const beatInterval = 60 / bpm;
  const interval = beatInterval * divisor;
  const points: number[] = [];
  for (let t = interval; t < duration - 0.5; t += interval) {
    points.push(Math.round(t * 100) / 100);
  }
  return points;
}

export const BeatSyncPanel = ({ tracks, onAutocut }: BeatSyncPanelProps) => {
  const [selectedBpm, setSelectedBpm] = useState(120);
  const [divisor, setDivisor] = useState(1); // 1 = every beat, 2 = every 2 beats, 4 = every bar
  const [cutPoints, setCutPoints] = useState<number[]>([]);

  const duration = tracks.reduce((max, t) => {
    const trackMax = t.clips.reduce((m, c) => Math.max(m, c.end), 0);
    return Math.max(max, trackMax);
  }, 0);

  // Detect BPM from music track if present
  const musicClips = tracks
    .filter((t) => t.type === "audio")
    .flatMap((t) => t.clips);

  const handleDetectBpm = useCallback(() => {
    // Try to match a music library track
    const musicClip = musicClips[0];
    if (musicClip) {
      const matchedTrack = MUSIC_LIBRARY.find(
        (m) => musicClip.label.includes(m.title)
      );
      if (matchedTrack) {
        setSelectedBpm(matchedTrack.bpm);
        const points = generateBeatGrid(matchedTrack.bpm, duration, divisor);
        setCutPoints(points);
        return;
      }
    }
    // Fallback: use selected BPM
    const points = generateBeatGrid(selectedBpm, duration, divisor);
    setCutPoints(points);
  }, [musicClips, duration, divisor, selectedBpm]);

  const handleAutocut = useCallback(() => {
    if (cutPoints.length === 0) {
      handleDetectBpm();
      return;
    }
    onAutocut(cutPoints);
  }, [cutPoints, onAutocut, handleDetectBpm]);

  const bpmPresets = [60, 80, 90, 100, 110, 120, 128, 140, 150, 160];
  const divisorLabels: Record<number, string> = {
    0.5: "½ beat",
    1: "Every beat",
    2: "Every 2 beats",
    4: "Every bar",
    8: "Every 2 bars",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <Music className="h-3 w-3 text-emerald-400" />
        </div>
        <div>
          <span className="text-[10px] font-semibold text-foreground block">Beat Sync</span>
          <span className="text-[8px] text-muted-foreground">Auto-cut clips to music BPM</span>
        </div>
      </div>

      {/* BPM Selection */}
      <div>
        <Label className="text-[9px] text-muted-foreground uppercase tracking-[0.15em] font-semibold">
          BPM — {selectedBpm}
        </Label>
        <Slider
          value={[selectedBpm]}
          min={40} max={200} step={1}
          onValueChange={([v]) => setSelectedBpm(v)}
          className="mt-2"
        />
        <div className="flex flex-wrap gap-1 mt-2">
          {bpmPresets.map((bpm) => (
            <button
              key={bpm}
              className={cn(
                "text-[8px] px-2 py-1 rounded-md border transition-all",
                selectedBpm === bpm
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-semibold"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
              onClick={() => setSelectedBpm(bpm)}
            >
              {bpm}
            </button>
          ))}
        </div>
      </div>

      {/* Beat Divisor */}
      <div>
        <Label className="text-[9px] text-muted-foreground uppercase tracking-[0.15em] font-semibold">
          Cut Interval
        </Label>
        <div className="grid grid-cols-3 gap-1 mt-2">
          {[1, 2, 4].map((d) => (
            <button
              key={d}
              className={cn(
                "text-[8px] px-2 py-1.5 rounded-md border transition-all",
                divisor === d
                  ? "bg-primary text-primary-foreground border-primary/20 font-semibold"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
              onClick={() => {
                setDivisor(d);
                const points = generateBeatGrid(selectedBpm, duration, d);
                setCutPoints(points);
              }}
            >
              {divisorLabels[d]}
            </button>
          ))}
        </div>
      </div>

      <div className="h-px bg-border/50" />

      {/* Actions */}
      <div className="space-y-2">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 h-8 text-[10px] border border-border rounded-lg hover:bg-secondary"
          onClick={handleDetectBpm}
        >
          <Zap className="h-3 w-3 text-amber-400" />
          Detect Beats ({cutPoints.length} markers)
        </Button>

        <Button
          className="w-full gap-2 h-9 text-[10px] font-semibold bg-white text-black hover:bg-white/90 rounded-lg"
          onClick={handleAutocut}
          disabled={cutPoints.length === 0 && duration === 0}
        >
          <Scissors className="h-3 w-3" />
          Auto-Cut to Beats ({cutPoints.length} cuts)
        </Button>
      </div>

      {cutPoints.length > 0 && (
        <div className="bg-secondary/50 rounded-lg p-2 border border-border">
          <span className="text-[8px] text-muted-foreground block mb-1">Cut points:</span>
          <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
            {cutPoints.slice(0, 20).map((t, i) => (
              <span key={i} className="text-[7px] font-mono bg-card px-1.5 py-0.5 rounded border border-border text-muted-foreground">
                {t.toFixed(1)}s
              </span>
            ))}
            {cutPoints.length > 20 && (
              <span className="text-[7px] text-muted-foreground">+{cutPoints.length - 20} more</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
