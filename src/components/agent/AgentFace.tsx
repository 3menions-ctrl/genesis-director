/**
 * APEX Agent — Hoppy Avatar Face
 * 
 * Uses the Hoppy avatar image with:
 * - Holographic glow aura that reacts to state
 * - Orbiting particle rings
 * - Breathing/pulse animation
 * - State indicator
 */

import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";

interface AgentFaceProps {
  state: "idle" | "thinking" | "speaking" | "listening";
  className?: string;
  size?: number;
}

const HOPPY_URL = "https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/avatars/batch-v2/hoppy-1770094130120.png";

export function AgentFace({ state, className, size = 160 }: AgentFaceProps) {
  const [breathPhase, setBreathPhase] = useState(0);

  // Breathing animation
  useEffect(() => {
    let frame = 0;
    const id = setInterval(() => {
      frame += 0.04;
      setBreathPhase(Math.sin(frame) * 0.5 + 0.5);
    }, 50);
    return () => clearInterval(id);
  }, []);

  const glowIntensity = state === "thinking" ? 0.55 : state === "speaking" ? 0.7 : state === "listening" ? 0.5 : 0.25;
  const auraScale = 1 + breathPhase * 0.025;
  const ringSpeed = state === "thinking" ? "6s" : state === "speaking" ? "4s" : "14s";
  const borderGlow = state === "speaking"
    ? "hsl(263 70% 58% / 0.6)"
    : state === "thinking"
    ? "hsl(42 100% 55% / 0.5)"
    : state === "listening"
    ? "hsl(195 90% 50% / 0.5)"
    : "hsl(263 50% 50% / 0.25)";

  return (
    <div
      className={cn("relative flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      {/* Holographic aura */}
      <div
        className="absolute inset-[-20%] rounded-full"
        style={{
          background: `
            radial-gradient(circle at 40% 35%, hsl(263 70% 60% / ${glowIntensity * 0.4}) 0%, transparent 55%),
            radial-gradient(circle at 60% 65%, hsl(195 85% 55% / ${glowIntensity * 0.3}) 0%, transparent 55%)
          `,
          transform: `scale(${auraScale})`,
          transition: "all 0.8s ease",
          filter: "blur(10px)",
        }}
      />

      {/* Orbiting ring */}
      <svg
        className="absolute inset-[-8%]"
        viewBox="0 0 200 200"
        style={{
          animation: `agent-orbit ${ringSpeed} linear infinite`,
          opacity: 0.5,
        }}
      >
        <circle cx="100" cy="100" r="92" fill="none" stroke="hsl(263 60% 55% / 0.15)" strokeWidth="0.5" strokeDasharray="3 10" />
        <circle cx="100" cy="8" r="2.5" fill="hsl(263 70% 65% / 0.7)">
          <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite" />
        </circle>
        <circle cx="192" cy="100" r="1.5" fill="hsl(195 85% 60% / 0.5)">
          <animate attributeName="opacity" values="0.3;0.8;0.3" dur="3s" repeatCount="indefinite" />
        </circle>
      </svg>

      {/* Counter-rotating ring */}
      <svg
        className="absolute inset-[3%]"
        viewBox="0 0 200 200"
        style={{
          animation: `agent-orbit ${state === "speaking" ? "5s" : "20s"} linear infinite reverse`,
          opacity: 0.35,
        }}
      >
        <circle cx="100" cy="100" r="88" fill="none" stroke="hsl(195 80% 55% / 0.1)" strokeWidth="0.5" strokeDasharray="2 16" />
        <circle cx="12" cy="100" r="1.5" fill="hsl(195 80% 65% / 0.5)" />
      </svg>

      {/* Avatar image container */}
      <div
        className="relative z-10 rounded-full overflow-hidden"
        style={{
          width: size * 0.72,
          height: size * 0.72,
          boxShadow: `0 0 20px ${borderGlow}, 0 0 40px ${borderGlow}, inset 0 0 15px hsl(263 30% 10% / 0.5)`,
          border: `1.5px solid ${borderGlow}`,
          transition: "box-shadow 0.5s ease, border-color 0.5s ease",
          transform: `scale(${1 + breathPhase * 0.015})`,
        }}
      >
        <img
          src={HOPPY_URL}
          alt="APEX Agent"
          className="w-full h-full object-cover object-top"
          loading="eager"
        />

        {/* Speaking overlay pulse */}
        {state === "speaking" && (
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(circle, transparent 50%, hsl(263 70% 50% / 0.12) 100%)",
              animation: "agent-pulse 1.5s ease-in-out infinite",
            }}
          />
        )}

        {/* Thinking overlay */}
        {state === "thinking" && (
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(circle, transparent 40%, hsl(42 100% 50% / 0.08) 100%)",
              animation: "agent-pulse 2s ease-in-out infinite",
            }}
          />
        )}
      </div>

      {/* State indicator */}
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1">
        <div
          className={cn(
            "h-1.5 w-1.5 rounded-full transition-all duration-500",
            state === "idle" && "bg-[hsl(160_84%_45%)] shadow-[0_0_6px_hsl(160_84%_45%/0.6)]",
            state === "thinking" && "bg-[hsl(42_100%_55%)] shadow-[0_0_8px_hsl(42_100%_55%/0.6)] animate-pulse",
            state === "speaking" && "bg-[hsl(263_70%_58%)] shadow-[0_0_8px_hsl(263_70%_58%/0.6)]",
            state === "listening" && "bg-[hsl(195_90%_50%)] shadow-[0_0_8px_hsl(195_90%_50%/0.6)]",
          )}
        />
        <span className={cn(
          "text-[8px] uppercase tracking-[0.15em] font-medium transition-colors duration-500",
          state === "idle" && "text-[hsl(160_84%_45%/0.7)]",
          state === "thinking" && "text-[hsl(42_100%_55%/0.7)]",
          state === "speaking" && "text-[hsl(263_70%_58%/0.7)]",
          state === "listening" && "text-[hsl(195_90%_50%/0.7)]",
        )}>
          {state}
        </span>
      </div>
    </div>
  );
}
