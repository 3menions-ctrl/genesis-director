/**
 * ColorGradingPanel — DaVinci Resolve-style color grading
 * Color wheels (Lift/Gamma/Gain), temperature, tint, curves preview
 */

import { memo, useCallback, useRef, useEffect } from "react";
import { Palette, Sun, Thermometer, Droplets, Contrast, SunMedium, Sparkles } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { useCustomTimeline, TimelineClip } from "@/hooks/useCustomTimeline";

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "hsla(0,0%,100%,0.02)", border: "1px solid hsla(0,0%,100%,0.05)" }}>
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: "1px solid hsla(0,0%,100%,0.04)" }}>
        <span className="text-[hsla(280,70%,60%,0.6)]">{icon}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-[hsla(0,0%,100%,0.45)]">{title}</span>
      </div>
      <div className="p-3 space-y-3">{children}</div>
    </div>
  );
}

function GradeSlider({ label, value, min, max, step, onChange, icon, color }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; icon?: React.ReactNode; color?: string;
}) {
  const fmt = value > 0 ? `+${value.toFixed(step < 1 ? 2 : 0)}` : value.toFixed(step < 1 ? 2 : 0);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-[hsla(0,0%,100%,0.4)] flex items-center gap-1">{icon}{label}</span>
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-md" style={{ color: color || "hsla(280,70%,60%,0.7)", background: "hsla(280,70%,50%,0.08)" }}>{fmt}</span>
      </div>
      <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={min} max={max} step={step} className="w-full" />
    </div>
  );
}

/** Color Wheel — interactive hue picker rendered on canvas */
function ColorWheel({ label, hue, onChange, size = 72 }: { label: string; hue: number; onChange: (h: number) => void; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const r = size / 2;
    const innerR = r * 0.55;
    
    ctx.clearRect(0, 0, size, size);
    
    // Draw color ring
    for (let angle = 0; angle < 360; angle += 1) {
      const rad = (angle - 90) * Math.PI / 180;
      ctx.beginPath();
      ctx.arc(r, r, r - 2, rad, rad + Math.PI / 180 + 0.01);
      ctx.arc(r, r, innerR, rad + Math.PI / 180 + 0.01, rad, true);
      ctx.closePath();
      ctx.fillStyle = `hsl(${angle}, 70%, 55%)`;
      ctx.fill();
    }

    // Draw inner dark circle
    ctx.beginPath();
    ctx.arc(r, r, innerR - 1, 0, Math.PI * 2);
    ctx.fillStyle = "hsl(220, 14%, 8%)";
    ctx.fill();

    // Draw indicator
    const indicatorAngle = (hue - 90) * Math.PI / 180;
    const indicatorR = (r + innerR) / 2;
    const ix = r + Math.cos(indicatorAngle) * indicatorR;
    const iy = r + Math.sin(indicatorAngle) * indicatorR;
    ctx.beginPath();
    ctx.arc(ix, iy, 5, 0, Math.PI * 2);
    ctx.fillStyle = `hsl(${hue}, 70%, 55%)`;
    ctx.fill();
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [hue, size]);

  const handleInteract = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    const angle = Math.atan2(y, x) * 180 / Math.PI + 90;
    onChange(((angle % 360) + 360) % 360);
  }, [size, onChange]);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="cursor-crosshair rounded-full"
        onClick={handleInteract}
        onMouseDown={e => {
          const onMove = (ev: MouseEvent) => {
            const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
            const x = ev.clientX - rect.left - size / 2;
            const y = ev.clientY - rect.top - size / 2;
            const angle = Math.atan2(y, x) * 180 / Math.PI + 90;
            onChange(((angle % 360) + 360) % 360);
          };
          const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
          window.addEventListener("mousemove", onMove);
          window.addEventListener("mouseup", onUp);
        }}
      />
      <span className="text-[9px] font-semibold text-[hsla(0,0%,100%,0.4)]">{label}</span>
      <span className="text-[8px] font-mono text-[hsla(0,0%,100%,0.3)]">{Math.round(hue)}°</span>
    </div>
  );
}

