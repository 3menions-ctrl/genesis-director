import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Film, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Play,
  Download,
  Clock,
  ArrowLeft,
  RotateCcw,
  Layers,
  Sparkles,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Pause,
  ChevronRight,
  Zap,
  Eye,
  X,
  FileText,
  Users,
  Shield,
  Wand2,
  Volume2,
  Music
} from 'lucide-react';
import { ManifestVideoPlayer } from '@/components/studio/ManifestVideoPlayer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { parsePendingVideoTasks } from '@/types/pending-video-tasks';
import { ClipTransitionAnalyzer } from '@/components/studio/ClipTransitionAnalyzer';
import { StitchingTroubleshooter } from '@/components/studio/StitchingTroubleshooter';
import { useRetryStitch } from '@/hooks/useRetryStitch';

interface StageStatus {
  name: string;
  shortName: string;
  status: 'pending' | 'active' | 'complete' | 'error' | 'skipped';
  details?: string;
}

interface ClipResult {
  index: number;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  videoUrl?: string;
  error?: string;
  id?: string;
}

interface PipelineLog {
  time: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

const STAGE_ICONS = [FileText, Users, Shield, Wand2, Film, Sparkles];

const INITIAL_STAGES: StageStatus[] = [
  { name: 'Script Generation', shortName: 'Script', status: 'pending' },
  { name: 'Identity Analysis', shortName: 'Identity', status: 'pending' },
  { name: 'Quality Audit', shortName: 'QA', status: 'pending' },
  { name: 'Asset Creation', shortName: 'Assets', status: 'pending' },
  { name: 'Video Production', shortName: 'Production', status: 'pending' },
  { name: 'Final Assembly', shortName: 'Assembly', status: 'pending' },
];

// Cinematic Stage Card Component
function StageCard({ 
  stage, 
  index, 
  isActive, 
  isComplete, 
  isPending 
}: { 
  stage: StageStatus; 
  index: number; 
  isActive: boolean; 
  isComplete: boolean; 
  isPending: boolean;
}) {
  const Icon = STAGE_ICONS[index];
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "relative group",
        "p-4 rounded-2xl border transition-all duration-500",
        isComplete && "bg-emerald-500/10 border-emerald-500/30",
        isActive && "bg-white/[0.08] border-white/30 shadow-lg shadow-white/5",
        isPending && "bg-white/[0.02] border-white/[0.06]",
        stage.status === 'error' && "bg-red-500/10 border-red-500/30"
      )}
    >
      {/* Active glow effect */}
      {isActive && (
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-white/5 via-white/10 to-white/5 animate-shimmer-bg" />
      )}
      
      {/* Connection line */}
      {index < 5 && (
        <div className={cn(
          "hidden lg:block absolute top-1/2 -right-[calc(50%-8px)] w-[calc(100%-16px)] h-px",
          isComplete ? "bg-emerald-500/50" : "bg-white/[0.08]"
        )} />
      )}
      
      <div className="relative flex flex-col items-center text-center">
        {/* Icon container */}
        <div className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-all duration-300",
          isComplete && "bg-emerald-500/20",
          isActive && "bg-white/10",
          isPending && "bg-white/[0.04]",
          stage.status === 'error' && "bg-red-500/20"
        )}>
          {isActive ? (
            <Loader2 className="w-5 h-5 text-white animate-spin" />
          ) : isComplete ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          ) : stage.status === 'error' ? (
            <XCircle className="w-5 h-5 text-red-400" />
          ) : (
            <Icon className={cn(
              "w-5 h-5 transition-colors",
              isPending ? "text-white/30" : "text-white/70"
            )} />
          )}
        </div>
        
        {/* Stage info */}
        <h3 className={cn(
          "text-sm font-semibold transition-colors mb-1",
          isComplete && "text-emerald-400",
          isActive && "text-white",
          isPending && "text-white/40",
          stage.status === 'error' && "text-red-400"
        )}>
          {stage.shortName}
        </h3>
        
        {stage.details && (
          <span className={cn(
            "text-[10px] font-medium px-2 py-0.5 rounded-full",
            isComplete && "bg-emerald-500/20 text-emerald-400",
            isActive && "bg-white/10 text-white/70"
          )}>
            {stage.details}
          </span>
        )}
      </div>
    </motion.div>
  );
}

