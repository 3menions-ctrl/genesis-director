import { Film, Clock, Sparkles, Zap, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductionStatsProps {
  completedClips: number;
  totalClips: number;
  elapsedTime: number;
  progress: number;
  auditScore: number | null;
  isComplete: boolean;
  isError: boolean;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function ProductionStats({
  completedClips,
  totalClips,
  elapsedTime,
  progress,
  auditScore,
  isComplete,
  isError,
}: ProductionStatsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      {/* Progress */}
      <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/30">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-sky-500/15 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <span className="text-[11px] text-zinc-500">Progress</span>
          </div>
          <span className={cn(
            "text-base font-semibold",
            isComplete ? "text-emerald-400" : isError ? "text-rose-400" : "text-zinc-100"
          )}>
            {Math.round(progress)}%
          </span>
        </div>
        <div className="h-1 rounded-full bg-zinc-700/50 overflow-hidden">
          <div 
            className={cn(
              "h-full rounded-full transition-all duration-500",
              isComplete ? "bg-emerald-500" : isError ? "bg-rose-500" : "bg-sky-500"
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Clips */}
      <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-violet-500/15 flex items-center justify-center">
              <Film className="w-3.5 h-3.5 text-violet-400" />
            </div>
            <span className="text-[11px] text-zinc-500">Clips</span>
          </div>
          <div className="text-right">
            <span className="text-base font-semibold text-zinc-100">{completedClips}</span>
            <span className="text-sm text-zinc-500">/{totalClips}</span>
          </div>
        </div>
        {completedClips === totalClips && totalClips > 0 && (
          <div className="flex items-center gap-1 mt-2 text-emerald-400">
            <CheckCircle2 className="w-3 h-3" />
            <span className="text-[10px] font-medium">Ready</span>
          </div>
        )}
      </div>

      {/* Time */}
      <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-amber-500/15 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <span className="text-[11px] text-zinc-500">Time</span>
          </div>
          <span className="text-base font-semibold font-mono text-zinc-100">
            {formatTime(elapsedTime)}
          </span>
        </div>
      </div>

      {/* Quality Score */}
      <div className={cn(
        "bg-zinc-800/50 rounded-lg p-3 border",
        auditScore !== null && auditScore >= 80 ? "border-emerald-500/30" :
        auditScore !== null && auditScore >= 60 ? "border-amber-500/30" :
        auditScore !== null && auditScore < 60 ? "border-rose-500/30" :
        "border-zinc-700/30"
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-7 h-7 rounded-md flex items-center justify-center",
              auditScore === null && "bg-zinc-700/50",
              auditScore !== null && auditScore >= 80 && "bg-emerald-500/15",
              auditScore !== null && auditScore >= 60 && auditScore < 80 && "bg-amber-500/15",
              auditScore !== null && auditScore < 60 && "bg-rose-500/15"
            )}>
              <Sparkles className={cn(
                "w-3.5 h-3.5",
                auditScore === null && "text-zinc-500",
                auditScore !== null && auditScore >= 80 && "text-emerald-400",
                auditScore !== null && auditScore >= 60 && auditScore < 80 && "text-amber-400",
                auditScore !== null && auditScore < 60 && "text-rose-400"
              )} />
            </div>
            <span className="text-[11px] text-zinc-500">Quality</span>
          </div>
          <span className={cn(
            "text-base font-semibold",
            auditScore === null && "text-zinc-500",
            auditScore !== null && auditScore >= 80 && "text-emerald-400",
            auditScore !== null && auditScore >= 60 && auditScore < 80 && "text-amber-400",
            auditScore !== null && auditScore < 60 && "text-rose-400"
          )}>
            {auditScore !== null ? `${auditScore}%` : '—'}
          </span>
        </div>
      </div>
    </div>
  );
}
