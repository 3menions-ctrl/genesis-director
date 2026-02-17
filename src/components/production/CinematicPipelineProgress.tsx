import React, { useMemo, useEffect, useState, useRef, memo } from 'react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Users, Shield, Wand2, Film, Sparkles,
  CheckCircle2, Loader2, XCircle, Clapperboard,
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
  gradient: string;
  glowColor: string;
  label: string;
}> = {
  'Script': { icon: FileText, gradient: 'from-violet-500 to-purple-600', glowColor: 'rgba(139,92,246,0.3)', label: 'Crafting narrative' },
  'Identity': { icon: Users, gradient: 'from-cyan-500 to-blue-600', glowColor: 'rgba(6,182,212,0.3)', label: 'Locking characters' },
  'Audit': { icon: Shield, gradient: 'from-emerald-500 to-teal-600', glowColor: 'rgba(16,185,129,0.3)', label: 'Quality check' },
  'Assets': { icon: Wand2, gradient: 'from-amber-500 to-orange-600', glowColor: 'rgba(245,158,11,0.3)', label: 'Generating assets' },
  'Render': { icon: Film, gradient: 'from-rose-500 to-pink-600', glowColor: 'rgba(244,63,94,0.3)', label: 'Rendering video' },
  'Stitch': { icon: Sparkles, gradient: 'from-indigo-500 to-violet-600', glowColor: 'rgba(99,102,241,0.3)', label: 'Final assembly' },
};

// ============= SUB-COMPONENTS =============

const ActivityText = memo(function ActivityText({ stage }: { stage: string }) {
  const activities: Record<string, string[]> = {
    'Script': ['Analyzing structure...', 'Breaking into shots...', 'Adding camera cues...'],
    'Identity': ['Extracting features...', 'Mapping proportions...', 'Creating anchors...'],
    'Audit': ['Validating continuity...', 'Scoring coherence...', 'Checking lighting...'],
    'Assets': ['Creating images...', 'Generating music...', 'Synthesizing voice...'],
    'Render': ['Processing frames...', 'Applying style...', 'Generating video...'],
    'Stitch': ['Analyzing transitions...', 'Building manifest...', 'Finalizing...'],
  };

  const [index, setIndex] = useState(0);
  const list = activities[stage] || ['Processing...'];

  useEffect(() => {
    const interval = setInterval(() => setIndex(i => (i + 1) % list.length), 2800);
    return () => clearInterval(interval);
  }, [list.length]);

  return (
    <motion.span 
      key={index}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="text-[10px] text-white/50 font-mono block"
    >
      {list[index]}
    </motion.span>
  );
});

