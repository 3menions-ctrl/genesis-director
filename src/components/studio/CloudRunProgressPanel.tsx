import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { 
  Cloud, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  RefreshCw,
  Activity,
  Film,
  Music,
  Palette,
  Scissors,
  Upload,
  Clock
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface PendingVideoTasks {
  stage?: string;
  progress?: number;
  error?: string | null;
  lastUpdated?: string;
  stitchingStarted?: string;
  expectedCompletionTime?: string;
  retryScheduled?: boolean;
  retryAttempt?: number;
  retryAfter?: string;
  currentStep?: string;
}

interface CloudRunProgressPanelProps {
  projectId: string;
  projectStatus: string;
  onComplete?: (videoUrl: string) => void;
}

const STAGE_CONFIG: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  'health_check': { icon: Activity, label: 'Checking Cloud Run Health', color: 'text-blue-500' },
  'stitching': { icon: Film, label: 'Stitching Video Clips', color: 'text-purple-500' },
  'processing_async': { icon: Cloud, label: 'Processing in Cloud Run', color: 'text-cyan-500' },
  'downloading_clips': { icon: Loader2, label: 'Downloading Clips', color: 'text-yellow-500' },
  'normalizing': { icon: Scissors, label: 'Normalizing Video', color: 'text-orange-500' },
  'crossfading': { icon: Film, label: 'Applying Transitions', color: 'text-pink-500' },
  'color_grading': { icon: Palette, label: 'Color Grading', color: 'text-violet-500' },
  'audio_mixing': { icon: Music, label: 'Mixing Audio', color: 'text-green-500' },
  'uploading': { icon: Upload, label: 'Uploading Final Video', color: 'text-blue-500' },
  'creating_manifest': { icon: Film, label: 'Creating Manifest', color: 'text-gray-500' },
  'fallback_mvp': { icon: AlertTriangle, label: 'Using Fallback Mode', color: 'text-amber-500' },
  'stitching_retry_scheduled': { icon: RefreshCw, label: 'Retry Scheduled', color: 'text-orange-500' },
  'complete': { icon: CheckCircle2, label: 'Complete', color: 'text-green-500' },
  'error': { icon: XCircle, label: 'Error', color: 'text-red-500' },
};

