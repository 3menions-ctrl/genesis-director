/**
 * APEX Agent — Animated Digital Face
 * 
 * SVG-based futuristic AI face with:
 * - Idle breathing/eye blink animations
 * - Lip-sync simulation when speaking
 * - Thinking state (eyes narrow, glow pulse)
 * - Ring/orbit decoration
 */

import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";

interface AgentFaceProps {
  state: "idle" | "thinking" | "speaking" | "listening";
  className?: string;
  size?: number;
}

export function AgentFace({ state, className, size = 160 }: AgentFaceProps) {
  const [blinkPhase, setBlinkPhase] = useState(false);
  const [mouthOpen, setMouthOpen] = useState(0);
  const animFrameRef = useRef<number>(0);
  const speakIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Blink every 3-5s
  useEffect(() => {
    const blink = () => {
      setBlinkPhase(true);
      setTimeout(() => setBlinkPhase(false), 150);
    };
    const id = setInterval(blink, 3000 + Math.random() * 2000);
    return () => clearInterval(id);
  }, []);

  // Lip-sync simulation when speaking
  useEffect(() => {
    if (state === "speaking") {
      speakIntervalRef.current = setInterval(() => {
        setMouthOpen(Math.random() * 0.8 + 0.2);
      }, 80);
    } else {
      setMouthOpen(0);
      if (speakIntervalRef.current) {
        clearInterval(speakIntervalRef.current);
        speakIntervalRef.current = null;
      }
    }
    return () => {
      if (speakIntervalRef.current) {
        clearInterval(speakIntervalRef.current);
      }
    };
  }, [state]);

  const eyeScaleY = blinkPhase ? 0.1 : state === "thinking" ? 0.6 : 1;
  const glowIntensity = state === "thinking" ? 0.6 : state === "speaking" ? 0.8 : 0.3;
  const ringSpeed = state === "thinking" ? "8s" : state === "speaking" ? "4s" : "12s";
  const mouthHeight = 2 + mouthOpen * 8;

  return (
    <div
      className={cn("relative flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      {/* Outer glow ring */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle, hsl(263 70% 58% / ${glowIntensity}) 0%, transparent 70%)`,
          animation: `agent-pulse 3s ease-in-out infinite`,
          transition: "all 0.5s ease",
        }}
      />

      {/* Orbiting ring */}
      <svg
        className="absolute inset-0"
        viewBox="0 0 160 160"
        style={{ animation: `agent-orbit ${ringSpeed} linear infinite` }}
      >
        <circle
          cx="80" cy="80" r="72"
          fill="none"
          stroke="hsl(263 70% 58% / 0.3)"
          strokeWidth="1"
          strokeDasharray="8 12"
        />
        <circle cx="80" cy="8" r="3" fill="hsl(263 70% 58% / 0.8)" />
      </svg>

      {/* Secondary orbit */}
      <svg
        className="absolute inset-0"
        viewBox="0 0 160 160"
        style={{ animation: `agent-orbit ${ringSpeed} linear infinite reverse` }}
      >
        <circle
          cx="80" cy="80" r="64"
          fill="none"
          stroke="hsl(195 90% 50% / 0.2)"
          strokeWidth="0.5"
          strokeDasharray="4 16"
        />
        <circle cx="80" cy="16" r="2" fill="hsl(195 90% 50% / 0.6)" />
      </svg>

      {/* Face SVG */}
      <svg viewBox="0 0 100 100" className="relative z-10" style={{ width: size * 0.65, height: size * 0.65 }}>
        {/* Head shape — hexagonal futuristic */}
        <defs>
          <linearGradient id="faceGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(250 12% 16%)" />
            <stop offset="100%" stopColor="hsl(250 15% 8%)" />
          </linearGradient>
          <filter id="faceGlow">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
          </filter>
        </defs>

        {/* Head */}
        <path
          d="M50 10 L82 25 L82 65 L50 85 L18 65 L18 25 Z"
          fill="url(#faceGrad)"
          stroke="hsl(263 70% 58% / 0.4)"
          strokeWidth="1"
        />

        {/* Inner face lines */}
        <path
          d="M50 15 L78 28 L78 62 L50 80 L22 62 L22 28 Z"
          fill="none"
          stroke="hsl(263 70% 58% / 0.15)"
          strokeWidth="0.5"
        />

        {/* Left eye */}
        <g transform={`translate(35, 40) scale(1, ${eyeScaleY})`} style={{ transition: "transform 0.1s ease" }}>
          <ellipse cx="0" cy="0" rx="6" ry="4" fill="hsl(195 90% 50% / 0.9)" />
          <ellipse cx="0" cy="0" rx="3" ry="2" fill="hsl(195 90% 80%)" />
          <ellipse cx="0" cy="0" rx="1" ry="1" fill="white" />
        </g>

        {/* Right eye */}
        <g transform={`translate(65, 40) scale(1, ${eyeScaleY})`} style={{ transition: "transform 0.1s ease" }}>
          <ellipse cx="0" cy="0" rx="6" ry="4" fill="hsl(195 90% 50% / 0.9)" />
          <ellipse cx="0" cy="0" rx="3" ry="2" fill="hsl(195 90% 80%)" />
          <ellipse cx="0" cy="0" rx="1" ry="1" fill="white" />
        </g>

        {/* Nose line */}
        <line x1="50" y1="44" x2="50" y2="54" stroke="hsl(263 70% 58% / 0.2)" strokeWidth="0.5" />

        {/* Mouth */}
        <ellipse
          cx="50"
          cy="62"
          rx="8"
          ry={mouthHeight}
          fill={state === "speaking" ? "hsl(263 70% 40% / 0.6)" : "hsl(263 70% 30% / 0.3)"}
          stroke="hsl(263 70% 58% / 0.4)"
          strokeWidth="0.5"
          style={{ transition: "ry 0.05s ease" }}
        />

        {/* Chin accent */}
        <line x1="40" y1="72" x2="60" y2="72" stroke="hsl(263 70% 58% / 0.15)" strokeWidth="0.5" />

        {/* Forehead accent */}
        <line x1="38" y1="22" x2="62" y2="22" stroke="hsl(195 90% 50% / 0.3)" strokeWidth="0.5" />

        {/* Side accents */}
        <circle cx="20" cy="42" r="1.5" fill="hsl(263 70% 58% / 0.4)" />
        <circle cx="80" cy="42" r="1.5" fill="hsl(263 70% 58% / 0.4)" />
      </svg>

      {/* State indicator */}
      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2">
        <div
          className={cn(
            "h-2 w-2 rounded-full transition-all duration-300",
            state === "idle" && "bg-[hsl(160_84%_45%)] shadow-[0_0_8px_hsl(160_84%_45%/0.5)]",
            state === "thinking" && "bg-[hsl(42_100%_55%)] shadow-[0_0_8px_hsl(42_100%_55%/0.5)] animate-pulse",
            state === "speaking" && "bg-[hsl(263_70%_58%)] shadow-[0_0_8px_hsl(263_70%_58%/0.5)]",
            state === "listening" && "bg-[hsl(195_90%_50%)] shadow-[0_0_8px_hsl(195_90%_50%/0.5)]",
          )}
        />
      </div>
    </div>
  );
}
