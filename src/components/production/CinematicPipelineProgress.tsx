import React, { useMemo, useEffect, useState, memo } from 'react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Users, Shield, Wand2, Film, Sparkles,
  CheckCircle2, XCircle, Clapperboard, Zap,
} from 'lucide-react';

// ============= TYPES =============

interface StageStatus {
  name: string;
  shortName: string;
  status: 'pending' | 'active' | 'complete' | 'error' | 'skipped';
  details?: string;
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
}

// ============= STAGE METADATA =============

const STAGE_META: Record<string, {
  icon: React.ElementType;
  hue: number;
  label: string;
  activityTexts: string[];
}> = {
  'Script':   { icon: FileText, hue: 270, label: 'Crafting narrative',   activityTexts: ['Analyzing structure...', 'Breaking into shots...', 'Adding camera cues...'] },
  'Identity': { icon: Users,    hue: 190, label: 'Locking characters',   activityTexts: ['Extracting features...', 'Mapping proportions...', 'Creating anchors...'] },
  'Audit':    { icon: Shield,   hue: 160, label: 'Quality check',        activityTexts: ['Validating continuity...', 'Scoring coherence...', 'Checking lighting...'] },
  'Assets':   { icon: Wand2,    hue: 35,  label: 'Generating assets',    activityTexts: ['Creating images...', 'Generating music...', 'Synthesizing voice...'] },
  'Render':   { icon: Film,     hue: 350, label: 'Rendering video',      activityTexts: ['Processing frames...', 'Applying style...', 'Generating video...'] },
  'Stitch':   { icon: Sparkles, hue: 240, label: 'Final assembly',       activityTexts: ['Analyzing transitions...', 'Building manifest...', 'Finalizing...'] },
};

function hslStr(hue: number, s: number, l: number, a = 1) {
  return `hsla(${hue}, ${s}%, ${l}%, ${a})`;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ============= ACTIVITY TEXT (rotating sub-label) =============

const ActivityText = memo(function ActivityText({ texts }: { texts: string[] }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setIndex(i => (i + 1) % texts.length), 2800);
    return () => clearInterval(interval);
  }, [texts.length]);
  return (
    <motion.span
      key={index}
      initial={{ opacity: 0, y: 3 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -3 }}
      className="text-[9px] font-mono block truncate"
      style={{ color: 'hsl(var(--muted-foreground))' }}
    >
      {texts[index]}
    </motion.span>
  );
});

// ============= STAGE NODE =============

