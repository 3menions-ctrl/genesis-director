/**
 * Phase 3: Holographic Orbital Progress Ring
 * 
 * A futuristic progress visualization with orbiting particles,
 * rotating rings, and holographic glow effects.
 */

import { memo, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface HolographicProgressRingProps {
  progress: number; // 0-100
  size?: number;
  label?: string;
  sublabel?: string;
  accentColor?: string; // HSL values e.g. "263 70% 58%"
  className?: string;
}

export const HolographicProgressRing = memo(forwardRef<HTMLDivElement, HolographicProgressRingProps>(
  function HolographicProgressRing({ 
    progress, 
    size = 180, 
    label, 
    sublabel,
    accentColor = "263 70% 58%",
    className 
  }, ref) {
    const radius = (size - 20) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (progress / 100) * circumference;
    const center = size / 2;

    return (
      <div ref={ref} className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
        {/* Ambient glow */}
        <div 
          className="absolute inset-0 rounded-full animate-section-breathe"
          style={{
            background: `radial-gradient(circle, hsl(${accentColor} / 0.15) 0%, transparent 70%)`,
          }}
        />

        {/* Outer orbital ring */}
        <div className="absolute inset-0 animate-orbital-ring" style={{ animationDuration: '12s' }}>
          <svg width={size} height={size} className="absolute inset-0">
            <circle
              cx={center} cy={center} r={radius + 6}
              fill="none"
              stroke={`hsl(${accentColor} / 0.1)`}
              strokeWidth="1"
              strokeDasharray="4 8"
            />
          </svg>
          {/* Orbiting particle */}
          <div 
            className="absolute w-2 h-2 rounded-full"
            style={{
              top: center - radius - 6 - 1,
              left: center - 1,
              background: `hsl(${accentColor})`,
              boxShadow: `0 0 8px hsl(${accentColor} / 0.6)`,
            }}
          />
        </div>

        {/* Inner orbital ring (reverse) */}
        <div className="absolute inset-0 animate-orbital-ring-reverse" style={{ animationDuration: '8s' }}>
          <svg width={size} height={size} className="absolute inset-0">
            <circle
              cx={center} cy={center} r={radius - 6}
              fill="none"
              stroke={`hsl(195 90% 50% / 0.08)`}
              strokeWidth="1"
              strokeDasharray="3 6"
            />
          </svg>
          <div 
            className="absolute w-1.5 h-1.5 rounded-full"
            style={{
              top: center - radius + 6 - 0.75,
              left: center - 0.75,
              background: 'hsl(195 90% 50%)',
              boxShadow: '0 0 6px hsl(195 90% 50% / 0.5)',
            }}
          />
        </div>

        {/* Main progress ring */}
        <svg width={size} height={size} className="absolute inset-0 -rotate-90">
          {/* Background track */}
          <circle
            cx={center} cy={center} r={radius}
            fill="none"
            stroke="hsl(0 0% 100% / 0.06)"
            strokeWidth="3"
          />
          {/* Progress arc */}
          <circle
            cx={center} cy={center} r={radius}
            fill="none"
            stroke={`hsl(${accentColor})`}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-700 ease-out"
            style={{
              filter: `drop-shadow(0 0 6px hsl(${accentColor} / 0.4))`,
            }}
          />
        </svg>

        {/* Center content */}
        <div className="relative flex flex-col items-center justify-center z-10">
          <span 
            className="text-2xl font-bold tabular-nums"
            style={{ color: `hsl(${accentColor})` }}
          >
            {Math.round(progress)}%
          </span>
          {label && (
            <span className="text-[10px] text-white/50 uppercase tracking-[0.15em] mt-1 font-medium">
              {label}
            </span>
          )}
          {sublabel && (
            <span className="text-[9px] text-white/30 mt-0.5">{sublabel}</span>
          )}
        </div>
      </div>
    );
  }
));

HolographicProgressRing.displayName = 'HolographicProgressRing';
