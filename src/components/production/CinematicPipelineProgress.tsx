/**
 * CinematicPipelineProgress — Apex Futuristic HUD
 *
 * Premium sci-fi aesthetic: circular arc ring, glowing radial core,
 * holographic stage chips, live metrics grid, and clip panel.
 * Every animation is smooth, slow, and photosensitivity-safe.
 */

import React, { useMemo, memo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Clock, XCircle, Play, ExternalLink, AlertCircle } from 'lucide-react';
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

const STAGE_META: Record<string, { emoji: string; label: string; sublabel: string; hue: number }> = {
  Script:   { emoji: '📝', label: 'Crafting Script',    sublabel: 'Generating narrative structure',  hue: 220 },
  Identity: { emoji: '👤', label: 'Characters',         sublabel: 'Locking character identities',    hue: 195 },
  Audit:    { emoji: '🔍', label: 'Quality Audit',      sublabel: 'Running continuity checks',        hue: 160 },
  Assets:   { emoji: '🎨', label: 'Creating Assets',    sublabel: 'Images, voice & music',           hue: 280 },
  Render:   { emoji: '🎥', label: 'Rendering',          sublabel: 'Generating video frames',          hue: 20  },
  Stitch:   { emoji: '✨', label: 'Final Assembly',      sublabel: 'Stitching clips together',         hue: 50  },
};

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// CIRCULAR ARC RING
// ─────────────────────────────────────────────────────────────────────────────

const ARC_R = 120;
const ARC_STROKE = 10;
const ARC_SIZE = (ARC_R + ARC_STROKE + 6) * 2;
const ARC_CIRCUMFERENCE = 2 * Math.PI * ARC_R;

const CircularRing = memo(function CircularRing({
  progress,
  isComplete,
  isError,
  isRunning,
  emoji,
  label,
}: {
  progress: number;
  isComplete: boolean;
  isError: boolean;
  isRunning: boolean;
  emoji: string;
  label: string;
}) {
  const offset = ARC_CIRCUMFERENCE * (1 - Math.min(progress / 100, 1));
  const cx = ARC_SIZE / 2;
  const cy = ARC_SIZE / 2;

  const trackColor  = 'hsl(240 15% 12%)';
  const ringGrad    = isError ? 'url(#ring-error)' : isComplete ? 'url(#ring-done)' : 'url(#ring-active)';
  const glowColor   = isError ? 'hsl(0 80% 55%)' : isComplete ? 'hsl(155 70% 48%)' : 'hsl(263 75% 62%)';

  return (
    <div className="relative flex items-center justify-center" style={{ width: ARC_SIZE, height: ARC_SIZE }}>
      <svg
        width={ARC_SIZE}
        height={ARC_SIZE}
        viewBox={`0 0 ${ARC_SIZE} ${ARC_SIZE}`}
        className="absolute inset-0"
        style={{ transform: 'rotate(-90deg)' }}
      >
        <defs>
          <linearGradient id="ring-active" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="hsl(215 95% 70%)" />
            <stop offset="40%"  stopColor="hsl(270 90% 68%)" />
            <stop offset="70%"  stopColor="hsl(320 85% 65%)" />
            <stop offset="100%" stopColor="hsl(35 100% 62%)" />
          </linearGradient>
          <linearGradient id="ring-done" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="hsl(155 80% 50%)" />
            <stop offset="100%" stopColor="hsl(185 90% 55%)" />
          </linearGradient>
          <linearGradient id="ring-error" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="hsl(0 85% 58%)" />
            <stop offset="100%" stopColor="hsl(20 90% 55%)" />
          </linearGradient>
          <filter id="ring-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Track ring */}
        <circle
          cx={cx} cy={cy} r={ARC_R}
          fill="none"
          stroke={trackColor}
          strokeWidth={ARC_STROKE}
        />

        {/* Glow pass (wider, blurred) */}
        <circle
          cx={cx} cy={cy} r={ARC_R}
          fill="none"
          stroke={ringGrad}
          strokeWidth={ARC_STROKE * 2.5}
          strokeDasharray={ARC_CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
          filter="url(#ring-glow)"
          opacity={0.35}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)' }}
        />

        {/* Sharp ring */}
        <circle
          cx={cx} cy={cy} r={ARC_R}
          fill="none"
          stroke={ringGrad}
          strokeWidth={ARC_STROKE}
          strokeDasharray={ARC_CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)' }}
        />

        {/* Tick marks every 30° */}
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i / 12) * 2 * Math.PI;
          const x1 = cx + Math.cos(angle) * (ARC_R - ARC_STROKE / 2 - 14);
          const y1 = cy + Math.sin(angle) * (ARC_R - ARC_STROKE / 2 - 14);
          const x2 = cx + Math.cos(angle) * (ARC_R - ARC_STROKE / 2 - 10);
          const y2 = cy + Math.sin(angle) * (ARC_R - ARC_STROKE / 2 - 10);
          return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="hsl(240 15% 22%)" strokeWidth="1" />
          );
        })}
      </svg>

      {/* Soft radial inner glow */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: ARC_R * 1.4,
          height: ARC_R * 1.4,
          background: `radial-gradient(circle, ${glowColor.replace(')', ' / 0.07)')} 0%, transparent 75%)`,
          filter: 'blur(8px)',
        }}
      />

      {/* Center content */}
      <div className="relative z-10 flex flex-col items-center gap-1 select-none">
        <AnimatePresence mode="wait">
          <motion.span
            key={emoji}
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="text-3xl"
          >
            {emoji}
          </motion.span>
        </AnimatePresence>

        <motion.span
          key={Math.round(progress)}
          className="font-black tabular-nums leading-none"
          style={{
            fontSize: 52,
            letterSpacing: '-0.04em',
            background: isError
              ? 'linear-gradient(160deg, hsl(0 80% 65%), hsl(20 90% 60%))'
              : isComplete
              ? 'linear-gradient(160deg, hsl(155 75% 55%), hsl(185 85% 60%))'
              : 'linear-gradient(160deg, hsl(215 95% 78%), hsl(270 88% 72%), hsl(320 85% 68%))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          {Math.round(progress)}<span style={{ fontSize: 24, opacity: 0.7 }}>%</span>
        </motion.span>

        <AnimatePresence mode="wait">
          <motion.p
            key={label}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.3 }}
            className="text-[11px] font-semibold text-center max-w-[120px] leading-tight"
            style={{ color: 'hsl(240 10% 55%)' }}
          >
            {label}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Slow rotating outer accent ring */}
      {isRunning && !isComplete && !isError && (
        <motion.div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: ARC_SIZE + 24,
            height: ARC_SIZE + 24,
            border: '1px dashed hsl(263 60% 50% / 0.2)',
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
        />
      )}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// STAGE STEPPER
