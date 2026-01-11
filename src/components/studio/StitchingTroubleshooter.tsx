import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Server,
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Zap,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Play,
  Clock,
  Wifi,
  WifiOff,
  Activity,
  Terminal,
  Download,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface StitchingTroubleshooterProps {
  projectId: string;
  projectStatus: string;
  completedClips: number;
  totalClips: number;
  onStitchComplete?: (videoUrl: string) => void;
  onStatusChange?: (status: string) => void;
}

interface HealthStatus {
  cloudRun: 'unknown' | 'checking' | 'healthy' | 'unhealthy';
  latencyMs?: number;
  lastChecked?: Date;
  error?: string;
}

interface StitchLog {
  time: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export function StitchingTroubleshooter({
  projectId,
  projectStatus,
  completedClips,
  totalClips,
  onStitchComplete,
  onStatusChange,
}: StitchingTroubleshooterProps) {
  const { user } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [health, setHealth] = useState<HealthStatus>({ cloudRun: 'unknown' });
  const [isChecking, setIsChecking] = useState(false);
  const [isStitching, setIsStitching] = useState(false);
  const [stitchMode, setStitchMode] = useState<'simple' | 'cloud' | null>(null);
  const [logs, setLogs] = useState<StitchLog[]>([]);
  const [progress, setProgress] = useState(0);

  const addLog = useCallback((message: string, type: StitchLog['type'] = 'info') => {
    const time = new Date().toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
    setLogs(prev => [...prev, { time, message, type }].slice(-30));
  }, []);

  // Check Cloud Run health
  const checkHealth = useCallback(async () => {
    setIsChecking(true);
    setHealth(prev => ({ ...prev, cloudRun: 'checking' }));
    addLog('Checking Cloud Run health...', 'info');

    try {
      const { data, error } = await supabase.functions.invoke('health-check-stitcher', {
        body: {},
      });

      if (error) throw error;

      if (data?.healthy) {
        setHealth({
          cloudRun: 'healthy',
          latencyMs: data.latencyMs,
          lastChecked: new Date(),
        });
        addLog(`Cloud Run healthy (${data.latencyMs}ms latency)`, 'success');
      } else {
        setHealth({
          cloudRun: 'unhealthy',
          error: data?.error || 'Unknown error',
          lastChecked: new Date(),
        });
        addLog(`Cloud Run unhealthy: ${data?.error}`, 'warning');
      }
    } catch (err) {
      setHealth({
        cloudRun: 'unhealthy',
        error: err instanceof Error ? err.message : 'Health check failed',
        lastChecked: new Date(),
      });
      addLog(`Health check failed: ${err instanceof Error ? err.message : 'Unknown'}`, 'error');
    } finally {
      setIsChecking(false);
    }
  }, [addLog]);

  // Auto-stitch (recommended - uses auto-stitch-trigger)
  const handleAutoStitch = useCallback(async () => {
    if (!user || isStitching) return;

    setIsStitching(true);
    setStitchMode('simple');
    setProgress(5);
    addLog('🎬 Starting auto-stitch...', 'info');
    toast.info('Starting auto-stitch...', { description: 'Automatically selecting the best stitching method' });

    try {
      setProgress(10);
      addLog('Invoking auto-stitch-trigger...', 'info');

      const { data, error } = await supabase.functions.invoke('auto-stitch-trigger', {
        body: { projectId, userId: user.id, forceStitch: true },
      });

      if (error) throw error;

      setProgress(50);
      addLog(`Response mode: ${data?.stitchMode || 'unknown'}`, 'info');

      if (data?.success) {
        if (data.stitchResult?.finalVideoUrl || data.finalVideoUrl) {
          const videoUrl = data.stitchResult?.finalVideoUrl || data.finalVideoUrl;
          setProgress(100);
          addLog(`✅ Stitch complete! Video ready.`, 'success');
          toast.success('Video stitched successfully!');
          onStitchComplete?.(videoUrl);
          onStatusChange?.('completed');
        } else if (data.stitchMode?.includes('async')) {
          setProgress(75);
          addLog('Cloud Run processing async. Check status in 1-2 minutes.', 'info');
          toast.info('Processing...', { description: 'Cloud Run is stitching. This may take a few minutes.' });
          onStatusChange?.('stitching');
        } else {
          setProgress(60);
          addLog(`Stitch initiated: ${data.stitchMode || 'processing'}`, 'info');
          onStatusChange?.('stitching');
        }
      } else if (data?.skipped) {
        addLog(`Skipped: ${data.reason}`, 'info');
      } else {
        throw new Error(data?.error || 'Auto-stitch failed');
      }
    } catch (err) {
      addLog(`Auto-stitch failed: ${err instanceof Error ? err.message : 'Unknown'}`, 'error');
      toast.error('Auto-stitch failed', { description: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setIsStitching(false);
      setStitchMode(null);
    }
  }, [user, projectId, isStitching, addLog, onStitchComplete, onStatusChange]);

  // Simple stitch (reliable fallback)
  const handleCloudStitch = useCallback(async () => {
    if (!user || isStitching) return;

    setIsStitching(true);
    setStitchMode('cloud');
    setProgress(5);
    addLog('Starting Cloud Run stitch...', 'info');

    try {
      // Get clips
      const { data: clips, error: clipsError } = await supabase
        .from('video_clips')
        .select('id, shot_index, video_url, duration_seconds')
        .eq('project_id', projectId)
        .eq('status', 'completed')
        .order('shot_index');

      if (clipsError) throw clipsError;
      if (!clips || clips.length === 0) throw new Error('No completed clips');

      setProgress(15);
      addLog(`Found ${clips.length} clips`, 'info');

      // Verify session before querying
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        addLog('No valid session', 'error');
        setIsStitching(false);
        return;
      }

      // Get project
      const { data: project } = await supabase
        .from('movie_projects')
        .select('title')
        .eq('id', projectId)
        .single();

      setProgress(20);

      const { data, error } = await supabase.functions.invoke('stitch-video', {
        body: {
          projectId,
          projectTitle: project?.title || 'Video',
          clips: clips.map(clip => ({
            shotId: clip.id,
            videoUrl: clip.video_url,
            durationSeconds: clip.duration_seconds || 4,
          })),
          audioMixMode: 'mute',
          outputFormat: 'mp4',
        },
      });

      if (error) throw error;

      setProgress(50);
      addLog(`Response: ${JSON.stringify(data).slice(0, 100)}...`, 'info');

      if (data?.success) {
        if (data.mode === 'cloud-run') {
          addLog('Cloud Run accepted request, processing async...', 'info');
          toast.info('Processing...', { description: 'Cloud Run is stitching your video' });
          onStatusChange?.('stitching');
        } else if (data.finalVideoUrl) {
          setProgress(100);
          addLog(`Complete! ${data.finalVideoUrl}`, 'success');
          toast.success('Video ready!');
          onStitchComplete?.(data.finalVideoUrl);
          onStatusChange?.('completed');
        }
      } else if (data?.retryScheduled) {
        addLog(`Retry scheduled: ${data.error}`, 'warning');
        toast.warning('Retry scheduled', { description: data.error });
      } else {
        throw new Error(data?.error || 'Unknown error');
      }
    } catch (err) {
      addLog(`Cloud stitch failed: ${err instanceof Error ? err.message : 'Unknown'}`, 'error');
      toast.error('Stitch failed', { description: err instanceof Error ? err.message : 'Unknown' });
    } finally {
      setIsStitching(false);
      setStitchMode(null);
    }
  }, [user, projectId, isStitching, addLog, onStitchComplete, onStatusChange]);

  // Refresh project status
  const refreshStatus = useCallback(async () => {
    // Verify session before querying
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    
    const { data, error } = await supabase
      .from('movie_projects')
      .select('status, video_url, pending_video_tasks')
      .eq('id', projectId)
      .single();

    if (!error && data) {
      addLog(`Status: ${data.status}`, 'info');
      onStatusChange?.(data.status);
      if (data.video_url && data.status === 'completed') {
        addLog('Video URL found!', 'success');
        onStitchComplete?.(data.video_url);
      }
    }
  }, [projectId, addLog, onStatusChange, onStitchComplete]);

  // Auto-check health on mount
  useEffect(() => {
    if (isExpanded && health.cloudRun === 'unknown') {
      checkHealth();
    }
  }, [isExpanded, health.cloudRun, checkHealth]);

  const canStitch = completedClips > 0 && !isStitching;
  const isInStitchingState = ['stitching', 'stitching_failed', 'retry_scheduled'].includes(projectStatus);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border-2 border-white/10 bg-white/[0.02] overflow-hidden"
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center",
            health.cloudRun === 'healthy' ? "bg-emerald-500/20" :
            health.cloudRun === 'unhealthy' ? "bg-red-500/20" :
            "bg-white/10"
          )}>
            {health.cloudRun === 'checking' ? (
              <Loader2 className="w-5 h-5 text-white animate-spin" />
            ) : health.cloudRun === 'healthy' ? (
              <Wifi className="w-5 h-5 text-emerald-400" />
            ) : health.cloudRun === 'unhealthy' ? (
              <WifiOff className="w-5 h-5 text-red-400" />
            ) : (
              <Server className="w-5 h-5 text-white/50" />
            )}
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-white">Stitching Troubleshooter</h3>
            <p className="text-xs text-white/40">
              {completedClips}/{totalClips} clips ready • 
              {health.cloudRun === 'healthy' ? ' Cloud Run OK' : 
               health.cloudRun === 'unhealthy' ? ' Cloud Run Down' : 
               ' Status Unknown'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isInStitchingState && (
            <Badge variant="outline" className="border-amber-500/50 text-amber-400 text-xs">
              {projectStatus.replace(/_/g, ' ')}
            </Badge>
          )}
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-white/40" />
          ) : (
            <ChevronDown className="w-5 h-5 text-white/40" />
          )}
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="p-4 pt-0 space-y-4">
              {/* Health Status */}
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-white/60">Cloud Run FFmpeg Service</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs"
                    onClick={checkHealth}
                    disabled={isChecking}
                  >
                    {isChecking ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3 h-3" />
                    )}
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  {health.cloudRun === 'healthy' ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm text-emerald-400">Healthy</span>
                      {health.latencyMs && (
                        <span className="text-xs text-white/40">({health.latencyMs}ms)</span>
                      )}
                    </>
                  ) : health.cloudRun === 'unhealthy' ? (
                    <>
                      <XCircle className="w-4 h-4 text-red-400" />
                      <span className="text-sm text-red-400">Unhealthy</span>
                      {health.error && (
                        <span className="text-xs text-white/40 truncate max-w-[200px]">
                          {health.error}
                        </span>
                      )}
                    </>
                  ) : health.cloudRun === 'checking' ? (
                    <>
                      <Loader2 className="w-4 h-4 text-white/50 animate-spin" />
                      <span className="text-sm text-white/50">Checking...</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4 text-white/40" />
                      <span className="text-sm text-white/40">Click to check</span>
                    </>
                  )}
                </div>
              </div>

              {/* Stitch Actions */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={handleAutoStitch}
                  disabled={!canStitch}
                  className={cn(
                    "h-auto py-3 flex-col gap-1",
                    "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30"
                  )}
                >
                  {isStitching && stitchMode === 'simple' ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Zap className="w-5 h-5" />
                  )}
                  <span className="text-xs font-semibold">Auto Stitch</span>
                  <span className="text-[10px] text-emerald-400/60">Recommended</span>
                </Button>

                <Button
                  onClick={handleCloudStitch}
                  disabled={!canStitch || health.cloudRun !== 'healthy'}
                  className={cn(
                    "h-auto py-3 flex-col gap-1",
                    "bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30",
                    health.cloudRun !== 'healthy' && "opacity-50"
                  )}
                >
                  {isStitching && stitchMode === 'cloud' ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Server className="w-5 h-5" />
                  )}
                  <span className="text-xs font-semibold">Cloud Stitch</span>
                  <span className="text-[10px] text-blue-400/60">Full FFmpeg</span>
                </Button>
              </div>

              {/* Progress */}
              {isStitching && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/60">Processing...</span>
                    <span className="text-white/40">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-1.5" />
                </div>
              )}

              {/* Quick Actions */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-xs h-8"
                  onClick={refreshStatus}
                >
                  <Activity className="w-3 h-3 mr-1" />
                  Refresh Status
                </Button>
              </div>

              {/* Logs */}
              {logs.length > 0 && (
                <div className="rounded-xl bg-black/40 border border-white/[0.06] overflow-hidden">
                  <div className="p-2 border-b border-white/[0.06] flex items-center gap-2">
                    <Terminal className="w-3 h-3 text-white/40" />
                    <span className="text-[10px] font-medium text-white/40 uppercase tracking-wider">
                      Logs
                    </span>
                  </div>
                  <ScrollArea className="h-32">
                    <div className="p-2 space-y-0.5 font-mono text-[10px]">
                      {logs.map((log, i) => (
                        <div key={i} className="flex gap-2">
                          <span className="text-white/30 shrink-0">{log.time}</span>
                          <span className={cn(
                            log.type === 'success' && 'text-emerald-400',
                            log.type === 'error' && 'text-red-400',
                            log.type === 'warning' && 'text-amber-400',
                            log.type === 'info' && 'text-white/60',
                          )}>
                            {log.message}
                          </span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
