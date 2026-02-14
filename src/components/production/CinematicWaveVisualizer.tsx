/**
 * CinematicWaveVisualizer - Premium pipeline animation
 * 
 * Replaces basic spinner with immersive visual:
 * - Audio waveform visualizer
 * - Orbital ring with stage indicators
 * - Particle field
 * - Glowing stage transitions
 */

import { memo, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface CinematicWaveVisualizerProps {
  progress: number;
  isProcessing: boolean;
  accentColor: 'violet' | 'emerald' | 'amber';
  currentStageIndex: number;
  totalStages: number;
  message?: string;
}

const ACCENT_COLORS = {
  violet: { primary: '#8b5cf6', secondary: '#a78bfa', glow: 'rgba(139,92,246,0.4)' },
  emerald: { primary: '#10b981', secondary: '#34d399', glow: 'rgba(16,185,129,0.4)' },
  amber: { primary: '#f59e0b', secondary: '#fbbf24', glow: 'rgba(245,158,11,0.4)' },
};

export const CinematicWaveVisualizer = memo(function CinematicWaveVisualizer({
  progress,
  isProcessing,
  accentColor,
  currentStageIndex,
  totalStages,
  message,
}: CinematicWaveVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const timeRef = useRef(0);
  const colors = ACCENT_COLORS[accentColor];

  // Animated waveform + particles on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = rect.height;

    // Particle system
    const particles: Array<{
      x: number; y: number; vx: number; vy: number;
      size: number; alpha: number; life: number; maxLife: number;
    }> = [];

    for (let i = 0; i < 40; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -Math.random() * 0.5 - 0.1,
        size: Math.random() * 2 + 0.5,
        alpha: Math.random() * 0.5 + 0.1,
        life: Math.random() * 200,
        maxLife: 200 + Math.random() * 100,
      });
    }

    const animate = () => {
      if (!isProcessing) return;
      timeRef.current += 0.016;
      const t = timeRef.current;

      ctx.clearRect(0, 0, w, h);

      // Draw particles
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life++;
        if (p.life > p.maxLife || p.y < -10) {
          p.x = Math.random() * w;
          p.y = h + 10;
          p.life = 0;
          p.alpha = Math.random() * 0.5 + 0.1;
        }
        const fade = Math.sin((p.life / p.maxLife) * Math.PI);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${hexToRgb(colors.primary)}, ${p.alpha * fade})`;
        ctx.fill();
      });

      // Draw waveform bars - centered
      const barCount = 48;
      const barWidth = 3;
      const gap = 2;
      const totalWidth = barCount * (barWidth + gap);
      const startX = (w - totalWidth) / 2;
      const centerY = h * 0.5;

      for (let i = 0; i < barCount; i++) {
        const frequency = 0.15 + (i / barCount) * 0.3;
        const phase = t * (2 + i * 0.05);
        const baseHeight = 8 + Math.sin(i * 0.3) * 4;
        const waveHeight = Math.sin(phase + i * frequency) * (12 + Math.sin(t * 0.5) * 6);
        const pulseHeight = Math.sin(t * 1.5 + i * 0.1) * 3;
        const barHeight = Math.abs(baseHeight + waveHeight + pulseHeight);

        const x = startX + i * (barWidth + gap);
        const progressFactor = i / barCount <= progress / 100 ? 1 : 0.15;

        // Gradient for each bar
        const gradient = ctx.createLinearGradient(x, centerY - barHeight, x, centerY + barHeight);
        gradient.addColorStop(0, `rgba(${hexToRgb(colors.secondary)}, ${0.8 * progressFactor})`);
        gradient.addColorStop(0.5, `rgba(${hexToRgb(colors.primary)}, ${1 * progressFactor})`);
        gradient.addColorStop(1, `rgba(${hexToRgb(colors.secondary)}, ${0.8 * progressFactor})`);

        ctx.fillStyle = gradient;
        
        // Top bar
        ctx.beginPath();
        ctx.roundRect(x, centerY - barHeight, barWidth, barHeight, 1.5);
        ctx.fill();
        
        // Bottom bar (mirror)
        ctx.beginPath();
        ctx.roundRect(x, centerY + 1, barWidth, barHeight * 0.6, 1.5);
        ctx.fill();
      }

      // Center glow
      const glowGradient = ctx.createRadialGradient(w / 2, centerY, 0, w / 2, centerY, totalWidth / 2);
      glowGradient.addColorStop(0, `rgba(${hexToRgb(colors.primary)}, 0.08)`);
      glowGradient.addColorStop(1, 'transparent');
      ctx.fillStyle = glowGradient;
      ctx.fillRect(0, 0, w, h);

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [isProcessing, progress, colors]);

  return (
    <div className="relative w-full">
      {/* Orbital ring - SVG based */}
      <div className="relative mx-auto w-48 h-48 mb-6">
        <svg viewBox="0 0 200 200" className="w-full h-full">
          {/* Background ring */}
          <circle cx="100" cy="100" r="88" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
          <circle cx="100" cy="100" r="80" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
          
          {/* Progress arc */}
          <circle
            cx="100" cy="100" r="88"
            fill="none"
            stroke={colors.primary}
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={`${progress * 5.53} ${553 - progress * 5.53}`}
            strokeDashoffset="138"
            className="transition-all duration-700 ease-out"
            style={{ filter: `drop-shadow(0 0 6px ${colors.glow})` }}
          />
          
          {/* Stage dots on the ring */}
          {Array.from({ length: totalStages }).map((_, i) => {
            const angle = ((i / totalStages) * 360 - 90) * (Math.PI / 180);
            const cx = 100 + 88 * Math.cos(angle);
            const cy = 100 + 88 * Math.sin(angle);
            const isActive = i === currentStageIndex;
            const isComplete = i < currentStageIndex;
            
            return (
              <g key={i}>
                {isActive && (
                  <circle
                    cx={cx} cy={cy} r="8"
                    fill="none"
                    stroke={colors.primary}
                    strokeWidth="1"
                    opacity="0.4"
                  >
                    <animate
                      attributeName="r"
                      values="6;12;6"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.4;0;0.4"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}
                <circle
                  cx={cx} cy={cy}
                  r={isActive ? 5 : 3.5}
                  fill={isComplete ? colors.primary : isActive ? colors.secondary : 'rgba(255,255,255,0.15)'}
                  className="transition-all duration-500"
                  style={isActive || isComplete ? { filter: `drop-shadow(0 0 4px ${colors.glow})` } : {}}
                />
              </g>
            );
          })}
          
          {/* Center content */}
          <text x="100" y="92" textAnchor="middle" fill="white" fontSize="28" fontWeight="700" fontFamily="system-ui" opacity="0.9">
            {Math.round(progress)}%
          </text>
          <text x="100" y="116" textAnchor="middle" fill="white" fontSize="10" fontWeight="400" fontFamily="system-ui" opacity="0.35" letterSpacing="2">
            {isProcessing ? 'GENERATING' : 'COMPLETE'}
          </text>
        </svg>
        
        {/* Rotating glow ring */}
        {isProcessing && (
          <div 
            className="absolute inset-0 rounded-full"
            style={{
              background: `conic-gradient(from 0deg, transparent 0%, ${colors.glow} 20%, transparent 40%)`,
              animation: 'spin 4s linear infinite',
              opacity: 0.3,
            }}
          />
        )}
      </div>

      {/* Waveform canvas */}
      <div className="relative h-24 mb-4">
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ width: '100%', height: '100%' }}
        />
      </div>

      {/* Message with fade transition */}
      {message && (
        <div className="text-center">
          <p 
            className="text-sm font-medium tracking-wide animate-fade-in"
            style={{ color: colors.secondary }}
            key={message}
          >
            {message}
          </p>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
});

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '255,255,255';
  return `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}`;
}

export default CinematicWaveVisualizer;
