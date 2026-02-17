/**
 * Hoppy Agent Face — Refined Compact Avatar 🐰
 * 
 * Minimal, elegant state-reactive avatar:
 * - Soft glow ring that shifts by state
 * - Subtle pulse animation
 * - Clean, no orbital clutter
 */

import { cn } from "@/lib/utils";

interface AgentFaceProps {
  state: "idle" | "thinking" | "speaking" | "listening";
  className?: string;
  size?: number;
}

const stateRing: Record<string, string> = {
  idle: "ring-emerald-400/20",
  thinking: "ring-amber-400/30",
  speaking: "ring-primary/35",
  listening: "ring-cyan-400/25",
};

const stateGlow: Record<string, string> = {
  idle: "shadow-[0_0_20px_hsl(160_60%_45%/0.1)]",
  thinking: "shadow-[0_0_24px_hsl(45_90%_55%/0.15)]",
  speaking: "shadow-[0_0_28px_hsl(var(--primary)/0.2)]",
  listening: "shadow-[0_0_20px_hsl(190_80%_50%/0.12)]",
};

export function AgentFace({ state, className, size = 80 }: AgentFaceProps) {
  return (
    <div
      className={cn("relative flex items-center justify-center", className)}
      style={{ width: size + 12, height: size + 12 }}
    >
      {/* Soft ambient glow */}
      <div
        className="absolute inset-0 rounded-full animate-pulse opacity-50"
        style={{
          background: `radial-gradient(circle, hsl(var(--primary) / 0.08) 0%, transparent 70%)`,
          animationDuration: "3s",
        }}
      />

      {/* Face container */}
      <div
        className={cn(
          "relative rounded-full overflow-hidden z-10 ring-2 transition-all duration-500",
          stateRing[state],
          stateGlow[state],
        )}
        style={{ width: size, height: size }}
      >
        <video
          src="/hoppy-blink.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover scale-[1.15]"
          style={{ objectPosition: "50% 25%" }}
        />
      </div>
    </div>
  );
}
