import { motion } from 'framer-motion';
import { Play, CheckCircle2, Loader2, RefreshCw, Film, Sparkles, ChevronRight } from 'lucide-react';
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

  return (
    <div className="bg-zinc-800/50 rounded-lg border border-zinc-700/30">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-700/30">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-violet-500/15 flex items-center justify-center">
            <Film className="w-3.5 h-3.5 text-violet-400" />
          </div>
          <div>
            <span className="text-xs font-medium text-zinc-200">Clips</span>
            <span className="text-[10px] text-zinc-500 ml-1.5">{completedClips}/{clips.length || expectedClipCount}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {completedClips > 0 && !finalVideoUrl && (
            <Button 
              size="sm" 
              className="h-7 text-[11px] gap-1 bg-zinc-700 hover:bg-zinc-600 text-zinc-200"
              onClick={onStitch}
              disabled={isSimpleStitching}
            >
              {isSimpleStitching ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3" />
              )}
              Stitch
            </Button>
          )}
          {completedClips > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 text-[11px] text-zinc-500 hover:text-zinc-300 gap-0.5"
              onClick={onViewAll}
            >
              All <ChevronRight className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>
      <div className="p-3">
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2">
          {clips.map((clip, index) => {
            const isCompleted = clip.status === 'completed';
            const isGenerating = clip.status === 'generating';
            const isFailed = clip.status === 'failed';
            const isRetrying = retryingIndex === index;

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.015 }}
              >
                <div
                  className={cn(
                    "relative aspect-video rounded overflow-hidden cursor-pointer group transition-all duration-150",
                    isCompleted && "ring-1 ring-emerald-500/30 hover:ring-emerald-500/60",
                    isGenerating && "ring-1 ring-sky-500/30",
                    isFailed && "ring-1 ring-rose-500/30 hover:ring-rose-500/60",
                    !isCompleted && !isGenerating && !isFailed && "ring-1 ring-zinc-700/50"
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
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center">
                        <Play className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="currentColor" />
                      </div>
                      <CheckCircle2 className="absolute top-0.5 right-0.5 w-3 h-3 text-emerald-400" />
                    </>
                  ) : isGenerating ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-sky-500/10">
                      <Loader2 className="w-4 h-4 text-sky-400 animate-spin" />
                    </div>
                  ) : isFailed ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-rose-500/10">
                      {isRetrying ? (
                        <Loader2 className="w-4 h-4 text-rose-400 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4 text-rose-400" />
                      )}
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
                      <span className="text-[10px] font-medium text-zinc-500">{index + 1}</span>
                    </div>
                  )}
                  
                  {/* Clip index badge - only show on completed/generating/failed clips */}
                  {(isCompleted || isGenerating || isFailed) && (
                    <div className="absolute bottom-0.5 left-0.5 px-1 py-0.5 rounded-sm bg-black/70 text-[8px] font-medium text-zinc-300 leading-none">
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
  );
}
