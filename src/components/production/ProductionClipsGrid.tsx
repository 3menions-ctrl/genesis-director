import { motion } from 'framer-motion';
import { Play, CheckCircle2, Loader2, RefreshCw, Film, Sparkles, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MotionVectorsDisplay } from '@/components/studio/MotionVectorsDisplay';
import { cn } from '@/lib/utils';

interface ClipResult {
  index: number;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  videoUrl?: string;
  error?: string;
  id?: string;
  motionVectors?: {
    subjectVelocity?: { x: number; y: number; magnitude: number };
    cameraMovement?: { type: string; direction: string; speed: number };
    motionBlur?: number;
    dominantDirection?: string;
  };
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
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Film className="w-4 h-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm">Video Clips</CardTitle>
              <p className="text-xs text-muted-foreground">{completedClips} of {clips.length || expectedClipCount} ready</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {completedClips > 0 && !finalVideoUrl && (
              <Button 
                size="sm" 
                className="h-8 text-xs gap-1.5"
                onClick={onStitch}
                disabled={isSimpleStitching}
              >
                {isSimpleStitching ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                Stitch Video
              </Button>
            )}
            {completedClips > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1"
                onClick={onViewAll}
              >
                View All <ChevronRight className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
          {clips.map((clip, index) => {
            const isCompleted = clip.status === 'completed';
            const isGenerating = clip.status === 'generating';
            const isFailed = clip.status === 'failed';
            const isRetrying = retryingIndex === index;
            const hasMotionVectors = isCompleted && clip.motionVectors;

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.02 }}
                className="flex flex-col gap-1"
              >
                <div
                  className={cn(
                    "relative aspect-video rounded-lg overflow-hidden cursor-pointer group transition-all duration-200",
                    isCompleted && "ring-1 ring-success/30 hover:ring-success/50 hover:scale-[1.02]",
                    isGenerating && "ring-1 ring-primary/20",
                    isFailed && "ring-1 ring-destructive/30 hover:ring-destructive/50",
                    !isCompleted && !isGenerating && !isFailed && "ring-1 ring-border"
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
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                        <Play className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="currentColor" />
                      </div>
                      <CheckCircle2 className="absolute top-1 right-1 w-4 h-4 text-success" />
                    </>
                  ) : isGenerating ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-primary/5">
                      <Loader2 className="w-5 h-5 text-primary animate-spin" />
                    </div>
                  ) : isFailed ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-destructive/5">
                      {isRetrying ? (
                        <Loader2 className="w-5 h-5 text-destructive animate-spin" />
                      ) : (
                        <RefreshCw className="w-5 h-5 text-destructive" />
                      )}
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-muted">
                      <span className="text-sm font-medium text-muted-foreground">{index + 1}</span>
                    </div>
                  )}
                  
                  <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-background/80 text-[10px] font-bold text-foreground">
                    {index + 1}
                  </div>
                </div>
                
                {/* Motion Vectors */}
                {hasMotionVectors && (
                  <MotionVectorsDisplay 
                    motionVectors={clip.motionVectors}
                    shotIndex={clip.index}
                    className="text-[10px]"
                  />
                )}
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}