export function CloudRunProgressPanel({ 
  projectId, 
  projectStatus,
  onComplete 
}: CloudRunProgressPanelProps) {
  const [tasks, setTasks] = useState<PendingVideoTasks | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [logs, setLogs] = useState<{ time: string; message: string; type: 'info' | 'success' | 'error' | 'warning' }[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!projectId) return;

    // Initial fetch
    const fetchInitial = async () => {
      const { data } = await supabase
        .from('movie_projects')
        .select('pending_video_tasks, video_url, status')
        .eq('id', projectId)
        .single();
      
      if (data) {
        const pendingTasks = data.pending_video_tasks as PendingVideoTasks | null;
        setTasks(pendingTasks);
        setVideoUrl(data.video_url);
        
        if (data.video_url && data.status === 'completed') {
          onComplete?.(data.video_url);
        }
      }
    };

    fetchInitial();

    // Subscribe to changes
    const channel = supabase
      .channel(`cloud-run-progress-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'movie_projects',
          filter: `id=eq.${projectId}`,
        },
        (payload) => {
          console.log('[CloudRunProgress] Realtime update:', payload);
          
          const newData = payload.new as any;
          const pendingTasks = newData.pending_video_tasks as PendingVideoTasks | null;
          
          // Add log entry
          if (pendingTasks?.stage) {
            const stageConfig = STAGE_CONFIG[pendingTasks.stage] || { label: pendingTasks.stage };
            const logType = pendingTasks.stage === 'error' ? 'error' 
              : pendingTasks.stage === 'complete' ? 'success'
              : pendingTasks.stage.includes('retry') ? 'warning'
              : 'info';
            
            setLogs(prev => [
              ...prev.slice(-20), // Keep last 20 logs
              {
                time: new Date().toLocaleTimeString(),
                message: `${stageConfig.label}${pendingTasks.progress ? ` (${pendingTasks.progress}%)` : ''}`,
                type: logType,
              }
            ]);
          }
          
          setTasks(pendingTasks);
          
          if (newData.video_url) {
            setVideoUrl(newData.video_url);
          }
          
          if (newData.video_url && newData.status === 'completed') {
            onComplete?.(newData.video_url);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, onComplete]);

  // Don't show if not in a stitching state
  const isStitchingState = ['stitching', 'post_production', 'processing'].includes(projectStatus);
  const hasActiveTask = tasks?.stage && !['complete', 'error'].includes(tasks.stage);
  
  if (!isStitchingState && !hasActiveTask && !tasks?.error) {
    return null;
  }

  const currentStage = tasks?.stage || 'stitching';
  const stageConfig = STAGE_CONFIG[currentStage] || { 
    icon: Cloud, 
    label: currentStage.replace(/_/g, ' '), 
    color: 'text-muted-foreground' 
  };
  const StageIcon = stageConfig.icon;
  const progress = tasks?.progress || 0;

  // Calculate elapsed time
  const startTime = tasks?.stitchingStarted ? new Date(tasks.stitchingStarted) : null;
  const elapsedMs = startTime ? Date.now() - startTime.getTime() : 0;
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  const elapsedDisplay = elapsedMinutes > 0 
    ? `${elapsedMinutes}m ${elapsedSeconds % 60}s`
    : `${elapsedSeconds}s`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-lg overflow-hidden"
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-full bg-muted", stageConfig.color)}>
            <StageIcon className={cn(
              "h-4 w-4",
              hasActiveTask && "animate-spin"
            )} />
          </div>
          <div className="text-left">
            <h3 className="font-medium text-sm">Cloud Run Stitcher</h3>
            <p className="text-xs text-muted-foreground">{stageConfig.label}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {startTime && hasActiveTask && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {elapsedDisplay}
            </div>
          )}
          
          <Badge 
            variant={
              currentStage === 'error' ? 'destructive' 
              : currentStage === 'complete' ? 'default'
              : 'secondary'
            }
          >
            {progress}%
          </Badge>
        </div>
      </button>

      {/* Progress Bar */}
      <div className="px-4 pb-2">
        <Progress 
          value={progress} 
          className={cn(
            "h-2",
            currentStage === 'error' && "bg-destructive/20"
          )}
        />
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">
              {/* Error Display */}
              {tasks?.error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                  <div className="flex items-start gap-2">
                    <XCircle className="h-4 w-4 text-destructive mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-destructive">Error</p>
                      <p className="text-xs text-muted-foreground mt-1">{tasks.error}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Retry Info */}
              {tasks?.retryScheduled && tasks.retryAfter && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-md">
                  <div className="flex items-start gap-2">
                    <RefreshCw className="h-4 w-4 text-amber-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                        Retry #{tasks.retryAttempt} Scheduled
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Will retry at {new Date(tasks.retryAfter).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Activity Log */}
              {logs.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Activity Log</p>
                  <ScrollArea className="h-32 rounded-md border bg-muted/30">
                    <div className="p-2 space-y-1">
                      {logs.map((log, i) => (
                        <div 
                          key={i}
                          className={cn(
                            "flex items-center gap-2 text-xs font-mono",
                            log.type === 'error' && "text-destructive",
                            log.type === 'success' && "text-green-600 dark:text-green-400",
                            log.type === 'warning' && "text-amber-600 dark:text-amber-400",
                            log.type === 'info' && "text-muted-foreground"
                          )}
                        >
                          <span className="text-muted-foreground/70">[{log.time}]</span>
                          <span>{log.message}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Video Ready */}
              {videoUrl && currentStage === 'complete' && (
                <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-md">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">
                      Video Ready!
                    </p>
                  </div>
                </div>
              )}

              {/* Stage Pipeline */}
              <div className="flex items-center gap-1 flex-wrap">
                {Object.entries(STAGE_CONFIG).slice(0, 8).map(([stage, config]) => {
                  const Icon = config.icon;
                  const isActive = stage === currentStage;
                  const isPast = getStageIndex(currentStage) > getStageIndex(stage);
                  
                  return (
                    <div 
                      key={stage}
                      className={cn(
                        "flex items-center gap-1 px-2 py-1 rounded text-xs",
                        isActive && "bg-primary/10 text-primary",
                        isPast && "text-green-600 dark:text-green-400",
                        !isActive && !isPast && "text-muted-foreground/50"
                      )}
                    >
                      <Icon className="h-3 w-3" />
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Helper to determine stage order
function getStageIndex(stage: string): number {
  const stages = [
    'health_check', 'stitching', 'processing_async', 'downloading_clips',
    'normalizing', 'crossfading', 'color_grading', 'audio_mixing',
    'uploading', 'complete'
  ];
  return stages.indexOf(stage);
}
