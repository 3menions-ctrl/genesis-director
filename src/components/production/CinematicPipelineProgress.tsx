/**
 * CinematicPipelineProgress — Holographic Bubbles Edition
 * 
 * Iridescent soap bubbles with prismatic reflections, pop animations,
 * and ambient floating particles that represent pipeline stage progression.
 */

import React, { useMemo, useEffect, useState, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, XCircle, Clapperboard, Zap, Play, CheckCircle2 } from 'lucide-react';
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
  colors: [string, string, string]; // [primary, secondary, tertiary] HSL
  activityTexts: string[];
}> = {
  'Script':   {
    emoji: '📝',
    label: 'Crafting Script',
    sublabel: 'Narrative & structure',
    colors: ['270 70% 65%', '240 80% 60%', '290 60% 70%'],
    activityTexts: ['Analyzing structure...', 'Breaking into shots...', 'Adding camera cues...'],
  },
  'Identity': {
    emoji: '👤',
    label: 'Locking Characters',
    sublabel: 'Identity anchoring',
    colors: ['195 90% 55%', '170 80% 50%', '220 70% 60%'],
    activityTexts: ['Extracting features...', 'Mapping proportions...', 'Creating anchors...'],
  },
  'Audit':    {
    emoji: '🔍',
    label: 'Quality Check',
    sublabel: 'Continuity audit',
    colors: ['160 84% 45%', '140 70% 50%', '185 80% 50%'],
    activityTexts: ['Validating continuity...', 'Scoring coherence...', 'Checking lighting...'],
  },
  'Assets':   {
    emoji: '🎨',
    label: 'Creating Assets',
    sublabel: 'Images, voice & music',
    colors: ['35 100% 55%', '48 100% 60%', '20 90% 55%'],
    activityTexts: ['Creating images...', 'Generating music...', 'Synthesizing voice...'],
  },
  'Render':   {
    emoji: '🎥',
    label: 'Rendering Video',
    sublabel: 'Frame by frame',
    colors: ['350 80% 60%', '330 70% 60%', '10 90% 60%'],
    activityTexts: ['Processing frames...', 'Applying style...', 'Generating video...'],
  },
  'Stitch':   {
    emoji: '✨',
    label: 'Final Assembly',
    sublabel: 'Merging clips',
    colors: ['263 70% 65%', '280 60% 70%', '240 80% 65%'],
    activityTexts: ['Analyzing transitions...', 'Building manifest...', 'Finalizing...'],
  },
};

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

const generateId = () => Math.random().toString(36).slice(2, 9);

// ============= BUBBLE COMPONENT =============

interface BubbleProps {
  id: string;
  size: number;
  colors: [string, string, string];
  emoji: string;
  label: string;
  sublabel?: string;
  isMain?: boolean;
  isPopping?: boolean;
  delay?: number;
  x: number; // px from center
  y: number; // px from bottom
  onPop?: () => void;
}