// Clip Grid Item Component
function ClipGridItem({ 
  clip, 
  index, 
  onPlay, 
  onRetry, 
  isRetrying 
}: { 
  clip: ClipResult; 
  index: number; 
  onPlay: () => void; 
  onRetry: () => void; 
  isRetrying: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.03, duration: 0.4 }}
      className={cn(
        "relative aspect-video rounded-xl overflow-hidden cursor-pointer transition-all duration-300",
        "border-2",
        clip.status === 'completed' && "border-emerald-500/50 hover:border-emerald-400 hover:shadow-lg hover:shadow-emerald-500/10",
        clip.status === 'generating' && "border-white/30",
        clip.status === 'failed' && "border-red-500/50 hover:border-red-400",
        clip.status === 'pending' && "border-white/[0.08]"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => {
        if (clip.status === 'completed' && clip.videoUrl) {
          onPlay();
        } else if (clip.status === 'failed') {
          onRetry();
        }
      }}
    >
      {/* Video preview for completed clips */}
      {clip.status === 'completed' && clip.videoUrl ? (
        <>
          <video
            src={clip.videoUrl}
            className="absolute inset-0 w-full h-full object-cover"
            muted
            preload="metadata"
            onLoadedData={(e) => {
              (e.target as HTMLVideoElement).currentTime = 1;
            }}
          />
          {/* Hover overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: isHovered ? 1 : 0 }}
            className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm"
          >
            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-xl flex items-center justify-center border border-white/30">
              <Play className="w-4 h-4 text-white ml-0.5" fill="currentColor" />
            </div>
          </motion.div>
        </>
      ) : clip.status === 'generating' ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-white/[0.08] to-transparent">
          <div className="relative">
            <div className="absolute inset-0 bg-white/20 rounded-full blur-xl animate-pulse" />
            <Loader2 className="relative w-6 h-6 text-white animate-spin" />
          </div>
          <span className="text-[10px] text-white/50 mt-2 font-medium">Generating...</span>
        </div>
      ) : clip.status === 'failed' ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-red-500/10 to-transparent">
          {isRetrying ? (
            <Loader2 className="w-5 h-5 text-red-400 animate-spin" />
          ) : (
            <>
              <RefreshCw className="w-5 h-5 text-red-400 group-hover:scale-110 transition-transform" />
              <span className="text-[10px] text-red-400 mt-1 font-medium">Click to Retry</span>
            </>
          )}
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-white/[0.02] to-transparent">
          <span className="text-lg font-bold text-white/20">{index + 1}</span>
        </div>
      )}
      
      {/* Index badge */}
      <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-sm">
        <span className="text-[10px] font-bold text-white">{index + 1}</span>
      </div>
      
      {/* Status indicator */}
      {clip.status === 'completed' && (
        <div className="absolute top-1.5 right-1.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 drop-shadow-lg" />
        </div>
      )}
    </motion.div>
  );
}

export default function Production() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');
  const { user } = useAuth();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isResuming, setIsResuming] = useState(false);
  const [projectTitle, setProjectTitle] = useState('');
  const [projectStatus, setProjectStatus] = useState('');
  const [stages, setStages] = useState<StageStatus[]>(INITIAL_STAGES);
  const [progress, setProgress] = useState(0);
  const [clipResults, setClipResults] = useState<ClipResult[]>([]);
  const [pipelineLogs, setPipelineLogs] = useState<PipelineLog[]>([]);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [auditScore, setAuditScore] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startTime] = useState<number>(Date.now());
  const [elapsedTime, setElapsedTime] = useState(0);
  const [completedClips, setCompletedClips] = useState(0);
  const [selectedClipUrl, setSelectedClipUrl] = useState<string | null>(null);
  const [retryingClipIndex, setRetryingClipIndex] = useState<number | null>(null);
  const [failedClipsNotified, setFailedClipsNotified] = useState<Set<number>>(new Set());
  const [showLogs, setShowLogs] = useState(false);
  const [isStalled, setIsStalled] = useState(false);
  const [lastProgressTime, setLastProgressTime] = useState<number>(Date.now());
  const [autoResumeAttempted, setAutoResumeAttempted] = useState(false);
  const [expectedClipCount, setExpectedClipCount] = useState(6);
  const [isSimpleStitching, setIsSimpleStitching] = useState(false);
  const [isAutoStitching, setIsAutoStitching] = useState(false);
  const [autoStitchAttempted, setAutoStitchAttempted] = useState(false);

  // Load actual video clips from database
  const loadVideoClips = useCallback(async () => {
    if (!projectId || !user) return;
    
    const { data: clips, error: clipsError } = await supabase
      .from('video_clips')
      .select('id, shot_index, status, video_url, error_message')
      .eq('project_id', projectId)
      .order('shot_index');
    
    if (!clipsError && clips) {
      setClipResults(clips.map(clip => ({
        index: clip.shot_index,
        status: clip.status as ClipResult['status'],
        videoUrl: clip.video_url || undefined,
        error: clip.error_message || undefined,
        id: clip.id,
      })));
      setCompletedClips(clips.filter(c => c.status === 'completed').length);
    }
  }, [projectId, user]);

  // Add log entry helper
  const addLog = useCallback((message: string, type: PipelineLog['type'] = 'info') => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setPipelineLogs(prev => [...prev, { time, message, type }].slice(-50));
  }, []);

  // Update stage status helper
  const updateStageStatus = useCallback((stageIndex: number, status: StageStatus['status'], details?: string) => {
    setStages(prev => {
      const updated = [...prev];
      updated[stageIndex] = { ...updated[stageIndex], status, details };
      return updated;
    });
  }, []);

  // Auto-stitch trigger - called when all clips complete
  const triggerAutoStitch = useCallback(async () => {
    if (!projectId || !user || isAutoStitching || autoStitchAttempted) return;
    
    setIsAutoStitching(true);
    setAutoStitchAttempted(true);
    addLog('🎬 All clips complete! Triggering automatic stitching...', 'info');
    toast.info('Starting video stitching...', { 
      description: 'All clips generated successfully. Assembling final video.',
      duration: 5000,
    });
    
    try {
      // Update stage to show stitching
      updateStageStatus(5, 'active', 'Stitching...');
      setProgress(85);
      setProjectStatus('stitching');
      
      const { data, error: stitchError } = await supabase.functions.invoke('auto-stitch-trigger', {
        body: {
          projectId,
          userId: user.id,
          forceStitch: false,
        },
      });
      
      if (stitchError) throw stitchError;
      
      if (data?.success) {
        if (data.stitchResult?.finalVideoUrl || data.finalVideoUrl) {
          const videoUrl = data.stitchResult?.finalVideoUrl || data.finalVideoUrl;
          setFinalVideoUrl(videoUrl);
          setProjectStatus('completed');
          setProgress(100);
          updateStageStatus(5, 'complete', 'Done!');
          addLog('✅ Video stitching complete!', 'success');
          toast.success('Video generated successfully!');
        } else if (data.stitchMode === 'cloud-run-async' || data.stitchMode === 'simple-stitch') {
          addLog('Stitching in progress via Cloud Run...', 'info');
          toast.info('Stitching in progress', { description: 'Will complete in a few moments' });
        } else {
          addLog(`Stitch initiated: ${data.stitchMode || 'processing'}`, 'info');
        }
      } else if (data?.skipped) {
        addLog(`Stitch skipped: ${data.reason}`, 'info');
      } else {
        throw new Error(data?.error || 'Auto-stitch returned no result');
      }
    } catch (err: any) {
      console.error('Auto-stitch failed:', err);
      addLog(`Auto-stitch failed: ${err.message}`, 'error');
      toast.error('Auto-stitch failed', { 
        description: 'Click "Simple Stitch" to retry manually',
        duration: 10000,
      });
      // Reset status so user can retry
      setProjectStatus('ready_for_stitch');
    } finally {
      setIsAutoStitching(false);
    }
  }, [projectId, user, isAutoStitching, autoStitchAttempted, addLog, updateStageStatus]);

  // Handle retry of failed clip
  const handleRetryClip = useCallback(async (clipIndex: number) => {
    if (!projectId || !user) return;
    
    setRetryingClipIndex(clipIndex);
    addLog(`Retrying clip ${clipIndex + 1}...`, 'info');
    
    try {
      const { data, error } = await supabase.functions.invoke('retry-failed-clip', {
        body: {
          userId: user.id,
          projectId,
          clipIndex,
        },
      });
      
      if (error) throw error;
      
      if (data?.success) {
        toast.success(`Clip ${clipIndex + 1} regenerated successfully!`);
        addLog(`Clip ${clipIndex + 1} retry succeeded`, 'success');
        
        setClipResults(prev => {
          const updated = [...prev];
          updated[clipIndex] = {
            ...updated[clipIndex],
            status: 'completed',
            videoUrl: data.videoUrl,
            error: undefined,
          };
          return updated;
        });
        
        setFailedClipsNotified(prev => {
          const updated = new Set(prev);
          updated.delete(clipIndex);
          return updated;
        });
        
        await loadVideoClips();
      } else {
        throw new Error(data?.error || 'Retry failed');
      }
    } catch (err) {
      console.error('Retry failed:', err);
      toast.error(`Failed to retry clip ${clipIndex + 1}`, {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
      addLog(`Clip ${clipIndex + 1} retry failed: ${err instanceof Error ? err.message : 'Unknown'}`, 'error');
    } finally {
      setRetryingClipIndex(null);
    }
  }, [projectId, user, addLog, loadVideoClips]);

  // Handle simple stitch retry (bypasses vision analysis)
  const handleSimpleStitchRetry = useCallback(async () => {
    if (!projectId || !user || isSimpleStitching) return;
    
    setIsSimpleStitching(true);
    addLog('Starting simple stitch (bypassing AI analysis)...', 'info');
    toast.info('Starting simple stitch...', { description: 'Concatenating clips without AI transition analysis' });
    
    try {
      // Get all completed clips from database
      const { data: clips, error: clipsError } = await supabase
        .from('video_clips')
        .select('id, shot_index, video_url, duration_seconds')
        .eq('project_id', projectId)
        .eq('status', 'completed')
        .order('shot_index');
      
      if (clipsError) throw clipsError;
      if (!clips || clips.length === 0) throw new Error('No completed clips found');
      
      addLog(`Found ${clips.length} completed clips`, 'info');
      
      // Get project title
      const { data: project } = await supabase
        .from('movie_projects')
        .select('title')
        .eq('id', projectId)
        .single();
      
      // Call stitch-video with forceMvpMode to bypass intelligent-stitch
      const { data, error: stitchError } = await supabase.functions.invoke('stitch-video', {
        body: {
          projectId,
          projectTitle: project?.title || 'Video',
          clips: clips.map(clip => ({
            shotId: clip.id,
            videoUrl: clip.video_url,
            durationSeconds: clip.duration_seconds || 4,
            transitionOut: 'continuous',
          })),
          audioMixMode: 'mute',
          forceMvpMode: true, // Bypass Cloud Run, use manifest mode
        },
      });
      
      if (stitchError) throw stitchError;
      
      if (data?.success && data?.finalVideoUrl) {
        setFinalVideoUrl(data.finalVideoUrl);
        setProjectStatus('completed');
        setProgress(100);
        toast.success('Video stitched successfully!');
        addLog('Simple stitch completed!', 'success');
      } else if (data?.success && data?.mode === 'cloud-run') {
        // Cloud Run async mode - wait for callback
        setProjectStatus('stitching');
        addLog('Stitch dispatched to Cloud Run, waiting for completion...', 'info');
        toast.info('Stitching in progress...', { description: 'This may take a few minutes' });
      } else {
        throw new Error(data?.error || 'Stitch returned no video URL');
      }
    } catch (err: any) {
      console.error('Simple stitch failed:', err);
      setError(err.message || 'Simple stitch failed');
      addLog(`Simple stitch failed: ${err.message}`, 'error');
      toast.error('Stitch failed', { description: err.message });
    } finally {
      setIsSimpleStitching(false);
    }
  }, [projectId, user, isSimpleStitching, addLog]);

  // Timer effect
  useEffect(() => {
    if (projectStatus === 'completed' || projectStatus === 'failed' || !projectId) {
      return;
    }
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime, projectStatus, projectId]);

  // Load initial project data
  useEffect(() => {
    const loadProject = async () => {
      if (!projectId || !user) {
        toast.error('No project specified');
        navigate('/create');
        return;
      }

      try {
        const { data: project, error: fetchError } = await supabase
          .from('movie_projects')
          .select('*')
          .eq('id', projectId)
          .eq('user_id', user.id)
          .single();

        if (fetchError || !project) {
          toast.error('Project not found');
          navigate('/create');
          return;
        }

        setProjectTitle(project.title);
        setProjectStatus(project.status);
        
        if (project.video_url) {
          setFinalVideoUrl(project.video_url);
        }

        const tasks = parsePendingVideoTasks(project.pending_video_tasks);
        
        const isOrphanedProject = ['producing', 'generating', 'rendering'].includes(project.status) 
          && (!tasks || Object.keys(tasks).length === 0 || Array.isArray(tasks));
        
        if (isOrphanedProject) {
          setError('This project was interrupted before the pipeline could save its state. You can restart it from scratch.');
          addLog('Orphaned project detected - no pipeline state found', 'warning');
          setIsLoading(false);
          return;
        }
        
        if (tasks && typeof tasks === 'object' && !Array.isArray(tasks)) {
          if (tasks.progress) setProgress(tasks.progress);
          if (tasks.auditScore) setAuditScore(tasks.auditScore);
          
          const clipCount = tasks.clipCount || 6;
          setExpectedClipCount(clipCount);
          if (tasks.clipsCompleted !== undefined) {
            setCompletedClips(tasks.clipsCompleted);
            setClipResults(Array(clipCount).fill(null).map((_, i) => ({
              index: i,
              status: i < tasks.clipsCompleted ? 'completed' : (i === tasks.clipsCompleted ? 'generating' : 'pending'),
            })));
          } else {
            setClipResults(Array(clipCount).fill(null).map((_, i) => ({
              index: i,
              status: 'pending',
            })));
          }

          const stageMap: Record<string, number> = {
            'preproduction': 0,
            'qualitygate': 2,
            'assets': 3,
            'production': 4,
            'postproduction': 5,
          };
          
          if (tasks.stage && stageMap[tasks.stage] !== undefined) {
            const currentIdx = stageMap[tasks.stage];
            setStages(prev => prev.map((s, i) => ({
              ...s,
              status: i < currentIdx ? 'complete' : (i === currentIdx ? 'active' : 'pending')
            })));
          }

          addLog(`Connected to pipeline: ${project.title}`, 'info');
          
          // Check if pipeline is already stalled on load (based on updated_at)
          const lastUpdate = new Date(project.updated_at).getTime();
          const timeSinceUpdate = Date.now() - lastUpdate;
          const isGenerating = ['generating', 'producing'].includes(project.status);
          
          if (isGenerating && tasks.stage === 'production' && timeSinceUpdate > 60000) {
            // Pipeline hasn't updated in 60+ seconds, check actual clips
            const { data: clips } = await supabase
              .from('video_clips')
              .select('id, status')
              .eq('project_id', projectId)
              .eq('status', 'completed');
            
            const actualCompleted = clips?.length || 0;
            const expectedCount = tasks.clipCount || 6;
            
            if (actualCompleted > 0 && actualCompleted < expectedCount) {
              setIsStalled(true);
              setCompletedClips(actualCompleted);
              addLog(`Pipeline stalled - ${actualCompleted}/${expectedCount} clips completed, last update ${Math.floor(timeSinceUpdate / 1000)}s ago`, 'warning');
            }
          }
        }

        if (project.status === 'completed') {
          setProgress(100);
          setStages(prev => prev.map(s => ({ ...s, status: 'complete' })));
          addLog('Pipeline completed!', 'success');
        } else if (project.status === 'failed') {
          setError('Pipeline failed');
          addLog('Pipeline failed', 'error');
        }

      } catch (err) {
        console.error('Error loading project:', err);
        toast.error('Failed to load project');
        navigate('/create');
      } finally {
        setIsLoading(false);
      }
    };

    loadProject();
    loadVideoClips();
  }, [projectId, user, navigate, addLog, loadVideoClips]);

  // Real-time subscription for pipeline updates
  useEffect(() => {
    if (!projectId || projectStatus === 'completed' || projectStatus === 'failed') {
      return;
    }

    const channel = supabase
      .channel(`production_${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'movie_projects',
          filter: `id=eq.${projectId}`,
        },
        (payload) => {
          const project = payload.new as Record<string, unknown>;
          if (!project) return;

          setProjectStatus(project.status as string);
          
          const tasks = parsePendingVideoTasks(project.pending_video_tasks);
          if (!tasks) return;

          if (tasks.progress) {
            setProgress(tasks.progress);
          }

          const stageMap: Record<string, number> = {
            'preproduction': 0,
            'qualitygate': 2,
            'assets': 3,
            'production': 4,
            'postproduction': 5,
          };

          if (tasks.stage && stageMap[tasks.stage] !== undefined) {
            const currentIdx = stageMap[tasks.stage];
            for (let i = 0; i < currentIdx; i++) {
              if (stages[i].status !== 'complete') {
                updateStageStatus(i, 'complete');
              }
            }
            updateStageStatus(currentIdx, 'active');
          }

          if (tasks.scriptGenerated && !pipelineLogs.some(l => l.message.includes('Script generated'))) {
            addLog('Script generated successfully', 'success');
            updateStageStatus(0, 'complete', `${tasks.shotCount || '?'} shots`);
          }

          if (tasks.auditScore && auditScore !== tasks.auditScore) {
            setAuditScore(tasks.auditScore);
            updateStageStatus(2, 'complete', `${tasks.auditScore}%`);
            addLog(`Quality score: ${tasks.auditScore}/100`, 'success');
          }

          if (tasks.charactersExtracted) {
            updateStageStatus(1, 'complete', `${tasks.charactersExtracted} chars`);
          }

          if (tasks.hasVoice && !pipelineLogs.some(l => l.message.includes('Voice narration'))) {
            addLog('Voice narration generated', 'success');
          }

          if (tasks.hasMusic && !pipelineLogs.some(l => l.message.includes('Background music'))) {
            addLog('Background music generated', 'success');
          }

          if (tasks.clipsCompleted !== undefined) {
            const clipCount = tasks.clipCount || clipResults.length || 6;
            setCompletedClips(tasks.clipsCompleted);
            setClipResults(prev => {
              const updated = [...prev];
              for (let i = 0; i < clipCount; i++) {
                if (i < tasks.clipsCompleted) {
                  updated[i] = { ...updated[i], status: 'completed' };
                } else if (i === tasks.clipsCompleted) {
                  updated[i] = { ...updated[i], status: 'generating' };
                }
              }
              return updated;
            });
            updateStageStatus(4, 'active', `${tasks.clipsCompleted}/${clipCount} clips`);
            addLog(`Video clips: ${tasks.clipsCompleted}/${clipCount} completed`, 'info');
          }

          const pendingTasksAny = tasks as any;
          if (pendingTasksAny.failedClips && Array.isArray(pendingTasksAny.failedClips)) {
            pendingTasksAny.failedClips.forEach((failedIndex: number) => {
              if (!failedClipsNotified.has(failedIndex)) {
                toast.error(`Clip ${failedIndex + 1} failed after auto-retry`, {
                  description: pendingTasksAny.lastFailedError || 'Click to retry manually',
                  action: {
                    label: 'Retry',
                    onClick: () => handleRetryClip(failedIndex),
                  },
                  duration: 10000,
                });
                setFailedClipsNotified(prev => new Set([...prev, failedIndex]));
                addLog(`Clip ${failedIndex + 1} failed - manual retry available`, 'warning');
              }
            });
            
            setClipResults(prev => {
              const updated = [...prev];
              pendingTasksAny.failedClips.forEach((failedIndex: number) => {
                if (updated[failedIndex]) {
                  updated[failedIndex] = { 
                    ...updated[failedIndex], 
                    status: 'failed',
                    error: pendingTasksAny.lastFailedError,
                  };
                }
              });
              return updated;
            });
          }

          if (tasks.stage === 'complete' && tasks.finalVideoUrl) {
            setFinalVideoUrl(tasks.finalVideoUrl);
            setProgress(100);
            stages.forEach((_, i) => updateStageStatus(i, 'complete'));
            addLog('Pipeline completed successfully!', 'success');
            toast.success('Video generated successfully!');
          }

          if (tasks.stage === 'error') {
            setError(tasks.error || 'Pipeline failed');
            addLog(`Error: ${tasks.error || 'Pipeline failed'}`, 'error');
            toast.error(tasks.error || 'Pipeline failed');
          }

          if (project.status === 'completed' && typeof project.video_url === 'string') {
            setFinalVideoUrl(project.video_url);
            setProgress(100);
          }

          if (project.status === 'failed') {
            setError('Pipeline failed');
          }
        }
      )
      .subscribe();

    // Also subscribe to video_clips table for real-time clip updates
    const clipsChannel = supabase
      .channel(`clips_${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'video_clips',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          // Clip was updated or inserted
          if (payload.new) {
            const clip = payload.new as Record<string, unknown>;
            if (clip.status === 'completed') {
              setLastProgressTime(Date.now());
              setIsStalled(false);
              loadVideoClips();
              addLog(`Clip ${(clip.shot_index as number) + 1} completed`, 'success');
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(clipsChannel);
    };
  }, [projectId, projectStatus, stages, pipelineLogs, auditScore, clipResults.length, updateStageStatus, addLog, failedClipsNotified, handleRetryClip, loadVideoClips]);

  // Auto-resume handler
  const handleResumePipeline = useCallback(async () => {
    if (!projectId || !user || isResuming) return;
    
    setIsResuming(true);
    setIsStalled(false);
    setAutoResumeAttempted(true);
    addLog('Resuming pipeline...', 'info');
    
    try {
      const { data, error: resumeError } = await supabase.functions.invoke('resume-pipeline', {
        body: {
          userId: user.id,
          projectId,
          resumeFrom: 'production',
        },
      });
      
      if (resumeError) throw resumeError;
      if (!data?.success) throw new Error(data?.error || 'Resume failed');
      
      addLog('Pipeline resumed successfully', 'success');
      toast.success('Pipeline resumed - continuing generation');
      setProjectStatus('generating');
      setLastProgressTime(Date.now());
    } catch (err: any) {
      console.error('Resume failed:', err);
      setError(err.message || 'Failed to resume pipeline');
      addLog(`Resume failed: ${err.message}`, 'error');
      toast.error('Failed to resume pipeline', { description: err.message });
    } finally {
      setIsResuming(false);
    }
  }, [projectId, user, isResuming, addLog]);

  // Auto-resume when stalled is detected (on page load or during monitoring)
  useEffect(() => {
    if (isStalled && !autoResumeAttempted && !isResuming && completedClips > 0) {
      addLog('Auto-resuming stalled pipeline...', 'info');
      const timer = setTimeout(() => {
        handleResumePipeline();
      }, 1500); // Small delay to show the UI first
      return () => clearTimeout(timer);
    }
  }, [isStalled, autoResumeAttempted, isResuming, completedClips, addLog, handleResumePipeline]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isRunning = !['completed', 'failed', 'draft'].includes(projectStatus);
  const isComplete = projectStatus === 'completed';
  const isError = projectStatus === 'failed';
  const currentStageIndex = stages.findIndex(s => s.status === 'active');
  const showResumeButton = isStalled && completedClips > 0 && completedClips < expectedClipCount && !isResuming;

  // Stall detection - check if no progress for 90 seconds during generation
  useEffect(() => {
    if (!isRunning || projectStatus === 'awaiting_approval') return;
    
    const checkInterval = setInterval(async () => {
      // Get actual completed clips from database
      const { data: clips } = await supabase
        .from('video_clips')
        .select('id, status')
        .eq('project_id', projectId)
        .eq('status', 'completed');
      
      const actualCompleted = clips?.length || 0;
      
      // Check if we have more completed in DB than tracked
      if (actualCompleted > completedClips) {
        setCompletedClips(actualCompleted);
        setLastProgressTime(Date.now());
        setIsStalled(false);
        loadVideoClips();
      }
      
      // Check if generation is stalled (90 seconds no progress)
      const timeSinceProgress = Date.now() - lastProgressTime;
      const isGenerating = projectStatus === 'generating' || projectStatus === 'producing';
      const hasIncompleteClips = actualCompleted < expectedClipCount;
      
      if (isGenerating && hasIncompleteClips && timeSinceProgress > 90000) {
        setIsStalled(true);
        addLog(`Pipeline stalled - no progress for ${Math.floor(timeSinceProgress / 1000)}s`, 'warning');
        
        // Auto-resume if not already attempted
        if (!autoResumeAttempted && actualCompleted > 0) {
          addLog('Attempting automatic resume...', 'info');
          handleResumePipeline();
        }
      }
    }, 15000); // Check every 15 seconds
    
    return () => clearInterval(checkInterval);
  }, [projectId, projectStatus, completedClips, expectedClipCount, lastProgressTime, autoResumeAttempted, isRunning, addLog, handleResumePipeline, loadVideoClips]);

  // Reset progress timer when clips complete
  useEffect(() => {
    setLastProgressTime(Date.now());
  }, [completedClips]);

  // AUTO-STITCH TRIGGER: Fire immediately when all clips complete
  useEffect(() => {
    // Only trigger if:
    // 1. We have completed all expected clips
    // 2. Project is not already completed/stitching
    // 3. We haven't already attempted auto-stitch
    // 4. Not currently stitching
    const allClipsComplete = completedClips >= expectedClipCount && expectedClipCount > 0;
    const shouldTrigger = allClipsComplete && 
                          !['completed', 'stitching', 'failed'].includes(projectStatus) &&
                          !autoStitchAttempted && 
                          !isAutoStitching &&
                          !isSimpleStitching;
    
    if (shouldTrigger) {
      console.log(`[AutoStitch] All ${completedClips}/${expectedClipCount} clips complete - triggering stitch!`);
      // Small delay to ensure all state is settled
      const timer = setTimeout(() => {
        triggerAutoStitch();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [completedClips, expectedClipCount, projectStatus, autoStitchAttempted, isAutoStitching, isSimpleStitching, triggerAutoStitch]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-6"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-white/10 rounded-full blur-2xl animate-pulse" />
            <Loader2 className="relative w-12 h-12 animate-spin text-white" />
          </div>
          <p className="text-white/60 font-medium">Loading pipeline...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] relative overflow-hidden">
      {/* Dramatic ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-30%] left-[-20%] w-[80vw] h-[80vw] rounded-full bg-gradient-to-br from-white/[0.015] to-transparent blur-[150px]" />
        <div className="absolute bottom-[-40%] right-[-20%] w-[90vw] h-[90vw] rounded-full bg-gradient-to-tl from-white/[0.01] to-transparent blur-[180px]" />
        
        {/* Film grain */}
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />
      </div>

      {/* Header */}
      <nav className="sticky top-0 z-50">
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="bg-black/60 backdrop-blur-2xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="h-16 flex items-center justify-between">
              {/* Left: Back + Title */}
              <div className="flex items-center gap-4">
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="text-white/60 hover:text-white hover:bg-white/10"
                  onClick={() => navigate('/create')}
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                
                <div className="flex items-center gap-3">
                  <div className="relative">
                    {isRunning && (
                      <div className="absolute inset-0 bg-white/20 rounded-xl blur-lg animate-pulse" />
                    )}
                    <div className={cn(
                      "relative w-10 h-10 rounded-xl flex items-center justify-center",
                      isComplete ? "bg-emerald-500/20" : isError ? "bg-red-500/20" : "bg-white/10"
                    )}>
                      <Film className={cn(
                        "w-5 h-5",
                        isComplete ? "text-emerald-400" : isError ? "text-red-400" : "text-white"
                      )} />
                    </div>
                  </div>
                  <div>
                    <h1 className="text-base font-bold text-white">Production Pipeline</h1>
                    <p className="text-xs text-white/40 truncate max-w-[200px] sm:max-w-none">
                      {projectTitle}
                    </p>
                  </div>
                </div>
              </div>

              {/* Right: Status + Time */}
              <div className="flex items-center gap-3">
                {isRunning && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.08] border border-white/10"
                  >
                    <div className="relative">
                      <div className="absolute inset-0 bg-white/30 rounded-full animate-ping" />
                      <div className="relative w-2 h-2 rounded-full bg-white" />
                    </div>
                    <span className="text-xs font-medium text-white">Processing</span>
                  </motion.div>
                )}
                
                {isComplete && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-semibold text-emerald-400">Complete</span>
                  </motion.div>
                )}
                
                {isError && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/20 border border-red-500/30"
                  >
                    <XCircle className="w-4 h-4 text-red-400" />
                    <span className="text-xs font-semibold text-red-400">Failed</span>
                  </motion.div>
                )}
                
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08]">
                  <Clock className="w-4 h-4 text-white/50" />
                  <span className="text-xs font-mono font-medium text-white">{formatTime(elapsedTime)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Progress Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative"
        >
          <div className="p-6 rounded-3xl bg-gradient-to-br from-white/[0.04] to-transparent border border-white/[0.06]">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">
                  {isComplete ? 'Production Complete!' : isError ? 'Production Failed' : 'Production in Progress'}
                </h2>
                <p className="text-white/40">
                  {isComplete 
                    ? 'Your video is ready for download'
                    : isError 
                      ? 'Something went wrong during production'
                      : `Stage ${currentStageIndex + 1} of ${stages.length}`
                  }
                </p>
              </div>
              <div className="text-right">
                <span className={cn(
                  "text-5xl font-bold",
                  isComplete ? "text-emerald-400" : isError ? "text-red-400" : "text-white"
                )}>
                  {Math.round(progress)}%
                </span>
              </div>
            </div>
            
            {/* Progress bar */}
            <div className="relative h-3 rounded-full bg-white/[0.05] overflow-hidden">
              <motion.div
                className={cn(
                  "absolute inset-y-0 left-0 rounded-full",
                  isComplete 
                    ? "bg-gradient-to-r from-emerald-500 to-emerald-400" 
                    : isError 
                      ? "bg-gradient-to-r from-red-500 to-red-400"
                      : "bg-gradient-to-r from-white/80 to-white"
                )}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
              {isRunning && (
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                />
              )}
            </div>
          </div>
        </motion.section>

        {/* Stalled Pipeline Warning + Resume Button */}
        {(showResumeButton || isResuming) && (
          <motion.section
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="p-6 rounded-3xl bg-amber-500/10 border-2 border-amber-500/30"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center shrink-0">
                {isResuming ? (
                  <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-amber-400" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-amber-400 mb-1">
                  {isResuming ? 'Resuming Pipeline...' : 'Pipeline Stalled'}
                </h3>
                <p className="text-sm text-white/60 mb-4">
                  {isResuming 
                    ? 'Reconnecting to continue video generation. This may take a moment...'
                    : `Generation paused after clip ${completedClips}. The backend timed out but your progress is saved.`
                  }
                </p>
                {!isResuming && (
                  <div className="flex flex-wrap gap-3">
                    <Button 
                      className="bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-full"
                      onClick={handleResumePipeline}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Resume from Clip {completedClips + 1}
                    </Button>
                    <Button 
                      variant="outline"
                      className="rounded-full border-white/10 text-white/70 hover:text-white hover:bg-white/10"
                      onClick={() => navigate(`/clips?projectId=${projectId}`)}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View Completed Clips
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </motion.section>
        )}

        {/* Stitching In Progress */}
        {projectStatus === 'stitching' && (
          <motion.section
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="p-6 rounded-3xl bg-gradient-to-br from-white/[0.06] to-transparent border-2 border-white/20"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shrink-0 relative">
                <div className="absolute inset-0 bg-white/20 rounded-2xl animate-ping" style={{ animationDuration: '2s' }} />
                <Film className="relative w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white mb-1">Final Assembly in Progress</h3>
                <p className="text-sm text-white/60 mb-4">
                  Cloud Run is stitching your {completedClips} clips together. This typically takes 1-3 minutes depending on video length.
                </p>
                
                {/* Animated progress bar */}
                <div className="relative h-2 rounded-full bg-white/10 overflow-hidden mb-4">
                  <motion.div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-white/40 to-white/80 rounded-full"
                    initial={{ width: '10%' }}
                    animate={{ width: ['10%', '60%', '30%', '80%', '50%'] }}
                    transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                    animate={{ x: ['-100%', '100%'] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  />
                </div>
                
                <div className="flex items-center gap-4 text-sm text-white/40">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Processing on Cloud Run</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>Est. 1-3 min</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>
        )}

        {/* Pipeline Stages */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center gap-3 mb-5">
            <Layers className="w-5 h-5 text-white/60" />
            <h2 className="text-lg font-bold text-white">Pipeline Stages</h2>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {stages.map((stage, index) => (
              <StageCard
                key={stage.name}
                stage={stage}
                index={index}
                isActive={stage.status === 'active'}
                isComplete={stage.status === 'complete'}
                isPending={stage.status === 'pending'}
              />
            ))}
          </div>
        </motion.section>

        {/* Video Clips Grid */}
        {clipResults.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <Film className="w-5 h-5 text-white/60" />
                <h2 className="text-lg font-bold text-white">
                  Video Clips 
                  <span className="ml-2 text-sm font-normal text-white/40">
                    {clipResults.filter(c => c.status === 'completed').length}/{clipResults.length}
                  </span>
                </h2>
              </div>
              
              {clipResults.some(c => c.status === 'completed') && (
                <Button 
                  variant="outline"
                  size="sm"
                  className="rounded-full bg-white/5 border-white/10 text-white/70 hover:text-white hover:bg-white/10"
                  onClick={() => navigate(`/clips?projectId=${projectId}`)}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View All
                </Button>
              )}
            </div>
            
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
              {clipResults.map((clip, index) => (
                <ClipGridItem
                  key={index}
                  clip={clip}
                  index={index}
                  onPlay={() => setSelectedClipUrl(clip.videoUrl || null)}
                  onRetry={() => handleRetryClip(index)}
                  isRetrying={retryingClipIndex === index}
                />
              ))}
            </div>
          </motion.section>
        )}

        {/* Quality Score */}
        {auditScore !== null && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className={cn(
              "p-6 rounded-3xl border-2 transition-colors",
              auditScore >= 80 
                ? "bg-emerald-500/5 border-emerald-500/30" 
                : auditScore >= 60 
                  ? "bg-amber-500/5 border-amber-500/30"
                  : "bg-red-500/5 border-red-500/30"
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center",
                  auditScore >= 80 
                    ? "bg-emerald-500/20" 
                    : auditScore >= 60 
                      ? "bg-amber-500/20"
                      : "bg-red-500/20"
                )}>
                  <Sparkles className={cn(
                    "w-7 h-7",
                    auditScore >= 80 
                      ? "text-emerald-400" 
                      : auditScore >= 60 
                        ? "text-amber-400"
                        : "text-red-400"
                  )} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Quality Audit Score</h3>
                  <p className="text-sm text-white/40">Script coherence and visual consistency</p>
                </div>
              </div>
              <div className={cn(
                "text-5xl font-bold",
                auditScore >= 80 
                  ? "text-emerald-400" 
                  : auditScore >= 60 
                    ? "text-amber-400"
                    : "text-red-400"
              )}>
                {auditScore}%
              </div>
            </div>
          </motion.section>
        )}

        {/* Script Approval Required */}
        {projectStatus === 'awaiting_approval' && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded-3xl bg-amber-500/10 border-2 border-amber-500/30"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6 text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-amber-400 mb-1">Script Approval Required</h3>
                <p className="text-sm text-white/60 mb-4">
                  The script has been generated and is ready for your review. Approve it to continue with video production.
                </p>
                <Button 
                  className="bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-full"
                  onClick={() => navigate(`/script-review?projectId=${projectId}`)}
                >
                  <Play className="w-4 h-4 mr-2" />
                  Review & Approve Script
                </Button>
              </div>
            </div>
          </motion.section>
        )}

        {/* Error Display */}
        {error && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded-3xl bg-red-500/10 border-2 border-red-500/30"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-500/20 flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6 text-red-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-red-400 mb-1">Pipeline Error</h3>
                <p className="text-sm text-white/60 mb-4">{error}</p>
                {error.includes('WORKER_LIMIT') && completedClips > 0 && (
                  <p className="text-sm text-white/40 mb-4">
                    {completedClips} clips were generated before the timeout. You can resume to continue from where it left off.
                  </p>
                )}
                <div className="flex flex-wrap gap-3">
                  {completedClips > 0 && (
                    <Button 
                      disabled={isResuming}
                      className="bg-white text-black hover:bg-white/90 rounded-full font-semibold"
                      onClick={async () => {
                        setIsResuming(true);
                        setError(null);
                        addLog('Resuming pipeline from checkpoint...', 'info');
                        try {
                          const { data, error: resumeError } = await supabase.functions.invoke('resume-pipeline', {
                            body: {
                              userId: user?.id,
                              projectId,
                              resumeFrom: 'production',
                            },
                          });
                          if (resumeError) throw resumeError;
                          if (!data?.success) throw new Error(data?.error || 'Resume failed');
                          addLog('Pipeline resumed successfully', 'success');
                          setProjectStatus('generating');
                        } catch (err: any) {
                          setError(err.message || 'Failed to resume');
                          addLog(`Resume failed: ${err.message}`, 'error');
                        } finally {
                          setIsResuming(false);
                        }
                      }}
                    >
                      {isResuming ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <RotateCcw className="w-4 h-4 mr-2" />
                      )}
                      Resume from Clip {completedClips + 1}
                    </Button>
                  )}
                  <Button 
                    variant="outline"
                    className="rounded-full border-white/10 text-white/70 hover:text-white hover:bg-white/10"
                    onClick={async () => {
                      await supabase
                        .from('movie_projects')
                        .update({ status: 'draft', pending_video_tasks: null })
                        .eq('id', projectId);
                      navigate('/create');
                    }}
                  >
                    Restart Project
                  </Button>
                  <Button 
                    variant="ghost"
                    className="rounded-full text-white/50 hover:text-white"
                    onClick={() => navigate('/create')}
                  >
                    Start New
                  </Button>
                </div>
              </div>
            </div>
          </motion.section>
        )}

        {/* Stitching Failed - Retry Options */}
        {projectStatus === 'stitching_failed' && completedClips > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded-3xl bg-amber-500/10 border-2 border-amber-500/30"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center shrink-0">
                {isSimpleStitching ? (
                  <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
                ) : (
                  <Layers className="w-6 h-6 text-amber-400" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-amber-400 mb-1">Stitching Failed</h3>
                <p className="text-sm text-white/60 mb-2">
                  All {completedClips} video clips were generated successfully, but the final assembly failed 
                  (likely due to Vision API quota limits for transition analysis).
                </p>
                <p className="text-sm text-white/40 mb-4">
                  You can retry with simple stitching which bypasses AI analysis and directly concatenates clips.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button 
                    disabled={isSimpleStitching}
                    className="bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-full"
                    onClick={handleSimpleStitchRetry}
                  >
                    {isSimpleStitching ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Zap className="w-4 h-4 mr-2" />
                    )}
                    Retry Simple Stitch
                  </Button>
                  <Button 
                    variant="outline"
                    className="rounded-full border-white/10 text-white/70 hover:text-white hover:bg-white/10"
                    onClick={() => navigate(`/clips?projectId=${projectId}`)}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View All Clips
                  </Button>
                </div>
              </div>
            </div>
          </motion.section>
        )}

        {/* Stitching Troubleshooter - Always visible when clips exist */}
        {completedClips > 0 && projectId && (
          <StitchingTroubleshooter
            projectId={projectId}
            projectStatus={projectStatus}
            completedClips={completedClips}
            totalClips={expectedClipCount}
            onStitchComplete={(videoUrl) => {
              setFinalVideoUrl(videoUrl);
              setProjectStatus('completed');
              setProgress(100);
              addLog('Final video ready!', 'success');
            }}
            onStatusChange={(status) => {
              setProjectStatus(status);
              if (status === 'stitching') {
                updateStageStatus(5, 'active', 'Stitching...');
              } else if (status === 'completed') {
                updateStageStatus(5, 'complete');
              }
            }}
          />
        )}

        {/* Transition Analyzer */}
        {completedClips >= 2 && projectId && (
          <ClipTransitionAnalyzer 
            projectId={projectId} 
            onBridgeGenerated={() => {
              loadVideoClips();
              addLog('Bridge clip generated', 'success');
            }}
          />
        )}

        {/* Completed Video */}
        {finalVideoUrl && (
          <motion.section
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="p-8 rounded-3xl bg-gradient-to-br from-emerald-500/10 to-transparent border-2 border-emerald-500/30"
          >
            <div className="flex flex-col items-center gap-8">
              {/* Success header */}
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-emerald-500/30 rounded-full blur-xl animate-pulse" />
                  <CheckCircle2 className="relative w-10 h-10 text-emerald-400" />
                </div>
                <h2 className="text-3xl font-bold text-white">Your Video is Ready!</h2>
              </div>
              
              {/* Video player */}
              <div className="w-full max-w-4xl aspect-video rounded-2xl overflow-hidden border border-emerald-500/30 shadow-2xl shadow-emerald-500/10">
                {finalVideoUrl.endsWith('.json') ? (
                  <ManifestVideoPlayer manifestUrl={finalVideoUrl} className="w-full h-full" />
                ) : (
                  <video
                    src={finalVideoUrl}
                    controls
                    className="w-full h-full object-contain bg-black"
                  />
                )}
              </div>
              
              {/* Actions */}
              <div className="flex flex-wrap items-center justify-center gap-4">
                {finalVideoUrl.endsWith('.json') && (
                  <Button 
                    size="lg"
                    className="bg-white text-black hover:bg-white/90 rounded-full font-bold shadow-lg shadow-white/10"
                    onClick={async () => {
                      toast.info('Starting AI-powered final assembly... This may take 2-5 minutes');
                      try {
                        const { data, error } = await supabase.functions.invoke('final-assembly', {
                          body: {
                            projectId,
                            userId: user?.id,
                            strictness: 'normal',
                            maxBridgeClips: 5,
                            outputQuality: '1080p',
                          },
                        });
                        
                        if (data?.success && data.finalVideoUrl) {
                          setFinalVideoUrl(data.finalVideoUrl);
                          toast.success('Final MP4 ready for download!');
                          addLog(`Final assembly complete: ${data.bridgeClipsGenerated} bridge clips generated`, 'success');
                        } else {
                          throw new Error(data?.error || 'Assembly failed');
                        }
                      } catch (err: any) {
                        toast.error(err.message || 'Failed to assemble final video');
                        addLog(`Assembly failed: ${err.message}`, 'error');
                      }
                    }}
                  >
                    <Sparkles className="w-5 h-5 mr-2" />
                    Generate Downloadable MP4
                  </Button>
                )}
                
                {!finalVideoUrl.endsWith('.json') && (
                  <Button 
                    size="lg"
                    className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-full font-bold shadow-lg"
                    asChild
                  >
                    <a href={finalVideoUrl} download target="_blank" rel="noopener noreferrer">
                      <Download className="w-5 h-5 mr-2" />
                      Download Video
                    </a>
                  </Button>
                )}
                
                {!finalVideoUrl.endsWith('.json') && completedClips >= 2 && (
                  <Button 
                    variant="outline"
                    size="lg"
                    className="rounded-full border-white/20 text-white hover:bg-white/10"
                    onClick={async () => {
                      toast.info('Re-assembling with AI bridge clips...');
                      try {
                        const { data, error } = await supabase.functions.invoke('final-assembly', {
                          body: {
                            projectId,
                            userId: user?.id,
                            forceReassemble: true,
                            strictness: 'strict',
                            maxBridgeClips: 5,
                            outputQuality: '1080p',
                          },
                        });
                        
                        if (data?.success && data.finalVideoUrl) {
                          setFinalVideoUrl(data.finalVideoUrl);
                          toast.success(`Re-stitched with ${data.bridgeClipsGenerated} AI bridge clips!`);
                        } else {
                          throw new Error(data?.error || 'Re-assembly failed');
                        }
                      } catch (err: any) {
                        toast.error(err.message || 'Failed to re-stitch');
                      }
                    }}
                  >
                    <Layers className="w-5 h-5 mr-2" />
                    Re-Stitch with AI Bridges
                  </Button>
                )}
                
                <Button 
                  variant="ghost"
                  size="lg"
                  className="rounded-full text-white/60 hover:text-white"
                  onClick={() => navigate('/projects')}
                >
                  View All Projects
                </Button>
              </div>
            </div>
          </motion.section>
        )}

        {/* Pipeline Logs - Collapsible */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <button
            onClick={() => setShowLogs(!showLogs)}
            className="flex items-center gap-3 mb-4 group"
          >
            <ChevronRight className={cn(
              "w-4 h-4 text-white/40 transition-transform",
              showLogs && "rotate-90"
            )} />
            <span className="text-sm font-semibold text-white/60 group-hover:text-white/80 transition-colors">
              Pipeline Logs
            </span>
            <span className="text-xs text-white/30">({pipelineLogs.length} entries)</span>
          </button>
          
          <AnimatePresence>
            {showLogs && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-1 font-mono text-xs">
                      {pipelineLogs.length === 0 ? (
                        <p className="text-white/30">Waiting for pipeline events...</p>
                      ) : (
                        pipelineLogs.map((log, index) => (
                          <div key={index} className="flex gap-3">
                            <span className="text-white/30 shrink-0">[{log.time}]</span>
                            <span className={cn(
                              log.type === 'success' && "text-emerald-400",
                              log.type === 'error' && "text-red-400",
                              log.type === 'warning' && "text-amber-400",
                              log.type === 'info' && "text-white/60"
                            )}>
                              {log.message}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>
      </main>

      {/* Clip Video Modal */}
      <AnimatePresence>
        {selectedClipUrl && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
            onClick={() => setSelectedClipUrl(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-5xl w-full aspect-video"
              onClick={(e) => e.stopPropagation()}
            >
              <video
                src={selectedClipUrl}
                controls
                autoPlay
                className="w-full h-full rounded-2xl"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white rounded-full"
                onClick={() => setSelectedClipUrl(null)}
              >
                <X className="w-5 h-5" />
              </Button>
              <div className="absolute bottom-6 right-6 flex gap-3">
                <Button 
                  size="sm" 
                  variant="outline"
                  className="rounded-full bg-black/50 border-white/20 text-white"
                  onClick={() => window.open(selectedClipUrl, '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open
                </Button>
                <Button 
                  size="sm"
                  className="rounded-full bg-white text-black hover:bg-white/90"
                  asChild
                >
                  <a href={selectedClipUrl} download>
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </a>
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
