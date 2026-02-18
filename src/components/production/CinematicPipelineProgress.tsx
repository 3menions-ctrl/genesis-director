/**
 * CinematicPipelineProgress — Calm Orbital Design
 *
 * Modern, serene progress display with slow orbital rings, gentle breathing,
 * and smooth stage transitions. No fast flashing, no rapid rotation.
 * Photosensitivity-safe: all animations are slow and gentle.
 */

import React, { useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Clock, Film, XCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============= TYPES =============

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

// ============= STAGE CONFIGURATIONS =============

const STAGE_META: Record<string, {
  emoji: string;
  label: string;
  sublabel: string;
  hue: number;
}> = {
  'Script':   { emoji: '📝', label: 'Crafting Script',     sublabel: 'Narrative & structure',   hue: 263 },
  'Identity': { emoji: '👤', label: 'Locking Characters',  sublabel: 'Identity anchoring',       hue: 195 },
  'Audit':    { emoji: '🔍', label: 'Quality Check',       sublabel: 'Continuity audit',         hue: 160 },
  'Assets':   { emoji: '🎨', label: 'Creating Assets',     sublabel: 'Images, voice & music',    hue: 35  },
  'Render':   { emoji: '🎥', label: 'Rendering Video',     sublabel: 'Frame by frame',           hue: 350 },
  'Stitch':   { emoji: '✨', label: 'Final Assembly',       sublabel: 'Merging clips',            hue: 280 },
};

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ============= ORBITAL RING VISUAL =============

const OrbitalRing = memo(function OrbitalRing({
  hue,
  size,
  isActive,
  isComplete,
  isError,
}: {
  hue: number;
  size: number;
  isActive: boolean;
  isComplete: boolean;
  isError: boolean;
}) {
  const color = isError
    ? '0 72% 55%'
    : isComplete
      ? '160 60% 48%'
      : `${hue} 65% 60%`;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {/* Outermost subtle glow ring - very slow fade */}
      {isActive && (
        <motion.div
          className="absolute rounded-full"
          style={{
            width: size + 28,
            height: size + 28,
            border: `1px solid hsl(${color} / 0.2)`,
          }}
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* Outer orbit ring */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: size + 14,
          height: size + 14,
          border: `1.5px solid hsl(${color} / ${isActive ? '0.35' : '0.15'})`,
        }}
        animate={isActive ? { opacity: [0.5, 1, 0.5] } : {}}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Main circle */}
      <div
        className="relative rounded-full flex items-center justify-center overflow-hidden"
        style={{
          width: size,
          height: size,
          background: `radial-gradient(circle at 38% 32%,
            hsl(${color} / 0.18) 0%,
            hsl(${color} / 0.06) 60%,
            transparent 100%
          )`,
          border: `1.5px solid hsl(${color} / ${isActive ? '0.5' : '0.2'})`,
          boxShadow: isActive
            ? `0 0 24px hsl(${color} / 0.18), inset 0 0 16px hsl(${color} / 0.08)`
            : `0 0 8px hsl(${color} / 0.08)`,
        }}
      >
        {/* Soft inner highlight — static, no animation */}
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: '42%',
            height: '26%',
            top: '16%',
            left: '22%',
            background: 'radial-gradient(ellipse, rgba(255,255,255,0.18) 0%, transparent 80%)',
            filter: 'blur(2px)',
          }}
        />
      </div>
    </div>
  );
});

// ============= ACTIVE STAGE CARD =============