const Bubble = memo(function Bubble({
  id, size, colors, emoji, label, sublabel, isMain, isPopping, delay = 0, x, y,
}: BubbleProps) {
  const [c1, c2, c3] = colors;

  return (
    <motion.div
      key={id}
      className="absolute flex items-center justify-center"
      style={{
        width: size,
        height: size,
        left: `50%`,
        bottom: y,
        marginLeft: x - size / 2,
      }}
      initial={{ scale: 0, opacity: 0, y: 30 }}
      animate={isPopping ? {
        scale: [1, 1.25, 0.1],
        opacity: [1, 1, 0],
      } : {
        scale: [0, 1.08, 0.96, 1],
        opacity: 1,
        y: 0,
      }}
      exit={{ scale: 0, opacity: 0, transition: { duration: 0.3 } }}
      transition={isPopping
        ? { duration: 0.45, ease: [0.4, 0, 0.6, 1] }
        : { duration: 0.7, delay, ease: [0.34, 1.56, 0.64, 1] }
      }
    >
      {/* Pop burst particles */}
      {isPopping && (
        <>
          {Array.from({ length: 10 }).map((_, pi) => {
            const angle = (pi / 10) * Math.PI * 2;
            const dist = size * 0.7;
            return (
              <motion.div
                key={pi}
                className="absolute rounded-full"
                style={{
                  width: pi % 2 === 0 ? 6 : 4,
                  height: pi % 2 === 0 ? 6 : 4,
                  background: `hsl(${pi % 2 === 0 ? c1 : c2})`,
                  boxShadow: `0 0 8px hsl(${c1} / 0.8)`,
                  top: size / 2,
                  left: size / 2,
                }}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{
                  x: Math.cos(angle) * dist,
                  y: Math.sin(angle) * dist,
                  opacity: 0,
                  scale: 0,
                }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            );
          })}
        </>
      )}

      {/* Outer pulse ring (main only) */}
      {isMain && !isPopping && (
        <motion.div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{ border: `1.5px solid hsl(${c1} / 0.35)` }}
          animate={{ scale: [1, 1.6], opacity: [0.5, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeOut' }}
        />
      )}

      {/* Second outer ring */}
      {isMain && !isPopping && (
        <motion.div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{ border: `1px solid hsl(${c2} / 0.2)` }}
          animate={{ scale: [1, 2], opacity: [0.3, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeOut', delay: 0.8 }}
        />
      )}

      {/* Bubble shell */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `
            radial-gradient(ellipse at 32% 28%, hsl(${c1} / 0.4) 0%, transparent 55%),
            radial-gradient(ellipse at 68% 72%, hsl(${c2} / 0.25) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 50%, hsl(${c3} / 0.12) 0%, transparent 80%),
            radial-gradient(ellipse at 50% 50%, hsl(250 15% 6% / 0.6) 0%, transparent 100%)
          `,
          border: `1.5px solid hsl(${c1} / 0.45)`,
          boxShadow: `
            0 0 ${size * 0.35}px hsl(${c1} / 0.2),
            0 0 ${size * 0.7}px hsl(${c2} / 0.1),
            inset 0 0 ${size * 0.25}px hsl(${c1} / 0.12)
          `,
        }}
      />

      {/* Prismatic rotating shimmer */}
      <motion.div
        className="absolute inset-0 rounded-full overflow-hidden pointer-events-none"
        animate={{ rotate: 360 }}
        transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
        style={{ opacity: 0.55 }}
      >
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(
              from 0deg,
              hsl(${c1} / 0.35),
              hsl(${c2} / 0.25),
              hsl(${c3} / 0.3),
              transparent 40%,
              hsl(${c1} / 0.2) 60%,
              hsl(${c2} / 0.15),
              hsl(${c1} / 0.35)
            )`,
          }}
        />
      </motion.div>

      {/* Counter-rotating inner shimmer */}
      <motion.div
        className="absolute rounded-full overflow-hidden pointer-events-none"
        style={{ inset: '15%', opacity: 0.3 }}
        animate={{ rotate: -360 }}
        transition={{ duration: 7, repeat: Infinity, ease: 'linear' }}
      >
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(
              from 90deg,
              hsl(${c2} / 0.4),
              transparent 40%,
              hsl(${c3} / 0.3),
              transparent 70%,
              hsl(${c2} / 0.4)
            )`,
          }}
        />
      </motion.div>

      {/* Primary glare highlight */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: size * 0.38,
          height: size * 0.22,
          top: '16%',
          left: '20%',
          background: 'radial-gradient(ellipse, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0.2) 50%, transparent 70%)',
          filter: 'blur(1.5px)',
          transform: 'rotate(-35deg)',
        }}
      />
      {/* Secondary micro-glare */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: size * 0.12,
          height: size * 0.12,
          bottom: '22%',
          right: '20%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.45) 0%, transparent 70%)',
        }}
      />
      {/* Third accent glare */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: size * 0.07,
          height: size * 0.07,
          top: '30%',
          right: '25%',
          background: `radial-gradient(circle, hsl(${c2} / 0.7) 0%, transparent 70%)`,
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center select-none" style={{ padding: size * 0.1 }}>
        {isMain ? (
          <>
            <motion.span
              style={{ fontSize: size * 0.22 }}
              animate={!isPopping ? { scale: [1, 1.18, 1] } : {}}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              {emoji}
            </motion.span>
            <span
              className="font-bold leading-tight block mt-0.5"
              style={{
                fontSize: size * 0.085,
                color: `hsl(${c1})`,
                textShadow: `0 0 10px hsl(${c1} / 0.7)`,
                maxWidth: size * 0.75,
              }}
            >
              {label}
            </span>
            {sublabel && (
              <span
                className="block mt-0.5 leading-tight"
                style={{
                  fontSize: size * 0.065,
                  color: `hsl(${c2} / 0.75)`,
                  maxWidth: size * 0.75,
                }}
              >
                {sublabel}
              </span>
            )}
          </>
        ) : (
          <>
            <span style={{ fontSize: size * 0.28 }}>{emoji}</span>
            <span
              className="font-bold tabular-nums block"
              style={{
                fontSize: size * 0.14,
                color: `hsl(${c1})`,
                textShadow: `0 0 8px hsl(${c1} / 0.7)`,
              }}
            >
              {label}
            </span>
          </>
        )}
      </div>
    </motion.div>
  );
});

