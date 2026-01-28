import React from 'react';
import { motion } from 'framer-motion';
import { 
  Film, Clock, Zap, CheckCircle2, AlertTriangle, Play, 
  RotateCcw, Sparkles, Layers, ChevronRight, Eye, Timer
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  clipDuration?: number; // seconds per clip (5 or 10)
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function estimateRemainingTime(completedClips: number, totalClips: number, clipDuration: number = 5): string {
  const remainingClips = totalClips - completedClips;
  if (remainingClips <= 0) return '< 1 min';
  // Kling takes ~2-4 minutes per clip, use 3 as average
  const avgTimePerClip = 3;
  const estimatedMinutes = remainingClips * avgTimePerClip;
  if (estimatedMinutes < 1) return '< 1 min';
  if (estimatedMinutes === 1) return '~1 min';
  return `~${estimatedMinutes} min`;
}

// Premium stat card with glass morphism
const StatCard = React.forwardRef<HTMLDivElement, {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subValue?: string;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'accent';
  pulse?: boolean;
  glow?: boolean;
}>(({ icon: Icon, label, value, subValue, variant = 'default', pulse = false, glow = false }, ref) => {
  const variants = {
    default: {
      icon: 'text-zinc-400',
      iconBg: 'bg-white/5',
      value: 'text-white',
      glow: '',
    },
    success: {
      icon: 'text-emerald-400',
      iconBg: 'bg-emerald-500/10',
      value: 'text-emerald-400',
      glow: 'shadow-[0_0_30px_-5px_rgba(52,211,153,0.3)]',
    },
    warning: {
      icon: 'text-amber-400',
      iconBg: 'bg-amber-500/10',
      value: 'text-amber-400',
      glow: 'shadow-[0_0_30px_-5px_rgba(251,191,36,0.3)]',
    },
    error: {
      icon: 'text-rose-400',
      iconBg: 'bg-rose-500/10',
      value: 'text-rose-400',
      glow: 'shadow-[0_0_30px_-5px_rgba(251,113,133,0.3)]',
    },
    accent: {
      icon: 'text-cyan-400',
      iconBg: 'bg-cyan-500/10',
      value: 'text-cyan-400',
      glow: 'shadow-[0_0_30px_-5px_rgba(34,211,238,0.3)]',
    },
  };

  const v = variants[variant];

  return (
    <div 
      ref={ref} 
      className={cn(
        "relative flex items-center gap-3 p-4 rounded-2xl overflow-hidden transition-all duration-300",
        "bg-white/[0.03] backdrop-blur-xl border border-white/[0.08]",
        "hover:bg-white/[0.05] hover:border-white/[0.12]",
        glow && v.glow
      )}
    >
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
      
      <div className={cn(
        "relative w-11 h-11 rounded-xl flex items-center justify-center",
        v.iconBg
      )}>
        <Icon className={cn("w-5 h-5", v.icon, pulse && "animate-pulse")} />
      </div>
      <div className="relative">
        <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 font-medium">{label}</p>
        <p className={cn("text-xl font-bold tracking-tight", v.value)}>
          {value}
          {subValue && <span className="text-xs text-zinc-500 font-normal ml-1.5">{subValue}</span>}
        </p>
      </div>
    </div>
  );
});
StatCard.displayName = 'StatCard';

// Premium clip thumbnail with hover effects
function ClipThumbnail({ 
  clip, 
  onPlay, 
  onRetry,
  isRetrying 
}: { 
  clip: ClipData;
  onPlay?: (url: string) => void;
  onRetry?: (index: number) => void;
  isRetrying?: boolean;
}) {
  const statusStyles = {
    completed: {
      border: 'border-emerald-500/40 hover:border-emerald-400',
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-400',
      glow: 'shadow-[0_0_20px_-5px_rgba(52,211,153,0.4)]',
    },
    generating: {
      border: 'border-amber-500/40',
      bg: 'bg-amber-500/10',
      text: 'text-amber-400',
      glow: 'shadow-[0_0_20px_-5px_rgba(251,191,36,0.4)]',
    },
    failed: {
      border: 'border-rose-500/40 hover:border-rose-400',
      bg: 'bg-rose-500/10',
      text: 'text-rose-400',
      glow: '',
    },
    pending: {
      border: 'border-zinc-700/50',
      bg: 'bg-zinc-800/50',
      text: 'text-zinc-600',
      glow: '',
    },
  };

  const style = statusStyles[clip.status];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "relative w-14 h-14 rounded-xl overflow-hidden cursor-pointer transition-all duration-300",
              "border-2 backdrop-blur-sm",
              "hover:scale-105 active:scale-[0.98]",
              style.border,
              style.bg,
              clip.status === 'completed' && style.glow,
              clip.status === 'generating' && "animate-pulse",
              clip.status === 'pending' && "opacity-40"
            )}
            onClick={() => {
              if (clip.status === 'completed' && clip.videoUrl && onPlay) {
                onPlay(clip.videoUrl);
              } else if (clip.status === 'failed' && onRetry) {
                onRetry(clip.index);
              }
            }}
          >
            {/* Clip number */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={cn("text-base font-bold", style.text)}>
                {clip.index + 1}
              </span>
            </div>
            
            {/* Status bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1">
              {clip.status === 'completed' && <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400" />}
              {clip.status === 'generating' && (
                <motion.div 
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-400"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                />
              )}
              {clip.status === 'failed' && <div className="h-full bg-gradient-to-r from-rose-500 to-rose-400" />}
            </div>
            
            {/* Hover overlay */}
            {clip.status === 'completed' && (
              <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/60">
                <Play className="w-5 h-5 text-white" />
              </div>
            )}
            
            {clip.status === 'failed' && (
              <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/60">
                <RotateCcw className={cn("w-4 h-4 text-white", isRetrying && "animate-spin")} />
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-zinc-900/95 border-zinc-700/50 backdrop-blur-xl">
          <p className="text-xs font-medium">
            Clip {clip.index + 1} • {clip.status.charAt(0).toUpperCase() + clip.status.slice(1)}
            {clip.error && <span className="block text-rose-400 text-[10px] mt-0.5 max-w-[200px] truncate">{clip.error}</span>}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function ProductionDashboard({
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
}: ProductionDashboardProps) {
  const failedClips = clips.filter(c => c.status === 'failed').length;
  const generatingClips = clips.filter(c => c.status === 'generating').length;
  const hasTransitions = transitions && transitions.length > 0;
  const avgTransitionScore = hasTransitions 
    ? Math.round(transitions.reduce((acc, t) => acc + t.overallScore, 0) / transitions.length)
    : undefined;
  
  // Calculate estimated total duration
  const estimatedDuration = totalClips * clipDuration;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-5"
    >
      {/* Main Progress Card - Premium Glass Design */}
      <div className={cn(
        "relative rounded-3xl overflow-hidden",
        "bg-gradient-to-br from-zinc-900/95 via-zinc-900/90 to-zinc-950/95",
        "border border-white/[0.08] backdrop-blur-2xl",
        "shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)]"
      )}>
        {/* Ambient background glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {isComplete && (
            <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 blur-[120px] rounded-full translate-x-1/3 -translate-y-1/3" />
          )}
          {isRunning && !isComplete && (
            <>
              <div className="absolute top-0 left-0 w-72 h-72 bg-cyan-500/8 blur-[100px] rounded-full -translate-x-1/3 -translate-y-1/3" />
              <div className="absolute bottom-0 right-0 w-72 h-72 bg-amber-500/8 blur-[100px] rounded-full translate-x-1/3 translate-y-1/3" />
            </>
          )}
          {/* Noise texture overlay */}
          <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.8\' numOctaves=\'4\' /%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' /%3E%3C/svg%3E")' }} />
        </div>
        
        <div className="relative p-6 sm:p-8">
          {/* Header Section */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              {/* Status Icon */}
              <div className={cn(
                "w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500",
                isComplete ? "bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 shadow-[0_0_30px_-5px_rgba(52,211,153,0.4)]" : 
                isRunning ? "bg-gradient-to-br from-cyan-500/20 to-cyan-600/10" : 
                "bg-white/5"
              )}>
                {isComplete ? (
                  <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                ) : generatingClips > 0 ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  >
                    <Sparkles className="w-7 h-7 text-cyan-400" />
                  </motion.div>
                ) : (
                  <Film className="w-7 h-7 text-zinc-400" />
                )}
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight truncate max-w-[240px] sm:max-w-none">
                  {projectTitle || 'Production'}
                </h2>
                <p className="text-sm text-zinc-500 mt-0.5">
                  {isComplete ? 'Complete' : isRunning ? 'Rendering clips...' : failedClips > 0 ? 'Needs attention' : 'Ready'}
                </p>
              </div>
            </div>
            
            {/* Timer */}
            <div className="text-right">
              <p className="text-3xl sm:text-4xl font-mono font-bold text-white tracking-tighter">
                {formatTime(elapsedTime)}
              </p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] mt-1">Elapsed</p>
            </div>
          </div>
          
          {/* Progress Section */}
          <div className="space-y-3 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-zinc-400">
                  {completedClips} of {totalClips} clips
                </span>
                {generatingClips > 0 && (
                  <span className="text-xs text-amber-400/80 animate-pulse">
                    • {generatingClips} rendering
                  </span>
                )}
              </div>
              <span className={cn(
                "text-lg font-bold tracking-tight",
                progress >= 100 ? "text-emerald-400" : progress > 50 ? "text-white" : "text-cyan-400"
              )}>
                {Math.round(progress)}%
              </span>
            </div>
            
            {/* Premium Progress Bar */}
            <div className="h-2.5 rounded-full bg-zinc-800/80 overflow-hidden backdrop-blur-sm border border-white/[0.05]">
              <motion.div
                className={cn(
                  "h-full rounded-full relative",
                  progress >= 100 
                    ? "bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400" 
                    : "bg-gradient-to-r from-cyan-500 via-cyan-400 to-blue-400"
                )}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(progress, 100)}%` }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              >
                {/* Shimmer effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
              </motion.div>
            </div>
          </div>
          
          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <StatCard 
              icon={Film} 
              label="Clips"
              value={`${completedClips}/${totalClips}`}
              variant={completedClips === totalClips && totalClips > 0 ? 'success' : 'default'}
              glow={completedClips === totalClips && totalClips > 0}
            />
            <StatCard 
              icon={Clock} 
              label="Duration"
              value={`${estimatedDuration}s`}
              subValue={`${clipDuration}s each`}
              variant="default"
            />
            {generatingClips > 0 && (
              <StatCard 
                icon={Timer} 
                label="Est. Remaining"
                value={estimateRemainingTime(completedClips, totalClips, clipDuration)}
                variant="warning"
                pulse
              />
            )}
            {consistencyScore !== undefined && consistencyScore > 0 && (
              <StatCard 
                icon={Layers} 
                label="Consistency"
                value={`${Math.round(consistencyScore * 100)}%`}
                variant={consistencyScore >= 0.8 ? 'success' : consistencyScore >= 0.6 ? 'warning' : 'error'}
                glow={consistencyScore >= 0.8}
              />
            )}
            {avgTransitionScore !== undefined && (
              <StatCard 
                icon={ChevronRight} 
                label="Transitions"
                value={`${avgTransitionScore}%`}
                subValue={`${transitions!.length} cuts`}
                variant={avgTransitionScore >= 85 ? 'success' : avgTransitionScore >= 70 ? 'warning' : 'error'}
              />
            )}
            {failedClips > 0 && (
              <StatCard 
                icon={AlertTriangle} 
                label="Failed"
                value={failedClips}
                variant="error"
              />
            )}
          </div>
          
          {/* Clips Grid */}
          {clips.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Eye className="w-4 h-4 text-zinc-500" />
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Clip Status</span>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {clips.map((clip) => (
                  <ClipThumbnail
                    key={clip.index}
                    clip={clip}
                    onPlay={onPlayClip}
                    onRetry={onRetryClip}
                  />
                ))}
              </div>
            </div>
          )}
          
          {/* Action Buttons */}
          {!isComplete && !finalVideoUrl && (
            <div className="flex flex-wrap gap-3">
              {!isRunning && completedClips < totalClips && onResume && (
                <Button
                  onClick={onResume}
                  disabled={isResuming}
                  className={cn(
                    "relative overflow-hidden",
                    "bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400",
                    "text-white font-semibold shadow-lg shadow-cyan-500/25",
                    "transition-all duration-300"
                  )}
                >
                  {isResuming ? (
                    <RotateCcw className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <RotateCcw className="w-4 h-4 mr-2" />
                  )}
                  Resume Pipeline
                </Button>
              )}
              {completedClips === totalClips && completedClips > 0 && onStitch && (
                <Button
                  onClick={onStitch}
                  disabled={isStitching}
                  className={cn(
                    "relative overflow-hidden",
                    "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400",
                    "text-white font-semibold shadow-lg shadow-emerald-500/25",
                    "transition-all duration-300"
                  )}
                >
                  {isStitching ? (
                    <Sparkles className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Sparkles className="w-4 h-4 mr-2" />
                  )}
                  Stitch Final Video
                </Button>
              )}
            </div>
          )}
          
          {/* Final Video Badge */}
          {finalVideoUrl && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex"
            >
              <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-4 py-1.5 text-sm font-medium backdrop-blur-sm">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Video Ready
              </Badge>
            </motion.div>
          )}
        </div>
      </div>
      
      {/* Transition Timeline - Premium Design */}
      {hasTransitions && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={cn(
            "relative rounded-2xl overflow-hidden p-5",
            "bg-white/[0.02] backdrop-blur-xl border border-white/[0.06]"
          )}
        >
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-4 h-4 text-zinc-500" />
            <span className="text-sm font-semibold text-zinc-300">Transition Flow</span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-hide">
            {transitions.map((t, idx) => (
              <div key={idx} className="flex items-center">
                <div className={cn(
                  "w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold",
                  "bg-zinc-800/80 border border-zinc-700/50 text-zinc-400"
                )}>
                  {t.fromIndex + 1}
                </div>
                <div className="flex items-center mx-1.5">
                  <div className={cn(
                    "w-8 h-0.5 rounded-full",
                    t.overallScore >= 85 ? "bg-gradient-to-r from-emerald-500 to-emerald-400" :
                    t.overallScore >= 70 ? "bg-gradient-to-r from-amber-500 to-amber-400" : 
                    "bg-gradient-to-r from-rose-500 to-rose-400"
                  )} />
                  <span className={cn(
                    "text-[10px] font-bold ml-1",
                    t.overallScore >= 85 ? "text-emerald-400" :
                    t.overallScore >= 70 ? "text-amber-400" : "text-rose-400"
                  )}>
                    {t.overallScore}
                  </span>
                </div>
                {idx === transitions.length - 1 && (
                  <div className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold",
                    "bg-zinc-800/80 border border-zinc-700/50 text-zinc-400"
                  )}>
                    {t.toIndex + 1}
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
