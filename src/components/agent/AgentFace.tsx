/**
 * APEX Agent — Hoppy Avatar Face (Enhanced Animation)
 * 
 * Hoppy's avatar with rich CSS-based life:
 * - Organic breathing with subtle scale + translate
 * - Eye shine sweeps across the face
 * - Head micro-sway animation
 * - Speaking: pulsing ring + vibrant glow
 * - Thinking: golden scanning line
 * - Listening: ripple rings
 */

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface AgentFaceProps {
  state: "idle" | "thinking" | "speaking" | "listening";
  className?: string;
  size?: number;
}

const HOPPY_URL = "https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/avatars/batch-v2/hoppy-1770094130120.png";

export function AgentFace({ state, className, size = 160 }: AgentFaceProps) {
  const [breathPhase, setBreathPhase] = useState(0);

  useEffect(() => {
    let frame = 0;
    const id = setInterval(() => {
      frame += 0.035;
      setBreathPhase(frame);
    }, 40);
    return () => clearInterval(id);
  }, []);

  const breathScale = 1 + Math.sin(breathPhase) * 0.012;
  const breathY = Math.sin(breathPhase * 0.8) * 1.2;
  const headSway = Math.sin(breathPhase * 0.3) * 0.6;

  const glowColor = state === "speaking"
    ? "hsl(263 70% 58%)"
    : state === "thinking"
    ? "hsl(42 100% 55%)"
    : state === "listening"
    ? "hsl(195 90% 50%)"
    : "hsl(263 50% 50%)";

  const glowIntensity = state === "idle" ? 0.2 : 0.55;
  const ringSpeed = state === "thinking" ? "6s" : state === "speaking" ? "4s" : "14s";
  const imgSize = size * 0.72;

  return (
    <div
      className={cn("relative flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      {/* Ambient aura */}
      <div
        className="absolute inset-[-25%] rounded-full pointer-events-none"
        style={{
          background: `
            radial-gradient(circle at 45% 40%, ${glowColor.replace(")", ` / ${glowIntensity * 0.35})`)} 0%, transparent 55%),
            radial-gradient(circle at 55% 60%, hsl(195 85% 55% / ${glowIntensity * 0.2}) 0%, transparent 50%)
          `,
          transition: "all 1s ease",
          filter: "blur(12px)",
          transform: `scale(${1 + Math.sin(breathPhase * 0.6) * 0.04})`,
        }}
      />

      {/* Orbiting ring */}
      <svg
        className="absolute inset-[-8%]"
        viewBox="0 0 200 200"
        style={{ animation: `agent-orbit ${ringSpeed} linear infinite`, opacity: 0.45 }}
      >
        <circle cx="100" cy="100" r="92" fill="none" stroke={`${glowColor.replace(")", " / 0.15)")}`} strokeWidth="0.5" strokeDasharray="3 10" />
        <circle cx="100" cy="8" r="2.5" fill={`${glowColor.replace(")", " / 0.7)")}`}>
          <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite" />
        </circle>
      </svg>

      {/* Counter ring */}
      <svg
        className="absolute inset-[3%]"
        viewBox="0 0 200 200"
        style={{ animation: `agent-orbit 20s linear infinite reverse`, opacity: 0.3 }}
      >
        <circle cx="100" cy="100" r="88" fill="none" stroke="hsl(195 80% 55% / 0.1)" strokeWidth="0.5" strokeDasharray="2 16" />
        <circle cx="12" cy="100" r="1.5" fill="hsl(195 80% 65% / 0.5)" />
      </svg>

      {/* Speaking: animated ring pulse */}
      {state === "speaking" && (
        <>
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              width: imgSize + 16,
              height: imgSize + 16,
              border: "1.5px solid hsl(263 70% 58% / 0.4)",
              animation: "agent-speak-ring 1.2s ease-out infinite",
            }}
          />
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              width: imgSize + 16,
              height: imgSize + 16,
              border: "1px solid hsl(263 70% 58% / 0.25)",
              animation: "agent-speak-ring 1.2s ease-out infinite 0.4s",
            }}
          />
        </>
      )}

      {/* Listening: ripple rings */}
      {state === "listening" && (
        <>
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              width: imgSize + 12,
              height: imgSize + 12,
              border: "1px solid hsl(195 90% 50% / 0.3)",
              animation: "agent-speak-ring 2s ease-out infinite",
            }}
          />
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              width: imgSize + 12,
              height: imgSize + 12,
              border: "1px solid hsl(195 90% 50% / 0.2)",
              animation: "agent-speak-ring 2s ease-out infinite 0.7s",
            }}
          />
        </>
      )}

      {/* Avatar image */}
      <div
        className="relative z-10 rounded-full overflow-hidden"
        style={{
          width: imgSize,
          height: imgSize,
          boxShadow: `
            0 0 ${state === "idle" ? 15 : 25}px ${glowColor.replace(")", ` / ${glowIntensity})`)} ,
            0 0 ${state === "idle" ? 30 : 50}px ${glowColor.replace(")", ` / ${glowIntensity * 0.5})`)} ,
            inset 0 0 20px hsl(260 30% 5% / 0.4)
          `,
          border: `1.5px solid ${glowColor.replace(")", ` / ${glowIntensity + 0.1})`)}`,
          transition: "box-shadow 0.6s ease, border-color 0.6s ease",
          transform: `scale(${breathScale}) translateY(${breathY}px) translateX(${headSway}px)`,
        }}
      >
        <img
          src={HOPPY_URL}
          alt="APEX Agent — Hoppy"
          className="w-full h-full object-cover object-top"
          loading="eager"
          draggable={false}
        />

        {/* Eye shine sweep — subtle highlight moving across */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(105deg, transparent 30%, hsl(0 0% 100% / 0.07) 45%, transparent 55%)",
            animation: "agent-eye-shine 5s ease-in-out infinite",
          }}
        />

        {/* Thinking scan line */}
        {state === "thinking" && (
          <div
            className="absolute inset-x-0 pointer-events-none"
            style={{
              height: 2,
              background: "linear-gradient(90deg, transparent, hsl(42 100% 55% / 0.4), transparent)",
              animation: "agent-scan-line 1.5s ease-in-out infinite",
            }}
          />
        )}

        {/* Speaking voice visualizer overlay at bottom */}
        {state === "speaking" && (
          <div
            className="absolute bottom-0 inset-x-0 h-[30%] pointer-events-none"
            style={{
              background: "linear-gradient(to top, hsl(263 70% 40% / 0.15), transparent)",
              animation: "agent-pulse 0.8s ease-in-out infinite",
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

      {/* Injected keyframes */}
      <style>{`
        @keyframes agent-speak-ring {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.35); opacity: 0; }
        }
        @keyframes agent-eye-shine {
          0%, 100% { transform: translateX(-80%); }
          50% { transform: translateX(80%); }
        }
        @keyframes agent-scan-line {
          0% { top: 10%; }
          50% { top: 85%; }
          100% { top: 10%; }
        }
      `}</style>
    </div>
  );
}
