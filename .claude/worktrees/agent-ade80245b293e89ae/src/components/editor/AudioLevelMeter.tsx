/**
 * AudioLevelMeter — Animated VU meters (stereo L/R)
 * Simulates real-time audio levels with peak hold
 */

import { memo, useState, useEffect, useRef } from "react";
import { useCustomTimeline } from "@/hooks/useCustomTimeline";

const SEGMENTS = 24;
const PEAK_HOLD_MS = 1200;
const DECAY_RATE = 0.92;

function getSegmentColor(index: number, total: number): string {
  const ratio = index / total;
  if (ratio > 0.85) return "hsl(0, 80%, 50%)";      // Red — clipping
  if (ratio > 0.7) return "hsl(35, 90%, 50%)";       // Orange — hot
  if (ratio > 0.55) return "hsl(50, 85%, 50%)";      // Yellow — warm
  return "hsl(142, 65%, 45%)";                        // Green — normal
}

export const AudioLevelMeter = memo(function AudioLevelMeter() {
  const { state } = useCustomTimeline();
  const [levelsL, setLevelsL] = useState(0);
  const [levelsR, setLevelsR] = useState(0);
  const [peakL, setPeakL] = useState(0);
  const [peakR, setPeakR] = useState(0);
  const peakTimerL = useRef<number>(0);
  const peakTimerR = useRef<number>(0);
  const animRef = useRef<number>(0);

  useEffect(() => {
    if (!state.isPlaying) {
      // Decay to 0 when stopped
      const decay = () => {
        setLevelsL(prev => {
          const next = prev * 0.85;
          return next < 0.01 ? 0 : next;
        });
        setLevelsR(prev => {
          const next = prev * 0.85;
          return next < 0.01 ? 0 : next;
        });
        setPeakL(prev => {
          if (Date.now() - peakTimerL.current > PEAK_HOLD_MS) return prev * 0.9;
          return prev;
        });
        setPeakR(prev => {
          if (Date.now() - peakTimerR.current > PEAK_HOLD_MS) return prev * 0.9;
          return prev;
        });
        animRef.current = requestAnimationFrame(decay);
      };
      animRef.current = requestAnimationFrame(decay);
      return () => cancelAnimationFrame(animRef.current);
    }

    // Simulate audio levels based on timeline position
    const tick = () => {
      const t = state.playheadTime;
      // Generate pseudo-random levels based on time + clip presence
      const hasClip = state.tracks.some(track =>
        track.clips.some(c => c.start <= t && c.end > t && (c.type === "video" || c.type === "audio"))
      );

      if (hasClip) {
        const baseL = 0.4 + Math.sin(t * 3.7) * 0.15 + Math.sin(t * 11.3) * 0.1 + Math.sin(t * 23.1) * 0.05;
        const baseR = 0.4 + Math.sin(t * 4.1 + 0.5) * 0.15 + Math.sin(t * 13.7 + 0.3) * 0.1 + Math.sin(t * 19.3) * 0.05;
        const targetL = Math.min(1, Math.max(0, baseL + (Math.random() - 0.5) * 0.15));
        const targetR = Math.min(1, Math.max(0, baseR + (Math.random() - 0.5) * 0.15));

        setLevelsL(prev => prev + (targetL - prev) * 0.3);
        setLevelsR(prev => prev + (targetR - prev) * 0.3);

        // Peak hold
        if (targetL > peakL) { setPeakL(targetL); peakTimerL.current = Date.now(); }
        if (targetR > peakR) { setPeakR(targetR); peakTimerR.current = Date.now(); }
      } else {
        setLevelsL(prev => prev * DECAY_RATE);
        setLevelsR(prev => prev * DECAY_RATE);
      }

      // Decay peaks
      setPeakL(prev => {
        if (Date.now() - peakTimerL.current > PEAK_HOLD_MS) return prev * 0.95;
        return prev;
      });
      setPeakR(prev => {
        if (Date.now() - peakTimerR.current > PEAK_HOLD_MS) return prev * 0.95;
        return prev;
      });

      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [state.isPlaying, state.playheadTime, state.tracks]);

  return (
    <div className="flex gap-[3px] h-full py-2 px-1" style={{ width: 28 }}>
      <MeterBar level={levelsL} peak={peakL} label="L" />
      <MeterBar level={levelsR} peak={peakR} label="R" />
    </div>
  );
});

function MeterBar({ level, peak, label }: { level: number; peak: number; label: string }) {
  const activeSegments = Math.floor(level * SEGMENTS);
  const peakSegment = Math.floor(peak * SEGMENTS);

  return (
    <div className="flex-1 flex flex-col-reverse gap-[1px] relative">
      {Array.from({ length: SEGMENTS }).map((_, i) => {
        const isActive = i < activeSegments;
        const isPeak = i === peakSegment && peakSegment > 0;
        const color = getSegmentColor(i, SEGMENTS);

        return (
          <div
            key={i}
            className="w-full rounded-[1px] transition-opacity duration-75"
            style={{
              height: 3,
              background: isActive || isPeak ? color : "hsla(0, 0%, 100%, 0.06)",
              opacity: isActive ? 1 : isPeak ? 0.8 : 1,
              boxShadow: isActive && i > SEGMENTS * 0.7 ? `0 0 4px ${color}` : "none",
            }}
          />
        );
      })}
      <span className="text-[7px] font-mono text-center text-[hsla(0,0%,100%,0.3)] mt-0.5 leading-none">
        {label}
      </span>
    </div>
  );
}
