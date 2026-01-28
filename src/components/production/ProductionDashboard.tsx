import { motion } from 'framer-motion';
import { 
  Film, Clock, Zap, CheckCircle2, AlertTriangle, Play, 
  RotateCcw, Sparkles, Layers, ChevronRight, Eye
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
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
  // Core data
  projectTitle: string;
  progress: number;
  elapsedTime: number;
  isRunning: boolean;
  isComplete: boolean;
  
  // Clips
  clips: ClipData[];
  totalClips: number;
  completedClips: number;
  
  // Consistency (real data only)
  consistencyScore?: number;
  transitions?: TransitionData[];
  
  // Actions
  onPlayClip?: (url: string) => void;
  onRetryClip?: (index: number) => void;
  onStitch?: () => void;
  onResume?: () => void;
  
  // State flags
  isStitching?: boolean;
  isResuming?: boolean;
  finalVideoUrl?: string;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  subValue,
  color = 'zinc',
  pulse = false 
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subValue?: string;
  color?: 'zinc' | 'emerald' | 'amber' | 'rose' | 'primary';
  pulse?: boolean;
}) {
  const colorMap = {
    zinc: 'text-zinc-400 bg-zinc-500/10',
    emerald: 'text-emerald-400 bg-emerald-500/10',
    amber: 'text-amber-400 bg-amber-500/10',
    rose: 'text-rose-400 bg-rose-500/10',
    primary: 'text-primary bg-primary/10',
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
      <div className={cn(
        "w-10 h-10 rounded-lg flex items-center justify-center",
        colorMap[color].split(' ')[1]
      )}>
        <Icon className={cn(
          "w-5 h-5",
          colorMap[color].split(' ')[0],
          pulse && "animate-pulse"
        )} />
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</p>
        <p className={cn("text-lg font-semibold", colorMap[color].split(' ')[0])}>
          {value}
          {subValue && <span className="text-xs text-zinc-500 ml-1">{subValue}</span>}
        </p>
      </div>
    </div>
  );
}

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
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
              "relative w-14 h-14 rounded-lg overflow-hidden cursor-pointer transition-all",
              "border-2",
              clip.status === 'completed' && "border-emerald-500/50 hover:border-emerald-400",
              clip.status === 'generating' && "border-amber-500/50 animate-pulse",
              clip.status === 'failed' && "border-rose-500/50 hover:border-rose-400",
              clip.status === 'pending' && "border-zinc-700 opacity-50"
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
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80">
              <span className={cn(
                "text-sm font-bold",
                clip.status === 'completed' && "text-emerald-400",
                clip.status === 'generating' && "text-amber-400",
                clip.status === 'failed' && "text-rose-400",
                clip.status === 'pending' && "text-zinc-600"
              )}>
                {clip.index + 1}
              </span>
            </div>
            
            {/* Status overlay */}
            <div className="absolute bottom-0 left-0 right-0 h-1">
              {clip.status === 'completed' && <div className="h-full bg-emerald-500" />}
              {clip.status === 'generating' && (
                <motion.div 
                  className="h-full bg-amber-500"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
              )}
              {clip.status === 'failed' && <div className="h-full bg-rose-500" />}
            </div>
            
            {/* Play icon for completed */}
            {clip.status === 'completed' && (
              <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/50">
                <Play className="w-4 h-4 text-white" />
              </div>
            )}
            
            {/* Retry icon for failed */}
            {clip.status === 'failed' && (
              <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/50">
                <RotateCcw className={cn("w-4 h-4 text-white", isRetrying && "animate-spin")} />
              </div>
            )}
          </motion.div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">
            Clip {clip.index + 1} • {clip.status.charAt(0).toUpperCase() + clip.status.slice(1)}
            {clip.error && <span className="block text-rose-400 text-[10px] mt-0.5">{clip.error}</span>}
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
}: ProductionDashboardProps) {
  const failedClips = clips.filter(c => c.status === 'failed').length;
  const generatingClips = clips.filter(c => c.status === 'generating').length;
  const hasTransitions = transitions && transitions.length > 0;
  const avgTransitionScore = hasTransitions 
    ? Math.round(transitions.reduce((acc, t) => acc + t.overallScore, 0) / transitions.length)
    : undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Main Progress Card */}
      <div className={cn(
        "relative rounded-2xl overflow-hidden",
        "bg-gradient-to-br from-zinc-900/90 via-zinc-900/70 to-zinc-900/90",
        "border border-white/[0.06] backdrop-blur-xl",
        "shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
      )}>
        {/* Ambient glow */}
        <div className={cn(
          "absolute inset-0 pointer-events-none",
          isComplete && "bg-gradient-to-br from-emerald-500/10 via-transparent to-emerald-500/5",
          isRunning && !isComplete && "bg-gradient-to-br from-primary/10 via-transparent to-amber-500/5",
          !isRunning && !isComplete && "bg-gradient-to-br from-zinc-500/5 via-transparent to-zinc-500/5"
        )} />
        
        <div className="relative p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center",
                isComplete ? "bg-emerald-500/20" : isRunning ? "bg-primary/20" : "bg-zinc-800"
              )}>
                {isComplete ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <Film className={cn("w-5 h-5", isRunning ? "text-primary" : "text-zinc-400")} />
                )}
              </div>
              <div>
                <h2 className="text-base font-semibold text-white truncate max-w-[200px] sm:max-w-none">
                  {projectTitle || 'Production'}
                </h2>
                <p className="text-xs text-zinc-500">
                  {isComplete ? 'Complete' : isRunning ? 'In Progress' : 'Paused'}
                </p>
              </div>
            </div>
            
            {/* Time */}
            <div className="text-right">
              <p className="text-2xl font-mono font-bold text-white">{formatTime(elapsedTime)}</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Elapsed</p>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="space-y-2 mb-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">{completedClips} of {totalClips} clips</span>
              <span className={cn(
                "text-sm font-bold",
                progress >= 100 ? "text-emerald-400" : progress > 50 ? "text-amber-400" : "text-primary"
              )}>
                {Math.round(progress)}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
              <motion.div
                className={cn(
                  "h-full rounded-full",
                  progress >= 100 ? "bg-gradient-to-r from-emerald-500 to-emerald-400" : 
                  "bg-gradient-to-r from-primary to-amber-500"
                )}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
          
          {/* Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <StatCard 
              icon={Film} 
              label="Clips" 
              value={`${completedClips}/${totalClips}`}
              color={completedClips === totalClips ? 'emerald' : 'zinc'}
            />
            <StatCard 
              icon={Clock} 
              label="Est. Duration" 
              value={`${totalClips * 5}s`}
              color="zinc"
            />
            {consistencyScore !== undefined && consistencyScore > 0 && (
              <StatCard 
                icon={Layers} 
                label="Consistency" 
                value={`${Math.round(consistencyScore * 100)}%`}
                color={consistencyScore >= 0.8 ? 'emerald' : consistencyScore >= 0.6 ? 'amber' : 'rose'}
              />
            )}
            {avgTransitionScore !== undefined && (
              <StatCard 
                icon={ChevronRight} 
                label="Transitions" 
                value={`${avgTransitionScore}%`}
                subValue={`${transitions!.length} cuts`}
                color={avgTransitionScore >= 85 ? 'emerald' : avgTransitionScore >= 70 ? 'amber' : 'rose'}
              />
            )}
            {generatingClips > 0 && (
              <StatCard 
                icon={Zap} 
                label="Generating" 
                value={generatingClips}
                color="amber"
                pulse
              />
            )}
            {failedClips > 0 && (
              <StatCard 
                icon={AlertTriangle} 
                label="Failed" 
                value={failedClips}
                color="rose"
              />
            )}
          </div>
          
          {/* Clips Grid */}
          {clips.length > 0 && (
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-3">
                <Eye className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-xs font-medium text-zinc-400">Clip Status</span>
              </div>
              <div className="flex flex-wrap gap-2">
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
            <div className="flex flex-wrap gap-2">
              {!isRunning && completedClips < totalClips && onResume && (
                <Button
                  onClick={onResume}
                  disabled={isResuming}
                  className="bg-primary hover:bg-primary/90"
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
                  className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
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
            <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Video Ready
            </Badge>
          )}
        </div>
      </div>
      
      {/* Transition Timeline (only if real data exists) */}
      {hasTransitions && (
        <div className={cn(
          "relative rounded-xl overflow-hidden p-4",
          "bg-white/[0.02] border border-white/[0.06]"
        )}>
          <div className="flex items-center gap-2 mb-3">
            <Layers className="w-4 h-4 text-zinc-500" />
            <span className="text-sm font-medium text-zinc-300">Transition Flow</span>
          </div>
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {transitions.map((t, idx) => (
              <div key={idx} className="flex items-center">
                <div className={cn(
                  "w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold",
                  "bg-zinc-800 border border-zinc-700 text-zinc-400"
                )}>
                  {t.fromIndex + 1}
                </div>
                <div className="flex items-center mx-1">
                  <div className={cn(
                    "w-6 h-0.5 rounded-full",
                    t.overallScore >= 85 ? "bg-emerald-500" :
                    t.overallScore >= 70 ? "bg-amber-500" : "bg-rose-500"
                  )} />
                  <span className={cn(
                    "text-[9px] font-bold ml-0.5",
                    t.overallScore >= 85 ? "text-emerald-400" :
                    t.overallScore >= 70 ? "text-amber-400" : "text-rose-400"
                  )}>
                    {t.overallScore}
                  </span>
                </div>
                {idx === transitions.length - 1 && (
                  <div className={cn(
                    "w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold",
                    "bg-zinc-800 border border-zinc-700 text-zinc-400"
                  )}>
                    {t.toIndex + 1}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
