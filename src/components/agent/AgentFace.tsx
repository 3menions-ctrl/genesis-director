/**
 * APEX Agent — Premium Digital Face
 * 
 * A beautiful, modern, lifelike-yet-digital AI face:
 * - Soft organic head shape with skin-like gradients
 * - Luminous iris eyes with pupil dilation
 * - Subtle breathing animation
 * - Neural circuit accents
 * - Holographic glow aura
 */

import { useEffect, useState, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";

interface AgentFaceProps {
  state: "idle" | "thinking" | "speaking" | "listening";
  className?: string;
  size?: number;
}

export function AgentFace({ state, className, size = 160 }: AgentFaceProps) {
  const [blinkPhase, setBlinkPhase] = useState(false);
  const [mouthOpen, setMouthOpen] = useState(0);
  const [breathPhase, setBreathPhase] = useState(0);
  const speakIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const breathRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Blink every 3-5s
  useEffect(() => {
    const blink = () => {
      setBlinkPhase(true);
      setTimeout(() => setBlinkPhase(false), 120);
    };
    const id = setInterval(blink, 3000 + Math.random() * 2000);
    return () => clearInterval(id);
  }, []);

  // Breathing
  useEffect(() => {
    let frame = 0;
    breathRef.current = setInterval(() => {
      frame += 0.05;
      setBreathPhase(Math.sin(frame) * 0.5 + 0.5);
    }, 50);
    return () => { if (breathRef.current) clearInterval(breathRef.current); };
  }, []);

  // Lip-sync
  useEffect(() => {
    if (state === "speaking") {
      speakIntervalRef.current = setInterval(() => {
        setMouthOpen(Math.random() * 0.7 + 0.3);
      }, 90);
    } else {
      setMouthOpen(0);
      if (speakIntervalRef.current) {
        clearInterval(speakIntervalRef.current);
        speakIntervalRef.current = null;
      }
    }
    return () => { if (speakIntervalRef.current) clearInterval(speakIntervalRef.current); };
  }, [state]);

  const eyeScaleY = blinkPhase ? 0.08 : state === "thinking" ? 0.65 : 1;
  const pupilSize = state === "thinking" ? 1.2 : state === "speaking" ? 1.8 : 1.5;
  const glowIntensity = state === "thinking" ? 0.5 : state === "speaking" ? 0.7 : 0.25;
  const auraScale = 1 + breathPhase * 0.03;
  const mouthRy = 1 + mouthOpen * 5;

  const uniqueId = useMemo(() => Math.random().toString(36).slice(2, 8), []);

  return (
    <div
      className={cn("relative flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      {/* Holographic aura */}
      <div
        className="absolute inset-[-15%] rounded-full"
        style={{
          background: `
            radial-gradient(circle at 40% 35%, hsl(263 70% 60% / ${glowIntensity * 0.4}) 0%, transparent 50%),
            radial-gradient(circle at 60% 65%, hsl(195 85% 55% / ${glowIntensity * 0.3}) 0%, transparent 50%)
          `,
          transform: `scale(${auraScale})`,
          transition: "all 0.8s ease",
          filter: "blur(8px)",
        }}
      />

      {/* Particle ring */}
      <svg
        className="absolute inset-[-5%]"
        viewBox="0 0 200 200"
        style={{
          animation: `agent-orbit ${state === "thinking" ? "6s" : "14s"} linear infinite`,
          opacity: 0.6,
        }}
      >
        <circle cx="100" cy="100" r="90" fill="none" stroke="hsl(263 60% 55% / 0.15)" strokeWidth="0.5" strokeDasharray="3 8" />
        <circle cx="100" cy="10" r="2.5" fill="hsl(263 70% 65% / 0.7)">
          <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite" />
        </circle>
        <circle cx="190" cy="100" r="1.5" fill="hsl(195 85% 60% / 0.5)">
          <animate attributeName="opacity" values="0.3;0.8;0.3" dur="3s" repeatCount="indefinite" />
        </circle>
      </svg>

      {/* Counter-rotating ring */}
      <svg
        className="absolute inset-[2%]"
        viewBox="0 0 200 200"
        style={{
          animation: `agent-orbit ${state === "speaking" ? "5s" : "18s"} linear infinite reverse`,
          opacity: 0.4,
        }}
      >
        <circle cx="100" cy="100" r="85" fill="none" stroke="hsl(195 80% 55% / 0.1)" strokeWidth="0.5" strokeDasharray="2 14" />
        <circle cx="15" cy="100" r="1.5" fill="hsl(195 80% 65% / 0.6)" />
      </svg>

      {/* Main face SVG */}
      <svg viewBox="0 0 120 140" className="relative z-10" style={{ width: size * 0.6, height: size * 0.7 }}>
        <defs>
          {/* Skin gradient — warm digital skin */}
          <radialGradient id={`skin-${uniqueId}`} cx="50%" cy="40%" r="55%">
            <stop offset="0%" stopColor="hsl(260 8% 22%)" />
            <stop offset="60%" stopColor="hsl(255 10% 15%)" />
            <stop offset="100%" stopColor="hsl(250 12% 10%)" />
          </radialGradient>

          {/* Iris gradient */}
          <radialGradient id={`iris-${uniqueId}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(195 95% 70%)" />
            <stop offset="40%" stopColor="hsl(210 85% 55%)" />
            <stop offset="80%" stopColor="hsl(263 70% 50%)" />
            <stop offset="100%" stopColor="hsl(263 60% 35%)" />
          </radialGradient>

          {/* Soft face shadow */}
          <filter id={`faceShadow-${uniqueId}`}>
            <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
            <feOffset dx="0" dy="2" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.3" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Eye glow */}
          <filter id={`eyeGlow-${uniqueId}`}>
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Lip gradient */}
          <linearGradient id={`lipGrad-${uniqueId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(350 30% 35% / 0.6)" />
            <stop offset="100%" stopColor="hsl(340 25% 25% / 0.4)" />
          </linearGradient>
        </defs>

        {/* Head shape — smooth organic oval with jaw */}
        <path
          d={`
            M60 12
            C82 12, 98 30, 98 55
            C98 78, 90 100, 78 112
            C72 118, 66 122, 60 124
            C54 122, 48 118, 42 112
            C30 100, 22 78, 22 55
            C22 30, 38 12, 60 12
            Z
          `}
          fill={`url(#skin-${uniqueId})`}
          filter={`url(#faceShadow-${uniqueId})`}
          stroke="hsl(263 50% 50% / 0.12)"
          strokeWidth="0.5"
        />

        {/* Subtle cheekbone highlights */}
        <ellipse cx="38" cy="65" rx="10" ry="6" fill="hsl(263 40% 40% / 0.06)" />
        <ellipse cx="82" cy="65" rx="10" ry="6" fill="hsl(263 40% 40% / 0.06)" />

        {/* Forehead highlight */}
        <ellipse cx="60" cy="32" rx="20" ry="10" fill="hsl(210 20% 30% / 0.08)" />

        {/* Neural circuit accents — subtle tech lines on temples */}
        <g opacity="0.2">
          <path d="M28 40 L24 48 L26 56" fill="none" stroke="hsl(195 80% 55%)" strokeWidth="0.4" />
          <circle cx="24" cy="48" r="0.8" fill="hsl(195 80% 65%)" />
          <path d="M92 40 L96 48 L94 56" fill="none" stroke="hsl(195 80% 55%)" strokeWidth="0.4" />
          <circle cx="96" cy="48" r="0.8" fill="hsl(195 80% 65%)" />
          {/* Forehead circuit */}
          <path d="M48 20 L52 16 L60 16 L68 16 L72 20" fill="none" stroke="hsl(263 60% 55%)" strokeWidth="0.3" />
          <circle cx="60" cy="16" r="0.6" fill="hsl(263 60% 65%)">
            <animate attributeName="opacity" values="0.3;1;0.3" dur="3s" repeatCount="indefinite" />
          </circle>
        </g>

        {/* Eyebrows — subtle arches */}
        <path
          d="M34 46 Q43 42, 52 45"
          fill="none"
          stroke="hsl(250 15% 28%)"
          strokeWidth="1.2"
          strokeLinecap="round"
          style={{ transition: "d 0.3s ease" }}
        />
        <path
          d="M68 45 Q77 42, 86 46"
          fill="none"
          stroke="hsl(250 15% 28%)"
          strokeWidth="1.2"
          strokeLinecap="round"
          style={{ transition: "d 0.3s ease" }}
        />

        {/* Left eye */}
        <g
          transform={`translate(43, 55) scale(1, ${eyeScaleY})`}
          style={{ transition: "transform 0.1s ease" }}
          filter={`url(#eyeGlow-${uniqueId})`}
        >
          {/* Eye white / sclera */}
          <ellipse cx="0" cy="0" rx="9" ry="5.5" fill="hsl(220 10% 12%)" />
          {/* Iris */}
          <ellipse cx="0" cy="0" rx="5.5" ry="5" fill={`url(#iris-${uniqueId})`} />
          {/* Pupil */}
          <ellipse cx="0" cy="0" rx={pupilSize} ry={pupilSize * 0.95} fill="hsl(240 10% 5%)"
            style={{ transition: "rx 0.3s ease, ry 0.3s ease" }}
          />
          {/* Specular highlight */}
          <ellipse cx="-1.5" cy="-1.5" rx="1.2" ry="0.8" fill="white" opacity="0.7" />
          <ellipse cx="1" cy="1.5" rx="0.6" ry="0.4" fill="white" opacity="0.3" />
        </g>

        {/* Right eye */}
        <g
          transform={`translate(77, 55) scale(1, ${eyeScaleY})`}
          style={{ transition: "transform 0.1s ease" }}
          filter={`url(#eyeGlow-${uniqueId})`}
        >
          <ellipse cx="0" cy="0" rx="9" ry="5.5" fill="hsl(220 10% 12%)" />
          <ellipse cx="0" cy="0" rx="5.5" ry="5" fill={`url(#iris-${uniqueId})`} />
          <ellipse cx="0" cy="0" rx={pupilSize} ry={pupilSize * 0.95} fill="hsl(240 10% 5%)"
            style={{ transition: "rx 0.3s ease, ry 0.3s ease" }}
          />
          <ellipse cx="-1.5" cy="-1.5" rx="1.2" ry="0.8" fill="white" opacity="0.7" />
          <ellipse cx="1" cy="1.5" rx="0.6" ry="0.4" fill="white" opacity="0.3" />
        </g>

        {/* Nose — soft minimal */}
        <path
          d="M58 68 Q60 74, 62 68"
          fill="none"
          stroke="hsl(255 8% 25% / 0.35)"
          strokeWidth="0.6"
          strokeLinecap="round"
        />
        <ellipse cx="56" cy="73" rx="2" ry="1" fill="hsl(255 8% 18% / 0.15)" />
        <ellipse cx="64" cy="73" rx="2" ry="1" fill="hsl(255 8% 18% / 0.15)" />

        {/* Nose bridge highlight */}
        <line x1="60" y1="56" x2="60" y2="68" stroke="hsl(220 15% 30% / 0.08)" strokeWidth="1.5" strokeLinecap="round" />

        {/* Mouth */}
        <g>
          {/* Upper lip line */}
          <path
            d={`M48 ${88 - mouthOpen * 1.5} Q54 ${85 - mouthOpen * 2}, 60 ${86 - mouthOpen * 2} Q66 ${85 - mouthOpen * 2}, 72 ${88 - mouthOpen * 1.5}`}
            fill="none"
            stroke="hsl(350 25% 35% / 0.5)"
            strokeWidth="0.7"
            strokeLinecap="round"
            style={{ transition: "d 0.05s ease" }}
          />
          {/* Mouth opening */}
          {mouthOpen > 0.1 && (
            <ellipse
              cx="60"
              cy={88}
              rx={7 + mouthOpen * 3}
              ry={mouthRy}
              fill={`url(#lipGrad-${uniqueId})`}
              stroke="hsl(350 20% 30% / 0.3)"
              strokeWidth="0.3"
              style={{ transition: "ry 0.05s ease, rx 0.05s ease" }}
            />
          )}
          {/* Lower lip */}
          <path
            d={`M50 ${90 + mouthOpen * 3} Q60 ${93 + mouthOpen * 3}, 70 ${90 + mouthOpen * 3}`}
            fill="none"
            stroke="hsl(350 20% 30% / 0.25)"
            strokeWidth="0.5"
            strokeLinecap="round"
            style={{ transition: "d 0.05s ease" }}
          />
        </g>

        {/* Jawline accent — very subtle */}
        <path
          d="M30 95 Q45 115, 60 118 Q75 115, 90 95"
          fill="none"
          stroke="hsl(260 20% 30% / 0.06)"
          strokeWidth="0.5"
        />

        {/* Ear accents (small) */}
        <ellipse cx="22" cy="58" rx="3" ry="7" fill="hsl(255 10% 14%)" stroke="hsl(263 50% 50% / 0.08)" strokeWidth="0.3" />
        <ellipse cx="98" cy="58" rx="3" ry="7" fill="hsl(255 10% 14%)" stroke="hsl(263 50% 50% / 0.08)" strokeWidth="0.3" />
      </svg>

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