// ============= AMBIENT MICRO-BUBBLES =============

const AmbientBubbles = memo(function AmbientBubbles({ active }: { active: boolean }) {
  const bubbles = useMemo(() =>
    Array.from({ length: 18 }, (_, i) => ({
      id: i,
      x: 5 + (i * 5.5) % 90,
      size: 5 + Math.random() * 14,
      delay: Math.random() * 5,
      duration: 6 + Math.random() * 9,
      hue: 200 + Math.floor(Math.random() * 130),
    })),
  []);

  if (!active) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {bubbles.map(b => (
        <motion.div
          key={b.id}
          className="absolute rounded-full"
          style={{
            width: b.size,
            height: b.size,
            left: `${b.x}%`,
            bottom: -b.size,
            background: `radial-gradient(circle at 35% 35%, hsl(${b.hue} 80% 70% / 0.4) 0%, transparent 70%)`,
            border: `1px solid hsl(${b.hue} 80% 70% / 0.2)`,
          }}
          animate={{
            y: [0, -(260 + Math.random() * 80)],
            opacity: [0, 0.7, 0.5, 0],
            scale: [0.5, 1, 0.85, 0.6],
            x: [0, (Math.random() - 0.5) * 30],
          }}
          transition={{
            duration: b.duration,
            delay: b.delay,
            repeat: Infinity,
            ease: 'easeOut',
          }}
        />
      ))}
    </div>
  );
});

// ============= COMPLETED STAGES TRAIL =============

const CompletedTrail = memo(function CompletedTrail({ stages }: { stages: StageStatus[] }) {
  const completed = stages.filter(s => s.status === 'complete');
  if (completed.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {completed.map((stage, i) => {
        const meta = STAGE_META[stage.shortName];
        const [c1] = meta?.colors ?? ['263 70% 65%', '195 90% 55%', '300 70% 65%'];
        return (
          <motion.div
            key={stage.shortName}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: i * 0.05, type: 'spring', stiffness: 400, damping: 25 }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{
              background: `hsl(${c1} / 0.08)`,
              border: `1px solid hsl(${c1} / 0.25)`,
            }}
          >
            <span className="text-xs">{meta?.emoji ?? '✦'}</span>
            <span className="text-[10px] font-semibold" style={{ color: `hsl(${c1} / 0.85)` }}>
              {stage.shortName}
            </span>
            <CheckCircle2 className="w-3 h-3" style={{ color: 'hsl(160 84% 45%)' }} />
          </motion.div>
        );
      })}
    </div>
  );
});

// ============= CLIP PROGRESS BARS =============

const ClipProgressBars = memo(function ClipProgressBars({
  clips, completedClips, totalClips,
}: { clips: ClipData[]; completedClips: number; totalClips: number }) {
  if (totalClips === 0) return null;
  const displayCount = Math.min(totalClips, 12);

  return (
    <div className="flex items-end gap-1.5">
      {Array.from({ length: displayCount }).map((_, i) => {
        const clip = clips[i];
        const isDone = clip?.status === 'completed' || i < completedClips;
        const isActive = clip?.status === 'generating';
        const isFailed = clip?.status === 'failed';
        return (
          <motion.div
            key={i}
            className="rounded-sm transition-all duration-500"
            style={{
              width: 7,
              height: isDone ? 22 : isActive ? 16 : 10,
              background: isFailed
                ? 'hsl(0 84% 60%)'
                : isDone
                  ? 'hsl(160 84% 45%)'
                  : isActive
                    ? 'hsl(263 70% 65%)'
                    : 'hsl(263 70% 65% / 0.18)',
              boxShadow: isDone
                ? '0 0 8px hsl(160 84% 45% / 0.5)'
                : isActive
                  ? '0 0 8px hsl(263 70% 65% / 0.5)'
                  : 'none',
            }}
            animate={isActive ? { scaleY: [1, 1.3, 1] } : {}}
            transition={{ duration: 0.8, repeat: Infinity }}
          />
        );
      })}
      <span className="text-[10px] ml-1 font-medium" style={{ color: 'hsl(240 5% 45%)' }}>
        {completedClips}/{totalClips}
      </span>
    </div>
  );
});

