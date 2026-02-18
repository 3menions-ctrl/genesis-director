/**
 * CinematicPipelineProgress
 *
 * Aesthetic: APEX Studios brand system.
 * Deep black base. Single violet accent. Surgical restraint.
 * Waveform visualizer · giant % counter · live status · clip grid.
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

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// WAVEFORM — monochrome violet, brand-true
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

    const setup = () => {
      const dpr  = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width  = rect.width  * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      return { W: rect.width, H: rect.height };
    };

    let { W, H } = setup();

    const BARS   = 48;
    const BAR_W  = 3;
    const GAP    = 2.2;
    const totalW = BARS * (BAR_W + GAP);

    const draw = () => {
      tRef.current += 0.014;
      const t = tRef.current;

      ctx.clearRect(0, 0, W, H);

      const startX = (W - totalW) / 2;
      const cy     = H * 0.55;
      const filled = progress / 100;

      for (let i = 0; i < BARS; i++) {
        const norm  = i / BARS;
        const lit   = norm <= filled;

        const base  = 4 + Math.sin(i * 0.31) * 3;
        const w1    = Math.sin(t * 1.9  + i * 0.18) * (10 + Math.sin(t * 0.3) * 5);
        const w2    = Math.sin(t * 1.1  + i * 0.29 + 1.2) * 6;
        const bh    = Math.max(2, Math.abs(base + w1 + w2));

        const x = startX + i * (BAR_W + GAP);

        if (lit) {
          // Monolith: pure white bars, soft glow
          ctx.save();
          ctx.filter = 'blur(4px)';
          ctx.globalAlpha = 0.18;
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          ctx.beginPath();
          ctx.roundRect(x - 1, cy - bh - 2, BAR_W + 2, bh * 2 + 4, 2);
          ctx.fill();
          ctx.restore();

          const grad = ctx.createLinearGradient(x, cy - bh, x, cy + bh);
          grad.addColorStop(0,   'rgba(255,255,255,0.55)');
          grad.addColorStop(0.5, 'rgba(255,255,255,0.95)');
          grad.addColorStop(1,   'rgba(255,255,255,0.55)');
          ctx.fillStyle = grad;
        } else {
          ctx.fillStyle = 'rgba(255,255,255,0.05)';
        }

        ctx.beginPath();
        ctx.roundRect(x, cy - bh, BAR_W, bh, 1.5);
        ctx.fill();

        if (lit) {
          ctx.globalAlpha = 0.1;
          ctx.beginPath();
          ctx.roundRect(x, cy + 2, BAR_W, bh * 0.3, 1);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      if (isActive) rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    const resizeObserver = new ResizeObserver(() => {
      const r = setup();
      W = r.W; H = r.H;
    });
    resizeObserver.observe(canvas);

    return () => {
      cancelAnimationFrame(rafRef.current);
      resizeObserver.disconnect();
    };
  }, [isActive, progress]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full block"
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
    <div className="flex flex-wrap items-center justify-center gap-2">
      {visible.map((stage, i) => {
        const done   = stage.status === 'complete';
        const active = stage.status === 'active';
        const error  = stage.status === 'error';

        return (
          <motion.div
            key={stage.shortName}
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.04, duration: 0.25, ease: 'easeOut' }}
            className="flex items-center gap-1.5 px-2.5 py-1"
            style={{
              fontSize: 9,
              fontWeight: 500,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              borderRadius: 4,
              border: `1px solid ${
                active ? 'rgba(255,255,255,0.5)'
                : done  ? 'rgba(255,255,255,0.15)'
                : error ? 'hsl(0 75% 55% / 0.3)'
                : 'rgba(255,255,255,0.06)'
              }`,
              color: active ? 'rgba(255,255,255,0.9)'
                : done  ? 'rgba(255,255,255,0.35)'
                : error ? 'hsl(0 75% 65%)'
                : 'rgba(255,255,255,0.1)',
            }}
          >
            {done  && <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />}
            {error && <XCircle      className="w-2.5 h-2.5 shrink-0" />}
            {active && (
              <motion.span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: 'rgba(255,255,255,0.8)' }}
                animate={{ opacity: [1, 0.2, 1] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
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
      <div className="flex items-center gap-3">
        <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.06)' }} />
        <span style={{ fontSize: 9, fontWeight: 400, letterSpacing: '0.22em', color: 'rgba(255,255,255,0.22)', textTransform: 'uppercase' }}>
          {done} / {clips.length} clips ready
        </span>
        <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.06)' }} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {clips.map((clip) => {
          const isComp = clip.status === 'completed' && !!clip.videoUrl;
          const isBusy = clip.status === 'generating';
          const isFail = clip.status === 'failed';

          return (
            <motion.div
              key={clip.index}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: clip.index * 0.03, duration: 0.28 }}
              className="overflow-hidden"
              style={{
                borderRadius: 8,
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${
                  isComp ? 'rgba(255,255,255,0.15)'
                  : isBusy ? 'rgba(255,255,255,0.1)'
                  : isFail ? 'hsl(0 75% 55% / 0.2)'
                  : 'rgba(255,255,255,0.05)'
                }`,
              }}
            >
              {/* accent stripe */}
              <div style={{
                height: 1,
                background: isComp
                  ? 'rgba(255,255,255,0.6)'
                  : isBusy
                  ? 'rgba(255,255,255,0.3)'
                  : isFail
                  ? 'hsl(0 75% 55%)'
                  : 'rgba(255,255,255,0.06)',
              }} />

              <div className="p-2.5 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span style={{
                    fontSize: 10, fontWeight: 500, letterSpacing: '0.05em',
                    color: isComp ? 'rgba(255,255,255,0.75)' : isBusy ? 'rgba(255,255,255,0.55)' : isFail ? 'hsl(0 75% 65%)' : 'rgba(255,255,255,0.25)',
                  }}>
                    Clip {clip.index + 1}
                  </span>
                  {isComp && <CheckCircle2 style={{ width: 12, height: 12, color: 'rgba(255,255,255,0.5)', flexShrink: 0 }} />}
                  {isFail  && <AlertCircle  style={{ width: 12, height: 12, color: 'hsl(0 75% 55%)', flexShrink: 0 }} />}
                  {isBusy  && <Loader2      style={{ width: 12, height: 12, color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} className="animate-spin" />}
                  {!isComp && !isBusy && !isFail && (
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />
                  )}
                </div>

                {isComp && clip.videoUrl && (
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => onPlayClip?.(clip.videoUrl!)}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 transition-all hover:brightness-125"
                      style={{
                        fontSize: 9, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase',
                        background: 'transparent',
                        border: '1px solid rgba(255,255,255,0.2)',
                        color: 'rgba(255,255,255,0.6)',
                        borderRadius: 4,
                      }}
                    >
                      <Play style={{ width: 9, height: 9 }} className="fill-current" />
                      Play
                    </button>
                    <a
                      href={clip.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center transition-all hover:brightness-125"
                      style={{
                        width: 26, height: 26, borderRadius: 4,
                        background: 'transparent',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: 'rgba(255,255,255,0.35)',
                      }}
                    >
                      <ExternalLink style={{ width: 10, height: 10 }} />
                    </a>
                  </div>
                )}

                {isBusy && (
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <motion.div
                      className="h-full"
                      style={{ background: 'rgba(255,255,255,0.5)' }}
                      animate={{ x: ['-100%', '200%'] }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  </div>
                )}

                {isFail && clip.error && (
                  <p style={{ fontSize: 9, color: 'hsl(0 75% 55% / 0.55)', lineHeight: 1.4 }} className="line-clamp-2">
                    {clip.error}
                  </p>
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
// MAIN
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
    ? (projectTitle ? `"${projectTitle}" is ready` : 'Your film is ready')
    : isError
    ? (lastError ?? 'Something went wrong')
    : activeStage?.details ?? activeStage?.name ?? 'Initializing pipeline…';

  const pct = Math.round(Math.min(progress, 100));

  const accentColor = isError
    ? 'hsl(0 75% 58%)'
    : isComplete
    ? 'hsl(160 84% 48%)'
    : 'hsl(263 70% 65%)';

  return (
    <div
      className={cn('relative flex flex-col gap-7 w-full overflow-hidden', className)}
      style={{
        background: '#050505',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 20,
        boxShadow: `0 40px 80px rgba(0,0,0,0.95), inset 0 1px 0 rgba(255,255,255,0.04)`,
        padding: '32px 28px 28px',
      }}
    >
      {/* Top hairline — pure white */}
      <div
        className="absolute top-0 inset-x-0 h-px pointer-events-none"
        style={{
          background: isError
            ? 'linear-gradient(90deg, transparent 10%, hsl(0 75% 55% / 0.5) 50%, transparent 90%)'
            : isComplete
            ? 'linear-gradient(90deg, transparent 10%, rgba(255,255,255,0.3) 50%, transparent 90%)'
            : 'linear-gradient(90deg, transparent 10%, rgba(255,255,255,0.18) 50%, transparent 90%)',
        }}
      />

      {/* ── PERCENTAGE ── */}
      <div className="flex flex-col items-center gap-3 select-none">
        <div
          className="font-black tabular-nums leading-none"
          style={{
            fontSize: 'clamp(80px, 16vw, 128px)',
            letterSpacing: '-0.07em',
            color: isError ? 'hsl(0 75% 65%)' : 'rgba(255,255,255,0.95)',
            textShadow: isError
              ? '0 0 60px hsl(0 75% 45% / 0.3)'
              : isComplete
              ? '0 0 60px rgba(255,255,255,0.08)'
              : '0 0 60px rgba(255,255,255,0.06)',
          }}
        >
          {pct}<span style={{ fontSize: '0.28em', fontWeight: 200, opacity: 0.22 }}>%</span>
        </div>

        {/* Live status — uppercase spaced */}
        <AnimatePresence mode="wait">
          <motion.p
            key={statusText}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            style={{
              fontSize: 10,
              fontWeight: 400,
              color: isError ? 'hsl(0 75% 55%)' : isComplete ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.28)',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              textAlign: 'center',
              maxWidth: 380,
            }}
          >
            {statusText}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* ── WAVEFORM ── */}
      <div
        className="relative overflow-hidden"
        style={{
          height: 96,
          borderRadius: 10,
          background: 'rgba(255,255,255,0.015)',
          border: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        <WaveformCanvas isActive={isRunning && !isComplete && !isError} progress={progress} />
      </div>

      {/* ── STAGE PILLS ── */}
      <StagePills stages={stages} />

      {/* ── PROGRESS BAR ── */}
      <div className="flex flex-col gap-2">
        <div
          className="relative w-full overflow-hidden"
          style={{ height: 1, background: 'rgba(255,255,255,0.06)' }}
        >
          <motion.div
            className="absolute inset-y-0 left-0"
            style={{
              background: isError
                ? 'hsl(0 75% 55%)'
                : isComplete
                ? 'rgba(255,255,255,0.9)'
                : 'rgba(255,255,255,0.82)',
            }}
            animate={{ width: `${Math.max(1, pct)}%` }}
            transition={{ duration: 0.9, ease: [0.4, 0, 0.2, 1] }}
          />
        </div>

        {/* row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.2)' }}>
            <Clock style={{ width: 11, height: 11 }} />
            <span style={{ fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.1em' }}>
              {formatTime(elapsedTime)}
            </span>
          </div>

          {totalClips > 0 && (
            <span style={{ fontSize: 10, fontWeight: 400, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.22)' }}>
              {completedClips} / {totalClips} clips
            </span>
          )}

          {onCancel && isRunning && !isComplete && (
            <button
              onClick={onCancel}
              disabled={isCancelling}
              className="transition-all disabled:opacity-40"
              style={{
                fontSize: 10, fontWeight: 500,
                padding: '3px 12px',
                borderRadius: 4,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'hsl(0 75% 60%)',
                background: 'transparent',
                border: '1px solid hsl(0 75% 50% / 0.2)',
              }}
            >
              {isCancelling ? 'Cancelling…' : 'Cancel'}
            </button>
          )}
        </div>
      </div>

      {/* ── CLIP BAR SPARKS ── */}
      {totalClips > 0 && !isComplete && (
        <div className="flex items-end justify-center gap-1">
          {Array.from({ length: Math.min(totalClips, 16) }).map((_, i) => {
            const filled = i < completedClips;
            return (
              <motion.div
                key={i}
                className="rounded-sm flex-shrink-0"
                style={{
                  width: 3,
                  background: filled ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.07)',
                }}
                animate={{ height: filled ? 18 : 4 }}
                transition={{ duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }}
              />
            );
          })}
        </div>
      )}

      {/* ── ERROR RESUME ── */}
      {isError && onResume && (
        <div className="flex justify-center">
          <button
            onClick={onResume}
            disabled={isResuming}
            className="transition-all disabled:opacity-50 hover:brightness-110"
            style={{
              fontSize: 11, fontWeight: 500,
              padding: '9px 28px',
              borderRadius: 6,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.2)',
              color: 'rgba(255,255,255,0.7)',
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
