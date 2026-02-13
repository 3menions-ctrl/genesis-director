import React, { useMemo, useEffect, useState, useRef, memo } from 'react';
import { cn } from '@/lib/utils';
import {
  FileText,
  Users,
  Shield,
  Wand2,
  Film,
  Sparkles,
  CheckCircle2,
  Loader2,
  XCircle,
  Clapperboard,
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
  accent: string;
  label: string;
}> = {
  'Script': { icon: FileText, accent: 'text-violet-400', label: 'Crafting narrative' },
  'Identity': { icon: Users, accent: 'text-cyan-400', label: 'Locking characters' },
  'Audit': { icon: Shield, accent: 'text-emerald-400', label: 'Quality check' },
  'Assets': { icon: Wand2, accent: 'text-amber-400', label: 'Generating assets' },
  'Render': { icon: Film, accent: 'text-rose-400', label: 'Rendering video' },
  'Stitch': { icon: Sparkles, accent: 'text-indigo-400', label: 'Final assembly' },
};

// ============= SUB-COMPONENTS =============

// Rotating activity text for active stage
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
    <span className="text-[11px] text-white/40 font-mono transition-opacity duration-300">
      {list[index]}
    </span>
  );
});

function StageNode({ stage }: { stage: StageStatus }) {
  const meta = STAGE_META[stage.shortName] || STAGE_META['Script'];
  const Icon = meta.icon;
  const isActive = stage.status === 'active';
  const isComplete = stage.status === 'complete';
  const isError = stage.status === 'error';
  const isPending = stage.status === 'pending';

  return (
    <div className="flex flex-col items-center gap-2.5 min-w-0">
      {/* Node circle */}
      <div className={cn(
        "relative w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500",
        isPending && "bg-white/[0.04] border border-white/[0.06] text-white/20",
        isActive && "bg-white/[0.08] border border-white/20 text-white shadow-[0_0_20px_-5px_rgba(255,255,255,0.1)]",
        isComplete && "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400",
        isError && "bg-rose-500/10 border border-rose-500/20 text-rose-400",
      )}>
        {/* Subtle pulse ring for active */}
        {isActive && (
          <div className="absolute -inset-1 rounded-xl border border-white/10 animate-[pulse_3s_ease-in-out_infinite]" />
        )}

        {isActive ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : isComplete ? (
          <CheckCircle2 className="w-5 h-5" />
        ) : isError ? (
          <XCircle className="w-5 h-5" />
        ) : (
          <Icon className="w-4.5 h-4.5" />
        )}
      </div>

      {/* Label */}
      <div className="text-center">
        <p className={cn(
          "text-[11px] font-semibold tracking-wide uppercase transition-colors duration-300",
          isPending && "text-white/25",
          isActive && "text-white",
          isComplete && "text-emerald-400/80",
          isError && "text-rose-400/80",
        )}>
          {stage.shortName}
        </p>
        {isActive && (
          <div className="mt-0.5 h-3.5">
            <ActivityText stage={stage.shortName} />
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
  stages,
  progress,
  isComplete,
  isError,
  isRunning,
  elapsedTime,
  projectTitle,
  lastError,
  onResume,
  onCancel,
  isResuming,
  isCancelling,
  className,
}: CinematicPipelineProgressProps) {
  const activeStage = stages.find(s => s.status === 'active');
  const activeMeta = activeStage ? STAGE_META[activeStage.shortName] : null;

  // Compute progress line percentage from stages
  const completedCount = stages.filter(s => s.status === 'complete').length;
  const activeIndex = stages.findIndex(s => s.status === 'active');
  const lineProgress = activeIndex >= 0
    ? ((completedCount + 0.5) / stages.length) * 100
    : (completedCount / stages.length) * 100;

  return (
    <div className={cn(
      "relative rounded-2xl overflow-hidden",
      "bg-white/[0.02] border border-white/[0.06]",
      "backdrop-blur-xl",
      className
    )}>
      {/* Subtle ambient glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {isComplete && (
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/[0.06] blur-[100px] rounded-full translate-x-1/3 -translate-y-1/3" />
        )}
        {isRunning && !isComplete && !isError && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-64 bg-white/[0.02] blur-[80px] rounded-full -translate-y-1/2" />
        )}
        {isError && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-64 bg-rose-500/[0.04] blur-[80px] rounded-full -translate-y-1/2" />
        )}
      </div>

      <div className="relative p-6 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3.5">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500",
              "bg-white/[0.05] border border-white/[0.08]",
              isComplete && "border-emerald-500/20",
              isError && "border-rose-500/20",
            )}>
              {isComplete ? (
                <Sparkles className="w-5 h-5 text-emerald-400" />
              ) : isError ? (
                <XCircle className="w-5 h-5 text-rose-400" />
              ) : (
                <Clapperboard className="w-4.5 h-4.5 text-white/40" />
              )}
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight">
                {projectTitle || 'Production Pipeline'}
              </h2>
              <p className="text-xs text-white/35 mt-0.5">
                {isComplete
                  ? 'Your video is ready'
                  : isError
                    ? (lastError ? lastError.slice(0, 80) : 'Production failed')
                    : activeMeta
                      ? activeMeta.label
                      : 'Initializing...'}
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
                  "px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all",
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
                  "px-4 py-1.5 rounded-lg text-xs font-semibold transition-all",
                  "bg-white/10 border border-white/15 text-white",
                  "hover:bg-white/15",
                  isResuming && "opacity-50 cursor-not-allowed"
                )}
              >
                {isResuming ? 'Resuming...' : 'Resume'}
              </button>
            )}

            {/* Live indicator */}
            {isRunning && !isComplete && !isError && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04]">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-[pulse_2s_ease-in-out_infinite]" />
                <span className="text-[10px] font-medium text-white/40 uppercase tracking-wider">Live</span>
              </div>
            )}

            {/* Timer + Progress */}
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-2xl font-mono font-bold text-white/90 tracking-tighter tabular-nums">
                  {formatTime(elapsedTime)}
                </p>
              </div>

              {/* Minimal progress ring */}
              <div className="relative w-16 h-16">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="3" />
                  <circle
                    cx="32" cy="32" r="28" fill="none"
                    stroke={isError ? '#f43f5e' : isComplete ? '#10b981' : 'rgba(255,255,255,0.5)'}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 28}
                    strokeDashoffset={2 * Math.PI * 28 * (1 - progress / 100)}
                    className="transition-all duration-700 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={cn(
                    "text-sm font-bold tabular-nums",
                    isError ? "text-rose-400" : isComplete ? "text-emerald-400" : "text-white/80"
                  )}>
                    {Math.round(progress)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Hairline progress bar */}
        <div className="h-px bg-white/[0.06] mb-8 relative overflow-hidden rounded-full">
          <div
            className={cn(
              "absolute inset-y-0 left-0 transition-all duration-700 ease-out",
              isError ? "bg-rose-500/60" : isComplete ? "bg-emerald-500/60" : "bg-white/30"
            )}
            style={{ width: `${Math.min(lineProgress, 100)}%` }}
          />
        </div>

        {/* Desktop: Horizontal stage nodes */}
        <div className="hidden md:block">
          <div className="grid grid-cols-6 gap-2">
            {stages.map((stage, index) => (
              <div key={stage.name} className="relative">
                {/* Connection line */}
                {index > 0 && (
                  <div className="absolute right-full top-6 w-full h-px -mr-1 z-0">
                    <div className={cn(
                      "h-full transition-all duration-500",
                      stages[index - 1].status === 'complete' ? "bg-emerald-500/25" : "bg-white/[0.04]"
                    )} />
                  </div>
                )}
                <StageNode stage={stage} />
              </div>
            ))}
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
                  "flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-300",
                  isActive && "bg-white/[0.04] border border-white/[0.08]",
                  isPend && "opacity-30",
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center",
                  isPend && "bg-white/[0.03] text-white/20",
                  isActive && "bg-white/[0.06] text-white",
                  isComp && "bg-emerald-500/10 text-emerald-400",
                  isErr && "bg-rose-500/10 text-rose-400",
                )}>
                  {isActive ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
                   isComp ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                   isErr ? <XCircle className="w-3.5 h-3.5" /> :
                   <Icon className="w-3.5 h-3.5" />}
                </div>
                <span className={cn(
                  "text-xs font-medium",
                  isPend && "text-white/30",
                  isActive && "text-white",
                  isComp && "text-emerald-400/70",
                  isErr && "text-rose-400/70",
                )}>
                  {stage.shortName}
                </span>
                {isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white/40 animate-[pulse_2s_ease-in-out_infinite]" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default CinematicPipelineProgress;
