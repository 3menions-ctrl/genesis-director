import { motion } from 'framer-motion';
import { Play, CheckCircle2, Loader2, RefreshCw, Film, Sparkles, ChevronRight, Grid3X3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ClipResult {
  index: number;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  videoUrl?: string;
  error?: string;
  id?: string;
}

interface ProductionClipsGridProps {
  clips: ClipResult[];
  completedClips: number;
  expectedClipCount: number;
  projectId: string | null;
  finalVideoUrl: string | null;
  isSimpleStitching: boolean;
  retryingIndex: number | null;
  onPlay: (url: string) => void;
  onRetry: (index: number) => void;
  onStitch: () => void;
  onViewAll: () => void;
}

export function ProductionClipsGrid({
  clips,
  completedClips,
  expectedClipCount,
  projectId,
  finalVideoUrl,
  isSimpleStitching,
  retryingIndex,
  onPlay,
  onRetry,
  onStitch,
  onViewAll,
}: ProductionClipsGridProps) {
  if (clips.length === 0) return null;

  const progressPercent = (completedClips / (clips.length || expectedClipCount)) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative group"
    >
      {/* Container with glass effect */}
      <div className={cn(
        "relative overflow-hidden rounded-2xl",
        "bg-gradient-to-br from-white/[0.04] to-white/[0.01]",
        "border border-white/[0.08]",
        "backdrop-blur-xl"
      )}>
        {/* Ambient glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        
        {/* Header */}
        <div className="relative flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/10 border border-violet-500/20 flex items-center justify-center">
              <Grid3X3 className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Video Clips</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] text-zinc-500">{completedClips} of {clips.length || expectedClipCount} ready</span>
                <div className="w-16 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-violet-500 to-purple-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {completedClips > 0 && !finalVideoUrl && (
              <Button 
                size="sm" 
                className={cn(
                  "h-8 text-xs gap-1.5 rounded-lg",
                  "bg-gradient-to-r from-violet-500/20 to-purple-500/20",
                  "border border-violet-500/30",
                  "text-violet-300 hover:text-white",
                  "hover:from-violet-500/30 hover:to-purple-500/30",
                  "transition-all duration-200"
                )}
                onClick={onStitch}
                disabled={isSimpleStitching}
              >
                {isSimpleStitching ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                Stitch Video
              </Button>
            )}
            {completedClips > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 text-xs text-zinc-500 hover:text-white gap-1 rounded-lg"
                onClick={onViewAll}
              >
                View All <ChevronRight className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
        
        {/* Clips Grid */}
        <div className="relative p-4">
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
            {clips.map((clip, index) => {
              const isCompleted = clip.status === 'completed';
              const isGenerating = clip.status === 'generating';
              const isFailed = clip.status === 'failed';
              const isRetrying = retryingIndex === index;

              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.02, duration: 0.3 }}
                  className="relative"
                >
                  <div
                    className={cn(
                      "relative aspect-video rounded-lg overflow-hidden cursor-pointer group/clip",
                      "border transition-all duration-200",
                      isCompleted && "border-emerald-500/30 hover:border-emerald-500/60 hover:shadow-lg hover:shadow-emerald-500/10",
                      isGenerating && "border-sky-500/30",
                      isFailed && "border-rose-500/30 hover:border-rose-500/60",
                      !isCompleted && !isGenerating && !isFailed && "border-white/[0.06] bg-white/[0.02]"
                    )}
                    onClick={() => {
                      if (isCompleted && clip.videoUrl) onPlay(clip.videoUrl);
                      else if (isFailed) onRetry(index);
                    }}
                  >
                    {isCompleted && clip.videoUrl ? (
                      <>
                        <video
                          src={clip.videoUrl}
                          className="w-full h-full object-cover"
                          muted
                          preload="metadata"
                          onLoadedData={(e) => { (e.target as HTMLVideoElement).currentTime = 1; }}
                        />
                        {/* Hover overlay with play button */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover/clip:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                            <Play className="w-4 h-4 text-white" fill="currentColor" />
                          </div>
                        </div>
                        {/* Success indicator */}
                        <div className="absolute top-1 right-1">
                          <div className="w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                          </div>
                        </div>
                      </>
                    ) : isGenerating ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-sky-500/10 to-blue-500/5">
                        <Loader2 className="w-5 h-5 text-sky-400 animate-spin" />
                        <span className="text-[9px] text-sky-400/70 mt-1 font-medium">Rendering</span>
                      </div>
                    ) : isFailed ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-rose-500/10 to-red-500/5">
                        {isRetrying ? (
                          <Loader2 className="w-5 h-5 text-rose-400 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4 text-rose-400 group-hover/clip:scale-110 transition-transform" />
                        )}
                        <span className="text-[9px] text-rose-400/70 mt-1 font-medium">
                          {isRetrying ? 'Retrying' : 'Retry'}
                        </span>
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm font-semibold text-zinc-600">{index + 1}</span>
                      </div>
                    )}
                    
                    {/* Clip index badge */}
                    {(isCompleted || isGenerating || isFailed) && (
                      <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm text-[9px] font-semibold text-white/80 leading-none">
                        {index + 1}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