const ActiveStageCard = memo(function ActiveStageCard({
  stage,
  progress,
  elapsedTime,
  completedClips,
  totalClips,
}: {
  stage: StageStatus | null;
  progress: number;
  elapsedTime: number;
  completedClips: number;
  totalClips: number;
}) {
  if (!stage) return null;

  const meta = STAGE_META[stage.shortName] ?? {
    emoji: '⚡', label: stage.name, sublabel: '', hue: 263,
  };
  const hue = meta.hue;
  const color = `${hue} 65% 60%`;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={stage.shortName}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="flex flex-col items-center gap-3 w-full"
      >
        {/* Orbital visual */}
        <div className="relative flex items-center justify-center">
          <OrbitalRing hue={hue} size={88} isActive isComplete={false} isError={false} />
          {/* Emoji centered inside */}
          <motion.span
            className="absolute text-2xl select-none"
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          >
            {meta.emoji}
          </motion.span>
        </div>

        {/* Stage label */}
        <div className="text-center">
          <p
            className="text-sm font-semibold"
            style={{ color: `hsl(${color})` }}
          >
            {meta.label}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{meta.sublabel}</p>
          {stage.details && (
            <p className="text-[11px] text-muted-foreground/70 mt-1 max-w-[200px] mx-auto leading-relaxed">
              {stage.details}
            </p>
          )}
        </div>

        {/* Clip counter (only during rendering) */}
        {totalClips > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex items-end gap-1">
              {Array.from({ length: Math.min(totalClips, 10) }).map((_, i) => {
                const done = i < completedClips;
                return (
                  <motion.div
                    key={i}
                    className="rounded-sm"
                    style={{
                      width: 5,
                      background: done
                        ? `hsl(160 60% 48%)`
                        : `hsl(${color} / 0.2)`,
                      boxShadow: done ? `0 0 6px hsl(160 60% 48% / 0.4)` : 'none',
                    }}
                    animate={{ height: done ? 18 : 10 }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                  />
                );
              })}
            </div>
            <span className="text-[11px] text-muted-foreground font-medium tabular-nums">
              {completedClips}/{totalClips} clips
            </span>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
});

// ============= STAGE STEPPER =============

const StageStepper = memo(function StageStepper({ stages }: { stages: StageStatus[] }) {
  const visible = stages.filter(s => s.status !== 'skipped');
  if (visible.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap justify-center">
      {visible.map((stage, i) => {
        const meta = STAGE_META[stage.shortName];
        const isDone = stage.status === 'complete';
        const isActive = stage.status === 'active';
        const isError = stage.status === 'error';
        const hue = meta?.hue ?? 263;
        const color = isError ? '0 72% 55%' : isDone ? '160 60% 48%' : `${hue} 65% 60%`;

        return (
          <React.Fragment key={stage.shortName}>
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.06, duration: 0.3 }}
              className="flex items-center gap-1 px-2 py-1 rounded-full"
              style={{
                background: (isActive || isDone)
                  ? `hsl(${color} / 0.1)`
                  : 'transparent',
                border: `1px solid hsl(${color} / ${isActive ? '0.4' : isDone ? '0.25' : '0.12'})`,
              }}
            >
              <span className="text-[10px]">{meta?.emoji ?? '•'}</span>
              <span
                className="text-[10px] font-medium"
                style={{ color: `hsl(${color} / ${isActive || isDone ? '1' : '0.45'})` }}
              >
                {stage.shortName}
              </span>
              {isDone && <CheckCircle2 className="w-3 h-3" style={{ color: 'hsl(160 60% 48%)' }} />}
              {isError && <XCircle className="w-3 h-3 text-destructive" />}
              {isActive && (
                <motion.div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: `hsl(${color})` }}
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
            </motion.div>

            {/* Connector line */}
            {i < visible.length - 1 && (
              <div
                className="w-4 h-px flex-shrink-0"
                style={{
                  background: isDone
                    ? 'hsl(160 60% 48% / 0.4)'
                    : 'hsl(240 5% 35% / 0.25)',
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
});

// ============= PROGRESS BAR =============

const ProgressBar = memo(function ProgressBar({
  progress,
  hue,
  isError,
  isComplete,
}: {
  progress: number;
  hue: number;
  isError: boolean;
  isComplete: boolean;
}) {
  const color = isError ? '0 72% 55%' : isComplete ? '160 60% 48%' : `${hue} 65% 60%`;

  return (
    <div className="w-full flex flex-col gap-1.5">
      <div
        className="relative w-full rounded-full overflow-hidden"
        style={{
          height: 4,
          background: `hsl(${color} / 0.12)`,
        }}
      >
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ background: `hsl(${color})` }}
          animate={{ width: `${Math.max(2, progress)}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
      <div className="flex justify-between items-center">
        <span className="text-[11px] text-muted-foreground tabular-nums font-medium">
          {Math.round(progress)}%
        </span>
      </div>
    </div>
  );
});

// ============= MAIN COMPONENT =============

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
  const activeStage = useMemo(
    () => stages.find(s => s.status === 'active') ?? null,
    [stages]
  );

  const activeHue = useMemo(() => {
    if (!activeStage) return 263;
    return STAGE_META[activeStage.shortName]?.hue ?? 263;
  }, [activeStage]);

  return (
    <div className={cn('flex flex-col gap-5 w-full', className)}>

      {/* Stage stepper */}
      <StageStepper stages={stages} />

      {/* Progress bar */}
      <ProgressBar
        progress={progress}
        hue={activeHue}
        isError={isError}
        isComplete={isComplete}
      />

      {/* Active stage central display */}
      {!isComplete && !isError && (
        <ActiveStageCard
          stage={activeStage}
          progress={progress}
          elapsedTime={elapsedTime}
          completedClips={completedClips}
          totalClips={totalClips}
        />
      )}

      {/* Completion state */}
      {isComplete && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="flex flex-col items-center gap-2 py-2"
        >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{
              background: 'hsl(160 60% 48% / 0.12)',
              border: '1.5px solid hsl(160 60% 48% / 0.4)',
            }}
          >
            <CheckCircle2 className="w-7 h-7" style={{ color: 'hsl(160 60% 48%)' }} />
          </div>
          <p className="text-sm font-semibold" style={{ color: 'hsl(160 60% 48%)' }}>
            Video Ready
          </p>
          <p className="text-xs text-muted-foreground">
            {projectTitle ?? 'Your project'} has been generated
          </p>
        </motion.div>
      )}

      {/* Error state */}
      {isError && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-2 py-2"
        >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{
              background: 'hsl(0 72% 55% / 0.1)',
              border: '1.5px solid hsl(0 72% 55% / 0.35)',
            }}
          >
            <XCircle className="w-7 h-7 text-destructive" />
          </div>
          <p className="text-sm font-semibold text-destructive">Generation Failed</p>
          {lastError && (
            <p className="text-[11px] text-muted-foreground text-center max-w-[220px] leading-relaxed">
              {lastError}
            </p>
          )}
          {onResume && (
            <button
              onClick={onResume}
              disabled={isResuming}
              className="mt-1 text-xs px-3 py-1.5 rounded-md font-medium transition-opacity disabled:opacity-50"
              style={{
                background: 'hsl(263 65% 60% / 0.15)',
                border: '1px solid hsl(263 65% 60% / 0.35)',
                color: 'hsl(263 65% 70%)',
              }}
            >
              {isResuming ? 'Resuming…' : 'Try Again'}
            </button>
          )}
        </motion.div>
      )}

      {/* Footer: elapsed time + cancel */}
      {isRunning && !isComplete && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span className="text-[11px] tabular-nums">{formatTime(elapsedTime)}</span>
          </div>
          {onCancel && (
            <button
              onClick={onCancel}
              disabled={isCancelling}
              className="text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors disabled:opacity-40"
            >
              {isCancelling ? 'Cancelling…' : 'Cancel'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