export const ColorGradingPanel = memo(function ColorGradingPanel() {
  const { state, dispatch } = useCustomTimeline();
  const track = state.tracks.find(t => t.id === state.selectedTrackId);
  const clip = track?.clips.find(c => c.id === state.selectedClipId);

  const update = useCallback((updates: Partial<TimelineClip>) => {
    if (!state.selectedClipId || !state.selectedTrackId) return;
    dispatch({ type: "UPDATE_CLIP", trackId: state.selectedTrackId, clipId: state.selectedClipId, updates });
  }, [state.selectedClipId, state.selectedTrackId, dispatch]);

  if (!clip || (clip.type !== "video" && clip.type !== "image")) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-3">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "hsla(280,70%,50%,0.06)", border: "1px dashed hsla(280,70%,50%,0.12)" }}>
          <Palette className="w-6 h-6 text-[hsla(280,70%,60%,0.25)]" />
        </div>
        <p className="text-[11px] font-semibold text-[hsla(0,0%,100%,0.35)]">No Visual Clip Selected</p>
        <p className="text-[9px] text-[hsla(0,0%,100%,0.2)] text-center max-w-[180px]">Select a video or image clip for color grading</p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 min-h-0">
      <div className="p-2.5 space-y-2.5">
        {/* Color Wheels — Lift / Gamma / Gain */}
        <Section title="Color Wheels" icon={<Palette className="w-3 h-3" />}>
          <div className="grid grid-cols-3 gap-1">
            <ColorWheel label="Shadows" hue={clip.shadowsHue ?? 0} onChange={v => update({ shadowsHue: v })} size={64} />
            <ColorWheel label="Midtones" hue={clip.midtonesHue ?? 0} onChange={v => update({ midtonesHue: v })} size={64} />
            <ColorWheel label="Highlights" hue={clip.highlightsHue ?? 0} onChange={v => update({ highlightsHue: v })} size={64} />
          </div>
        </Section>

        {/* Lift / Gamma / Gain */}
        <Section title="Lift / Gamma / Gain" icon={<Sun className="w-3 h-3" />}>
          <GradeSlider label="Lift" value={clip.lift ?? 0} min={-1} max={1} step={0.01} onChange={v => update({ lift: v })} icon={<span className="text-[8px]">▼</span>} />
          <GradeSlider label="Gamma" value={clip.gamma ?? 1} min={0.1} max={3} step={0.01} onChange={v => update({ gamma: v })} icon={<span className="text-[8px]">◉</span>} />
          <GradeSlider label="Gain" value={clip.gain ?? 1} min={0} max={3} step={0.01} onChange={v => update({ gain: v })} icon={<span className="text-[8px]">▲</span>} />
        </Section>

        {/* Temperature & Tint */}
        <Section title="White Balance" icon={<Thermometer className="w-3 h-3" />}>
          <GradeSlider label="Temperature" value={clip.temperature ?? 0} min={-100} max={100} step={1} onChange={v => update({ temperature: v })} icon={<Thermometer className="w-2.5 h-2.5" />} color="hsla(30,90%,55%,0.7)" />
          <GradeSlider label="Tint" value={clip.tint ?? 0} min={-100} max={100} step={1} onChange={v => update({ tint: v })} icon={<Droplets className="w-2.5 h-2.5" />} color="hsla(300,60%,55%,0.7)" />
        </Section>

        {/* Primary Corrections */}
        <Section title="Primary" icon={<Contrast className="w-3 h-3" />}>
          <GradeSlider label="Brightness" value={clip.brightness ?? 0} min={-100} max={100} step={1} onChange={v => update({ brightness: v })} icon={<SunMedium className="w-2.5 h-2.5" />} />
          <GradeSlider label="Contrast" value={clip.contrast ?? 0} min={-100} max={100} step={1} onChange={v => update({ contrast: v })} icon={<Contrast className="w-2.5 h-2.5" />} />
          <GradeSlider label="Saturation" value={clip.saturation ?? 0} min={-100} max={100} step={1} onChange={v => update({ saturation: v })} icon={<Droplets className="w-2.5 h-2.5" />} />
        </Section>

        {/* Reset */}
        <button
          onClick={() => update({ brightness: 0, contrast: 0, saturation: 0, temperature: 0, tint: 0, gamma: 1, lift: 0, gain: 1, shadowsHue: 0, midtonesHue: 0, highlightsHue: 0 })}
          className="w-full py-2 rounded-xl text-[10px] font-bold text-[hsla(0,0%,100%,0.4)] hover:text-[hsla(0,0%,100%,0.7)] bg-[hsla(0,0%,100%,0.03)] hover:bg-[hsla(0,0%,100%,0.06)] border border-[hsla(0,0%,100%,0.05)] transition-all"
        >
          Reset All Color
        </button>
      </div>
    </ScrollArea>
  );
});
