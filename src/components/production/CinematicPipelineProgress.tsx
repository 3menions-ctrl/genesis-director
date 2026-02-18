/**
 * CinematicPipelineProgress — Waveform-driven pipeline UI
 *
 * Design: Dark studio aesthetic. Canvas waveform visualizer, giant
 * percentage counter, live scrolling status text, stage pills,
 * and a clip link grid. Rich but purposeful.
 */

import React, { memo, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Play, ExternalLink, AlertCircle, Clock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface StageStatus {
  name: string;
  shortName: string;
  status: 'pending' | 'active' | 'complete' | 'error' | 'skipped';
  details?: string;
}

interface ClipData {
  index: number;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  videoUrl?: string;
  error?: string;
}

interface CinematicPipelineProgressProps {
  stages: StageStatus[];
  progress: number;
  isComplete: boolean;
  isError?: boolean;
  isRunning?: boolean;
  elapsedTime: number;
  projectTitle?: string;
  lastError?: string | null;
  onResume?: () => void;
  onCancel?: () => void;
  isResuming?: boolean;
  isCancelling?: boolean;
  className?: string;
  clips?: ClipData[];
  completedClips?: number;
  totalClips?: number;
  onPlayClip?: (url: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

function hexToRgb(hex: string): string {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!r) return '255,255,255';
  return `${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)}`;
}

// Waveform palette — blue → violet → magenta → amber
const W = {
  primary:   '#7c3aed',
  secondary: '#a78bfa',
  tertiary:  '#c4b5fd',
  accent:    '#f59e0b',
  glow:      'rgba(124,58,237,0.45)',
};

// ─────────────────────────────────────────────────────────────────────────────
// WAVEFORM CANVAS
// ─────────────────────────────────────────────────────────────────────────────

const WaveformCanvas = memo(function WaveformCanvas({
  isActive,
  progress,
}: {
  isActive: boolean;
  progress: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  const tRef      = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr  = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width  = rect.width  * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W_px = rect.width;
    const H    = rect.height;

    // Particles
    const particles: Array<{
      x: number; y: number; vx: number; vy: number;
      size: number; alpha: number; life: number; maxLife: number;
    }> = Array.from({ length: 50 }, () => ({
      x: Math.random() * W_px,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.35,
      vy: -(Math.random() * 0.5 + 0.08),
      size: Math.random() * 2.2 + 0.3,
      alpha: Math.random() * 0.55 + 0.08,
      life: Math.random() * 180,
      maxLife: 180 + Math.random() * 140,
    }));

    const BARS   = 52;
    const BAR_W  = 3;
    const GAP    = 1.8;
    const totalW = BARS * (BAR_W + GAP);
    const startX = (W_px - totalW) / 2;
    const cy     = H * 0.52;

    const draw = () => {
      tRef.current += 0.018;
      const t = tRef.current;

      ctx.clearRect(0, 0, W_px, H);

      // ── Particles ──
      for (const p of particles) {
        p.x   += p.vx;
        p.y   += p.vy;
        p.life++;
        if (p.life > p.maxLife || p.y < -10) {
          p.x = Math.random() * W_px;
          p.y = H + 10;
          p.life  = 0;
          p.alpha = Math.random() * 0.55 + 0.08;
        }
        const fade = Math.sin((p.life / p.maxLife) * Math.PI);
        // glow halo
        const gs = p.size * 4;
        const gg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, gs);
        gg.addColorStop(0, `rgba(${hexToRgb(W.primary)},${p.alpha * fade * 0.25})`);
        gg.addColorStop(1, 'transparent');
        ctx.fillStyle = gg;
        ctx.fillRect(p.x - gs, p.y - gs, gs * 2, gs * 2);
        // core
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${hexToRgb(W.secondary)},${p.alpha * fade})`;
        ctx.fill();
      }

      // ── Waveform bars ──
      for (let i = 0; i < BARS; i++) {
        const norm  = i / BARS;
        const freq  = 0.11 + norm * 0.32;
        const phase = t * (2.0 + i * 0.038);
        const base  = 5 + Math.sin(i * 0.28) * 4.5;
        const wave  = Math.sin(phase + i * freq) * (13 + Math.sin(t * 0.38) * 6.5);
        const pulse = Math.sin(t * 1.7 + i * 0.09) * 3.5;
        const bh    = Math.abs(base + wave + pulse);

        const x   = startX + i * (BAR_W + GAP);
        const lit = norm <= progress / 100;
        const pf  = lit ? 1 : 0.07;

        // color sweep: blue → violet → magenta → amber
        let r: number, g: number, b: number;
        if (norm < 0.35) {
          const s = norm / 0.35;
          r = Math.round(80  + s * 50);
          g = Math.round(100 - s * 40);
          b = 255;
        } else if (norm < 0.65) {
          const s = (norm - 0.35) / 0.30;
          r = Math.round(130 + s * 100);
          g = Math.round(60  - s * 10);
          b = Math.round(255 - s * 100);
        } else {
          const s = (norm - 0.65) / 0.35;
          r = 245;
          g = Math.round(50  + s * 108);
          b = Math.round(155 - s * 155);
        }
        const col = `rgba(${r},${g},${b}`;

        const grad = ctx.createLinearGradient(x, cy - bh, x, cy + bh);
        grad.addColorStop(0,   `${col},${0.55 * pf})`);
        grad.addColorStop(0.4, `${col},${0.9  * pf})`);
        grad.addColorStop(0.5, `${col},${1.0  * pf})`);
        grad.addColorStop(0.6, `${col},${0.9  * pf})`);
        grad.addColorStop(1,   `${col},${0.55 * pf})`);

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, cy - bh,      BAR_W, bh,        2);
        ctx.fill();
        ctx.beginPath();
        ctx.roundRect(x, cy + 2,       BAR_W, bh * 0.45, 2);
        ctx.fill();

        // glow pass on lit bars
        if (lit && bh > 8) {
          ctx.save();
          ctx.filter = 'blur(3px)';
          ctx.globalAlpha = 0.18;
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.roundRect(x - 1, cy - bh - 1, BAR_W + 2, bh + 2, 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // ── Centre line ──
      const lg = ctx.createLinearGradient(startX, cy, startX + totalW, cy);
      lg.addColorStop(0,   'transparent');
      lg.addColorStop(0.3, `rgba(${hexToRgb(W.primary)},0.12)`);
      lg.addColorStop(0.5, `rgba(${hexToRgb(W.secondary)},0.18)`);
      lg.addColorStop(0.7, `rgba(${hexToRgb(W.primary)},0.12)`);
      lg.addColorStop(1,   'transparent');
      ctx.fillStyle = lg;
      ctx.fillRect(startX, cy - 0.5, totalW, 1);

      rafRef.current = requestAnimationFrame(draw);
    };

    if (isActive) {
      rafRef.current = requestAnimationFrame(draw);
    } else {
      // static idle frame
      draw();
      cancelAnimationFrame(rafRef.current);
    }

    return () => cancelAnimationFrame(rafRef.current);
  }, [isActive, progress]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ width: '100%', height: '100%' }}
    />
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// STAGE PILLS
// ─────────────────────────────────────────────────────────────────────────────

const StagePills = memo(function StagePills({ stages }: { stages: StageStatus[] }) {
  const visible = stages.filter(s => s.status !== 'skipped');
  if (!visible.length) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      {visible.map((stage, i) => {
        const done   = stage.status === 'complete';
        const active = stage.status === 'active';
        const error  = stage.status === 'error';

        return (
          <motion.div
            key={stage.shortName}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.04, duration: 0.25 }}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold"
            style={{
              background: active
                ? 'rgba(124,58,237,0.18)'
                : done
                ? 'rgba(16,185,129,0.1)'
                : error
                ? 'rgba(239,68,68,0.1)'
                : 'rgba(255,255,255,0.04)',
              border: `1px solid ${
                active ? 'rgba(124,58,237,0.5)'
                : done  ? 'rgba(16,185,129,0.35)'
                : error ? 'rgba(239,68,68,0.35)'
                : 'rgba(255,255,255,0.08)'
              }`,
              color: active ? '#a78bfa'
                : done  ? '#34d399'
                : error ? '#f87171'
                : 'rgba(255,255,255,0.3)',
            }}
          >
            {done  && <CheckCircle2 className="w-3 h-3 shrink-0" />}
            {error && <XCircle      className="w-3 h-3 shrink-0" />}
            {active && (
              <motion.div
                className="w-1.5 h-1.5 rounded-full shrink-0 bg-violet-400"
                animate={{ opacity: [1, 0.25, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}
            <span>{stage.shortName}</span>
          </motion.div>
        );
      })}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// CLIP GRID
// ─────────────────────────────────────────────────────────────────────────────

const ClipGrid = memo(function ClipGrid({
  clips, onPlayClip,
}: { clips: ClipData[]; onPlayClip?: (url: string) => void }) {
  if (!clips.length) return null;
  const done = clips.filter(c => c.status === 'completed').length;

  return (
    <div className="w-full flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.06)' }} />
        <span className="text-[10px] font-bold uppercase tracking-[0.2em]"
          style={{ color: 'rgba(255,255,255,0.25)' }}>
          Clips — {done}/{clips.length} ready
        </span>
        <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.06)' }} />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {clips.map((clip) => {
          const isComplete  = clip.status === 'completed' && !!clip.videoUrl;
          const isBusy      = clip.status === 'generating';
          const isFailed    = clip.status === 'failed';

          return (
            <motion.div
              key={clip.index}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: clip.index * 0.035, duration: 0.3 }}
              className="relative rounded-xl overflow-hidden"
              style={{
                background: isComplete
                  ? 'rgba(16,185,129,0.06)'
                  : isBusy
                  ? 'rgba(124,58,237,0.07)'
                  : isFailed
                  ? 'rgba(239,68,68,0.06)'
                  : 'rgba(255,255,255,0.03)',
                border: `1px solid ${
                  isComplete ? 'rgba(16,185,129,0.25)'
                  : isBusy   ? 'rgba(124,58,237,0.22)'
                  : isFailed ? 'rgba(239,68,68,0.22)'
                  : 'rgba(255,255,255,0.07)'
                }`,
              }}
            >
              {/* top stripe */}
              <div className="h-0.5 w-full" style={{
                background: isComplete
                  ? 'linear-gradient(90deg,#10b981,#34d399)'
                  : isBusy
                  ? 'linear-gradient(90deg,#7c3aed,#a78bfa)'
                  : isFailed
                  ? '#ef4444'
                  : 'rgba(255,255,255,0.06)',
                opacity: isComplete || isBusy ? 1 : 0.4,
              }} />

              <div className="p-2.5 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold"
                    style={{ color: isComplete ? '#34d399' : isBusy ? '#a78bfa' : isFailed ? '#f87171' : 'rgba(255,255,255,0.35)' }}>
                    Clip {clip.index + 1}
                  </span>
                  {isComplete && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                  {isFailed   && <AlertCircle  className="w-3.5 h-3.5 text-red-400 shrink-0"     />}
                  {isBusy     && <Loader2      className="w-3.5 h-3.5 text-violet-400 shrink-0 animate-spin" />}
                  {!isComplete && !isBusy && !isFailed && (
                    <div className="w-2 h-2 rounded-full bg-white/10 shrink-0" />
                  )}
                </div>

                {isComplete && clip.videoUrl && (
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => onPlayClip?.(clip.videoUrl!)}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-semibold transition-all hover:brightness-125"
                      style={{
                        background: 'rgba(16,185,129,0.12)',
                        border: '1px solid rgba(16,185,129,0.28)',
                        color: '#34d399',
                      }}
                    >
                      <Play className="w-2.5 h-2.5 fill-current" />
                      Play
                    </button>
                    <a
                      href={clip.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center w-7 h-7 rounded-lg transition-all hover:brightness-125"
                      style={{
                        background: 'rgba(124,58,237,0.12)',
                        border: '1px solid rgba(124,58,237,0.28)',
                        color: '#a78bfa',
                      }}
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}

                {isBusy && (
                  <div className="h-0.5 rounded-full overflow-hidden bg-violet-950">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-violet-600 to-purple-400"
                      animate={{ x: ['-100%', '200%'] }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  </div>
                )}

                {isFailed && clip.error && (
                  <p className="text-[9px] text-red-400/60 leading-tight line-clamp-2">{clip.error}</p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function CinematicPipelineProgress({
  stages,
  progress,
  isComplete,
  isError = false,
  isRunning = false,
  elapsedTime,
  projectTitle,
  lastError,
  onResume,
  onCancel,
  isResuming,
  isCancelling,
  className,
  clips = [],
  completedClips = 0,
  totalClips = 0,
  onPlayClip,
}: CinematicPipelineProgressProps) {
  const activeStage = useMemo(() => stages.find(s => s.status === 'active') ?? null, [stages]);

  const statusText = isComplete
    ? (projectTitle ? `"${projectTitle}" is ready` : 'Your video is ready')
    : isError
    ? (lastError ?? 'Something went wrong')
    : activeStage?.details ?? activeStage?.name ?? 'Initializing pipeline…';

  const pct = Math.round(Math.min(progress, 100));

  return (
    <div
      className={cn('relative flex flex-col gap-6 w-full rounded-2xl overflow-hidden', className)}
      style={{
        background: 'linear-gradient(160deg, hsl(240 22% 4%) 0%, hsl(258 28% 5%) 60%, hsl(240 18% 4%) 100%)',
        border: '1px solid rgba(124,58,237,0.18)',
        boxShadow: '0 0 0 1px rgba(0,0,0,0.4), 0 40px 100px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.05)',
        padding: '28px 24px 24px',
      }}
    >
      {/* Top edge glow line */}
      <div
        className="absolute top-0 left-0 right-0 h-px pointer-events-none"
        style={{ background: 'linear-gradient(90deg,transparent,rgba(124,58,237,0.5) 40%,rgba(167,139,250,0.4) 60%,transparent)' }}
      />

      {/* Subtle grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.018]"
        style={{
          backgroundImage: 'linear-gradient(rgba(167,139,250,1) 1px,transparent 1px),linear-gradient(90deg,rgba(167,139,250,1) 1px,transparent 1px)',
          backgroundSize: '44px 44px',
        }}
      />

      {/* ── GIANT PERCENTAGE ── */}
      <div className="relative flex flex-col items-center gap-1 select-none">
        <motion.div
          key={pct}
          className="font-black tabular-nums leading-none"
          style={{
            fontSize: 'clamp(72px, 15vw, 120px)',
            letterSpacing: '-0.05em',
            background: isError
              ? 'linear-gradient(135deg,#f87171,#fb923c)'
              : isComplete
              ? 'linear-gradient(135deg,#34d399,#22d3ee)'
              : 'linear-gradient(135deg,#818cf8 0%,#a78bfa 35%,#c084fc 65%,#f59e0b 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            filter: isError ? 'none' : isComplete ? 'none' : 'drop-shadow(0 0 40px rgba(124,58,237,0.45))',
          }}
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          {pct}<span style={{ fontSize: '0.38em', opacity: 0.6 }}>%</span>
        </motion.div>

        {/* Live status text */}
        <AnimatePresence mode="wait">
          <motion.p
            key={statusText}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.35 }}
            className="text-sm font-medium text-center max-w-xs leading-relaxed"
            style={{
              color: isError ? '#f87171' : isComplete ? '#34d399' : 'rgba(167,139,250,0.85)',
            }}
          >
            {statusText}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* ── WAVEFORM CANVAS ── */}
      <div className="relative rounded-xl overflow-hidden" style={{ height: 120 }}>
        {/* subtle background tint */}
        <div className="absolute inset-0 rounded-xl"
          style={{ background: 'rgba(124,58,237,0.04)', border: '1px solid rgba(124,58,237,0.1)' }} />
        <WaveformCanvas isActive={isRunning && !isComplete && !isError} progress={progress} />
      </div>

      {/* ── STAGE PILLS ── */}
      <StagePills stages={stages} />

      {/* ── PROGRESS BAR ── */}
      <div className="flex flex-col gap-1.5">
        <div
          className="relative w-full rounded-full overflow-hidden"
          style={{ height: 4, background: 'rgba(255,255,255,0.06)' }}
        >
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              background: isError
                ? 'linear-gradient(90deg,#ef4444,#f97316)'
                : isComplete
                ? 'linear-gradient(90deg,#10b981,#22d3ee)'
                : 'linear-gradient(90deg,#6366f1,#8b5cf6,#c084fc,#f59e0b)',
              boxShadow: isComplete
                ? '0 0 12px rgba(16,185,129,0.6)'
                : isError
                ? '0 0 12px rgba(239,68,68,0.6)'
                : '0 0 16px rgba(139,92,246,0.55)',
            }}
            animate={{ width: `${Math.max(1, pct)}%` }}
            transition={{ duration: 0.85, ease: 'easeOut' }}
          />
          {/* shimmer */}
          {isRunning && !isComplete && (
            <motion.div
              className="absolute inset-y-0 w-20 rounded-full pointer-events-none"
              style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.22),transparent)' }}
              animate={{ x: ['0%', '600%'] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.8 }}
            />
          )}
        </div>

        {/* Footer row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.28)' }}>
            <Clock className="w-3 h-3" />
            <span className="text-[11px] tabular-nums font-medium">{formatTime(elapsedTime)}</span>
          </div>
          {totalClips > 0 && (
            <span className="text-[11px] font-medium" style={{ color: 'rgba(167,139,250,0.6)' }}>
              {completedClips}/{totalClips} clips
            </span>
          )}
          {onCancel && isRunning && !isComplete && (
            <button
              onClick={onCancel}
              disabled={isCancelling}
              className="text-[11px] px-3 py-1 rounded-lg font-medium transition-all disabled:opacity-40 hover:brightness-110"
              style={{
                color: 'rgba(248,113,113,0.8)',
                background: 'rgba(239,68,68,0.06)',
                border: '1px solid rgba(239,68,68,0.15)',
              }}
            >
              {isCancelling ? 'Cancelling…' : 'Cancel'}
            </button>
          )}
        </div>
      </div>

      {/* ── CLIP MINI-BAR (visual) ── */}
      {totalClips > 0 && !isComplete && (
        <div className="flex items-end justify-center gap-1">
          {Array.from({ length: Math.min(totalClips, 16) }).map((_, i) => {
            const filled = i < completedClips;
            return (
              <motion.div
                key={i}
                className="rounded-sm flex-shrink-0"
                style={{
                  width: 5,
                  background: filled
                    ? 'linear-gradient(to top,#10b981,#34d399)'
                    : 'rgba(255,255,255,0.07)',
                  boxShadow: filled ? '0 0 6px rgba(16,185,129,0.5)' : 'none',
                }}
                animate={{ height: filled ? 20 : 6 }}
                transition={{ duration: 0.45, ease: [0.34,1.56,0.64,1] }}
              />
            );
          })}
        </div>
      )}

      {/* ── RESUME BUTTON ── */}
      {isError && onResume && (
        <div className="flex justify-center">
          <button
            onClick={onResume}
            disabled={isResuming}
            className="text-sm px-8 py-2.5 rounded-xl font-semibold transition-all disabled:opacity-50 hover:brightness-110"
            style={{
              background: 'rgba(124,58,237,0.12)',
              border: '1px solid rgba(124,58,237,0.35)',
              color: '#a78bfa',
              boxShadow: '0 0 20px rgba(124,58,237,0.12)',
            }}
          >
            {isResuming ? 'Resuming…' : '↩ Try Again'}
          </button>
        </div>
      )}

      {/* ── CLIP LINKS ── */}
      {clips.length > 0 && (
        <ClipGrid clips={clips} onPlayClip={onPlayClip} />
      )}
    </div>
  );
}
