interface PlayerTimecodeHUDProps {
  time: number;
  fps: number;
  width: number;
  height: number;
  isRendering: boolean;
}

/** Premium floating timecode HUD — broadcast NLE feel */
export function PlayerTimecodeHUD({
  time,
  fps,
  width,
  height,
  isRendering,
}: PlayerTimecodeHUDProps) {
  const safeFps = Math.max(1, fps || 24);
  const totalFrames = Math.floor(time * safeFps);
  const hh = Math.floor(time / 3600).toString().padStart(2, "0");
  const mm = Math.floor((time % 3600) / 60).toString().padStart(2, "0");
  const ss = Math.floor(time % 60).toString().padStart(2, "0");
  const ff = (totalFrames % safeFps).toString().padStart(2, "0");

  return (
    <div
      className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-xl"
      style={{
        background: "linear-gradient(180deg, hsla(220, 14%, 8%, 0.72), hsla(220, 14%, 4%, 0.65))",
        boxShadow:
          "inset 0 1px 0 hsla(0,0%,100%,0.08), 0 0 0 1px hsla(0,0%,100%,0.06), 0 8px 24px -8px hsla(0,0%,0%,0.7), 0 0 24px -6px hsl(var(--accent) / 0.35)",
      }}
    >
      <span className="relative flex items-center justify-center w-2 h-2">
        <span
          className="absolute inset-0 rounded-full"
          style={{
            background: isRendering ? "hsl(0,80%,60%)" : "hsl(142, 70%, 55%)",
            boxShadow: isRendering
              ? "0 0 10px hsla(0,80%,60%,0.85)"
              : "0 0 10px hsla(142,72%,55%,0.7)",
          }}
        />
        <span
          className="absolute inset-0 rounded-full animate-ping opacity-40"
          style={{ background: isRendering ? "hsl(0,80%,60%)" : "hsl(142,70%,55%)" }}
        />
      </span>

      <span
        className="font-mono text-[11px] tabular-nums tracking-[0.10em] text-foreground/95"
        style={{ textShadow: "0 0 8px hsl(var(--accent) / 0.35)" }}
      >
        {hh}:{mm}:{ss}
        <span className="text-muted-foreground">:</span>
        <span style={{ color: "hsl(200,100%,75%)" }}>{ff}</span>
      </span>

      <span className="w-px h-3 bg-border/60" />
      <span className="font-mono text-[9px] tabular-nums tracking-[0.18em] text-muted-foreground uppercase">
        {width}×{height} · {safeFps}p
      </span>
    </div>
  );
}