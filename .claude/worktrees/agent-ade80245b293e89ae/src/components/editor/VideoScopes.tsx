/**
 * VideoScopes — Professional waveform/vectorscope/histogram monitors
 * Renders simulated scope displays like DaVinci Resolve
 */

import { memo, useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

type ScopeMode = "waveform" | "vectorscope" | "histogram" | "parade";

const SCOPE_LABELS: Record<ScopeMode, string> = {
  waveform: "Waveform",
  vectorscope: "Vectorscope",
  histogram: "Histogram",
  parade: "RGB Parade",
};

function drawWaveform(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  
  // Background grid
  ctx.strokeStyle = "hsla(0, 0%, 100%, 0.04)";
  ctx.lineWidth = 0.5;
  for (let y = 0; y <= 10; y++) {
    const yPos = (y / 10) * h;
    ctx.beginPath();
    ctx.moveTo(0, yPos);
    ctx.lineTo(w, yPos);
    ctx.stroke();
  }
  
  // IRE labels
  ctx.fillStyle = "hsla(0, 0%, 100%, 0.2)";
  ctx.font = "8px monospace";
  ctx.textAlign = "right";
  ["100", "75", "50", "25", "0"].forEach((label, i) => {
    ctx.fillText(label, w - 4, (i / 4) * h + 3);
  });

  // Waveform data (simulated)
  const seed = Date.now() % 1000;
  ctx.globalAlpha = 0.6;
  
  // Luma channel
  ctx.strokeStyle = "hsl(120, 70%, 50%)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x < w; x++) {
    const noise = Math.sin(x * 0.05 + seed * 0.01) * 0.15;
    const base = 0.3 + Math.sin(x * 0.02) * 0.2 + noise;
    const y = (1 - Math.max(0, Math.min(1, base))) * h;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  
  // Add scattered points for density
  ctx.fillStyle = "hsla(120, 70%, 50%, 0.3)";
  for (let i = 0; i < 200; i++) {
    const x = (Math.sin(i * 7.3 + seed * 0.003) * 0.5 + 0.5) * w;
    const base = 0.3 + Math.sin(x * 0.02) * 0.2;
    const scatter = (Math.cos(i * 3.7) * 0.15);
    const y = (1 - Math.max(0, Math.min(1, base + scatter))) * h;
    ctx.fillRect(x, y, 1, 1);
  }
  
  ctx.globalAlpha = 1;
}

function drawVectorscope(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(cx, cy) - 10;
  
  // Graticule circle
  ctx.strokeStyle = "hsla(0, 0%, 100%, 0.08)";
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.75, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2);
  ctx.stroke();
  
  // Crosshair
  ctx.beginPath();
  ctx.moveTo(cx - r, cy);
  ctx.lineTo(cx + r, cy);
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx, cy + r);
  ctx.stroke();
  
  // Color targets (SMPTE bars positions)
  const targets = [
    { angle: -13, dist: 0.6, color: "hsl(0, 80%, 55%)", label: "R" },
    { angle: 60, dist: 0.55, color: "hsl(120, 70%, 45%)", label: "G" },
    { angle: 167, dist: 0.6, color: "hsl(240, 70%, 55%)", label: "B" },
    { angle: -76, dist: 0.5, color: "hsl(300, 60%, 50%)", label: "Mg" },
    { angle: 104, dist: 0.45, color: "hsl(60, 70%, 45%)", label: "Yl" },
    { angle: -166, dist: 0.55, color: "hsl(180, 60%, 45%)", label: "Cy" },
  ];
  
  targets.forEach(({ angle, dist, color, label }) => {
    const rad = (angle * Math.PI) / 180;
    const x = cx + Math.cos(rad) * r * dist;
    const y = cy - Math.sin(rad) * r * dist;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.4;
    ctx.font = "7px monospace";
    ctx.textAlign = "center";
    ctx.fillText(label, x, y - 7);
  });
  
  // Simulated scatter plot
  ctx.globalAlpha = 0.5;
  const seed = Date.now() % 1000;
  for (let i = 0; i < 300; i++) {
    const angle = (Math.sin(i * 2.3 + seed * 0.002) * 0.5 + Math.cos(i * 1.7) * 0.5) * Math.PI;
    const dist = Math.abs(Math.sin(i * 0.7 + seed * 0.001)) * r * 0.4;
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    const hue = (angle / Math.PI) * 180 + 180;
    ctx.fillStyle = `hsl(${hue}, 60%, 55%)`;
    ctx.fillRect(x, y, 1.5, 1.5);
  }
  ctx.globalAlpha = 1;
}

