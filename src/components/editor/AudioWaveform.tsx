import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface AudioWaveformProps {
  clipId: string;
  width: number;
  height: number;
  color: string;
}

/** Procedural waveform visualization for audio clips */
export const AudioWaveform = ({ clipId, width, height, color }: AudioWaveformProps) => {
  // Generate deterministic pseudo-random waveform from clipId
  const bars = useMemo(() => {
    const count = Math.max(Math.floor(width / 3), 10);
    let seed = 0;
    for (let i = 0; i < clipId.length; i++) {
      seed = ((seed << 5) - seed + clipId.charCodeAt(i)) | 0;
    }
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed & 0x7fffffff) / 0x7fffffff;
    };
    return Array.from({ length: count }, () => 0.15 + random() * 0.85);
  }, [clipId, width]);

  const barWidth = Math.max(1, width / bars.length - 1);

  return (
    <div className="absolute inset-0 flex items-center justify-center px-1 gap-px opacity-60">
      {bars.map((amp, i) => (
        <div
          key={i}
          className={cn("rounded-full bg-current", color)}
          style={{
            width: barWidth,
            height: `${amp * (height - 8)}px`,
            minHeight: 2,
          }}
        />
      ))}
    </div>
  );
};