function StageNode({ stage }: { stage: StageStatus }) {
  const meta = STAGE_META[stage.shortName] || STAGE_META['Script'];
  const Icon = meta.icon;
  const isActive = stage.status === 'active';
  const isComplete = stage.status === 'complete';
  const isError = stage.status === 'error';
  const isPending = stage.status === 'pending';
  const hue = meta.hue;

  return (
    <div className="flex flex-col items-center gap-2.5 min-w-0">
      {/* Node container */}
      <div className="relative">
        {/* Breathing orbital glow for active */}
        {isActive && (
          <>
            <motion.div
              className="absolute -inset-5 rounded-2xl blur-2xl"
              style={{ background: hslStr(hue, 80, 60, 0.18) }}
              animate={{ opacity: [0.6, 1, 0.6], scale: [0.9, 1.05, 0.9] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute -inset-2.5 rounded-2xl border"
              style={{ borderColor: hslStr(hue, 80, 65, 0.35) }}
              animate={{ opacity: [0.4, 0.9, 0.4] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
          </>
        )}

        {/* Emerald halo for completed */}
        {isComplete && (
          <motion.div
            className="absolute -inset-1.5 rounded-xl"
            style={{ background: 'hsl(160 80% 50% / 0.1)' }}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: 'backOut' }}
          />
        )}

        {/* Main node */}
        <motion.div
          className={cn(
            "relative w-14 h-14 rounded-xl flex items-center justify-center border transition-colors duration-500 overflow-hidden",
            isPending && "border-white/[0.06]",
            isActive && "border-white/20 shadow-2xl",
            isComplete && "border-emerald-500/25",
            isError && "border-rose-500/25",
          )}
          style={{
            background: isPending
              ? 'hsl(0 0% 100% / 0.02)'
              : isComplete
                ? 'hsl(160 80% 50% / 0.1)'
                : isError
                  ? 'hsl(350 80% 60% / 0.1)'
                  : `linear-gradient(135deg, ${hslStr(hue, 80, 55, 0.2)}, ${hslStr(hue + 30, 70, 45, 0.12)})`,
            boxShadow: isActive ? `0 0 24px ${hslStr(hue, 80, 60, 0.25)}, 0 0 8px ${hslStr(hue, 80, 60, 0.15)}` : undefined,
          }}
          animate={isActive ? { scale: [1, 1.03, 1] } : {}}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          {/* Holographic shimmer on active */}
          {isActive && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `linear-gradient(105deg, transparent 40%, ${hslStr(hue, 80, 90, 0.12)} 50%, transparent 60%)`,
                animation: 'holo-shimmer 3s ease-in-out infinite',
              }}
            />
          )}
          {/* Glass top reflection */}
          <div className="absolute top-0 inset-x-0 h-1/3 bg-gradient-to-b from-white/[0.05] to-transparent rounded-t-xl pointer-events-none" />

          {isActive ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              className="relative z-10"
              style={{ color: hslStr(hue, 80, 75, 1) }}
            >
              <Icon className="w-5 h-5" />
            </motion.div>
          ) : isComplete ? (
            <motion.div
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              className="relative z-10 text-emerald-400"
            >
              <CheckCircle2 className="w-5 h-5" />
            </motion.div>
          ) : isError ? (
            <XCircle className="w-5 h-5 relative z-10 text-rose-400" />
          ) : (
            <Icon className="w-5 h-5 relative z-10 text-white/15" />
          )}

          {/* Active indicator bar at bottom */}
          {isActive && (
            <div className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full overflow-hidden">
              <motion.div
                className="h-full"
                style={{ background: `linear-gradient(90deg, ${hslStr(hue, 80, 65, 0)}, ${hslStr(hue, 80, 70, 1)}, ${hslStr(hue, 80, 65, 0)})` }}
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>
          )}
        </motion.div>
      </div>

      {/* Label */}
      <div className="text-center min-h-[34px] px-0.5">
        <p className={cn(
          "text-[10px] font-bold tracking-widest uppercase transition-colors duration-300",
          isPending && "text-white/15",
          isActive && "text-white",
          isComplete && "text-emerald-400/80",
          isError && "text-rose-400/80",
        )}>
          {stage.shortName}
        </p>
        {isActive && (
          <div className="mt-0.5 overflow-hidden">
            <AnimatePresence mode="wait">
              <ActivityText texts={meta.activityTexts} />
            </AnimatePresence>
          </div>
        )}
        {isComplete && (
          <span className="text-[9px] text-emerald-500/60 font-medium">Done</span>
        )}
      </div>
    </div>
  );
}

// ============= CONNECTING LINE =============

