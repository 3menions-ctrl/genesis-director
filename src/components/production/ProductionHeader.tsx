import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  Film, Loader2, CheckCircle2, XCircle, Clock, X, RotateCcw, FolderOpen, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface StageStatus {
  name: string;
  shortName: string;
  icon: React.ElementType;
  status: 'pending' | 'active' | 'complete' | 'error' | 'skipped';
  details?: string;
}

interface ProductionHeaderProps {
  projectTitle: string;
  projectStatus: string;
  stages: StageStatus[];
  progress: number;
  elapsedTime: number;
  isRunning: boolean;
  isComplete: boolean;
  isError: boolean;
  isCancelling: boolean;
  isResuming: boolean;
  hasClips: boolean;
  onCancel: () => void;
  onResume: () => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function PremiumPipeline({ stages }: { stages: StageStatus[] }) {
  const completedCount = stages.filter(s => s.status === 'complete').length;
  const progressPercent = stages.length > 1 
    ? (completedCount / (stages.length - 1)) * 100 
    : 0;
  
  return (
    <div className="relative flex items-center">
      {/* Background track */}
      <div className="absolute inset-y-0 left-4 right-4 flex items-center">
        <div className="h-[3px] w-full rounded-full bg-white/[0.06] overflow-hidden">
          {/* Animated progress fill */}
          <motion.div
            className="h-full bg-gradient-to-r from-emerald-500 via-cyan-400 to-cyan-300"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(progressPercent, 100)}%` }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Shimmer effect */}
            <motion.div 
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear", repeatDelay: 1 }}
            />
          </motion.div>
        </div>
      </div>
      
      {/* Stage nodes */}
      {stages.map((stage, i) => {
        const isActive = stage.status === 'active';
        const isComplete = stage.status === 'complete';
        const isError = stage.status === 'error';
        const isPending = stage.status === 'pending';
        
        return (
          <div key={i} className="relative group flex items-center">
            {/* Spacer for track */}
            {i > 0 && <div className="w-6" />}
            
            {/* Stage Node */}
            <motion.div 
              initial={false}
              animate={{ scale: isActive ? 1.15 : 1 }}
              className="relative"
            >
              {/* Pulse ring for active */}
              {isActive && (
                <>
                  <motion.div
                    className="absolute inset-0 rounded-xl bg-cyan-400/30"
                    initial={{ scale: 1, opacity: 0.5 }}
                    animate={{ scale: 2, opacity: 0 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
                  />
                  <motion.div
                    className="absolute inset-0 rounded-xl bg-cyan-400/20"
                    initial={{ scale: 1, opacity: 0.3 }}
                    animate={{ scale: 2.5, opacity: 0 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut", delay: 0.3 }}
                  />
                </>
              )}
              
              {/* Glow effect */}
              {(isComplete || isActive) && (
                <div className={cn(
                  "absolute -inset-1 rounded-2xl blur-md",
                  isComplete && "bg-emerald-500/30",
                  isActive && "bg-cyan-500/30"
                )} />
              )}
              
              {/* Main node */}
              <div className={cn(
                "relative w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300",
                "border backdrop-blur-sm",
                isPending && "bg-white/[0.03] border-white/[0.08] text-zinc-600",
                isActive && "bg-gradient-to-br from-cyan-500/25 to-cyan-600/15 border-cyan-400/50 text-cyan-300 shadow-[0_0_30px_rgba(34,211,238,0.4)]",
                isComplete && "bg-gradient-to-br from-emerald-500/25 to-emerald-600/15 border-emerald-400/50 text-emerald-300 shadow-[0_0_30px_rgba(52,211,153,0.4)]",
                isError && "bg-gradient-to-br from-rose-500/25 to-rose-600/15 border-rose-400/50 text-rose-300 shadow-[0_0_30px_rgba(251,113,133,0.4)]"
              )}>
                {isActive ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isComplete ? (
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </motion.div>
                ) : isError ? (
                  <XCircle className="w-4 h-4" />
                ) : (
                  <stage.icon className="w-4 h-4" />
                )}
              </div>
            </motion.div>
            
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-3 py-2 rounded-xl bg-zinc-900/95 backdrop-blur-xl text-zinc-200 text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none border border-white/[0.1] shadow-2xl z-20 hidden sm:block">
              <div className="flex items-center gap-2">
                <span className={cn(
                  "w-2 h-2 rounded-full",
                  isComplete && "bg-emerald-400",
                  isActive && "bg-cyan-400 animate-pulse",
                  isError && "bg-rose-400",
                  isPending && "bg-zinc-500"
                )} />
                {stage.shortName}
              </div>
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-900/95" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ProductionHeader({
  projectTitle,
  projectStatus,
  stages,
  progress,
  elapsedTime,
  isRunning,
  isComplete,
  isError,
  isCancelling,
  isResuming,
  hasClips,
  onCancel,
  onResume,
}: ProductionHeaderProps) {
  const showResumeButton = !isComplete && !isRunning && (isError || hasClips);
  const showCancelButton = isRunning;

  return (
    <div className="relative shrink-0 border-b border-white/[0.06]">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-r from-zinc-900/80 via-zinc-900/60 to-zinc-900/80 backdrop-blur-xl" />
      
      {/* Top highlight line */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
      
      {/* Desktop: single row */}
      <div className="relative hidden sm:flex h-16 px-6 items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Status Icon */}
          <motion.div 
            initial={false}
            animate={{ scale: isRunning ? [1, 1.05, 1] : 1 }}
            transition={{ duration: 2, repeat: isRunning ? Infinity : 0 }}
            className={cn(
              "relative w-11 h-11 rounded-2xl flex items-center justify-center",
              "border backdrop-blur-sm",
              isComplete && "bg-emerald-500/15 border-emerald-500/30 text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.25)]",
              isError && "bg-rose-500/15 border-rose-500/30 text-rose-400 shadow-[0_0_30px_rgba(244,63,94,0.25)]",
              isRunning && "bg-primary/15 border-primary/30 text-primary shadow-[0_0_30px_rgba(255,255,255,0.1)]",
              !isRunning && !isComplete && !isError && "bg-white/[0.04] border-white/[0.08] text-zinc-400"
            )}
          >
            {isRunning && (
              <motion.div
                className="absolute inset-0 rounded-2xl bg-primary/10"
                animate={{ opacity: [0.6, 0.2, 0.6] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}
            {isRunning && <Loader2 className="w-5 h-5 animate-spin" />}
            {isComplete && <CheckCircle2 className="w-5 h-5" />}
            {isError && <XCircle className="w-5 h-5" />}
            {!isRunning && !isComplete && !isError && <Film className="w-5 h-5" />}
          </motion.div>
          
          <div>
            <h1 className="text-base font-semibold text-white leading-none tracking-tight truncate max-w-[240px]">
              {projectTitle}
            </h1>
            <p className="text-xs text-zinc-500 mt-1 capitalize flex items-center gap-1.5">
              <span className={cn(
                "w-1.5 h-1.5 rounded-full",
                isComplete && "bg-emerald-400",
                isError && "bg-rose-400",
                isRunning && "bg-primary animate-pulse",
                !isComplete && !isError && !isRunning && "bg-zinc-500"
              )} />
              {projectStatus.replace(/_/g, ' ')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <PremiumPipeline stages={stages} />
          
          <div className="h-8 w-px bg-white/[0.06]" />
          
          {showCancelButton && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-3 text-xs text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 rounded-lg border border-transparent hover:border-rose-500/20"
              onClick={onCancel}
              disabled={isCancelling}
            >
              {isCancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <X className="w-3.5 h-3.5 mr-1.5" />}
              Cancel
            </Button>
          )}
          
          {showResumeButton && (
            <Button
              size="sm"
              className="h-8 px-3 text-xs bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 rounded-lg border border-amber-500/20"
              onClick={onResume}
              disabled={isResuming}
            >
              {isResuming ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <RotateCcw className="w-3.5 h-3.5 mr-1.5" />}
              Resume
            </Button>
          )}
          
          {isRunning && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-sm">
              <motion.div 
                className="w-2 h-2 rounded-full bg-emerald-400"
                animate={{ opacity: [1, 0.3, 1], scale: [1, 0.9, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">Live</span>
            </div>
          )}
          
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
            <Clock className="w-3.5 h-3.5 text-zinc-500" />
            <span className="text-xs font-mono text-zinc-300 tracking-tight">{formatTime(elapsedTime)}</span>
          </div>

          {/* Progress Circle */}
          <div className="relative w-12 h-12">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <circle
                cx="18"
                cy="18"
                r="15"
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="2"
              />
              <motion.circle
                cx="18"
                cy="18"
                r="15"
                fill="none"
                stroke={isComplete ? '#10b981' : isError ? '#f43f5e' : 'rgba(255,255,255,0.8)'}
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 15}`}
                initial={{ strokeDashoffset: 2 * Math.PI * 15 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 15 * (1 - progress / 100) }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={cn(
                "text-sm font-bold tabular-nums",
                isComplete ? "text-emerald-400" : isError ? "text-rose-400" : "text-white"
              )}>
                {Math.round(progress)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: stacked layout */}
      <div className="relative sm:hidden">
        {/* Top row: Title + Status + Progress */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Link 
              to="/projects" 
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-white/[0.04] border border-white/[0.08] text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors"
            >
              <FolderOpen className="w-4 h-4" />
            </Link>
            
            <motion.div 
              animate={{ scale: isRunning ? [1, 1.05, 1] : 1 }}
              transition={{ duration: 2, repeat: isRunning ? Infinity : 0 }}
              className={cn(
                "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border",
                isComplete && "bg-emerald-500/15 border-emerald-500/30 text-emerald-400",
                isError && "bg-rose-500/15 border-rose-500/30 text-rose-400",
                isRunning && "bg-primary/15 border-primary/30 text-primary",
                !isRunning && !isComplete && !isError && "bg-white/[0.04] border-white/[0.08] text-zinc-500"
              )}
            >
              {isRunning && <Loader2 className="w-4 h-4 animate-spin" />}
              {isComplete && <CheckCircle2 className="w-4 h-4" />}
              {isError && <XCircle className="w-4 h-4" />}
              {!isRunning && !isComplete && !isError && <Film className="w-4 h-4" />}
            </motion.div>
            
            <div className="min-w-0 flex-1">
              <h1 className="text-sm font-semibold text-white leading-none truncate">
                {projectTitle}
              </h1>
              <p className="text-[11px] text-zinc-500 mt-1 capitalize">
                {projectStatus.replace(/_/g, ' ')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isRunning && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <motion.div 
                  className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                />
                <span className="text-[10px] font-semibold text-emerald-400 uppercase">Live</span>
              </div>
            )}
            <span className={cn(
              "text-lg font-bold tabular-nums",
              isComplete ? "text-emerald-400" : isError ? "text-rose-400" : "text-white"
            )}>
              {Math.round(progress)}%
            </span>
          </div>
        </div>

        {/* Pipeline + Timer row */}
        <div className="flex items-center justify-between px-4 pb-3">
          <PremiumPipeline stages={stages} />
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06]">
            <Clock className="w-3 h-3 text-zinc-500" />
            <span className="text-[11px] font-mono text-zinc-300">{formatTime(elapsedTime)}</span>
          </div>
        </div>

        {/* Action buttons row */}
        {(showCancelButton || showResumeButton) && (
          <div className="flex items-center gap-2 px-4 pb-4">
            {showCancelButton && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-10 text-xs text-rose-400 border-rose-500/30 hover:bg-rose-500/10 rounded-xl"
                onClick={onCancel}
                disabled={isCancelling}
              >
                {isCancelling ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <X className="w-4 h-4 mr-2" />}
                Cancel Pipeline
              </Button>
            )}
            
            {showResumeButton && (
              <Button
                size="sm"
                className="flex-1 h-10 text-xs bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-semibold rounded-xl shadow-lg shadow-amber-500/20"
                onClick={onResume}
                disabled={isResuming}
              >
                {isResuming ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RotateCcw className="w-4 h-4 mr-2" />}
                Resume Pipeline
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
