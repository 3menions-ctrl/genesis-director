/**
 * CinematicPipelineProgress
 *
 * Aesthetic: APEX Studios brand system — mirrors CinemaLoader.
 * Deep blue-undertone base with conic aurora · luminous hairlines ·
 * concentric halo around percentage · cinematic blue progress bar.
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
          // Cinematic blue luminous bars with soft halo
          ctx.save();
          ctx.filter = 'blur(5px)';
          ctx.globalAlpha = 0.32;
          ctx.fillStyle = 'hsla(215,100%,60%,0.85)';
          ctx.beginPath();
          ctx.roundRect(x - 1.5, cy - bh - 3, BAR_W + 3, bh * 2 + 6, 2);
          ctx.fill();
          ctx.restore();

          const grad = ctx.createLinearGradient(x, cy - bh, x, cy + bh);
          grad.addColorStop(0,   'hsla(215,100%,75%,0.65)');
          grad.addColorStop(0.5, 'hsla(215,100%,85%,0.98)');
          grad.addColorStop(1,   'hsla(215,100%,65%,0.65)');
          ctx.fillStyle = grad;
        } else {
          ctx.fillStyle = 'hsla(215,30%,60%,0.07)';
        }

        ctx.beginPath();
        ctx.roundRect(x, cy - bh, BAR_W, bh, 1.5);
        ctx.fill();

        if (lit) {
          ctx.globalAlpha = 0.14;
          ctx.fillStyle = 'hsla(215,100%,75%,0.5)';
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
            className="flex items-center gap-1.5 px-3 py-1.5"
            style={{
              fontSize: 9,
              fontWeight: 400,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              borderRadius: 999,
              fontFamily: 'Sora, system-ui, sans-serif',
              background: active
                ? 'hsla(215,100%,55%,0.10)'
                : done
                ? 'hsla(0,0%,100%,0.025)'
                : error
                ? 'hsla(0,75%,55%,0.08)'
                : 'hsla(0,0%,100%,0.02)',
              boxShadow: active
                ? 'inset 0 0 0 1px hsla(215,100%,55%,0.4), inset 0 1px 0 hsla(215,100%,80%,0.12), 0 0 18px hsla(215,100%,55%,0.18)'
                : done
                ? 'inset 0 0 0 1px hsla(0,0%,100%,0.06)'
                : error
                ? 'inset 0 0 0 1px hsla(0,75%,55%,0.3)'
                : 'inset 0 0 0 1px hsla(0,0%,100%,0.04)',
              color: active
                ? 'hsla(215,100%,85%,0.95)'
                : done
                ? 'rgba(255,255,255,0.4)'
                : error
                ? 'hsl(0 75% 70%)'
                : 'rgba(255,255,255,0.18)',
            }}
          >
            {done  && <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />}
            {error && <XCircle      className="w-2.5 h-2.5 shrink-0" />}
            {active && (
              <motion.span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{
                  background: 'hsl(215,100%,75%)',
                  boxShadow: '0 0 8px hsla(215,100%,60%,0.85)',
                }}
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
    : 'hsl(215, 100%, 65%)';

  return (
    <div
      className={cn('relative flex flex-col gap-7 w-full overflow-hidden', className)}
      style={{
        backgroundColor: 'hsl(220, 14%, 2%)',
        borderRadius: 24,
        boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.05), inset 0 0 0 1px hsla(0,0%,100%,0.04), 0 40px 100px -20px rgba(0,0,0,0.9)',
        padding: '40px 32px 32px',
      }}
    >
      {/* Layer 1 — Deep base wash with cool blue undertone */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          borderRadius: 24,
          background:
            'radial-gradient(1200px 700px at 50% 30%, hsla(215, 95%, 26%, 0.22), transparent 62%),' +
            'radial-gradient(900px 540px at 100% 110%, hsla(210, 80%, 18%, 0.14), transparent 58%),' +
            'radial-gradient(700px 480px at 0% 100%, hsla(220, 70%, 12%, 0.16), transparent 60%),' +
            'linear-gradient(180deg, hsl(220, 16%, 3.4%) 0%, hsl(220, 14%, 2%) 100%)',
        }}
      />

      {/* Layer 2 — Slow conic aurora sweep */}
      {!isError && (
        <div
          className="absolute -inset-[20%] pointer-events-none opacity-[0.18]"
          style={{
            background:
              'conic-gradient(from 0deg at 50% 50%, transparent 0deg, hsla(215,100%,60%,0.32) 60deg, transparent 130deg, hsla(210,100%,55%,0.2) 220deg, transparent 300deg, hsla(215,100%,60%,0.26) 360deg)',
            filter: 'blur(80px)',
            animation: 'pipelineAurora 50s linear infinite',
          }}
        />
      )}

      {/* Layer 3 — Edge vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          borderRadius: 24,
          background: 'radial-gradient(ellipse at center, transparent 50%, hsla(220,30%,1%,0.7) 100%)',
        }}
      />

      {/* Layer 4 — Film grain */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.045] mix-blend-overlay"
        style={{
          borderRadius: 24,
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.9'/></svg>\")",
        }}
      />

      {/* Top + bottom luminous hairlines */}
      <div
        className="absolute top-0 left-0 right-0 h-px pointer-events-none"
        style={{
          background: isError
            ? 'linear-gradient(90deg, transparent 10%, hsl(0 75% 55% / 0.55) 50%, transparent 90%)'
            : isComplete
            ? 'linear-gradient(90deg, transparent 10%, hsla(160, 84%, 55%, 0.55) 50%, transparent 90%)'
            : 'linear-gradient(90deg, transparent 0%, hsla(215,100%,60%,0.55) 50%, transparent 100%)',
        }}
      />
      <div
        className="absolute bottom-0 left-0 right-0 h-px pointer-events-none"
        style={{
          background: isError
            ? 'linear-gradient(90deg, transparent 10%, hsl(0 75% 55% / 0.35) 50%, transparent 90%)'
            : 'linear-gradient(90deg, transparent 0%, hsla(215,100%,60%,0.38) 50%, transparent 100%)',
        }}
      />

      {/* ── PERCENTAGE ── */}
      <div className="relative z-10 flex flex-col items-center gap-5 select-none">
        {/* Concentric halo system around percentage */}
        <div className="relative flex items-center justify-center" style={{ width: 'clamp(220px, 30vw, 300px)', height: 'clamp(220px, 30vw, 300px)' }}>
          {/* Pulsing inner aura */}
          {!isError && (
            <div
              className="absolute inset-[15%] rounded-full"
              style={{
                background: isComplete
                  ? 'radial-gradient(circle at 50% 50%, hsla(160,84%,55%,0.3) 0%, hsla(160,84%,40%,0.1) 35%, transparent 70%)'
                  : 'radial-gradient(circle at 50% 50%, hsla(215,100%,55%,0.35) 0%, hsla(215,100%,42%,0.12) 35%, transparent 70%)',
                animation: 'pipelineAura 3.6s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                filter: 'blur(10px)',
              }}
            />
          )}

          {/* Outer rotating ring with orbital pip */}
          <svg
            viewBox="0 0 200 200"
            className="absolute inset-0 w-full h-full"
            style={{ animation: 'pipelineSpin 18s linear infinite' }}
          >
            <defs>
              <linearGradient id="pipelineRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
                <stop offset="50%" stopColor={isError ? 'hsla(0,75%,65%,0.6)' : 'hsla(215,100%,68%,0.65)'} />
                <stop offset="100%" stopColor="rgba(255,255,255,0.05)" />
              </linearGradient>
            </defs>
            <circle cx="100" cy="100" r="98" fill="none" stroke="url(#pipelineRingGrad)" strokeWidth="0.6" />
            <circle cx="100" cy="2" r="2.4" fill={isError ? 'hsl(0,75%,68%)' : 'hsl(215,100%,72%)'}>
              <animate attributeName="opacity" values="0.6;1;0.6" dur="2s" repeatCount="indefinite" />
            </circle>
          </svg>

          {/* Counter-rotating dashed arc */}
          <svg
            viewBox="0 0 200 200"
            className="absolute inset-3 w-[calc(100%-1.5rem)] h-[calc(100%-1.5rem)]"
            style={{ animation: 'pipelineSpinReverse 26s linear infinite' }}
          >
            <circle cx="100" cy="100" r="92" fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="0.4" strokeDasharray="2 7" />
          </svg>

          {/* Progress arc */}
          <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full -rotate-90">
            <circle cx="100" cy="100" r="80" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
            <circle
              cx="100" cy="100" r="80"
              fill="none"
              stroke={isError ? 'hsla(0,75%,60%,0.85)' : isComplete ? 'hsla(160,84%,55%,0.9)' : 'hsla(215,100%,68%,0.9)'}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray={`${pct * 5.0265} ${502.65 - pct * 5.0265}`}
              style={{
                transition: 'stroke-dasharray 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                filter: isError
                  ? 'drop-shadow(0 0 8px hsla(0,75%,55%,0.55))'
                  : isComplete
                  ? 'drop-shadow(0 0 8px hsla(160,84%,48%,0.55))'
                  : 'drop-shadow(0 0 10px hsla(215,100%,60%,0.65))',
              }}
            />
          </svg>

          {/* Centered percentage */}
          <div
            className="relative z-10 font-light tabular-nums leading-none"
            style={{
              fontSize: 'clamp(64px, 9vw, 96px)',
              letterSpacing: '-0.06em',
              fontFamily: 'Sora, system-ui, sans-serif',
              color: isError ? 'hsl(0 75% 75%)' : 'rgba(255,255,255,0.96)',
              textShadow: isError
                ? '0 0 50px hsla(0,75%,45%,0.4)'
                : isComplete
                ? '0 0 50px hsla(160,84%,55%,0.25)'
                : '0 0 60px hsla(215,100%,55%,0.35)',
            }}
          >
            {pct}
            <span style={{ fontSize: '0.32em', fontWeight: 200, opacity: 0.4, marginLeft: '0.05em' }}>%</span>
          </div>
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
              fontSize: 11,
              fontWeight: 300,
              fontFamily: 'Sora, system-ui, sans-serif',
              color: isError ? 'hsl(0 75% 65%)' : isComplete ? 'hsla(160,84%,70%,0.85)' : 'hsla(215,100%,80%,0.7)',
              letterSpacing: '0.28em',
              textTransform: 'uppercase',
              textAlign: 'center',
              maxWidth: 420,
              textShadow: isError ? 'none' : '0 0 16px hsla(215,100%,55%,0.25)',
            }}
          >
            {statusText}
          </motion.p>
        </AnimatePresence>

        {/* Wordmark divider — matches CinemaLoader */}
        <div className="flex items-center gap-3 mt-1">
          <div
            className="h-px w-10"
            style={{ background: 'linear-gradient(90deg, transparent, hsla(215,100%,65%,0.5))' }}
          />
          <p
            className="text-white/65 text-[10px] font-medium tracking-[0.4em] uppercase"
            style={{ fontFamily: 'Sora, system-ui, sans-serif' }}
          >
            Pipeline · Live
          </p>
          <div
            className="h-px w-10"
            style={{ background: 'linear-gradient(90deg, hsla(215,100%,65%,0.5), transparent)' }}
          />
        </div>
      </div>

      {/* ── WAVEFORM ── */}
      <div
        className="relative z-10 overflow-hidden"
        style={{
          height: 96,
          borderRadius: 14,
          background: 'hsla(215,40%,8%,0.35)',
          boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.04), inset 0 0 0 1px hsla(215,100%,55%,0.08)',
        }}
      >
        <WaveformCanvas isActive={isRunning && !isComplete && !isError} progress={progress} />
      </div>

      {/* ── STAGE PILLS ── */}
      <div className="relative z-10">
        <StagePills stages={stages} />
      </div>

      {/* ── PROGRESS BAR ── */}
      <div className="relative z-10 flex flex-col gap-3">
        <div
          className="relative w-full overflow-hidden rounded-full"
          style={{ height: 2, background: 'rgba(255,255,255,0.04)' }}
        >
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              background: isError
                ? 'linear-gradient(90deg, hsla(0,75%,50%,0.7) 0%, hsla(0,75%,68%,0.95) 100%)'
                : isComplete
                ? 'linear-gradient(90deg, hsla(160,84%,48%,0.7) 0%, hsla(160,84%,68%,0.95) 100%)'
                : 'linear-gradient(90deg, hsla(215,100%,55%,0.7) 0%, hsla(215,100%,75%,0.95) 60%, rgba(255,255,255,0.95) 100%)',
              boxShadow: isError
                ? '0 0 12px hsla(0,75%,55%,0.6)'
                : isComplete
                ? '0 0 12px hsla(160,84%,55%,0.6)'
                : '0 0 14px hsla(215,100%,60%,0.65), 0 0 2px rgba(255,255,255,0.7)',
            }}
            animate={{ width: `${Math.max(1, pct)}%` }}
            transition={{ duration: 0.9, ease: [0.4, 0, 0.2, 1] }}
          >
            {/* End-cap glow */}
            {!isError && pct > 2 && pct < 100 && (
              <div
                className="absolute -right-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
                style={{
                  background: 'rgba(255,255,255,0.95)',
                  boxShadow: isComplete
                    ? '0 0 10px hsla(160,84%,65%,0.9), 0 0 18px hsla(160,84%,50%,0.6)'
                    : '0 0 10px hsla(215,100%,70%,0.9), 0 0 18px hsla(215,100%,55%,0.6)',
                }}
              />
            )}
          </motion.div>
        </div>

        {/* row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5" style={{ color: 'hsla(215,30%,75%,0.4)' }}>
            <Clock style={{ width: 11, height: 11 }} />
            <span style={{ fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.18em' }}>
              {formatTime(elapsedTime)}
            </span>
          </div>

          {totalClips > 0 && (
            <span style={{ fontSize: 10, fontWeight: 300, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'hsla(215,30%,75%,0.45)', fontFamily: 'Sora, system-ui, sans-serif' }}>
              {completedClips} / {totalClips} clips
            </span>
          )}

          {onCancel && (isRunning || isError) && !isComplete && (
            <button
              onClick={onCancel}
              disabled={isCancelling}
              className="transition-all disabled:opacity-40 hover:brightness-125"
              style={{
                fontSize: 9, fontWeight: 400,
                padding: '5px 14px',
                borderRadius: 999,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                fontFamily: 'Sora, system-ui, sans-serif',
                color: 'hsl(0 75% 70%)',
                background: 'hsla(0,75%,55%,0.06)',
                boxShadow: 'inset 0 0 0 1px hsla(0,75%,55%,0.25)',
              }}
            >
              {isCancelling ? 'Cancelling…' : 'Cancel'}
            </button>
          )}
        </div>

        {/* Diagnostic ticker — matches CinemaLoader signature */}
        {!isComplete && !isError && (
          <div className="flex items-center justify-center gap-5 mt-1">
            {['Engine', 'Render', 'Stream'].map((label, i) => (
              <div key={label} className="flex items-center gap-1.5">
                <div
                  className="w-1 h-1 rounded-full"
                  style={{
                    background: 'hsla(215,100%,65%,0.85)',
                    boxShadow: '0 0 6px hsla(215,100%,65%,0.7)',
                    animation: `pipelineTick 1.4s cubic-bezier(0.4, 0, 0.6, 1) ${i * 0.25}s infinite`,
                  }}
                />
                <span
                  className="text-[9px] text-white/35 font-mono tracking-[0.22em] uppercase"
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── CLIP BAR SPARKS ── */}
      {totalClips > 0 && !isComplete && (
        <div className="relative z-10 flex items-end justify-center gap-1.5">
          {Array.from({ length: Math.min(totalClips, 16) }).map((_, i) => {
            const filled = i < completedClips;
            return (
              <motion.div
                key={i}
                className="rounded-sm flex-shrink-0"
                style={{
                  width: 3,
                  background: filled
                    ? 'linear-gradient(180deg, hsla(215,100%,80%,0.95), hsla(215,100%,55%,0.85))'
                    : 'rgba(255,255,255,0.06)',
                  boxShadow: filled ? '0 0 8px hsla(215,100%,55%,0.5)' : 'none',
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
        <div className="relative z-10 flex justify-center">
          <button
            onClick={onResume}
            disabled={isResuming}
            className="transition-all disabled:opacity-50 hover:brightness-110"
            style={{
              fontSize: 10, fontWeight: 400,
              padding: '11px 32px',
              borderRadius: 999,
              letterSpacing: '0.28em',
              textTransform: 'uppercase',
              fontFamily: 'Sora, system-ui, sans-serif',
              background: 'linear-gradient(135deg, hsla(215,100%,55%,0.18), hsla(215,100%,45%,0.12))',
              boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.12), inset 0 0 0 1px hsla(215,100%,55%,0.4), 0 0 24px hsla(215,100%,55%,0.2)',
              color: 'hsla(215,100%,90%,0.95)',
            }}
          >
            {isResuming ? 'Resuming…' : '↩ Try Again'}
          </button>
        </div>
      )}

      {/* ── CLIP LINKS ── */}
      {clips.length > 0 && (
        <div className="relative z-10">
          <ClipGrid clips={clips} onPlayClip={onPlayClip} />
        </div>
      )}

      {/* Keyframes — mirror CinemaLoader */}
      <style>{`
        @keyframes pipelineSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pipelineSpinReverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        @keyframes pipelineAurora {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pipelineAura {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.08); }
        }
        @keyframes pipelineTick {
          0%, 100% { opacity: 0.35; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.5); }
        }
      `}</style>
    </div>
  );
}
