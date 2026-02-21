import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface RealAudioWaveformProps {
  clipId: string;
  width: number;
  height: number;
  color: string;
  /** Real waveform data from Web Audio API (0-1 normalized amplitudes) */
  waveformData?: Float32Array | number[];
}

/**
 * Audio waveform visualization that uses real audio data when available,
 * falling back to deterministic procedural generation.
 */
export const RealAudioWaveform = ({ clipId, width, height, color, waveformData }: RealAudioWaveformProps) => {
  const bars = useMemo(() => {
    const count = Math.max(Math.floor(width / 3), 10);

    if (waveformData && waveformData.length > 0) {
      // Resample real waveform data to match bar count
      const data = waveformData instanceof Float32Array ? Array.from(waveformData) : waveformData;
      const step = data.length / count;
      return Array.from({ length: count }, (_, i) => {
        const idx = Math.floor(i * step);
        const end = Math.min(Math.floor((i + 1) * step), data.length);
        let sum = 0;
        let samples = 0;
        for (let j = idx; j < end; j++) {
          sum += Math.abs(data[j]);
          samples++;
        }
        const avg = samples > 0 ? sum / samples : 0;
        return 0.15 + avg * 0.85;
      });
    }

    // Fallback: deterministic procedural waveform
    let seed = 0;
    for (let i = 0; i < clipId.length; i++) {
      seed = ((seed << 5) - seed + clipId.charCodeAt(i)) | 0;
    }
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed & 0x7fffffff) / 0x7fffffff;
    };
    return Array.from({ length: count }, () => 0.15 + random() * 0.85);
  }, [clipId, width, waveformData]);

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
