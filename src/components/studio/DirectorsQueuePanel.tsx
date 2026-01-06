import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Film, 
  Loader2, 
  Check, 
  Play,
  Clock,
  ArrowRight,
  Download,
  Layers
} from 'lucide-react';
import { useProductionPipeline } from '@/contexts/ProductionPipelineContext';
import { cn } from '@/lib/utils';
import { useState } from 'react';

/**
 * DirectorsQueuePanel
 * 
 * Shows the status of each chained shot in a visual queue format.
 * Displays frame chaining status and shot transitions.
 */
export function DirectorsQueuePanel() {
  const { state } = useProductionPipeline();
  const { production, structuredShots } = state;
  
  const completedCount = production.shots.filter(s => s.status === 'completed').length;
  const generatingShot = production.shots.find(s => s.status === 'generating');
  const isGenerating = production.isGeneratingVideo;
  
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Layers className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h4 className="font-medium text-foreground">Director's Queue</h4>
            <p className="text-xs text-muted-foreground">
              {completedCount}/{structuredShots.length} shots chained
            </p>
          </div>
        </div>
        
        <Badge 
          variant={isGenerating ? 'default' : completedCount === structuredShots.length ? 'secondary' : 'outline'}
          className={cn(
            "gap-1",
            isGenerating && "animate-pulse"
          )}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              Chaining
            </>
          ) : completedCount === structuredShots.length ? (
            <>
              <Check className="w-3 h-3" />
              Complete
            </>
          ) : (
            <>
              <Clock className="w-3 h-3" />
              Pending
            </>
          )}
        </Badge>
      </div>
      
      <ScrollArea className="h-[300px]">
        <div className="space-y-2">
          {production.shots.map((shot, index) => {
            const isActive = generatingShot?.id === shot.id;
            const isCompleted = shot.status === 'completed';
            const isFailed = shot.status === 'failed';
            const hasChainedFrame = shot.endFrameUrl || (index === 0 && production.chainContext.previousFrameUrl);
            
            return (
              <div key={shot.id} className="relative">
                {/* Chain connector line */}
                {index > 0 && (
                  <div className={cn(
                    "absolute left-4 -top-2 w-0.5 h-2",
                    isCompleted || production.shots[index - 1]?.status === 'completed'
                      ? "bg-primary"
                      : "bg-border"
                  )} />
                )}
                
                <div className={cn(
                  "flex items-center gap-3 p-2 rounded-lg transition-all",
                  isActive && "bg-primary/10 ring-1 ring-primary",
                  isCompleted && "bg-success/5",
                  isFailed && "bg-destructive/5"
                )}>
                  {/* Status indicator */}
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                    isActive && "bg-primary text-primary-foreground",
                    isCompleted && "bg-green-600 text-white",
                    isFailed && "bg-destructive text-destructive-foreground",
                    !isActive && !isCompleted && !isFailed && "bg-muted text-muted-foreground"
                  )}>
                    {isActive ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : isCompleted ? (
                      <Check className="w-4 h-4" />
                    ) : isFailed ? (
                      <span className="text-xs">!</span>
                    ) : (
                      <span className="text-xs font-medium">{index + 1}</span>
                    )}
                  </div>
                  
                  {/* Shot info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{shot.title}</span>
                      {hasChainedFrame && isCompleted && (
                        <Badge variant="outline" className="text-[10px] gap-0.5 px-1 py-0">
                          <Film className="w-2.5 h-2.5" />
                          Chained
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {shot.durationSeconds}s • {shot.transitionOut || 'cut'}
                    </p>
                  </div>
                  
                  {/* Thumbnail preview */}
                  {shot.videoUrl && (
                    <div className="w-12 h-8 rounded overflow-hidden bg-muted shrink-0">
                      <video 
                        src={shot.videoUrl} 
                        className="w-full h-full object-cover"
                        muted
                      />
                    </div>
                  )}
                </div>
                
                {/* Transition arrow */}
                {index < production.shots.length - 1 && shot.transitionOut && (
                  <div className="flex items-center justify-center py-1">
                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
      
      {/* Frame chaining status */}
      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Frame Chaining</span>
          <Badge variant="outline" className="text-[10px]">
            {production.chainContext.previousFrameUrl ? 'Active' : 'Waiting'}
          </Badge>
        </div>
        <Progress 
          value={(completedCount / Math.max(structuredShots.length, 1)) * 100} 
          className="h-1.5 mt-2" 
        />
      </div>
    </Card>
  );
}

/**
 * VideoStitcherPanel
 * 
 * Final step: merge all clips into a seamless production with synchronized audio.
 */
export function VideoStitcherPanel() {
  const { state, stitchFinalVideo } = useProductionPipeline();
  const [isStitching, setIsStitching] = useState(false);
  
  const completedCount = state.production.shots.filter(s => s.status === 'completed').length;
  const totalDuration = state.production.shots
    .filter(s => s.status === 'completed')
    .reduce((sum, s) => sum + s.durationSeconds, 0);
  
  const canStitch = completedCount > 1;
  
  const handleStitch = async () => {
    setIsStitching(true);
    try {
      await stitchFinalVideo();
    } finally {
      setIsStitching(false);
    }
  };
  
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Film className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h4 className="font-medium text-foreground">Final Stitcher</h4>
          <p className="text-xs text-muted-foreground">
            Merge clips into seamless production
          </p>
        </div>
      </div>
      
      <div className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-muted/50 rounded-lg text-center">
            <span className="text-2xl font-bold text-foreground">{completedCount}</span>
            <p className="text-xs text-muted-foreground">Clips Ready</p>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg text-center">
            <span className="text-2xl font-bold text-foreground">{totalDuration}s</span>
            <p className="text-xs text-muted-foreground">Total Duration</p>
          </div>
        </div>
        
        {/* Final video preview */}
        {state.finalVideoUrl && (
          <div className="aspect-video rounded-lg overflow-hidden bg-muted">
            <video 
              src={state.finalVideoUrl}
              className="w-full h-full object-cover"
              controls
            />
          </div>
        )}
        
        {/* Stitch button */}
        <Button
          onClick={handleStitch}
          disabled={!canStitch || isStitching}
          className="w-full gap-2"
        >
          {isStitching ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Stitching...
            </>
          ) : state.finalVideoUrl ? (
            <>
              <Download className="w-4 h-4" />
              Download Final Video
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Stitch {completedCount} Clips
            </>
          )}
        </Button>
        
        {!canStitch && (
          <p className="text-xs text-center text-muted-foreground">
            Need at least 2 completed clips to stitch
          </p>
        )}
      </div>
    </Card>
  );
}
