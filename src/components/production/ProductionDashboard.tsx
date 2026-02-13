import React, { memo, forwardRef } from 'react';
import { 
  Film, Clock, CheckCircle2, AlertTriangle, Play, 
  RotateCcw, Sparkles, Layers, Eye, Timer
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ClipData {
  index: number;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  videoUrl?: string;
  error?: string;
}

interface TransitionData {
  fromIndex: number;
  toIndex: number;
  overallScore: number;
  needsBridge?: boolean;
}

interface ProductionDashboardProps {
  projectTitle: string;
  progress: number;
  elapsedTime: number;
  isRunning: boolean;
  isComplete: boolean;
  clips: ClipData[];
  totalClips: number;
  completedClips: number;
  consistencyScore?: number;
  transitions?: TransitionData[];
  onPlayClip?: (url: string) => void;
  onRetryClip?: (index: number) => void;
  onStitch?: () => void;
  onResume?: () => void;
  isStitching?: boolean;
  isResuming?: boolean;
  finalVideoUrl?: string;
  clipDuration?: number;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function estimateRemaining(completed: number, total: number): string {
  const remaining = total - completed;
  if (remaining <= 0) return '< 1 min';
  const est = remaining * 3;
  return est <= 1 ? '< 1 min' : `~${est} min`;
}

// Minimal stat pill
function StatPill({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
      <span className="text-[10px] uppercase tracking-wider text-white/30 font-medium">{label}</span>
      <span className={cn("text-sm font-semibold tabular-nums", accent || "text-white/70")}>{value}</span>
    </div>
  );
}

// Clip dot indicator
function ClipDot({ clip, onPlay, onRetry }: { 
  clip: ClipData; 
  onPlay?: (url: string) => void;
  onRetry?: (index: number) => void;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className={cn(
              "relative w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300",
              "border text-xs font-bold",
              clip.status === 'completed' && "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/15 cursor-pointer",
              clip.status === 'generating' && "bg-amber-500/10 border-amber-500/20 text-amber-400 animate-[pulse_2s_ease-in-out_infinite]",
              clip.status === 'failed' && "bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/15 cursor-pointer",
              clip.status === 'pending' && "bg-white/[0.02] border-white/[0.05] text-white/15",
            )}
            onClick={() => {
              if (clip.status === 'completed' && clip.videoUrl && onPlay) onPlay(clip.videoUrl);
              else if (clip.status === 'failed' && onRetry) onRetry(clip.index);
            }}
          >
            {clip.index + 1}
            {/* Status indicator bar at bottom */}
            <div className="absolute bottom-0 left-1 right-1 h-0.5 rounded-full overflow-hidden">
              {clip.status === 'completed' && <div className="h-full bg-emerald-400/60" />}
              {clip.status === 'generating' && <div className="h-full bg-amber-400/60" />}
              {clip.status === 'failed' && <div className="h-full bg-rose-400/60" />}
            </div>
            {/* Hover overlay */}
            {clip.status === 'completed' && (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg opacity-0 hover:opacity-100 transition-opacity bg-black/50">
                <Play className="w-3.5 h-3.5 text-white" />
              </div>
            )}
            {clip.status === 'failed' && (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg opacity-0 hover:opacity-100 transition-opacity bg-black/50">
                <RotateCcw className="w-3 h-3 text-white" />
              </div>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-zinc-900/95 border-zinc-700/50 backdrop-blur-xl">
          <p className="text-xs font-medium">
            Clip {clip.index + 1} · {clip.status.charAt(0).toUpperCase() + clip.status.slice(1)}
            {clip.error && <span className="block text-rose-400 text-[10px] mt-0.5 max-w-[200px] truncate">{clip.error}</span>}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export const ProductionDashboard = memo(forwardRef<HTMLDivElement, ProductionDashboardProps>(function ProductionDashboard({
  projectTitle,
  progress,
  elapsedTime,
  isRunning,
  isComplete,
  clips,
  totalClips,
  completedClips,
  consistencyScore,
  transitions,
  onPlayClip,
  onRetryClip,
  onStitch,
  onResume,
  isStitching,
  isResuming,
  finalVideoUrl,
  clipDuration = 5,
}, ref) {
  const failedClips = clips.filter(c => c.status === 'failed').length;
  const generatingClips = clips.filter(c => c.status === 'generating').length;
  const hasTransitions = transitions && transitions.length > 0;
  const avgTransitionScore = hasTransitions
    ? Math.round(transitions.reduce((acc, t) => acc + t.overallScore, 0) / transitions.length)
    : undefined;
  const estimatedDuration = totalClips * clipDuration;

  return (
    <div ref={ref} className="space-y-4">
      {/* Main card */}
      <div className={cn(
        "relative rounded-2xl overflow-hidden",
        "bg-white/[0.02] border border-white/[0.06]",
        "backdrop-blur-xl",
      )}>
        <div className="relative p-5 sm:p-6">
          {/* Header row */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-9 h-9 rounded-lg flex items-center justify-center",
                "bg-white/[0.04] border border-white/[0.06]",
                isComplete && "border-emerald-500/20",
              )}>
                {isComplete ? (
                  <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400" />
                ) : generatingClips > 0 ? (
                  <Film className="w-4 h-4 text-white/50 animate-[pulse_2s_ease-in-out_infinite]" />
                ) : (
                  <Film className="w-4 h-4 text-white/30" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white/90 tracking-tight">
                  {projectTitle || 'Production'}
                </h3>
                <p className="text-[11px] text-white/30">
                  {isComplete ? 'Complete' : isRunning ? 'Rendering...' : failedClips > 0 ? 'Needs attention' : 'Ready'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xl font-mono font-bold text-white/80 tracking-tighter tabular-nums">
                {formatTime(elapsedTime)}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-white/35 font-medium">
                {completedClips}/{totalClips} clips
                {generatingClips > 0 && <span className="text-amber-400/60 ml-1.5">· {generatingClips} rendering</span>}
              </span>
              <span className={cn(
                "text-xs font-bold tabular-nums",
                progress >= 100 ? "text-emerald-400" : "text-white/50"
              )}>
                {Math.round(progress)}%
              </span>
            </div>
            <div className="h-1 rounded-full bg-white/[0.04] overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-700 ease-out",
                  progress >= 100 ? "bg-emerald-500/50" : "bg-white/20"
                )}
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap gap-2 mb-5">
            <StatPill label="Clips" value={`${completedClips}/${totalClips}`} accent={completedClips === totalClips && totalClips > 0 ? "text-emerald-400" : undefined} />
            <StatPill label="Duration" value={`${estimatedDuration}s`} />
            {generatingClips > 0 && (
              <StatPill label="ETA" value={estimateRemaining(completedClips, totalClips)} accent="text-amber-400/80" />
            )}
            {consistencyScore !== undefined && consistencyScore > 0 && (
              <StatPill label="Consistency" value={`${Math.round(consistencyScore * 100)}%`} accent={consistencyScore >= 0.8 ? "text-emerald-400" : "text-amber-400"} />
            )}
            {avgTransitionScore !== undefined && (
              <StatPill label="Transitions" value={`${avgTransitionScore}%`} accent={avgTransitionScore >= 85 ? "text-emerald-400" : "text-amber-400"} />
            )}
            {failedClips > 0 && (
              <StatPill label="Failed" value={failedClips} accent="text-rose-400" />
            )}
          </div>

          {/* Clips grid */}
          {clips.length > 0 && (
            <div className="mb-5">
              <div className="flex items-center gap-1.5 mb-2.5">
                <Eye className="w-3.5 h-3.5 text-white/20" />
                <span className="text-[10px] font-medium text-white/25 uppercase tracking-wider">Clip Status</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {clips.map((clip) => (
                  <ClipDot key={clip.index} clip={clip} onPlay={onPlayClip} onRetry={onRetryClip} />
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          {!isComplete && !finalVideoUrl && (
            <div className="flex flex-wrap gap-2.5">
              {!isRunning && completedClips < totalClips && onResume && (
                <Button
                  onClick={onResume}
                  disabled={isResuming}
                  size="sm"
                  className="bg-white/10 border border-white/15 text-white hover:bg-white/15 text-xs"
                >
                  <RotateCcw className={cn("w-3.5 h-3.5 mr-1.5", isResuming && "animate-spin")} />
                  Resume
                </Button>
              )}
              {completedClips === totalClips && completedClips > 0 && onStitch && (
                <Button
                  onClick={onStitch}
                  disabled={isStitching}
                  size="sm"
                  className="bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/25 text-xs"
                >
                  <Sparkles className={cn("w-3.5 h-3.5 mr-1.5", isStitching && "animate-spin")} />
                  Stitch Final Video
                </Button>
              )}
            </div>
          )}

          {/* Video Ready badge */}
          {finalVideoUrl && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/15">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-medium text-emerald-400">Video Ready</span>
            </div>
          )}
        </div>
      </div>

      {/* Transition flow */}
      {hasTransitions && (
        <div className={cn(
          "rounded-xl overflow-hidden p-4",
          "bg-white/[0.02] border border-white/[0.05]",
        )}>
          <div className="flex items-center gap-1.5 mb-3">
            <Layers className="w-3.5 h-3.5 text-white/20" />
            <span className="text-[10px] font-medium text-white/25 uppercase tracking-wider">Transition Flow</span>
          </div>
          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-hide">
            {transitions!.map((t, idx) => (
              <div key={idx} className="flex items-center">
                <div className="w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold bg-white/[0.04] border border-white/[0.06] text-white/30">
                  {t.fromIndex + 1}
                </div>
                <div className="flex items-center mx-1">
                  <div className={cn(
                    "w-5 h-px",
                    t.overallScore >= 85 ? "bg-emerald-500/40" : t.overallScore >= 70 ? "bg-amber-500/40" : "bg-rose-500/40"
                  )} />
                  <span className={cn(
                    "text-[9px] font-bold ml-0.5",
                    t.overallScore >= 85 ? "text-emerald-400/60" : t.overallScore >= 70 ? "text-amber-400/60" : "text-rose-400/60"
                  )}>{t.overallScore}</span>
                </div>
                {idx === transitions!.length - 1 && (
                  <div className="w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold bg-white/[0.04] border border-white/[0.06] text-white/30">
                    {t.toIndex + 1}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}));

export default ProductionDashboard;
