import React, { memo, forwardRef } from 'react';
import { motion } from 'framer-motion';
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

// Premium stat pill with gradient accent
function StatPill({ label, value, accent, icon: Icon }: { label: string; value: string | number; accent?: string; icon?: React.ElementType }) {
  return (
    <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm hover:bg-white/[0.05] transition-colors">
      {Icon && <Icon className={cn("w-3.5 h-3.5", accent || "text-white/30")} />}
      <div className="flex flex-col">
        <span className="text-[9px] uppercase tracking-wider text-white/30 font-bold leading-none">{label}</span>
        <span className={cn("text-sm font-bold tabular-nums leading-tight mt-0.5", accent || "text-white/80")}>{value}</span>
      </div>
    </div>
  );
}

// Premium clip card
function ClipCard({ clip, onPlay, onRetry }: { 
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
              "relative w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300",
              "border text-xs font-bold backdrop-blur-sm",
              clip.status === 'completed' && "bg-emerald-500/10 border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/40 hover:scale-105 cursor-pointer shadow-lg shadow-emerald-500/5",
              clip.status === 'generating' && "bg-violet-500/10 border-violet-500/25 text-violet-400 shadow-lg shadow-violet-500/10",
              clip.status === 'failed' && "bg-rose-500/10 border-rose-500/25 text-rose-400 hover:bg-rose-500/20 hover:scale-105 cursor-pointer",
              clip.status === 'pending' && "bg-white/[0.02] border-white/[0.05] text-white/15",
            )}
            onClick={() => {
              if (clip.status === 'completed' && clip.videoUrl && onPlay) onPlay(clip.videoUrl);
              else if (clip.status === 'failed' && onRetry) onRetry(clip.index);
            }}
          >
            {clip.index + 1}
            
            {/* Animated pulse for generating */}
            {clip.status === 'generating' && (
              <div className="absolute -inset-0.5 rounded-xl border border-violet-500/30 animate-[pulse_2s_ease-in-out_infinite]" />
            )}
            
            {/* Status bar */}
            <div className="absolute bottom-0 left-1.5 right-1.5 h-0.5 rounded-full overflow-hidden">
              {clip.status === 'completed' && <div className="h-full bg-gradient-to-r from-emerald-400 to-teal-400" />}
              {clip.status === 'generating' && (
                <div className="h-full bg-gradient-to-r from-violet-400 to-purple-400 animate-pulse" />
              )}
              {clip.status === 'failed' && <div className="h-full bg-gradient-to-r from-rose-400 to-pink-400" />}
            </div>
            
            {/* Hover overlay */}
            {clip.status === 'completed' && (
              <div className="absolute inset-0 flex items-center justify-center rounded-xl opacity-0 hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-sm">
                <Play className="w-4 h-4 text-white" />
              </div>
            )}
            {clip.status === 'failed' && (
              <div className="absolute inset-0 flex items-center justify-center rounded-xl opacity-0 hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-sm">
                <RotateCcw className="w-3.5 h-3.5 text-white" />
              </div>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-black/90 border-white/10 backdrop-blur-2xl">
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
  projectTitle, progress, elapsedTime, isRunning, isComplete,
  clips, totalClips, completedClips, consistencyScore, transitions,
  onPlayClip, onRetryClip, onStitch, onResume,
  isStitching, isResuming, finalVideoUrl, clipDuration = 5,
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
        "bg-white/[0.03] border border-white/[0.08]",
        "backdrop-blur-2xl shadow-2xl shadow-black/20",
      )}>
        {/* Gradient accent border */}
        <div className="absolute inset-0 rounded-2xl pointer-events-none overflow-hidden">
          <div 
            className="absolute -inset-[1px] rounded-2xl opacity-20"
            style={{
              background: isComplete
                ? 'linear-gradient(135deg, rgba(16,185,129,0.3), transparent 50%, rgba(20,184,166,0.2))'
                : 'linear-gradient(135deg, rgba(139,92,246,0.2), transparent 50%, rgba(99,102,241,0.15))',
            }}
          />
        </div>

        <div className="relative p-6">
          {/* Header row */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3.5">
              <div className={cn(
                "w-11 h-11 rounded-xl flex items-center justify-center border",
                isComplete
                  ? "bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border-emerald-500/30"
                  : generatingClips > 0
                    ? "bg-gradient-to-br from-violet-500/20 to-purple-500/20 border-violet-500/30"
                    : "bg-white/[0.04] border-white/[0.06]",
              )}>
                {isComplete ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : generatingClips > 0 ? (
                  <Film className="w-4.5 h-4.5 text-violet-400 animate-[pulse_2s_ease-in-out_infinite]" />
                ) : (
                  <Film className="w-4.5 h-4.5 text-white/30" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">
                  {projectTitle || 'Production'}
                </h3>
                <p className="text-[11px] text-white/35">
                  {isComplete ? 'All clips rendered' : isRunning ? 'Rendering clips...' : failedClips > 0 ? 'Needs attention' : 'Ready'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-mono font-black text-white/85 tracking-tighter tabular-nums">
                {formatTime(elapsedTime)}
              </p>
            </div>
          </div>

          {/* Premium progress bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white/40 font-medium">
                {completedClips}/{totalClips} clips
                {generatingClips > 0 && <span className="text-violet-400/70 ml-2">· {generatingClips} rendering</span>}
              </span>
              <span className={cn(
                "text-xs font-black tabular-nums",
                progress >= 100 ? "text-emerald-400" : "text-white/60"
              )}>
                {Math.round(progress)}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-700 ease-out",
                  progress >= 100 
                    ? "bg-gradient-to-r from-emerald-500 to-teal-500" 
                    : "bg-gradient-to-r from-violet-500 to-indigo-500"
                )}
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap gap-2 mb-6">
            <StatPill label="Clips" value={`${completedClips}/${totalClips}`} icon={Film} accent={completedClips === totalClips && totalClips > 0 ? "text-emerald-400" : undefined} />
            <StatPill label="Duration" value={`${estimatedDuration}s`} icon={Clock} />
            {generatingClips > 0 && (
              <StatPill label="ETA" value={estimateRemaining(completedClips, totalClips)} icon={Timer} accent="text-violet-400" />
            )}
            {consistencyScore !== undefined && consistencyScore > 0 && (
              <StatPill label="Consistency" value={`${Math.round(consistencyScore * 100)}%`} icon={Eye} accent={consistencyScore >= 0.8 ? "text-emerald-400" : "text-amber-400"} />
            )}
            {avgTransitionScore !== undefined && (
              <StatPill label="Transitions" value={`${avgTransitionScore}%`} icon={Layers} accent={avgTransitionScore >= 85 ? "text-emerald-400" : "text-amber-400"} />
            )}
            {failedClips > 0 && (
              <StatPill label="Failed" value={failedClips} icon={AlertTriangle} accent="text-rose-400" />
            )}
          </div>

          {/* Clips grid */}
          {clips.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Eye className="w-3.5 h-3.5 text-white/25" />
                <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Clip Status</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {clips.map((clip) => (
                  <ClipCard key={clip.index} clip={clip} onPlay={onPlayClip} onRetry={onRetryClip} />
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          {!isComplete && !finalVideoUrl && (
            <div className="flex flex-wrap gap-3">
              {!isRunning && completedClips < totalClips && onResume && (
                <Button
                  onClick={onResume}
                  disabled={isResuming}
                  size="sm"
                  className="bg-white/10 border border-white/15 text-white hover:bg-white/15 text-xs font-bold rounded-xl h-10 px-5"
                >
                  <RotateCcw className={cn("w-3.5 h-3.5 mr-2", isResuming && "animate-spin")} />
                  Resume
                </Button>
              )}
              {completedClips === totalClips && completedClips > 0 && onStitch && (
                <Button
                  onClick={onStitch}
                  disabled={isStitching}
                  size="sm"
                  className={cn(
                    "text-xs font-bold rounded-xl h-10 px-5",
                    "bg-gradient-to-r from-emerald-500 to-teal-500 text-white",
                    "hover:from-emerald-400 hover:to-teal-400",
                    "shadow-lg shadow-emerald-500/20"
                  )}
                >
                  <Sparkles className={cn("w-3.5 h-3.5 mr-2", isStitching && "animate-spin")} />
                  Stitch Final Video
                </Button>
              )}
            </div>
          )}

          {/* Video Ready badge */}
          {finalVideoUrl && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-emerald-400">Video Ready</span>
            </div>
          )}
        </div>
      </div>

      {/* Transition flow */}
      {hasTransitions && (
        <div className={cn(
          "rounded-2xl overflow-hidden p-5",
          "bg-white/[0.03] border border-white/[0.08]",
          "backdrop-blur-2xl shadow-xl shadow-black/10",
        )}>
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-4 h-4 text-white/25" />
            <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Transition Flow</span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            {transitions!.map((t, idx) => (
              <div key={idx} className="flex items-center">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold bg-white/[0.04] border border-white/[0.06] text-white/35">
                  {t.fromIndex + 1}
                </div>
                <div className="flex items-center mx-1.5">
                  <div className={cn(
                    "w-6 h-px",
                    t.overallScore >= 85 ? "bg-emerald-500/50" : t.overallScore >= 70 ? "bg-amber-500/50" : "bg-rose-500/50"
                  )} />
                  <span className={cn(
                    "text-[9px] font-bold ml-1",
                    t.overallScore >= 85 ? "text-emerald-400/70" : t.overallScore >= 70 ? "text-amber-400/70" : "text-rose-400/70"
                  )}>{t.overallScore}</span>
                </div>
                {idx === transitions!.length - 1 && (
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold bg-white/[0.04] border border-white/[0.06] text-white/35">
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
