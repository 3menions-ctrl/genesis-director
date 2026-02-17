import React, { memo, forwardRef } from 'react';
import { motion } from 'framer-motion';
import { 
  Film, Clock, CheckCircle2, AlertTriangle, Play, 
  RotateCcw, Sparkles, Layers, Eye, Timer, Zap
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

// Premium stat pill with glassmorphism
function StatPill({ label, value, accent, icon: Icon }: { label: string; value: string | number; accent?: string; icon?: React.ElementType }) {
  return (
    <div className="group relative flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm hover:bg-white/[0.06] hover:border-white/[0.1] transition-all duration-300">
      {/* Subtle gradient overlay on hover */}
      <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
      {Icon && <Icon className={cn("w-3.5 h-3.5 relative z-10", accent || "text-white/25")} />}
      <div className="flex flex-col relative z-10">
        <span className="text-[9px] uppercase tracking-[0.15em] text-white/25 font-bold leading-none">{label}</span>
        <span className={cn("text-sm font-bold tabular-nums leading-tight mt-0.5", accent || "text-white/80")}>{value}</span>
      </div>
    </div>
  );
}

// Premium holographic clip card
function ClipCard({ clip, onPlay, onRetry }: { 
  clip: ClipData; 
  onPlay?: (url: string) => void;
  onRetry?: (index: number) => void;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.button
            whileHover={{ scale: 1.08, y: -2 }}
            whileTap={{ scale: 0.95 }}
            className={cn(
              "relative w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-300",
              "border text-sm font-bold backdrop-blur-sm",
              clip.status === 'completed' && "bg-emerald-500/8 border-emerald-500/20 text-emerald-400 cursor-pointer shadow-lg shadow-emerald-500/5",
              clip.status === 'generating' && "bg-violet-500/8 border-violet-500/20 text-violet-400 shadow-lg shadow-violet-500/10",
              clip.status === 'failed' && "bg-rose-500/8 border-rose-500/20 text-rose-400 cursor-pointer",
              clip.status === 'pending' && "bg-white/[0.015] border-white/[0.04] text-white/12",
            )}
            onClick={() => {
              if (clip.status === 'completed' && clip.videoUrl && onPlay) onPlay(clip.videoUrl);
              else if (clip.status === 'failed' && onRetry) onRetry(clip.index);
            }}
          >
            {clip.index + 1}
            
            {/* Animated glow ring for generating */}
            {clip.status === 'generating' && (
              <>
                <div className="absolute -inset-1 rounded-xl border border-violet-500/20 animate-[pulse_2s_ease-in-out_infinite]" />
                <div className="absolute -inset-2 rounded-xl bg-violet-500/5 blur-sm animate-[pulse_3s_ease-in-out_infinite]" />
              </>
            )}

            {/* Complete shimmer */}
            {clip.status === 'completed' && (
              <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
                <div 
                  className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity"
                  style={{ background: 'linear-gradient(105deg, transparent 40%, rgba(16,185,129,0.08) 45%, transparent 50%)' }}
                />
              </div>
            )}
            
            {/* Status bar */}
            <div className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full overflow-hidden">
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
          </motion.button>
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
        "relative rounded-3xl overflow-hidden",
        "bg-black/40 border border-white/[0.06]",
        "backdrop-blur-3xl shadow-2xl shadow-black/40",
      )}>
        {/* Gradient accent border */}
        <div className="absolute inset-0 rounded-3xl pointer-events-none overflow-hidden">
          <div 
            className="absolute -inset-[1px] rounded-3xl opacity-30"
            style={{
              background: isComplete
                ? 'linear-gradient(135deg, rgba(16,185,129,0.4), transparent 40%, rgba(20,184,166,0.2), transparent 70%)'
                : 'linear-gradient(135deg, rgba(139,92,246,0.25), transparent 40%, rgba(99,102,241,0.15), transparent 70%)',
            }}
          />
          {/* Top edge light */}
          <div className="absolute top-0 inset-x-8 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>

        {/* Ambient glow */}
        {generatingClips > 0 && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-40 bg-violet-500/[0.06] blur-[80px] -translate-y-1/2 pointer-events-none" />
        )}

        <div className="relative p-7">
          {/* Header row */}
          <div className="flex items-center justify-between mb-7">
            <div className="flex items-center gap-4">
              <motion.div 
                className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center border relative overflow-hidden",
                  isComplete
                    ? "bg-gradient-to-br from-emerald-500/15 to-teal-500/10 border-emerald-500/25"
                    : generatingClips > 0
                      ? "bg-gradient-to-br from-violet-500/15 to-purple-500/10 border-violet-500/25"
                      : "bg-white/[0.03] border-white/[0.06]",
                )}
                animate={generatingClips > 0 ? { scale: [1, 1.04, 1] } : {}}
                transition={{ duration: 2.5, repeat: Infinity }}
              >
                {isComplete ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : generatingClips > 0 ? (
                  <Film className="w-5 h-5 text-violet-400" />
                ) : (
                  <Film className="w-5 h-5 text-white/25" />
                )}
                {/* Glass highlight */}
                <div className="absolute top-0 inset-x-0 h-1/2 bg-gradient-to-b from-white/[0.05] to-transparent" />
              </motion.div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">
                  {projectTitle || 'Production'}
                </h3>
                <p className="text-[11px] text-white/30">
                  {isComplete ? '✦ All clips rendered' : isRunning ? 'Rendering clips...' : failedClips > 0 ? 'Needs attention' : 'Ready'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-mono font-black text-white/80 tracking-tighter tabular-nums">
                {formatTime(elapsedTime)}
              </p>
            </div>
          </div>

          {/* Premium progress bar with glow */}
          <div className="mb-7">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs text-white/35 font-medium">
                {completedClips}/{totalClips} clips
                {generatingClips > 0 && <span className="text-violet-400/60 ml-2">· {generatingClips} rendering</span>}
              </span>
              <span className={cn(
                "text-xs font-black tabular-nums",
                progress >= 100 ? "text-emerald-400" : "text-white/50"
              )}>
                {Math.round(progress)}%
              </span>
            </div>
            <div className="relative h-2 rounded-full bg-white/[0.03] overflow-hidden">
              {/* Glow underneath */}
              <div
                className={cn(
                  "absolute -inset-y-1 left-0 rounded-full blur-md opacity-40",
                  progress >= 100 ? "bg-emerald-500" : "bg-violet-500"
                )}
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
              <div
                className={cn(
                  "relative h-full rounded-full transition-all duration-700 ease-out",
                  progress >= 100 
                    ? "bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400" 
                    : "bg-gradient-to-r from-violet-500 via-indigo-500 to-purple-400"
                )}
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap gap-2.5 mb-7">
            <StatPill label="Clips" value={`${completedClips}/${totalClips}`} icon={Film} accent={completedClips === totalClips && totalClips > 0 ? "text-emerald-400" : undefined} />
            <StatPill label="Duration" value={`${estimatedDuration}s`} icon={Clock} />
            {generatingClips > 0 && (
              <StatPill label="ETA" value={estimateRemaining(completedClips, totalClips)} icon={Timer} accent="text-violet-400" />
            )}
            {consistencyScore !== undefined && consistencyScore > 0 && (
              <StatPill label="Consistency" value={`${Math.round(consistencyScore * 100)}%`} icon={Eye} accent={consistencyScore >= 0.8 ? "text-emerald-400" : "text-amber-400"} />
            )}
            {avgTransitionScore !== undefined && (
              <StatPill label="Flow" value={`${avgTransitionScore}%`} icon={Layers} accent={avgTransitionScore >= 85 ? "text-emerald-400" : "text-amber-400"} />
            )}
            {failedClips > 0 && (
              <StatPill label="Failed" value={failedClips} icon={AlertTriangle} accent="text-rose-400" />
            )}
          </div>

          {/* Clips grid */}
          {clips.length > 0 && (
            <div className="mb-7">
              <div className="flex items-center gap-2 mb-3.5">
                <Zap className="w-3.5 h-3.5 text-white/20" />
                <span className="text-[10px] font-bold text-white/25 uppercase tracking-[0.15em]">Render Status</span>
              </div>
              <div className="flex flex-wrap gap-2.5">
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
                  className="bg-white/[0.06] border border-white/[0.1] text-white hover:bg-white/[0.1] text-xs font-bold rounded-xl h-10 px-5"
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
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-emerald-400">✦ Video Ready</span>
            </motion.div>
          )}
        </div>
      </div>

      {/* Transition flow */}
      {hasTransitions && (
        <div className={cn(
          "rounded-2xl overflow-hidden p-5",
          "bg-black/30 border border-white/[0.06]",
          "backdrop-blur-2xl shadow-xl shadow-black/10",
        )}>
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-4 h-4 text-white/20" />
            <span className="text-[10px] font-bold text-white/25 uppercase tracking-[0.15em]">Transition Flow</span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            {transitions!.map((t, idx) => (
              <div key={idx} className="flex items-center">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-[10px] font-bold bg-white/[0.03] border border-white/[0.05] text-white/30">
                  {t.fromIndex + 1}
                </div>
                <div className="flex items-center mx-1.5">
                  <div className={cn(
                    "w-6 h-px",
                    t.overallScore >= 85 ? "bg-emerald-500/40" : t.overallScore >= 70 ? "bg-amber-500/40" : "bg-rose-500/40"
                  )} />
                  <span className={cn(
                    "text-[9px] font-bold ml-1",
                    t.overallScore >= 85 ? "text-emerald-400/60" : t.overallScore >= 70 ? "text-amber-400/60" : "text-rose-400/60"
                  )}>{t.overallScore}</span>
                </div>
                {idx === transitions!.length - 1 && (
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-[10px] font-bold bg-white/[0.03] border border-white/[0.05] text-white/30">
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
