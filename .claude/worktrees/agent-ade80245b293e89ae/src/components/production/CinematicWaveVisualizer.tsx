/**
 * CinematicWaveVisualizer - Premium pipeline animation
 * 
 * Immersive visual with:
 * - Audio waveform visualizer with gradient bars
 * - Orbital ring with glowing stage indicators
 * - Particle field with depth
 * - Holographic ring rotation
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
  violet:  { primary: '#8b5cf6', secondary: '#a78bfa', tertiary: '#c4b5fd', glow: 'rgba(139,92,246,0.4)' },
  emerald: { primary: '#10b981', secondary: '#34d399', tertiary: '#6ee7b7', glow: 'rgba(16,185,129,0.4)' },
  amber:   { primary: '#f59e0b', secondary: '#fbbf24', tertiary: '#fde68a', glow: 'rgba(245,158,11,0.4)' },
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

    // Particle system - more particles, varied sizes
    const particles: Array<{
      x: number; y: number; vx: number; vy: number;
      size: number; alpha: number; life: number; maxLife: number;
      hueShift: number;
    }> = [];

    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -Math.random() * 0.6 - 0.1,
        size: Math.random() * 2.5 + 0.3,
        alpha: Math.random() * 0.6 + 0.1,
        life: Math.random() * 200,
        maxLife: 200 + Math.random() * 150,
        hueShift: (Math.random() - 0.5) * 30,
      });
    }

    const animate = () => {
      if (!isProcessing) return;
      timeRef.current += 0.016;
      const t = timeRef.current;

      ctx.clearRect(0, 0, w, h);

      // Draw particles with glow
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life++;
        if (p.life > p.maxLife || p.y < -10) {
          p.x = Math.random() * w;
          p.y = h + 10;
          p.life = 0;
          p.alpha = Math.random() * 0.6 + 0.1;
        }
        const fade = Math.sin((p.life / p.maxLife) * Math.PI);
        
        // Glow effect
        const glowSize = p.size * 3;
        const glowGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowSize);
        glowGrad.addColorStop(0, `rgba(${hexToRgb(colors.primary)}, ${p.alpha * fade * 0.3})`);
        glowGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = glowGrad;
        ctx.fillRect(p.x - glowSize, p.y - glowSize, glowSize * 2, glowSize * 2);
        
        // Core particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${hexToRgb(colors.secondary)}, ${p.alpha * fade})`;
        ctx.fill();
      });

      // Draw waveform bars - centered, with variable widths
      const barCount = 56;
      const barWidth = 3;
      const gap = 1.5;
      const totalWidth = barCount * (barWidth + gap);
      const startX = (w - totalWidth) / 2;
      const centerY = h * 0.5;

      for (let i = 0; i < barCount; i++) {
        const frequency = 0.12 + (i / barCount) * 0.35;
        const phase = t * (2.2 + i * 0.04);
        const baseHeight = 6 + Math.sin(i * 0.25) * 5;
        const waveHeight = Math.sin(phase + i * frequency) * (14 + Math.sin(t * 0.4) * 7);
        const pulseHeight = Math.sin(t * 1.8 + i * 0.08) * 4;
        const barHeight = Math.abs(baseHeight + waveHeight + pulseHeight);

        const x = startX + i * (barWidth + gap);
        const progressFactor = i / barCount <= progress / 100 ? 1 : 0.08;

        // Multi-stop gradient for each bar
        const gradient = ctx.createLinearGradient(x, centerY - barHeight, x, centerY + barHeight);
        gradient.addColorStop(0, `rgba(${hexToRgb(colors.tertiary)}, ${0.7 * progressFactor})`);
        gradient.addColorStop(0.3, `rgba(${hexToRgb(colors.secondary)}, ${0.9 * progressFactor})`);
        gradient.addColorStop(0.5, `rgba(${hexToRgb(colors.primary)}, ${1 * progressFactor})`);
        gradient.addColorStop(0.7, `rgba(${hexToRgb(colors.secondary)}, ${0.9 * progressFactor})`);
        gradient.addColorStop(1, `rgba(${hexToRgb(colors.tertiary)}, ${0.7 * progressFactor})`);

        ctx.fillStyle = gradient;
        
        // Top bar with rounded corners
        ctx.beginPath();
        ctx.roundRect(x, centerY - barHeight, barWidth, barHeight, 2);
        ctx.fill();
        
        // Bottom bar (mirror) - slightly shorter
        ctx.beginPath();
        ctx.roundRect(x, centerY + 1.5, barWidth, barHeight * 0.55, 2);
        ctx.fill();
      }

      // Center horizontal glow line
      const lineGrad = ctx.createLinearGradient(startX, centerY, startX + totalWidth, centerY);
      lineGrad.addColorStop(0, 'transparent');
      lineGrad.addColorStop(0.3, `rgba(${hexToRgb(colors.primary)}, 0.15)`);
      lineGrad.addColorStop(0.5, `rgba(${hexToRgb(colors.secondary)}, 0.2)`);
      lineGrad.addColorStop(0.7, `rgba(${hexToRgb(colors.primary)}, 0.15)`);
      lineGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = lineGrad;
      ctx.fillRect(startX, centerY - 0.5, totalWidth, 1);

      // Ambient center glow
      const ambientGlow = ctx.createRadialGradient(w / 2, centerY, 0, w / 2, centerY, totalWidth / 1.5);
      ambientGlow.addColorStop(0, `rgba(${hexToRgb(colors.primary)}, 0.06)`);
      ambientGlow.addColorStop(0.5, `rgba(${hexToRgb(colors.primary)}, 0.02)`);
      ambientGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = ambientGlow;
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
      <div className="relative mx-auto w-52 h-52 mb-6">
        <svg viewBox="0 0 200 200" className="w-full h-full">
          {/* Background rings */}
          <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
          <circle cx="100" cy="100" r="88" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
          <circle cx="100" cy="100" r="78" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="0.5" />
          
          {/* Progress arc with glow */}
          <defs>
            <filter id="arcGlow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <circle
            cx="100" cy="100" r="88"
            fill="none"
            stroke={colors.primary}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={`${progress * 5.53} ${553 - progress * 5.53}`}
            strokeDashoffset="138"
            className="transition-all duration-700 ease-out"
            filter="url(#arcGlow)"
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
                {/* Active glow pulse */}
                {isActive && (
                  <>
                    <circle cx={cx} cy={cy} r="10" fill="none" stroke={colors.primary} strokeWidth="0.5" opacity="0.2">
                      <animate attributeName="r" values="6;14;6" dur="2.5s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.3;0;0.3" dur="2.5s" repeatCount="indefinite" />
                    </circle>
                    <circle cx={cx} cy={cy} r="8" fill={colors.glow} opacity="0.15" />
                  </>
                )}
                {/* Core dot */}
                <circle
                  cx={cx} cy={cy}
                  r={isActive ? 5.5 : isComplete ? 4 : 3}
                  fill={isComplete ? colors.primary : isActive ? colors.secondary : 'rgba(255,255,255,0.1)'}
                  className="transition-all duration-500"
                  style={isActive || isComplete ? { filter: `drop-shadow(0 0 6px ${colors.glow})` } : {}}
                />
                {/* Complete checkmark indicator */}
                {isComplete && (
                  <circle cx={cx} cy={cy} r="2" fill="white" opacity="0.6" />
                )}
              </g>
            );
          })}
          
          {/* Center content */}
          <text x="100" y="88" textAnchor="middle" fill="white" fontSize="30" fontWeight="800" fontFamily="system-ui" opacity="0.9">
            {Math.round(progress)}%
          </text>
          <text x="100" y="114" textAnchor="middle" fill={colors.secondary} fontSize="9" fontWeight="600" fontFamily="system-ui" opacity="0.5" letterSpacing="3">
            {isProcessing ? 'GENERATING' : 'COMPLETE'}
          </text>
        </svg>
        
        {/* Rotating holographic ring */}
        {isProcessing && (
          <div 
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background: `conic-gradient(from 0deg, transparent 0%, ${colors.glow} 15%, transparent 35%, transparent 65%, ${colors.glow.replace('0.4', '0.15')} 80%, transparent 100%)`,
              animation: 'wave-ring-spin 5s linear infinite',
              opacity: 0.25,
            }}
          />
        )}
      </div>

      {/* Waveform canvas */}
      <div className="relative h-28 mb-4">
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
        @keyframes wave-ring-spin {
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
