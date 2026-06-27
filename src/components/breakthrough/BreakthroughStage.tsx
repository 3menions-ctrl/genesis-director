/**
 * BreakthroughStage — mounts a canvas and plays a `TemplateDefinition` live
 * through the procedural BreakthroughEngine. Owns its own rAF clock (so React
 * never re-renders per frame); reports time back throttled for the scrubber.
 */
import { useEffect, useRef } from "react";
import { BreakthroughEngine } from "@/lib/breakthrough-fx";
import type { TemplateDefinition } from "@/lib/templates/breakthrough";

interface Props {
  def: TemplateDefinition;
  playing: boolean;
  loop?: boolean;
  intensity: number;
  /** Override break beat (drives the audio-cue-sync demo). */
  breakBeatSec?: number;
  seed?: number;
  /** Explicit scrub target — when this changes, jump there. */
  scrubTime?: number | null;
  onTime?: (t: number) => void;
  onDuration?: (d: number) => void;
  className?: string;
}

export function BreakthroughStage({
  def, playing, loop = true, intensity, breakBeatSec, seed = 1337,
  scrubTime, onTime, onDuration, className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<BreakthroughEngine | null>(null);
  const timeRef = useRef(0);
  const playingRef = useRef(playing);
  const loopRef = useRef(loop);
  const lastEmit = useRef(0);

  playingRef.current = playing;
  loopRef.current = loop;

  // Rebuild engine when the template or seed changes.
  useEffect(() => {
    const eng = new BreakthroughEngine(def, { seed, intensity });
    engineRef.current = eng;
    timeRef.current = 0;
    onDuration?.(eng.durationSec);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def, seed]);

  // Live param updates without rebuilding.
  useEffect(() => { engineRef.current?.setIntensity(intensity); }, [intensity]);
  useEffect(() => {
    if (breakBeatSec != null) engineRef.current?.setBreakBeat(breakBeatSec);
  }, [breakBeatSec]);

  // Explicit scrub.
  useEffect(() => {
    if (scrubTime != null) timeRef.current = scrubTime;
  }, [scrubTime]);

  // The render loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let raf = 0;
    let prev = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      const eng = engineRef.current;
      if (eng) {
        if (playingRef.current) {
          timeRef.current += dt;
          if (timeRef.current >= eng.durationSec) {
            timeRef.current = loopRef.current ? 0 : eng.durationSec;
          }
        }
        eng.advanceTo(timeRef.current);
        eng.render(ctx, canvas.width, canvas.height, timeRef.current);
        if (now - lastEmit.current > 66) {
          lastEmit.current = now;
          onTime?.(timeRef.current);
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: "100%", height: "100%", display: "block", borderRadius: 18 }}
    />
  );
}