function StageNode({ stage, index, totalStages }: { stage: StageStatus; index: number; totalStages: number }) {
  const meta = STAGE_META[stage.shortName] || STAGE_META['Script'];
  const Icon = meta.icon;
  const isActive = stage.status === 'active';
  const isComplete = stage.status === 'complete';
  const isError = stage.status === 'error';
  const isPending = stage.status === 'pending';

  return (
    <div className="flex flex-col items-center gap-3 min-w-0">
      {/* Node */}
      <div className="relative">
        {/* Glow ring for active */}
        {isActive && (
          <div 
            className="absolute -inset-2 rounded-2xl opacity-60 blur-md animate-[pulse_3s_ease-in-out_infinite]"
            style={{ background: meta.glowColor }}
          />
        )}
        {/* Complete glow */}
        {isComplete && (
          <div className="absolute -inset-1.5 rounded-xl bg-emerald-500/10 blur-sm" />
        )}
        
        <div className={cn(
          "relative w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-500 border",
          isPending && "bg-white/[0.03] border-white/[0.06] text-white/15",
          isActive && `bg-gradient-to-br ${meta.gradient} border-white/20 text-white shadow-2xl`,
          isComplete && "bg-emerald-500/15 border-emerald-500/30 text-emerald-400",
          isError && "bg-rose-500/15 border-rose-500/30 text-rose-400",
        )}>
          {isActive ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : isComplete ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : isError ? (
            <XCircle className="w-5 h-5" />
          ) : (
            <Icon className="w-5 h-5" />
          )}
        </div>
      </div>

      {/* Label */}
      <div className="text-center min-h-[32px]">
        <p className={cn(
          "text-[11px] font-semibold tracking-wide uppercase transition-colors duration-300",
          isPending && "text-white/20",
          isActive && "text-white",
          isComplete && "text-emerald-400/80",
          isError && "text-rose-400/80",
        )}>
          {stage.shortName}
        </p>
        {isActive && (
          <div className="mt-0.5 h-4 overflow-hidden">
            <AnimatePresence mode="wait">
              <ActivityText stage={stage.shortName} />
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
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

  return (
    <div className={cn(
      "relative rounded-2xl overflow-hidden",
      "bg-white/[0.03] border border-white/[0.08]",
      "backdrop-blur-2xl shadow-2xl shadow-black/20",
      className
    )}>
      {/* Animated gradient border shimmer */}
      <div className="absolute inset-0 rounded-2xl pointer-events-none overflow-hidden">
        <div 
          className="absolute -inset-[1px] rounded-2xl opacity-30"
          style={{
            background: isComplete
              ? 'linear-gradient(135deg, rgba(16,185,129,0.3), transparent 50%, rgba(16,185,129,0.15))'
              : isError
                ? 'linear-gradient(135deg, rgba(244,63,94,0.2), transparent 50%, rgba(244,63,94,0.1))'
                : 'linear-gradient(135deg, rgba(139,92,246,0.2), transparent 40%, rgba(99,102,241,0.15))',
          }}
        />
      </div>

      {/* Ambient light effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {isComplete && (
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/[0.06] blur-[120px] rounded-full translate-x-1/3 -translate-y-1/3" />
        )}
        {isRunning && !isComplete && !isError && activeMeta && (
          <div 
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-80 blur-[100px] rounded-full -translate-y-1/2 opacity-40"
            style={{ background: activeMeta.glowColor }}
          />
        )}
        {isError && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-80 bg-rose-500/[0.05] blur-[100px] rounded-full -translate-y-1/2" />
        )}
      </div>

      <div className="relative p-6 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500 border",
              isComplete
                ? "bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border-emerald-500/30"
                : isError
                  ? "bg-gradient-to-br from-rose-500/20 to-pink-500/20 border-rose-500/30"
                  : "bg-white/[0.05] border-white/[0.1]",
            )}>
              {isComplete ? (
                <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity }}>
                  <Sparkles className="w-5 h-5 text-emerald-400" />
                </motion.div>
              ) : isError ? (
                <XCircle className="w-5 h-5 text-rose-400" />
              ) : (
                <Clapperboard className="w-5 h-5 text-white/50" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                {projectTitle || 'Production Pipeline'}
              </h2>
              <p className="text-xs text-white/40 mt-0.5">
                {isComplete ? 'Your video is ready' : isError ? (lastError?.slice(0, 80) || 'Production failed') : activeMeta ? activeMeta.label : 'Initializing...'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Action buttons */}
            {onCancel && isRunning && !isComplete && (
              <button
                onClick={onCancel}
                disabled={isCancelling}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-medium transition-all",
                  "bg-white/[0.04] border border-white/[0.08] text-white/50",
                  "hover:bg-rose-500/10 hover:border-rose-500/20 hover:text-rose-400",
                  isCancelling && "opacity-50 cursor-not-allowed"
                )}
              >
                {isCancelling ? 'Cancelling...' : 'Cancel'}
              </button>
            )}

            {onResume && isError && (
              <button
                onClick={onResume}
                disabled={isResuming}
                className={cn(
                  "px-5 py-2 rounded-lg text-xs font-bold transition-all",
                  "bg-gradient-to-r from-violet-500 to-indigo-500 text-white",
                  "hover:from-violet-400 hover:to-indigo-400 shadow-lg shadow-violet-500/20",
                  isResuming && "opacity-50 cursor-not-allowed"
                )}
              >
                {isResuming ? 'Resuming...' : 'Resume'}
              </button>
            )}

            {/* Live indicator */}
            {isRunning && !isComplete && !isError && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08]">
                <div className="relative">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                </div>
                <span className="text-[10px] font-bold text-emerald-400/80 uppercase tracking-widest">Live</span>
              </div>
            )}

            {/* Timer + Ring */}
            <div className="flex items-center gap-5">
              <div className="text-right hidden sm:block">
                <p className="text-3xl font-mono font-black text-white/90 tracking-tighter tabular-nums">
                  {formatTime(elapsedTime)}
                </p>
              </div>

              {/* Premium progress ring */}
              <div className="relative w-18 h-18" style={{ width: 72, height: 72 }}>
                <svg className="w-full h-full -rotate-90" viewBox="0 0 72 72">
                  {/* Background track */}
                  <circle cx="36" cy="36" r="30" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="4" />
                  {/* Gradient progress */}
                  <defs>
                    <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      {isError ? (
                        <>
                          <stop offset="0%" stopColor="#f43f5e" />
                          <stop offset="100%" stopColor="#e11d48" />
                        </>
                      ) : isComplete ? (
                        <>
                          <stop offset="0%" stopColor="#10b981" />
                          <stop offset="100%" stopColor="#14b8a6" />
                        </>
                      ) : (
                        <>
                          <stop offset="0%" stopColor="#8b5cf6" />
                          <stop offset="100%" stopColor="#6366f1" />
                        </>
                      )}
                    </linearGradient>
                  </defs>
                  <circle
                    cx="36" cy="36" r="30" fill="none"
                    stroke="url(#progressGrad)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 30}
                    strokeDashoffset={2 * Math.PI * 30 * (1 - progress / 100)}
                    className="transition-all duration-700 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={cn(
                    "text-base font-black tabular-nums",
                    isError ? "text-rose-400" : isComplete ? "text-emerald-400" : "text-white"
                  )}>
                    {Math.round(progress)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Premium gradient progress bar */}
        <div className="h-1 bg-white/[0.04] mb-8 relative overflow-hidden rounded-full">
          <div
            className={cn(
              "absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out",
              isError ? "bg-gradient-to-r from-rose-500 to-pink-500" 
                : isComplete ? "bg-gradient-to-r from-emerald-500 to-teal-500" 
                : "bg-gradient-to-r from-violet-500 to-indigo-500"
            )}
            style={{ width: `${Math.min(lineProgress, 100)}%` }}
          />
          {/* Shimmer effect on active */}
          {isRunning && !isComplete && !isError && (
            <div 
              className="absolute inset-y-0 left-0 w-full"
              style={{ 
                width: `${Math.min(lineProgress, 100)}%`,
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)',
                animation: 'shimmer 2s ease-in-out infinite',
              }}
            />
          )}
        </div>

        {/* Desktop: Horizontal stage nodes with connecting lines */}
        <div className="hidden md:block">
          <div className="relative">
            {/* Connection line track */}
            <div className="absolute top-7 left-[8%] right-[8%] h-px bg-white/[0.06]" />
            <div 
              className="absolute top-7 left-[8%] h-px transition-all duration-700 ease-out"
              style={{ 
                width: `${Math.min(lineProgress * 0.84, 84)}%`,
                background: isComplete 
                  ? 'linear-gradient(90deg, rgba(16,185,129,0.5), rgba(20,184,166,0.3))' 
                  : 'linear-gradient(90deg, rgba(139,92,246,0.5), rgba(99,102,241,0.3))'
              }}
            />
            
            <div className="grid grid-cols-6 gap-2 relative">
              {stages.map((stage, index) => (
                <StageNode key={stage.name} stage={stage} index={index} totalStages={stages.length} />
              ))}
            </div>
          </div>
        </div>

        {/* Mobile: Compact vertical list */}
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
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300",
                  isActive && "bg-white/[0.05] border border-white/[0.1] shadow-lg",
                  isPend && "opacity-25",
                )}
              >
                <div className={cn(
                  "w-9 h-9 rounded-lg flex items-center justify-center border",
                  isPend && "bg-white/[0.03] border-white/[0.05] text-white/20",
                  isActive && `bg-gradient-to-br ${meta.gradient} border-white/20 text-white`,
                  isComp && "bg-emerald-500/15 border-emerald-500/25 text-emerald-400",
                  isErr && "bg-rose-500/15 border-rose-500/25 text-rose-400",
                )}>
                  {isActive ? <Loader2 className="w-4 h-4 animate-spin" /> :
                   isComp ? <CheckCircle2 className="w-4 h-4" /> :
                   isErr ? <XCircle className="w-4 h-4" /> :
                   <Icon className="w-4 h-4" />}
                </div>
                <span className={cn(
                  "text-xs font-semibold",
                  isPend && "text-white/30",
                  isActive && "text-white",
                  isComp && "text-emerald-400/70",
                  isErr && "text-rose-400/70",
                )}>
                  {stage.shortName}
                </span>
                {isActive && (
                  <div className="ml-auto flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* CSS for shimmer */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
}

export default CinematicPipelineProgress;