function drawHistogram(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  
  // Grid
  ctx.strokeStyle = "hsla(0, 0%, 100%, 0.04)";
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= 4; x++) {
    const xPos = (x / 4) * w;
    ctx.beginPath();
    ctx.moveTo(xPos, 0);
    ctx.lineTo(xPos, h);
    ctx.stroke();
  }

  const bins = 64;
  const channels = [
    { color: "hsla(0, 80%, 55%, 0.4)", offset: 0 },
    { color: "hsla(120, 70%, 45%, 0.4)", offset: 1 },
    { color: "hsla(220, 80%, 55%, 0.4)", offset: 2 },
  ];
  
  const seed = Date.now() % 1000;
  
  channels.forEach(({ color, offset }) => {
    ctx.fillStyle = color;
    for (let i = 0; i < bins; i++) {
      const x = (i / bins) * w;
      const bw = w / bins;
      // Bell curve with some noise
      const norm = i / bins;
      const bell = Math.exp(-Math.pow((norm - 0.45 - offset * 0.05) * 3, 2));
      const noise = Math.sin(i * 7 + offset * 50 + seed * 0.01) * 0.15;
      const val = Math.max(0, bell + noise) * 0.8;
      ctx.fillRect(x, h - val * h, bw - 0.5, val * h);
    }
  });
}

function drawParade(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  
  const third = w / 3;
  const seed = Date.now() % 1000;
  
  // Separator lines
  ctx.strokeStyle = "hsla(0, 0%, 100%, 0.06)";
  ctx.lineWidth = 0.5;
  [1, 2].forEach(i => {
    ctx.beginPath();
    ctx.moveTo(third * i, 0);
    ctx.lineTo(third * i, h);
    ctx.stroke();
  });
  
  // Grid
  for (let y = 0; y <= 4; y++) {
    const yPos = (y / 4) * h;
    ctx.beginPath();
    ctx.moveTo(0, yPos);
    ctx.lineTo(w, yPos);
    ctx.stroke();
  }
  
  const channels = [
    { color: "hsla(0, 80%, 55%, 0.5)", startX: 0 },
    { color: "hsla(120, 70%, 50%, 0.5)", startX: third },
    { color: "hsla(220, 80%, 55%, 0.5)", startX: third * 2 },
  ];
  
  channels.forEach(({ color, startX }, ci) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < third; x++) {
      const noise = Math.sin(x * 0.08 + ci * 30 + seed * 0.005) * 0.15;
      const base = 0.35 + Math.sin(x * 0.03 + ci * 10) * 0.2 + noise;
      const y = (1 - Math.max(0, Math.min(1, base))) * h;
      if (x === 0) ctx.moveTo(startX + x, y);
      else ctx.lineTo(startX + x, y);
    }
    ctx.stroke();
    
    // Scatter
    ctx.fillStyle = color;
    for (let i = 0; i < 80; i++) {
      const x = startX + (Math.sin(i * 5.1 + ci * 20) * 0.5 + 0.5) * third;
      const base = 0.35 + Math.sin(x * 0.03 + ci * 10) * 0.2;
      const scatter = Math.cos(i * 3.3 + ci * 7) * 0.12;
      const y = (1 - Math.max(0, Math.min(1, base + scatter))) * h;
      ctx.fillRect(x, y, 1, 1);
    }
  });
}

export const VideoScopes = memo(function VideoScopes({ visible }: { visible: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<ScopeMode>("waveform");
  
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !visible) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    const w = canvas.width;
    const h = canvas.height;
    
    switch (mode) {
      case "waveform": drawWaveform(ctx, w, h); break;
      case "vectorscope": drawVectorscope(ctx, w, h); break;
      case "histogram": drawHistogram(ctx, w, h); break;
      case "parade": drawParade(ctx, w, h); break;
    }
  }, [mode, visible]);
  
  useEffect(() => {
    if (!visible) return;
    draw();
    const interval = setInterval(draw, 2000);
    return () => clearInterval(interval);
  }, [draw, visible]);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => {
      canvas.width = canvas.clientWidth * (window.devicePixelRatio > 1 ? 2 : 1);
      canvas.height = canvas.clientHeight * (window.devicePixelRatio > 1 ? 2 : 1);
      draw();
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [draw]);

  if (!visible) return null;

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{
        height: 140,
        background: "hsl(220, 14%, 3%)",
        borderTop: "1px solid hsla(0, 0%, 100%, 0.06)",
      }}
    >
      {/* Scope mode selector */}
      <div
        className="shrink-0 flex items-center gap-0.5 px-2 py-1"
        style={{
          background: "hsla(0, 0%, 100%, 0.02)",
          borderBottom: "1px solid hsla(0, 0%, 100%, 0.04)",
        }}
      >
        {(Object.keys(SCOPE_LABELS) as ScopeMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              "px-2 py-0.5 rounded text-[9px] font-semibold transition-all",
              mode === m
                ? "bg-[hsla(215,100%,50%,0.15)] text-[hsl(215,100%,70%)]"
                : "text-[hsla(0,0%,100%,0.3)] hover:text-[hsla(0,0%,100%,0.6)]"
            )}
          >
            {SCOPE_LABELS[m]}
          </button>
        ))}
      </div>
      
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="flex-1 w-full min-h-0"
        style={{ imageRendering: "auto" }}
      />
    </div>
  );
});