// ============= MAIN COMPONENT =============

export function CinematicPipelineProgress({
  stages, progress, isComplete, isError, isRunning,
  elapsedTime, projectTitle, lastError,
  onResume, onCancel, isResuming, isCancelling, className,
  clips = [], completedClips = 0, totalClips = 0, onPlayClip,
}: CinematicPipelineProgressProps) {
  const activeStage = stages.find(s => s.status === 'active');
  const activeMeta = activeStage ? STAGE_META[activeStage.shortName] : null;

  // Bubble state
  const [mainBubbleId, setMainBubbleId] = useState<string>(generateId());
  const [poppingId, setPoppingId] = useState<string | null>(null);
  const [activityTextIndex, setActivityTextIndex] = useState(0);
  const prevStageRef = useRef('');
  const timerRef = useRef<NodeJS.Timeout[]>([]);

  // Activity text rotation
  useEffect(() => {
    if (!activeMeta) return;
    const texts = activeMeta.activityTexts;
    const interval = setInterval(() => {
      setActivityTextIndex(i => (i + 1) % texts.length);
    }, 2800);
    return () => clearInterval(interval);
  }, [activeMeta]);

  // Bubble pop + respawn on stage change
  useEffect(() => {
    if (!activeStage || activeStage.shortName === prevStageRef.current) return;
    prevStageRef.current = activeStage.shortName;
    setActivityTextIndex(0);

    // Pop current bubble
    const currentId = mainBubbleId;
    setPoppingId(currentId);

    const t1 = setTimeout(() => {
      setPoppingId(null);
      setMainBubbleId(generateId());
    }, 550);

    timerRef.current.push(t1);
    return () => timerRef.current.forEach(t => clearTimeout(t));
  }, [activeStage?.shortName]);

  const colors = activeMeta?.colors ?? ['263 70% 65%', '195 90% 55%', '300 70% 65%'];
  const [c1, c2] = colors;
  const activityText = activeMeta?.activityTexts[activityTextIndex] ?? '';

  return (
    <div
      className={cn('relative rounded-3xl overflow-hidden border', className)}
      style={{
        background: 'hsl(250 15% 4% / 0.92)',
        borderColor: activeMeta
          ? `hsl(${c1} / 0.18)`
          : isComplete
            ? 'hsl(160 84% 45% / 0.2)'
            : 'hsl(263 70% 58% / 0.12)',
        backdropFilter: 'blur(40px)',
        boxShadow: activeMeta
          ? `0 0 80px hsl(${c1} / 0.06), 0 4px 40px hsl(0 0% 0% / 0.5)`
          : '0 4px 40px hsl(0 0% 0% / 0.5)',
      }}
    >
      {/* Top edge light */}
      <div
        className="absolute top-0 inset-x-0 h-px pointer-events-none"
        style={{
          background: `linear-gradient(90deg, transparent, hsl(${c1} / 0.35), hsl(${c2} / 0.2), transparent)`,
        }}
      />

      {/* Ambient glow from active stage color */}
      {isRunning && activeMeta && (
        <motion.div
          className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none"
          style={{
            width: 800,
            height: 300,
            marginTop: -150,
            background: `radial-gradient(ellipse, hsl(${c1} / 0.09) 0%, transparent 70%)`,
            filter: 'blur(40px)',
          }}
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* Complete state glow */}
      {isComplete && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at 50% 0%, hsl(160 84% 45% / 0.08) 0%, transparent 60%)',
          }}
        />
      )}

      {/* Ambient floating micro-bubbles */}
      <AmbientBubbles active={!!(isRunning && !isComplete && !isError)} />

      {/* Subtle grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: `linear-gradient(hsl(263 70% 65%) 1px, transparent 1px), linear-gradient(90deg, hsl(263 70% 65%) 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative p-6 md:p-8">
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-4 min-w-0">
            {/* Icon orb */}
            <div className="relative shrink-0">
              {/* Pulse ring around orb */}
              {isRunning && !isComplete && !isError && (
                <motion.div
                  className="absolute -inset-2 rounded-full"
                  style={{ border: `1px solid hsl(${c1} / 0.3)` }}
                  animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
                />
              )}
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center relative overflow-hidden"
                style={{
                  background: isComplete
                    ? 'linear-gradient(135deg, hsl(160 84% 45% / 0.2), hsl(185 90% 50% / 0.1))'
                    : isError
                      ? 'hsl(0 84% 60% / 0.15)'
                      : activeMeta
                        ? `linear-gradient(135deg, hsl(${c1} / 0.2), hsl(${c2} / 0.1))`
                        : 'hsl(263 70% 58% / 0.08)',
                  border: `1px solid hsl(${isComplete ? '160 84% 45%' : isError ? '0 84% 60%' : c1} / 0.25)`,
                  boxShadow: activeMeta ? `0 0 20px hsl(${c1} / 0.15)` : 'none',
                }}
              >
                {isComplete ? (
                  <Sparkles className="w-5 h-5 text-emerald-400" />
                ) : isError ? (
                  <XCircle className="w-5 h-5 text-rose-400" />
                ) : isRunning ? (
                  <motion.span
                    style={{ fontSize: 20 }}
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    {activeMeta?.emoji ?? '⚡'}
                  </motion.span>
                ) : (
                  <Clapperboard className="w-5 h-5" style={{ color: 'hsl(263 70% 65% / 0.4)' }} />
                )}
                <div className="absolute top-0 inset-x-0 h-1/2 bg-gradient-to-b from-white/[0.06] to-transparent rounded-t-2xl" />
              </div>
            </div>

            <div className="min-w-0">
              <h2 className="text-base font-bold tracking-tight leading-tight" style={{ color: 'hsl(240 5% 92%)' }}>
                {projectTitle || 'Production Pipeline'}
              </h2>
              <AnimatePresence mode="wait">
                <motion.p
                  key={activityText}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.3 }}
                  className="text-[11px] mt-0.5 truncate"
                  style={{ color: 'hsl(240 5% 50%)' }}
                >
                  {isComplete
                    ? '✦ Your cinematic masterpiece is ready'
                    : isError
                      ? (lastError?.slice(0, 80) || 'Production failed')
                      : activityText || (activeMeta ? activeMeta.label : 'Initializing...')}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>

          {/* Action buttons + Live badge */}
          <div className="flex items-center gap-2 shrink-0">
            {onCancel && isRunning && !isComplete && (
              <button
                onClick={onCancel}
                disabled={isCancelling}
                className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all disabled:opacity-40"
                style={{
                  background: 'hsl(0 84% 60% / 0.08)',
                  border: '1px solid hsl(0 84% 60% / 0.2)',
                  color: 'hsl(0 84% 60%)',
                }}
              >
                {isCancelling ? 'Cancelling...' : 'Cancel'}
              </button>
            )}
            {onResume && isError && (
              <button
                onClick={onResume}
                disabled={isResuming}
                className="px-4 py-1.5 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-50"
                style={{
                  background: 'linear-gradient(135deg, hsl(263 70% 55%), hsl(280 60% 60%))',
                  boxShadow: '0 4px 20px hsl(263 70% 55% / 0.3)',
                }}
              >
                {isResuming ? 'Resuming...' : 'Resume'}
              </button>
            )}
            {isRunning && !isComplete && !isError && (
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                style={{ background: 'hsl(160 84% 45% / 0.06)', border: '1px solid hsl(160 84% 45% / 0.15)' }}
              >
                <motion.div
                  className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                />
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-400/80">Live</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Progress bar ── */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-medium" style={{ color: 'hsl(240 5% 40%)' }}>
              {Math.round(progress)}% complete
            </span>
            <span className="text-[10px] tabular-nums font-medium" style={{ color: 'hsl(240 5% 40%)' }}>
              {formatTime(elapsedTime)}
            </span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'hsl(250 15% 10%)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{
                background: isComplete
                  ? 'linear-gradient(90deg, hsl(160 84% 45%), hsl(185 90% 50%))'
                  : isError
                    ? 'hsl(0 84% 60%)'
                    : activeMeta
                      ? `linear-gradient(90deg, hsl(${c1}), hsl(${c2}))`
                      : 'linear-gradient(90deg, hsl(263 70% 58%), hsl(195 90% 50%))',
                boxShadow: activeMeta ? `0 0 12px hsl(${c1} / 0.5)` : 'none',
              }}
              initial={{ width: 0 }}
              animate={{ width: `${isComplete ? 100 : progress}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
          {/* Shimmer sweep */}
          {isRunning && !isComplete && (
            <div className="relative -mt-1.5 h-1.5 overflow-hidden rounded-full pointer-events-none">
              <motion.div
                className="absolute inset-0"
                style={{ background: 'linear-gradient(90deg, transparent, hsl(0 0% 100% / 0.25), transparent)' }}
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'linear', repeatDelay: 1 }}
              />
            </div>
          )}
        </div>

        {/* ── Holographic Bubble Stage Visualization ── */}
        {isRunning && !isComplete && !isError && activeMeta && (
          <div
            className="relative rounded-2xl overflow-hidden mb-6"
            style={{
              height: 200,
              background: `linear-gradient(to top, hsl(250 15% 3% / 0.9), hsl(250 15% 6% / 0.6))`,
              border: `1px solid hsl(${c1} / 0.1)`,
            }}
          >
            {/* Inner ambient glow at bottom */}
            <div
              className="absolute bottom-0 left-1/2 -translate-x-1/2 pointer-events-none"
              style={{
                width: '80%',
                height: 100,
                background: `radial-gradient(ellipse, hsl(${c1} / 0.15) 0%, transparent 70%)`,
                filter: 'blur(20px)',
              }}
            />

            {/* Main stage bubble */}
            <AnimatePresence>
              <Bubble
                key={mainBubbleId}
                id={mainBubbleId}
                size={130}
                colors={colors}
                emoji={activeMeta.emoji}
                label={activeMeta.label}
                sublabel={activeMeta.sublabel}
                isMain
                isPopping={poppingId === mainBubbleId}
                x={0}
                y={30}
              />
            </AnimatePresence>

            {/* Satellite bubble: progress % */}
            <Bubble
              id="progress-sat"
              size={72}
              colors={['195 90% 55%', '220 80% 60%', '170 80% 50%']}
              emoji="📊"
              label={`${Math.round(progress)}%`}
              x={-130}
              y={55}
              delay={0.2}
            />

            {/* Satellite bubble: time */}
            <Bubble
              id="time-sat"
              size={66}
              colors={['48 100% 60%', '35 100% 55%', '55 90% 60%']}
              emoji="⏱"
              label={formatTime(elapsedTime)}
              x={130}
              y={60}
              delay={0.35}
            />

            {/* Clip count bubble if in render stage */}
            {totalClips > 0 && (
              <Bubble
                id="clip-sat"
                size={60}
                colors={['263 70% 65%', '280 60% 70%', '240 80% 65%']}
                emoji="🎬"
                label={`${completedClips}/${totalClips}`}
                x={0}
                y={150}
                delay={0.5}
              />
            )}
          </div>
        )}

        {/* ── Completed stages trail ── */}
        {stages.some(s => s.status === 'complete') && (
          <div className="mb-4">
            <p className="text-[9px] uppercase tracking-widest font-bold mb-2" style={{ color: 'hsl(240 5% 35%)' }}>
              Completed stages
            </p>
            <CompletedTrail stages={stages} />
          </div>
        )}

        {/* ── Clip progress bars (render stage) ── */}
        {totalClips > 0 && isRunning && !isComplete && (
          <div className="mt-4">
            <p className="text-[9px] uppercase tracking-widest font-bold mb-2" style={{ color: 'hsl(240 5% 35%)' }}>
              Clips rendering
            </p>
            <ClipProgressBars clips={clips} completedClips={completedClips} totalClips={totalClips} />
          </div>
        )}

        {/* ── Completed state ── */}
        {isComplete && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: 'backOut' }}
            className="flex flex-col items-center justify-center py-8 text-center"
          >
            <motion.div
              className="text-5xl mb-4"
              animate={{ scale: [1, 1.15, 1], rotate: [0, 5, -5, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              🎉
            </motion.div>
            <h3 className="text-xl font-bold mb-1" style={{ color: 'hsl(160 84% 55%)' }}>
              Your video is ready!
            </h3>
            <p className="text-sm" style={{ color: 'hsl(240 5% 50%)' }}>
              Cinematic masterpiece complete ✦
            </p>
          </motion.div>
        )}

        {/* ── Error state ── */}
        {isError && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-4 rounded-xl"
            style={{ background: 'hsl(0 84% 60% / 0.08)', border: '1px solid hsl(0 84% 60% / 0.2)' }}
          >
            <p className="text-sm font-medium mb-1" style={{ color: 'hsl(0 84% 65%)' }}>Production failed</p>
            {lastError && (
              <p className="text-xs" style={{ color: 'hsl(0 84% 60% / 0.7)' }}>{lastError.slice(0, 160)}</p>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default CinematicPipelineProgress;