// ─────────────────────────────────────────────────────────────────────────────

const StageStepper = memo(function StageStepper({ stages }: { stages: StageStatus[] }) {
  const visible = stages.filter(s => s.status !== 'skipped');
  if (!visible.length) return null;

  return (
    <div className="flex items-center justify-center gap-1 flex-wrap">
      {visible.map((stage, i) => {
        const meta   = STAGE_META[stage.shortName];
        const done   = stage.status === 'complete';
        const active = stage.status === 'active';
        const error  = stage.status === 'error';
        const color  = error ? '0 75% 58%' : done ? '155 70% 48%' : `${meta?.hue ?? 263} 65% 62%`;

        return (
          <React.Fragment key={stage.shortName}>
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold"
              style={{
                background: active
                  ? `hsl(${color} / 0.15)`
                  : done
                  ? `hsl(${color} / 0.08)`
                  : 'hsl(240 15% 8% / 0.6)',
                border: `1px solid hsl(${color} / ${active ? '0.5' : done ? '0.3' : '0.1'})`,
                color: `hsl(${color} / ${active || done ? '1' : '0.38'})`,
                boxShadow: active ? `0 0 12px hsl(${color} / 0.2)` : 'none',
              }}
            >
              <span>{meta?.emoji ?? '·'}</span>
              <span>{stage.shortName}</span>
              {done  && <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />}
              {error && <XCircle className="w-2.5 h-2.5 shrink-0" />}
              {active && (
                <motion.div
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: `hsl(${color})` }}
                  animate={{ opacity: [1, 0.2, 1] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
            </motion.div>
            {i < visible.length - 1 && (
              <div className="w-2 h-px shrink-0"
                style={{ background: done ? `hsl(${color} / 0.4)` : 'hsl(240 8% 20%)' }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// GRADIENT PROGRESS BAR
// ─────────────────────────────────────────────────────────────────────────────

const GradientBar = memo(function GradientBar({
  progress, isError, isComplete,
}: { progress: number; isError: boolean; isComplete: boolean }) {
  return (
    <div className="w-full flex flex-col gap-2">
      <div
        className="relative w-full rounded-full overflow-hidden"
        style={{ height: 6, background: 'hsl(240 15% 10%)' }}
      >
        {/* Subtle dot texture */}
        <div className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: 'radial-gradient(circle, hsl(240 20% 55%) 1px, transparent 1px)',
            backgroundSize: '5px 5px',
          }}
        />
        {/* Fill */}
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            background: isError
              ? 'linear-gradient(90deg, hsl(0 85% 55%), hsl(20 90% 58%))'
              : isComplete
              ? 'linear-gradient(90deg, hsl(155 75% 48%), hsl(185 85% 55%))'
              : 'linear-gradient(90deg, hsl(215 90% 68%), hsl(265 85% 65%), hsl(320 80% 63%), hsl(35 95% 60%))',
            boxShadow: isComplete
              ? '0 0 18px hsl(155 75% 48% / 0.5)'
              : isError
              ? '0 0 18px hsl(0 85% 55% / 0.5)'
              : '0 0 20px hsl(265 85% 62% / 0.5)',
          }}
          animate={{ width: `${Math.max(1, progress)}%` }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
        {/* Moving shimmer */}
        <motion.div
          className="absolute inset-y-0 w-16 rounded-full"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)' }}
          animate={{ x: ['0%', '700%'] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1 }}
        />
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// METRICS ROW
// ─────────────────────────────────────────────────────────────────────────────

const MetricChip = memo(function MetricChip({
  label, value, hue = 263,
}: { label: string; value: string; hue?: number }) {
  return (
    <div
      className="flex flex-col items-center gap-0.5 px-4 py-2.5 rounded-xl"
      style={{
        background: `hsl(${hue} 25% 8%)`,
        border: `1px solid hsl(${hue} 30% 18%)`,
      }}
    >
      <span className="text-[9px] font-semibold uppercase tracking-widest"
        style={{ color: `hsl(${hue} 50% 50%)` }}>
        {label}
      </span>
      <span className="text-sm font-bold tabular-nums"
        style={{ color: `hsl(${hue} 70% 72%)` }}>
        {value}
      </span>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// CLIP PANEL
// ─────────────────────────────────────────────────────────────────────────────

const ClipPanel = memo(function ClipPanel({
  clips, onPlayClip,
}: { clips: ClipData[]; onPlayClip?: (url: string) => void }) {
  if (!clips.length) return null;

  const completed = clips.filter(c => c.status === 'completed');

  return (
    <div className="w-full flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="h-px flex-1" style={{ background: 'hsl(240 10% 14%)' }} />
        <span className="text-[10px] font-bold uppercase tracking-widest"
          style={{ color: 'hsl(240 10% 35%)' }}>
          Clips · {completed.length}/{clips.length}
        </span>
        <div className="h-px flex-1" style={{ background: 'hsl(240 10% 14%)' }} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {clips.map((clip) => {
          const done  = clip.status === 'completed' && !!clip.videoUrl;
          const busy  = clip.status === 'generating';
          const fail  = clip.status === 'failed';
          const idle  = clip.status === 'pending';

          const chipColor = done ? '155 65% 48%' : busy ? '263 65% 60%' : fail ? '0 72% 55%' : '240 10% 30%';

          return (
            <motion.div
              key={clip.index}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: clip.index * 0.04, duration: 0.3 }}
              className="relative rounded-xl overflow-hidden flex flex-col"
              style={{
                background: `hsl(${chipColor} / 0.05)`,
                border: `1px solid hsl(${chipColor} / ${done ? '0.3' : busy ? '0.25' : '0.12'})`,
                boxShadow: done ? `0 0 14px hsl(${chipColor} / 0.12)` : 'none',
              }}
            >
              {/* Color stripe */}
              <div className="h-0.5 w-full"
                style={{ background: `hsl(${chipColor})`, opacity: done || busy ? 1 : 0.3 }} />

              <div className="p-2.5 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold" style={{ color: `hsl(${chipColor})` }}>
                    Clip {clip.index + 1}
                  </span>
                  {done && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: `hsl(${chipColor})` }} />}
                  {fail && <AlertCircle className="w-3.5 h-3.5 shrink-0 text-destructive" />}
                  {busy && (
                    <motion.div className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: `hsl(${chipColor})` }}
                      animate={{ opacity: [1, 0.2, 1] }}
                      transition={{ duration: 1.6, repeat: Infinity }} />
                  )}
                  {idle && <div className="w-2 h-2 rounded-full shrink-0 bg-muted-foreground/20" />}
                </div>

                {done && clip.videoUrl && (
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => onPlayClip?.(clip.videoUrl!)}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-semibold transition-all hover:brightness-125"
                      style={{
                        background: `hsl(${chipColor} / 0.15)`,
                        border: `1px solid hsl(${chipColor} / 0.3)`,
                        color: `hsl(${chipColor})`,
                      }}
                    >
                      <Play className="w-2.5 h-2.5 fill-current" />
                      Play
                    </button>
                    <a
                      href={clip.videoUrl}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center w-7 h-7 rounded-lg transition-all hover:brightness-125"
                      style={{
                        background: 'hsl(263 40% 12%)',
                        border: '1px solid hsl(263 30% 22%)',
                        color: 'hsl(263 65% 65%)',
                      }}
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}

                {busy && (
                  <div className="h-0.5 rounded-full overflow-hidden" style={{ background: 'hsl(263 40% 14%)' }}>
                    <motion.div className="h-full rounded-full"
                      style={{ background: `hsl(${chipColor})` }}
                      animate={{ x: ['-100%', '200%'] }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }} />
                  </div>
                )}

                {fail && clip.error && (
                  <p className="text-[9px] text-destructive/60 leading-tight line-clamp-2">{clip.error}</p>
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
// STARFIELD (subtle atmospheric dots)
// ─────────────────────────────────────────────────────────────────────────────

const Starfield = memo(function Starfield({ active }: { active: boolean }) {
  const dots = useMemo(() => Array.from({ length: 30 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    r: 0.8 + Math.random() * 1.4,
    delay: Math.random() * 6,
    dur: 4 + Math.random() * 6,
    hue: [215, 270, 320, 35][Math.floor(Math.random() * 4)],
  })), []);

  if (!active) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
      {dots.map(d => (
        <motion.div
          key={d.id}
          className="absolute rounded-full"
          style={{
            left: `${d.x}%`,
            top: `${d.y}%`,
            width: d.r * 2,
            height: d.r * 2,
            background: `hsl(${d.hue} 80% 70%)`,
          }}
          animate={{ opacity: [0, 0.7, 0], scale: [0.5, 1.2, 0.5] }}
          transition={{ duration: d.dur, delay: d.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
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
  const activeMeta  = useMemo(() => {
    if (!activeStage) return null;
    return STAGE_META[activeStage.shortName] ?? { emoji: '⚡', label: activeStage.name, sublabel: '', hue: 263 };
  }, [activeStage]);

  const emoji = isComplete ? '✅' : isError ? '❌' : (activeMeta?.emoji ?? '⚡');
  const label = isComplete ? 'Complete!' : isError ? 'Failed' : (activeMeta?.label ?? 'Initializing…');

  return (
    <div
      className={cn('relative flex flex-col gap-6 w-full rounded-3xl overflow-hidden', className)}
      style={{
        background: 'linear-gradient(145deg, hsl(240 22% 5%) 0%, hsl(258 28% 6%) 50%, hsl(240 18% 4%) 100%)',
        border: '1px solid hsl(258 30% 16% / 0.7)',
        boxShadow: '0 0 0 1px hsl(258 20% 10% / 0.5), 0 32px 80px hsl(258 50% 5% / 0.8), inset 0 1px 0 hsl(258 40% 20% / 0.15)',
        padding: '32px 28px 28px',
      }}
    >
      {/* Subtle grid lines */}
      <div
        className="absolute inset-0 pointer-events-none rounded-3xl opacity-[0.025]"
        style={{
          backgroundImage: `
            linear-gradient(hsl(263 70% 60%) 1px, transparent 1px),
            linear-gradient(90deg, hsl(263 70% 60%) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Top edge highlight */}
      <div
        className="absolute top-0 left-1/4 right-1/4 h-px pointer-events-none"
        style={{ background: 'linear-gradient(90deg, transparent, hsl(263 70% 60% / 0.4), transparent)' }}
      />

      {/* Atmospheric starfield */}
      <Starfield active={isRunning && !isComplete && !isError} />

      {/* ── Stage stepper ── */}
      <StageStepper stages={stages} />

      {/* ── Central ring + sublabel ── */}
      <div className="flex flex-col items-center gap-4 relative">
        <CircularRing
          progress={progress}
          isComplete={isComplete}
          isError={isError}
          isRunning={isRunning}
          emoji={emoji}
          label={label}
        />

        {/* Stage sublabel */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeMeta?.sublabel ?? label}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.4 }}
            className="text-center"
          >
            {!isComplete && !isError && activeMeta && (
              <>
                <p className="text-sm font-medium" style={{ color: 'hsl(240 10% 65%)' }}>
                  {activeMeta.sublabel}
                </p>
                {activeStage?.details && (
                  <p className="text-xs mt-1 max-w-xs mx-auto leading-relaxed"
                    style={{ color: 'hsl(240 8% 42%)' }}>
                    {activeStage.details}
                  </p>
                )}
              </>
            )}
            {isComplete && (
              <p className="text-sm font-medium" style={{ color: 'hsl(155 65% 55%)' }}>
                {projectTitle ? `"${projectTitle}" is ready` : 'Your video is ready'}
              </p>
            )}
            {isError && lastError && (
              <p className="text-xs max-w-xs mx-auto leading-relaxed"
                style={{ color: 'hsl(0 65% 58%)' }}>
                {lastError}
              </p>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Gradient progress bar ── */}
      <GradientBar progress={progress} isError={isError} isComplete={isComplete} />

      {/* ── Metrics row ── */}
      <div className="grid grid-cols-3 gap-2">
        <MetricChip label="Progress" value={`${Math.round(progress)}%`} hue={263} />
        <MetricChip label="Elapsed"  value={formatTime(elapsedTime)}    hue={195} />
        {totalClips > 0
          ? <MetricChip label="Clips"   value={`${completedClips}/${totalClips}`} hue={160} />
          : <MetricChip label="Stage"   value={activeMeta?.label?.split(' ')[0] ?? '—'} hue={220} />
        }
      </div>

      {/* ── Clip bar visualiser (during render stage) ── */}
      {totalClips > 0 && !isComplete && (
        <div className="flex items-center justify-center gap-1.5">
          {Array.from({ length: Math.min(totalClips, 14) }).map((_, i) => {
            const done = i < completedClips;
            return (
              <motion.div
                key={i}
                className="rounded-full flex-shrink-0"
                style={{
                  width: 5,
                  background: done
                    ? 'linear-gradient(to top, hsl(155 70% 45%), hsl(185 80% 55%))'
                    : 'hsl(240 12% 16%)',
                  boxShadow: done ? '0 0 8px hsl(155 70% 45% / 0.5)' : 'none',
                }}
                animate={{ height: done ? 22 : 8 }}
                transition={{ duration: 0.5, ease: [0.34,1.56,0.64,1] }}
              />
            );
          })}
        </div>
      )}

      {/* ── Footer: timer + cancel ── */}
      {isRunning && !isComplete && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2" style={{ color: 'hsl(240 8% 38%)' }}>
            <Clock className="w-3.5 h-3.5" />
            <span className="text-xs tabular-nums font-medium">{formatTime(elapsedTime)}</span>
          </div>
          {onCancel && (
            <button
              onClick={onCancel}
              disabled={isCancelling}
              className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all disabled:opacity-40"
              style={{
                color: 'hsl(0 65% 58%)',
                background: 'hsl(0 65% 50% / 0.06)',
                border: '1px solid hsl(0 65% 50% / 0.15)',
              }}
            >
              {isCancelling ? 'Cancelling…' : 'Cancel'}
            </button>
          )}
        </div>
      )}

      {/* ── Error resume button ── */}
      {isError && onResume && (
        <div className="flex justify-center">
          <button
            onClick={onResume}
            disabled={isResuming}
            className="text-sm px-8 py-2.5 rounded-xl font-semibold transition-all disabled:opacity-50 hover:brightness-110"
            style={{
              background: 'linear-gradient(135deg, hsl(263 65% 52% / 0.2), hsl(280 60% 55% / 0.15))',
              border: '1px solid hsl(263 65% 58% / 0.4)',
              color: 'hsl(263 70% 72%)',
              boxShadow: '0 0 20px hsl(263 65% 55% / 0.15)',
            }}
          >
            {isResuming ? 'Resuming…' : '↩ Try Again'}
          </button>
        </div>
      )}

      {/* ── Clip links ── */}
      {clips.length > 0 && (
        <ClipPanel clips={clips} onPlayClip={onPlayClip} />
      )}
    </div>
  );
}