function ConnectorLine({ from, to }: { from: StageStatus; to: StageStatus }) {
  const fromComplete = from.status === 'complete';
  const toActive = to.status === 'active';
  const toComplete = to.status === 'complete';
  const lit = fromComplete && (toActive || toComplete);
  const fromMeta = STAGE_META[from.shortName] || STAGE_META['Script'];

  return (
    <div className="flex-1 flex items-center relative" style={{ marginTop: '-34px' }}>
      {/* Base rail */}
      <div className="w-full h-px bg-white/[0.04]" />
      {/* Lit progress */}
      {lit && (
        <motion.div
          className="absolute inset-y-0 left-0 w-full h-px"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          style={{
            background: toComplete
              ? 'linear-gradient(90deg, hsl(160 80% 50% / 0.5), hsl(160 80% 55% / 0.3))'
              : `linear-gradient(90deg, ${hslStr(fromMeta.hue, 80, 65, 0.5)}, ${hslStr(fromMeta.hue, 80, 65, 0.15)})`,
            transformOrigin: 'left',
          }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      )}
      {/* Energy pulse dot when actively flowing */}
      {lit && toActive && (
        <motion.div
          className="absolute top-0 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
          style={{
            background: hslStr(fromMeta.hue, 90, 75, 1),
            boxShadow: `0 0 6px ${hslStr(fromMeta.hue, 90, 70, 0.8)}`,
          }}
          animate={{ x: ['0%', '100%'] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
    </div>
  );
}

// ============= MAIN COMPONENT =============

export function CinematicPipelineProgress({
  stages, progress, isComplete, isError, isRunning,
  elapsedTime, projectTitle, lastError,
  onResume, onCancel, isResuming, isCancelling, className,
}: CinematicPipelineProgressProps) {
  const activeStage = stages.find(s => s.status === 'active');
  const activeMeta = activeStage ? STAGE_META[activeStage.shortName] : null;
  const completedCount = stages.filter(s => s.status === 'complete').length;
  const activeIndex = stages.findIndex(s => s.status === 'active');
  const lineProgress = activeIndex >= 0
    ? ((completedCount + 0.5) / stages.length) * 100
    : (completedCount / stages.length) * 100;

  // Status color hue
  const statusHue = isComplete ? 160 : isError ? 350 : (activeMeta?.hue ?? 270);

  return (
    <div className={cn(
      "relative rounded-3xl overflow-hidden",
      "border border-white/[0.06]",
      "shadow-2xl shadow-black/50",
      className
    )}
    style={{ background: 'hsl(0 0% 4% / 0.85)', backdropFilter: 'blur(40px)' }}
    >
      {/* Gradient border accent */}
      <div className="absolute inset-0 rounded-3xl pointer-events-none overflow-hidden">
        <div
          className="absolute -inset-[1px] rounded-3xl opacity-40"
          style={{
            background: isComplete
              ? 'linear-gradient(135deg, hsl(160 80% 50% / 0.5), transparent 45%, hsl(185 90% 50% / 0.2), transparent 70%)'
              : isError
                ? 'linear-gradient(135deg, hsl(350 80% 60% / 0.4), transparent 50%)'
                : activeMeta
                  ? `linear-gradient(135deg, ${hslStr(activeMeta.hue, 80, 60, 0.35)}, transparent 40%, ${hslStr(activeMeta.hue + 30, 70, 55, 0.15)}, transparent 70%)`
                  : 'linear-gradient(135deg, hsl(270 80% 60% / 0.25), transparent 45%)',
          }}
        />
        {/* Top edge light */}
        <div className="absolute top-0 inset-x-12 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent" />
      </div>

      {/* Ambient glow */}
      {isRunning && !isComplete && !isError && activeMeta && (
        <motion.div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-80 rounded-full -translate-y-2/3 pointer-events-none"
          style={{ background: hslStr(activeMeta.hue, 80, 60, 0.07), filter: 'blur(80px)' }}
          animate={{ opacity: [0.5, 0.9, 0.5] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      {isComplete && (
        <div className="absolute top-0 right-0 w-[500px] h-[400px] translate-x-1/4 -translate-y-1/3 pointer-events-none"
          style={{ background: 'hsl(160 80% 50% / 0.07)', filter: 'blur(100px)', borderRadius: '50%' }} />
      )}

      {/* Floating micro particles */}
      {isRunning && !isComplete && !isError && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute w-0.5 h-0.5 rounded-full"
              style={{
                left: `${15 + i * 13}%`,
                background: activeMeta ? hslStr(activeMeta.hue, 80, 75, 0.4) : 'hsl(0 0% 100% / 0.15)',
                animation: `float-up-particle ${5 + i * 0.8}s ease-in-out infinite`,
                animationDelay: `${i * 0.5}s`,
              }}
            />
          ))}
        </div>
      )}

      <div className="relative p-6 md:p-8">
        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            {/* Icon badge */}
            <motion.div
              className="w-13 h-13 rounded-2xl flex items-center justify-center border relative overflow-hidden"
              style={{
                width: 52, height: 52,
                background: isComplete
                  ? 'linear-gradient(135deg, hsl(160 80% 50% / 0.2), hsl(185 90% 50% / 0.1))'
                  : isError
                    ? 'hsl(350 80% 60% / 0.15)'
                    : 'hsl(0 0% 100% / 0.03)',
                borderColor: isComplete ? 'hsl(160 80% 50% / 0.3)' : isError ? 'hsl(350 80% 60% / 0.3)' : 'hsl(0 0% 100% / 0.07)',
              }}
              animate={isRunning && !isComplete && !isError ? { scale: [1, 1.04, 1] } : {}}
              transition={{ duration: 3, repeat: Infinity }}
            >
              {isComplete ? (
                <motion.div animate={{ rotate: [0, 8, -8, 0] }} transition={{ duration: 4, repeat: Infinity }}>
                  <Sparkles className="w-6 h-6 text-emerald-400" />
                </motion.div>
              ) : isError ? (
                <XCircle className="w-6 h-6 text-rose-400" />
              ) : isRunning ? (
                <Zap className="w-6 h-6 text-white/50" />
              ) : (
                <Clapperboard className="w-6 h-6 text-white/30" />
              )}
              <div className="absolute top-0 inset-x-0 h-1/2 bg-gradient-to-b from-white/[0.06] to-transparent rounded-t-2xl" />
            </motion.div>

            <div>
              <h2 className="text-lg font-bold text-white tracking-tight leading-tight">
                {projectTitle || 'Production Pipeline'}
              </h2>
              <p className="text-[11px] mt-0.5 max-w-xs truncate" style={{ color: 'hsl(var(--muted-foreground))' }}>
                {isComplete
                  ? '✦ Your cinematic masterpiece is ready'
                  : isError
                    ? (lastError?.slice(0, 80) || 'Production failed')
                    : activeMeta
                      ? activeMeta.label
                      : 'Initializing pipeline...'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Cancel button */}
            {onCancel && isRunning && !isComplete && (
              <button
                onClick={onCancel}
                disabled={isCancelling}
                className="px-4 py-2 rounded-xl text-xs font-medium transition-all bg-white/[0.03] border border-white/[0.06] text-white/40 hover:bg-rose-500/10 hover:border-rose-500/20 hover:text-rose-400 disabled:opacity-40"
              >
                {isCancelling ? 'Cancelling...' : 'Cancel'}
              </button>
            )}

            {/* Resume button */}
            {onResume && isError && (
              <button
                onClick={onResume}
                disabled={isResuming}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, hsl(270 80% 60%), hsl(240 80% 55%))', boxShadow: '0 4px 20px hsl(270 80% 60% / 0.3)' }}
              >
                {isResuming ? 'Resuming...' : 'Resume'}
              </button>
            )}

            {/* Live badge */}
            {isRunning && !isComplete && !isError && (
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/[0.03] border border-white/[0.06]">
                <div className="relative w-2 h-2">
                  <div className="absolute inset-0 rounded-full bg-emerald-400" />
                  <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping" />
                </div>
                <span className="text-[9px] font-black text-emerald-400/80 uppercase tracking-[0.25em]">Live</span>
              </div>
            )}

            {/* Timer + progress ring */}
            <div className="flex items-center gap-4">
              <p className="text-2xl font-mono font-black tabular-nums tracking-tighter hidden sm:block"
                style={{ color: 'hsl(0 0% 100% / 0.8)' }}>
                {formatTime(elapsedTime)}
              </p>

              {/* Holographic SVG ring */}
              <div className="relative" style={{ width: 70, height: 70 }}>
                <svg className="w-full h-full -rotate-90" viewBox="0 0 70 70">
                  <defs>
                    <linearGradient id="cpRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      {isComplete ? (
                        <>
                          <stop offset="0%" stopColor="hsl(160 80% 50%)" />
                          <stop offset="100%" stopColor="hsl(185 90% 55%)" />
                        </>
                      ) : isError ? (
                        <>
                          <stop offset="0%" stopColor="hsl(350 80% 60%)" />
                          <stop offset="100%" stopColor="hsl(340 75% 55%)" />
                        </>
                      ) : (
                        <>
                          <stop offset="0%" stopColor={hslStr(statusHue, 80, 65, 1)} />
                          <stop offset="100%" stopColor={hslStr(statusHue + 30, 75, 55, 1)} />
                        </>
                      )}
                    </linearGradient>
                    <filter id="cpRingGlow">
                      <feGaussianBlur stdDeviation="2" result="blur" />
                      <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                  </defs>
                  {/* Track */}
                  <circle cx="35" cy="35" r="29" fill="none" stroke="hsl(0 0% 100% / 0.04)" strokeWidth="3" />
                  {/* Progress arc */}
                  <circle
                    cx="35" cy="35" r="29" fill="none"
                    stroke="url(#cpRingGrad)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 29}
                    strokeDashoffset={2 * Math.PI * 29 * (1 - Math.min(progress, 100) / 100)}
                    className="transition-all duration-700 ease-out"
                    filter="url(#cpRingGlow)"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={cn("text-sm font-black tabular-nums",
                    isComplete ? "text-emerald-400" : isError ? "text-rose-400" : "text-white")}>
                    {Math.round(progress)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Progress bar ── */}
        <div className="relative h-1.5 rounded-full overflow-hidden mb-10" style={{ background: 'hsl(0 0% 100% / 0.03)' }}>
          {/* Glow blur underneath */}
          <div
            className="absolute -inset-y-2 left-0 rounded-full blur-md opacity-50 transition-all duration-700 ease-out"
            style={{
              width: `${Math.min(lineProgress, 100)}%`,
              background: isComplete ? 'hsl(160 80% 50%)' : isError ? 'hsl(350 80% 60%)' : hslStr(statusHue, 80, 60, 1),
            }}
          />
          <div
            className="relative h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${Math.min(lineProgress, 100)}%`,
              background: isComplete
                ? 'linear-gradient(90deg, hsl(160 80% 50%), hsl(185 90% 55%), hsl(195 90% 55%))'
                : isError
                  ? 'linear-gradient(90deg, hsl(350 80% 60%), hsl(340 75% 55%))'
                  : `linear-gradient(90deg, ${hslStr(statusHue, 80, 65, 1)}, ${hslStr(statusHue + 20, 75, 55, 1)})`,
            }}
          />
          {/* Shimmer sweep */}
          {isRunning && !isComplete && !isError && (
            <div
              className="absolute inset-y-0 left-0"
              style={{
                width: `${Math.min(lineProgress, 100)}%`,
                background: 'linear-gradient(90deg, transparent, hsl(0 0% 100% / 0.25), transparent)',
                animation: 'shimmer-sweep 2.5s ease-in-out infinite',
              }}
            />
          )}
        </div>

        {/* ── Desktop: Stage nodes with connectors ── */}
        <div className="hidden md:block">
          <div className="flex items-start">
            {stages.map((stage, index) => (
              <React.Fragment key={stage.name}>
                <StageNode stage={stage} />
                {index < stages.length - 1 && (
                  <ConnectorLine from={stage} to={stages[index + 1]} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* ── Mobile: Compact vertical list ── */}
        <div className="md:hidden space-y-1.5">
          {stages.map((stage) => {
            const meta = STAGE_META[stage.shortName] || STAGE_META['Script'];
            const Icon = meta.icon;
            const isActive = stage.status === 'active';
            const isComp = stage.status === 'complete';
            const isErr = stage.status === 'error';
            const isPend = stage.status === 'pending';
            return (
              <div
                key={stage.name}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 border",
                  isActive ? "border-white/[0.08] shadow-lg" : "border-transparent",
                  isPend && "opacity-25",
                )}
                style={isActive ? { background: `hsl(0 0% 100% / 0.03)` } : {}}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center border text-sm flex-shrink-0"
                  style={{
                    background: isPend ? 'hsl(0 0% 100% / 0.02)' : isComp ? 'hsl(160 80% 50% / 0.12)' : isErr ? 'hsl(350 80% 60% / 0.12)' : `hsl(${meta.hue} 80% 60% / 0.15)`,
                    borderColor: isPend ? 'hsl(0 0% 100% / 0.05)' : isComp ? 'hsl(160 80% 50% / 0.25)' : isErr ? 'hsl(350 80% 60% / 0.25)' : `hsl(${meta.hue} 80% 65% / 0.25)`,
                    color: isPend ? 'hsl(0 0% 100% / 0.15)' : isComp ? 'hsl(160 80% 60%)' : isErr ? 'hsl(350 80% 65%)' : `hsl(${meta.hue} 80% 70%)`,
                  }}
                >
                  {isActive ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}>
                      <Icon className="w-4 h-4" />
                    </motion.div>
                  ) : isComp ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : isErr ? (
                    <XCircle className="w-4 h-4" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className={cn(
                    "text-xs font-semibold block",
                    isPend ? "text-white/25" : isComp ? "text-emerald-400/80" : isErr ? "text-rose-400/80" : "text-white",
                  )}>
                    {stage.shortName}
                  </span>
                  {isActive && (
                    <span className="text-[9px] font-mono" style={{ color: `hsl(${meta.hue} 80% 65% / 0.7)` }}>
                      {meta.activityTexts[0]}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CSS keyframes */}
      <style>{`
        @keyframes holo-shimmer {
          0%, 100% { transform: translateX(-100%); }
          50% { transform: translateX(200%); }
        }
        @keyframes shimmer-sweep {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        @keyframes float-up-particle {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.3; }
          50% { transform: translateY(-100px) scale(1.8); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export default CinematicPipelineProgress;
