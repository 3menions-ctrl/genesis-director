import { motion } from 'framer-motion';
import { 
  Film, Loader2, CheckCircle2, XCircle, Clock, X, RotateCcw
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

function MiniPipeline({ stages }: { stages: StageStatus[] }) {
  return (
    <div className="flex items-center gap-1">
      {stages.map((stage, i) => {
        const isActive = stage.status === 'active';
        const isComplete = stage.status === 'complete';
        const isError = stage.status === 'error';
        
        return (
          <div key={i} className="relative group">
            <div className={cn(
              "w-7 h-7 rounded-md flex items-center justify-center transition-all",
              isComplete && "bg-emerald-500/20 text-emerald-400",
              isActive && "bg-sky-500/20 text-sky-400",
              !isComplete && !isActive && !isError && "bg-zinc-800 text-zinc-500",
              isError && "bg-rose-500/20 text-rose-400"
            )}>
              {isActive ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : isComplete ? (
                <CheckCircle2 className="w-3 h-3" />
              ) : isError ? (
                <XCircle className="w-3 h-3" />
              ) : (
                <stage.icon className="w-3 h-3" />
              )}
            </div>
            
            {i < stages.length - 1 && (
              <div className={cn(
                "absolute top-1/2 -right-1 w-1.5 h-px -translate-y-1/2",
                isComplete ? "bg-emerald-500/50" : "bg-zinc-700"
              )} />
            )}
            
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded bg-zinc-800 text-zinc-200 text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-zinc-700 shadow-lg z-10">
              {stage.shortName}
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
  return (
    <div className="h-12 px-4 flex items-center justify-between border-b border-zinc-800/50 bg-zinc-900 shrink-0">
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center",
          isComplete ? "bg-emerald-500/15 text-emerald-400" : 
          isError ? "bg-rose-500/15 text-rose-400" : 
          isRunning ? "bg-sky-500/15 text-sky-400" :
          "bg-zinc-800 text-zinc-500"
        )}>
          {isRunning && <Loader2 className="w-4 h-4 animate-spin" />}
          {isComplete && <CheckCircle2 className="w-4 h-4" />}
          {isError && <XCircle className="w-4 h-4" />}
          {!isRunning && !isComplete && !isError && <Film className="w-4 h-4" />}
        </div>
        <div>
          <h1 className="text-sm font-medium text-zinc-100 leading-none truncate max-w-[200px]">
            {projectTitle}
          </h1>
          <p className="text-[11px] text-zinc-500 mt-0.5 capitalize">
            {projectStatus.replace(/_/g, ' ')}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <MiniPipeline stages={stages} />
        
        <div className="h-5 w-px bg-zinc-800" />
        
        {isRunning && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-[11px] text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
            onClick={onCancel}
            disabled={isCancelling}
          >
            {isCancelling ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <X className="w-3 h-3 mr-1" />}
            Cancel
          </Button>
        )}
        
        {hasClips && !isComplete && !isRunning && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-[11px] text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
            onClick={onResume}
            disabled={isResuming}
          >
            {isResuming ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RotateCcw className="w-3 h-3 mr-1" />}
            Resume
          </Button>
        )}
        
        {isRunning && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20">
            <motion.div 
              className="w-1.5 h-1.5 rounded-full bg-emerald-400"
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
            <span className="text-[10px] font-medium text-emerald-400 uppercase tracking-wide">Live</span>
          </div>
        )}
        
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-800">
          <Clock className="w-3 h-3 text-zinc-500" />
          <span className="text-[11px] font-mono text-zinc-300">{formatTime(elapsedTime)}</span>
        </div>

        <span className={cn(
          "text-lg font-semibold tabular-nums",
          isComplete ? "text-emerald-400" : isError ? "text-rose-400" : "text-zinc-100"
        )}>
          {Math.round(progress)}%
        </span>
      </div>
    </div>
  );
}
