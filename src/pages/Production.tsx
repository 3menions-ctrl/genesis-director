import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { motion, AnimatePresence, useSpring } from 'framer-motion';
import { 
  Film, Loader2, CheckCircle2, XCircle, X, FileText, Users, Shield, Wand2,
  AlertCircle, Sparkles, RotateCcw, Cpu, Layers, Eye, Activity
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { parsePendingVideoTasks } from '@/types/pending-video-tasks';

// Components - New modular design
import { ProductionSidebar } from '@/components/production/ProductionSidebar';
import { ProductionHeader } from '@/components/production/ProductionHeader';
import { ProductionStats } from '@/components/production/ProductionStats';
import { ProductionClipsGrid } from '@/components/production/ProductionClipsGrid';
import { ProductionActivityLog } from '@/components/production/ProductionActivityLog';
import { ProductionFinalVideo } from '@/components/production/ProductionFinalVideo';

// Existing components - Keep for specialized functionality
import { AppHeader } from '@/components/layout/AppHeader';
import { ScriptReviewPanel, ScriptShot } from '@/components/studio/ScriptReviewPanel';
import { ConsistencyDashboard } from '@/components/studio/ConsistencyDashboard';
import { TransitionTimeline } from '@/components/studio/TransitionTimeline';
import { FailedClipsPanel } from '@/components/studio/FailedClipsPanel';
import { ContinuityManifestPanel } from '@/components/studio/ContinuityManifestPanel';
import { CloudRunProgressPanel } from '@/components/studio/CloudRunProgressPanel';
import { StitchingTroubleshooter } from '@/components/studio/StitchingTroubleshooter';
import { useContinuityOrchestrator } from '@/hooks/useContinuityOrchestrator';
import { useContinuityManifest } from '@/hooks/useContinuityManifest';

// ============= TYPES =============

interface StageStatus {
  name: string;
  shortName: string;
  icon: React.ElementType;
  status: 'pending' | 'active' | 'complete' | 'error' | 'skipped';
  details?: string;
}

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

interface PipelineLog {
  id: string;
  time: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

interface ProductionProject {
  id: string;
  title: string;
  status: string;
  progress: number;
  clipsCompleted: number;
  totalClips: number;
  thumbnail?: string;
  updatedAt: string;
}

interface ProFeaturesState {
  masterSceneAnchor?: any;
  characters?: any[];
  identityBible?: any;
  consistencyScore?: number;
  qualityTier?: string;
}

// ============= CONSTANTS =============

const STAGE_CONFIG: Array<{ name: string; shortName: string; icon: React.ElementType }> = [
  { name: 'Script Generation', shortName: 'Script', icon: FileText },
  { name: 'Identity Analysis', shortName: 'Identity', icon: Users },
  { name: 'Quality Audit', shortName: 'Audit', icon: Shield },
  { name: 'Asset Creation', shortName: 'Assets', icon: Wand2 },
  { name: 'Video Production', shortName: 'Render', icon: Film },
  { name: 'Final Assembly', shortName: 'Stitch', icon: Sparkles },
];

// ============= MAIN COMPONENT =============

export default function Production() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');
  const { user } = useAuth();
  
  // UI State
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Core state
  const [isLoading, setIsLoading] = useState(true);
  const [isResuming, setIsResuming] = useState(false);
  const [projectTitle, setProjectTitle] = useState('');
  const [projectStatus, setProjectStatus] = useState('');
  const [stages, setStages] = useState<StageStatus[]>(
    STAGE_CONFIG.map(s => ({ ...s, status: 'pending' as const }))
  );
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
  const [expectedClipCount, setExpectedClipCount] = useState(6);
  const [isSimpleStitching, setIsSimpleStitching] = useState(false);
  const [autoStitchAttempted, setAutoStitchAttempted] = useState(false);
  const [allProductionProjects, setAllProductionProjects] = useState<ProductionProject[]>([]);
  const [scriptShots, setScriptShots] = useState<ScriptShot[] | null>(null);
  const [isApprovingScript, setIsApprovingScript] = useState(false);
  const [pipelineStage, setPipelineStage] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [proFeatures, setProFeatures] = useState<ProFeaturesState | null>(null);
  const [selectedManifestIndex, setSelectedManifestIndex] = useState<number>(0);

  // Continuity orchestrator for transition analysis
  const {
    isAnalyzing: isContinuityAnalyzing,
    transitionAnalyses,
    clipsToRetry: continuityClipsToRetry,
    overallScore: continuityScore,
    bridgeClipsNeeded,
    postProcessClips,
  } = useContinuityOrchestrator();

  // Continuity manifest for per-shot detail tracking
  const {
    isExtracting: isExtractingManifest,
    getManifestForShot,
    extractManifest,
  } = useContinuityManifest({ 
    projectId: projectId || '',
    onManifestExtracted: (manifest) => {
      addLog(`Extracted continuity for shot ${manifest.shotIndex + 1}: ${manifest.criticalAnchors?.length || 0} anchors`, 'success');
    }
  });

  const springProgress = useSpring(progress, { stiffness: 100, damping: 30 });
  const logIdRef = useRef(0);

  const addLog = useCallback((message: string, type: PipelineLog['type'] = 'info') => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const id = `log-${logIdRef.current++}`;
    setPipelineLogs(prev => [...prev, { id, time, message, type }].slice(-100));
  }, []);

  const updateStageStatus = useCallback((stageIndex: number, status: StageStatus['status'], details?: string) => {
    setStages(prev => {
      const updated = [...prev];
      if (updated[stageIndex]) {
        updated[stageIndex] = { ...updated[stageIndex], status, details };
      }
      return updated;
    });
  }, []);

  const loadVideoClips = useCallback(async () => {
    if (!projectId) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    
    const { data: clips } = await supabase
      .from('video_clips')
      .select('id, shot_index, status, video_url, error_message, motion_vectors')
      .eq('project_id', projectId)
      .eq('user_id', session.user.id)
      .order('shot_index');
    
    if (clips) {
      setClipResults(clips.map(clip => ({
        index: clip.shot_index,
        status: clip.status as ClipResult['status'],
        videoUrl: clip.video_url || undefined,
        error: clip.error_message || undefined,
        id: clip.id,
        motionVectors: clip.motion_vectors as ClipResult['motionVectors'],
      })));
      setCompletedClips(clips.filter(c => c.status === 'completed').length);
    }
  }, [projectId]);

  const loadAllProductionProjects = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { data: projects } = await supabase
      .from('movie_projects')
      .select('id, title, status, pending_video_tasks, thumbnail_url, updated_at, video_url')
      .eq('user_id', session.user.id)
      .in('status', ['generating', 'producing', 'rendering', 'stitching', 'stitching_failed', 'failed', 'completed'])
      .order('updated_at', { ascending: false })
      .limit(30);

    if (projects) {
      setAllProductionProjects(projects.map(p => {
        const tasks = parsePendingVideoTasks(p.pending_video_tasks);
        const hasVideo = !!p.video_url;
        const progress = hasVideo ? 100 : (p.status === 'stitching_failed' ? 90 : (tasks?.progress || 0));
        return {
          id: p.id,
          title: p.title,
          status: p.status,
          progress,
          clipsCompleted: tasks?.clipsCompleted || 0,
          totalClips: tasks?.clipCount || 6,
          thumbnail: p.thumbnail_url || undefined,
          updatedAt: p.updated_at,
        };
      }));
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  useEffect(() => {
    // Reset all project-specific state when projectId changes
    setScriptShots(null);
    setClipResults([]);
    setFinalVideoUrl(null);
    setProgress(0);
    setCompletedClips(0);
    setAuditScore(null);
    setPipelineStage(null);
    setError(null);
    setAutoStitchAttempted(false);
    setStages(STAGE_CONFIG.map(s => ({ ...s, status: 'pending' as const })));
    setPipelineLogs([]);
    
    const loadProject = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate('/auth');
        return;
      }

      if (!projectId) {
        const { data: recentProject } = await supabase
          .from('movie_projects')
          .select('id')
          .eq('user_id', session.user.id)
          .in('status', ['generating', 'producing', 'rendering', 'stitching', 'stitching_failed', 'failed', 'completed'])
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (recentProject) {
          navigate(`/production?projectId=${recentProject.id}`, { replace: true });
          return;
        }
        
        await loadAllProductionProjects();
        setIsLoading(false);
        return;
      }

      const { data: project, error: projectError } = await supabase
        .from('movie_projects')
        .select('*')
        .eq('id', projectId)
        .eq('user_id', session.user.id)
        .single();

      if (projectError || !project) {
        toast.error('Project not found');
        navigate('/projects');
        return;
      }

      setProjectTitle(project.title);
      setProjectStatus(project.status);
      if (project.video_url) setFinalVideoUrl(project.video_url);
      
      // Load pro features data
      const proData = project.pro_features_data as any;
      if (proData) {
        const continuityPlan = proData.continuityPlan;
        const envLock = continuityPlan?.environmentLock;
        setProFeatures({
          masterSceneAnchor: proData.masterSceneAnchor || (envLock ? {
            lighting: envLock.lighting,
            environment: `${envLock.weather || ''} ${envLock.timeOfDay || ''}`.trim(),
            dominantColors: envLock.colorPalette ? [envLock.colorPalette] : [],
          } : null),
          characters: proData.characters || [],
          identityBible: proData.identityBible,
          consistencyScore: proData.consistencyScore || (continuityPlan?.overallContinuityScore ? continuityPlan.overallContinuityScore / 100 : undefined),
          qualityTier: project.quality_tier,
        });
      }

      let scriptLoaded = false;
      const tasks = parsePendingVideoTasks(project.pending_video_tasks);
      if (tasks) {
        if (tasks.progress) setProgress(tasks.progress);
        if (tasks.clipCount) setExpectedClipCount(tasks.clipCount);
        if (tasks.auditScore) setAuditScore(tasks.auditScore);
        if (tasks.stage) setPipelineStage(tasks.stage);
        
        if (tasks.script?.shots) {
          const shots: ScriptShot[] = tasks.script.shots.map((shot, idx) => ({
            id: shot.id || `shot-${idx}`,
            index: idx,
            title: shot.title,
            description: shot.description,
            durationSeconds: shot.durationSeconds,
            sceneType: shot.sceneType,
            cameraScale: shot.cameraScale,
            cameraAngle: shot.cameraAngle,
            movementType: shot.movementType,
            transitionOut: shot.transitionOut,
            visualAnchors: shot.visualAnchors,
            motionDirection: shot.motionDirection,
            lightingHint: shot.lightingHint,
            dialogue: shot.dialogue,
            mood: shot.mood,
          }));
          setScriptShots(shots);
          scriptLoaded = true;
          if (tasks.stage === 'awaiting_approval') {
            addLog('Script ready for approval', 'info');
          }
        }
        
        if (tasks.stage) {
          const stageMap: Record<string, number> = {
            'preproduction': 0, 'awaiting_approval': 0, 'qualitygate': 2, 'assets': 3,
            'production': 4, 'postproduction': 5, 'complete': 5,
          };
          const idx = stageMap[tasks.stage];
          if (idx !== undefined) {
            for (let i = 0; i < idx; i++) updateStageStatus(i, 'complete');
            if (tasks.stage !== 'complete') updateStageStatus(idx, 'active');
            else updateStageStatus(idx, 'complete');
          }
        }
      }
      
      if (!scriptLoaded && project.generated_script) {
        try {
          const scriptData = JSON.parse(project.generated_script);
          if (scriptData?.shots && Array.isArray(scriptData.shots)) {
            const shots: ScriptShot[] = scriptData.shots.map((shot: any, idx: number) => ({
              id: shot.id || `shot-${idx}`,
              index: idx,
              title: shot.title || shot.name || `Shot ${idx + 1}`,
              description: shot.description || shot.prompt || '',
              durationSeconds: shot.durationSeconds || shot.duration || 6,
              sceneType: shot.sceneType,
              cameraScale: shot.cameraScale,
              cameraAngle: shot.cameraAngle,
              movementType: shot.movementType,
              transitionOut: shot.transitionOut,
              visualAnchors: shot.visualAnchors,
              motionDirection: shot.motionDirection,
              lightingHint: shot.lightingHint,
              dialogue: shot.dialogue,
              mood: shot.mood,
            }));
            setScriptShots(shots);
            
            if (project.status === 'awaiting_approval') {
              setPipelineStage('awaiting_approval');
              addLog('Script ready for approval', 'info');
              toast.info('Script ready! Review and approve to continue.');
            } else {
              addLog('Script loaded from project', 'info');
            }
          }
        } catch (e) {
          console.warn('Could not parse generated_script:', e);
        }
      }

      await loadVideoClips();
      await loadAllProductionProjects();
      addLog('Connected to pipeline', 'info');
      setIsLoading(false);
    };

    loadProject();
  }, [projectId, navigate, updateStageStatus, loadVideoClips, loadAllProductionProjects, addLog]);

  // Realtime subscriptions
  useEffect(() => {
    if (!projectId || !user) return;

    const projectChannel = supabase
      .channel(`production_${projectId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'movie_projects',
        filter: `id=eq.${projectId}`,
      }, (payload) => {
        const project = payload.new as Record<string, unknown>;
        if (!project) return;

        setProjectStatus(project.status as string);
        if (project.video_url) setFinalVideoUrl(project.video_url as string);
        
        const proData = project.pro_features_data as any;
        if (proData) {
          const continuityPlan = proData.continuityPlan;
          const envLock = continuityPlan?.environmentLock;
          setProFeatures({
            masterSceneAnchor: proData.masterSceneAnchor || (envLock ? {
              lighting: envLock.lighting,
              environment: `${envLock.weather || ''} ${envLock.timeOfDay || ''}`.trim(),
              dominantColors: envLock.colorPalette ? [envLock.colorPalette] : [],
            } : null),
            characters: proData.characters || [],
            identityBible: proData.identityBible,
            consistencyScore: proData.consistencyScore || (continuityPlan?.overallContinuityScore ? continuityPlan.overallContinuityScore / 100 : undefined),
            qualityTier: project.quality_tier as string,
          });
        }

        const tasks = parsePendingVideoTasks(project.pending_video_tasks);
        if (tasks) {
          if (tasks.progress) {
            setProgress(tasks.progress);
            springProgress.set(tasks.progress);
          }
          
          if (tasks.stage) setPipelineStage(tasks.stage);

          const stageMap: Record<string, number> = {
            'preproduction': 0, 'awaiting_approval': 0, 'qualitygate': 2, 'assets': 3,
            'production': 4, 'postproduction': 5,
          };

          if (tasks.stage && stageMap[tasks.stage] !== undefined) {
            const idx = stageMap[tasks.stage];
            for (let i = 0; i < idx; i++) {
              if (stages[i]?.status !== 'complete') updateStageStatus(i, 'complete');
            }
            updateStageStatus(idx, 'active');
          }
          
          if (tasks.stage === 'awaiting_approval' && tasks.script?.shots) {
            const shots: ScriptShot[] = tasks.script.shots.map((shot, idx) => ({
              id: shot.id || `shot-${idx}`,
              index: idx,
              title: shot.title,
              description: shot.description,
              durationSeconds: shot.durationSeconds,
              sceneType: shot.sceneType,
              cameraScale: shot.cameraScale,
              cameraAngle: shot.cameraAngle,
              movementType: shot.movementType,
              transitionOut: shot.transitionOut,
              visualAnchors: shot.visualAnchors,
              motionDirection: shot.motionDirection,
              lightingHint: shot.lightingHint,
              dialogue: shot.dialogue,
              mood: shot.mood,
            }));
            setScriptShots(shots);
            addLog('Script ready for approval', 'info');
            toast.info('Script ready! Review and approve to continue.');
          }
        }
      })
      .subscribe();

    const clipsChannel = supabase
      .channel(`clips_${projectId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'video_clips',
        filter: `project_id=eq.${projectId}`,
      }, (payload) => {
        if (payload.new) {
          const clip = payload.new as Record<string, unknown>;
          if (clip.status === 'completed') {
            loadVideoClips();
            addLog(`Clip ${(clip.shot_index as number) + 1} done`, 'success');
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(projectChannel);
      supabase.removeChannel(clipsChannel);
    };
  }, [projectId, user, stages, updateStageStatus, addLog, loadVideoClips, springProgress]);

  // Auto-stitch
  useEffect(() => {
    const allComplete = completedClips >= expectedClipCount && expectedClipCount > 0;
    const shouldTrigger = allComplete && 
      !['completed', 'stitching', 'failed'].includes(projectStatus) &&
      !autoStitchAttempted && !isSimpleStitching;

    if (shouldTrigger) {
      const timer = setTimeout(async () => {
        setAutoStitchAttempted(true);
        addLog('Stitching...', 'info');
        updateStageStatus(5, 'active');
        setProgress(85);

        try {
          const { data, error } = await supabase.functions.invoke('auto-stitch-trigger', {
            body: { projectId, userId: user?.id, forceStitch: false },
          });

          if (error) throw error;
          if (data?.success && (data.stitchResult?.finalVideoUrl || data.finalVideoUrl)) {
            setFinalVideoUrl(data.stitchResult?.finalVideoUrl || data.finalVideoUrl);
            setProjectStatus('completed');
            setProgress(100);
            updateStageStatus(5, 'complete');
            addLog('Done!', 'success');
            toast.success('Video ready!');
          }
        } catch (err: any) {
          addLog(`Stitch failed: ${err.message}`, 'error');
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [completedClips, expectedClipCount, projectStatus, autoStitchAttempted, isSimpleStitching, projectId, user, addLog, updateStageStatus]);

  // Auto-run continuity analysis
  useEffect(() => {
    if (!projectId || completedClips < 2) return;
    
    const completedClipData = clipResults
      .filter(c => c.status === 'completed' && c.videoUrl)
      .map(c => ({
        index: c.index,
        videoUrl: c.videoUrl!,
        prompt: scriptShots?.[c.index]?.description || `Clip ${c.index + 1}`,
        motionVectors: c.motionVectors,
      }));
    
    if (completedClipData.length === expectedClipCount && completedClipData.length >= 2 && transitionAnalyses.length === 0 && !isContinuityAnalyzing) {
      addLog('Running continuity analysis...', 'info');
      postProcessClips(projectId, completedClipData);
    }
  }, [completedClips, expectedClipCount, projectId, clipResults, scriptShots, transitionAnalyses.length, isContinuityAnalyzing, postProcessClips, addLog]);

  const handleRetryClip = async (clipIndex: number) => {
    if (!projectId || !user) return;
    setRetryingClipIndex(clipIndex);
    
    try {
      const { data, error } = await supabase.functions.invoke('retry-failed-clip', {
        body: { userId: user.id, projectId, clipIndex },
      });
      
      if (error) throw error;
      if (data?.success) {
        toast.success(`Clip ${clipIndex + 1} retrying`);
        await loadVideoClips();
      }
    } catch {
      toast.error(`Retry failed`);
    } finally {
      setRetryingClipIndex(null);
    }
  };

  const handleSimpleStitch = async () => {
    if (!projectId || !user || isSimpleStitching) return;
    setIsSimpleStitching(true);
    
    try {
      const { data: clips } = await supabase
        .from('video_clips')
        .select('id, shot_index, video_url, duration_seconds')
        .eq('project_id', projectId)
        .eq('status', 'completed')
        .order('shot_index');

      if (!clips?.length) throw new Error('No clips');

      const { data, error } = await supabase.functions.invoke('simple-stitch', {
        body: {
          projectId,
          clips: clips.map(c => ({ shotId: c.id, videoUrl: c.video_url, durationSeconds: c.duration_seconds || 6 })),
        },
      });

      if (error) throw error;
      if (data?.success && data?.finalVideoUrl) {
        setFinalVideoUrl(data.finalVideoUrl);
        setProjectStatus('completed');
        setProgress(100);
        updateStageStatus(5, 'complete');
        toast.success('Stitched!');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSimpleStitching(false);
    }
  };

  const handleResume = async () => {
    if (!projectId || !user || isResuming) return;
    setIsResuming(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('resume-pipeline', {
        body: { userId: user.id, projectId, resumeFrom: 'production' },
      });
      
      if (error) throw error;
      if (data?.success) {
        toast.success('Resumed');
        setProjectStatus('generating');
      }
    } catch {
      toast.error('Resume failed');
    } finally {
      setIsResuming(false);
    }
  };

  const handleCancelPipeline = async () => {
    if (!projectId || !user || isCancelling) return;
    
    if (!window.confirm('Are you sure you want to cancel this production?')) return;
    
    setIsCancelling(true);
    
    try {
      addLog('Cancelling pipeline...', 'warning');
      
      const { error: updateError } = await supabase
        .from('movie_projects')
        .update({ status: 'draft' })
        .eq('id', projectId)
        .eq('user_id', user.id);
      
      if (updateError) throw updateError;
      
      await supabase
        .from('video_clips')
        .update({ status: 'pending' })
        .eq('project_id', projectId)
        .eq('status', 'generating');
      
      setProjectStatus('draft');
      toast.success('Pipeline cancelled');
      navigate('/projects');
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel');
      addLog(`Cancel failed: ${err.message}`, 'error');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleApproveScript = async (approvedShots: ScriptShot[]) => {
    if (!projectId || !user || isApprovingScript) return;
    setIsApprovingScript(true);
    
    try {
      addLog('Approving script...', 'info');
      
      const { data, error } = await supabase.functions.invoke('resume-pipeline', {
        body: {
          projectId,
          userId: user.id,
          resumeFrom: 'qualitygate',
          approvedShots: approvedShots.map(shot => ({
            id: shot.id,
            title: shot.title,
            description: shot.description,
            durationSeconds: shot.durationSeconds,
            sceneType: shot.sceneType,
            cameraScale: shot.cameraScale,
            cameraAngle: shot.cameraAngle,
            movementType: shot.movementType,
            transitionOut: shot.transitionOut,
            visualAnchors: shot.visualAnchors,
            motionDirection: shot.motionDirection,
            lightingHint: shot.lightingHint,
            dialogue: shot.dialogue,
            mood: shot.mood,
          })),
        },
      });
      
      if (error) throw error;
      if (data?.success) {
        toast.success('Script approved! Production starting...');
        setScriptShots(null);
        setPipelineStage('qualitygate');
        updateStageStatus(0, 'complete');
        updateStageStatus(1, 'active');
        addLog('Script approved, continuing pipeline', 'success');
      } else if (data?.error) {
        throw new Error(data.error);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve script');
      addLog(`Script approval failed: ${err.message}`, 'error');
    } finally {
      setIsApprovingScript(false);
    }
  };

  const handleRegenerateScript = async () => {
    if (!projectId || !user) return;
    
    try {
      addLog('Regenerating script...', 'info');
      toast.info('Regenerating script...');
      
      const { data, error } = await supabase.functions.invoke('hollywood-pipeline', {
        body: { userId: user.id, projectId, action: 'regenerate_script' },
      });
      
      if (error) throw error;
      if (data?.success) {
        setScriptShots(null);
        toast.success('Script regeneration started');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to regenerate script');
    }
  };

  const isRunning = !['completed', 'failed', 'draft'].includes(projectStatus);
  const isComplete = projectStatus === 'completed';
  const isError = projectStatus === 'failed';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          className="flex flex-col items-center gap-4"
        >
          <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
          </div>
          <p className="text-zinc-500 text-sm">Loading production...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* App Header */}
      <AppHeader showCreate={false} />

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <ProductionSidebar
          projects={allProductionProjects}
          activeProjectId={projectId}
          isCollapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden bg-zinc-900">
          {/* Production Header */}
          <ProductionHeader
            projectTitle={projectTitle}
            projectStatus={projectStatus}
            stages={stages}
            progress={progress}
            elapsedTime={elapsedTime}
            isRunning={isRunning}
            isComplete={isComplete}
            isError={isError}
            isCancelling={isCancelling}
            isResuming={isResuming}
            hasClips={clipResults.length > 0}
            onCancel={handleCancelPipeline}
            onResume={handleResume}
          />

          {/* Content Grid */}
          <div className="flex-1 overflow-auto p-4 lg:p-6">
            <div className="max-w-7xl mx-auto space-y-4 lg:space-y-6">
              
              {/* Stats Row */}
              <ProductionStats
                completedClips={completedClips}
                totalClips={clipResults.length || expectedClipCount}
                elapsedTime={elapsedTime}
                progress={progress}
                auditScore={auditScore}
                isComplete={isComplete}
                isError={isError}
              />

              {/* Main Content Grid */}
              <div className="grid grid-cols-12 gap-4 lg:gap-6">
                {/* Main Column */}
                <div className="col-span-12 lg:col-span-8 space-y-4 lg:space-y-6">
                  
                  {/* Script Review Panel */}
                  {scriptShots && scriptShots.length > 0 && pipelineStage === 'awaiting_approval' && (
                    <Card className="glass-card ring-1 ring-primary/30">
                      <CardContent className="p-6">
                        <ScriptReviewPanel
                          shots={scriptShots}
                          onApprove={handleApproveScript}
                          onRegenerate={handleRegenerateScript}
                          onCancel={() => navigate('/projects')}
                          isLoading={isApprovingScript}
                          totalDuration={scriptShots.reduce((sum, shot) => sum + (shot.durationSeconds || 6), 0)}
                          projectTitle={projectTitle}
                        />
                      </CardContent>
                    </Card>
                  )}
                  
                  {/* Final Video */}
                  {finalVideoUrl && (
                    <ProductionFinalVideo videoUrl={finalVideoUrl} />
                  )}

                  {/* Consistency Dashboard */}
                  {projectId && (proFeatures || clipResults.length > 0) && (
                    <ConsistencyDashboard
                      masterAnchor={proFeatures?.masterSceneAnchor}
                      characters={proFeatures?.characters?.map((c: any) => ({
                        name: c.name || 'Unknown',
                        appearance: c.appearance,
                        verified: c.verified,
                        consistencyScore: c.consistencyScore,
                      })) || []}
                      identityBibleActive={!!proFeatures?.identityBible}
                      nonFacialAnchors={proFeatures?.identityBible?.nonFacialAnchors || []}
                      consistencyScore={proFeatures?.consistencyScore || (completedClips > 0 ? completedClips / (clipResults.length || expectedClipCount) : 0)}
                      consistencyMetrics={{
                        color: proFeatures?.masterSceneAnchor?.dominantColors?.length ? 0.85 : undefined,
                        scene: proFeatures?.masterSceneAnchor ? 0.9 : undefined,
                      }}
                      isProTier={proFeatures?.qualityTier === 'professional'}
                    />
                  )}

                  {/* Clips Grid */}
                  <ProductionClipsGrid
                    clips={clipResults}
                    completedClips={completedClips}
                    expectedClipCount={expectedClipCount}
                    projectId={projectId}
                    finalVideoUrl={finalVideoUrl}
                    isSimpleStitching={isSimpleStitching}
                    retryingIndex={retryingClipIndex}
                    onPlay={setSelectedClipUrl}
                    onRetry={handleRetryClip}
                    onStitch={handleSimpleStitch}
                    onViewAll={() => navigate(`/clips?projectId=${projectId}`)}
                  />

                  {/* Failed Clips Panel */}
                  {clipResults.filter(c => c.status === 'failed').length > 0 && user && projectId && (
                    <FailedClipsPanel
                      clips={clipResults.filter(c => c.status === 'failed').map(c => ({
                        index: c.index,
                        error: c.error,
                        prompt: scriptShots?.[c.index]?.description,
                        id: c.id,
                      }))}
                      projectId={projectId}
                      userId={user.id}
                      onRetry={handleRetryClip}
                      isRetrying={retryingClipIndex !== null}
                      retryingIndex={retryingClipIndex}
                    />
                  )}

                  {/* Transition Timeline */}
                  {clipResults.length >= 2 && completedClips >= 2 && transitionAnalyses.length > 0 && (
                    <TransitionTimeline
                      transitions={transitionAnalyses}
                      clipsToRetry={continuityClipsToRetry}
                      onRetryClip={handleRetryClip}
                      isRetrying={retryingClipIndex !== null}
                    />
                  )}

                  {/* Status Cards */}
                  <AnimatePresence mode="wait">
                    {!isRunning && !isComplete && projectId && clipResults.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                      >
                        <Card className="glass-card ring-1 ring-warning/30">
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center shrink-0">
                                <AlertCircle className="w-5 h-5 text-warning" />
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-warning">Pipeline Paused</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {completedClips} of {expectedClipCount} clips completed
                                </p>
                                <div className="flex gap-2 mt-3">
                                  <Button 
                                    size="sm" 
                                    className="bg-warning hover:bg-warning/90 text-warning-foreground" 
                                    onClick={handleResume} 
                                    disabled={isResuming}
                                  >
                                    {isResuming ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RotateCcw className="w-3 h-3 mr-1" />}
                                    Resume Pipeline
                                  </Button>
                                  {completedClips === expectedClipCount && (
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      className="border-warning/30 text-warning hover:bg-warning/10" 
                                      onClick={handleSimpleStitch} 
                                      disabled={isSimpleStitching}
                                    >
                                      {isSimpleStitching ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Sparkles className="w-3 h-3 mr-1" />}
                                      Quick Stitch
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    )}

                    {projectStatus === 'stitching' && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                      >
                        <Card className="glass-card">
                          <CardContent className="p-4 flex items-center gap-3">
                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
                              <Cpu className="w-5 h-5 text-primary" />
                            </motion.div>
                            <div>
                              <p className="text-sm font-semibold text-foreground">Assembling Video</p>
                              <p className="text-xs text-muted-foreground">Cloud processing in progress...</p>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Cloud Run Progress */}
                  {projectId && ['stitching', 'post_production', 'processing'].includes(projectStatus) && (
                    <CloudRunProgressPanel
                      projectId={projectId}
                      projectStatus={projectStatus}
                      onComplete={(url) => {
                        setFinalVideoUrl(url);
                        setProjectStatus('completed');
                        setProgress(100);
                        updateStageStatus(5, 'complete');
                        toast.success('Video stitching complete!');
                      }}
                    />
                  )}

                  {/* Troubleshooter */}
                  {completedClips > 0 && projectId && !finalVideoUrl && (
                    <StitchingTroubleshooter
                      projectId={projectId}
                      projectStatus={projectStatus}
                      completedClips={completedClips}
                      totalClips={expectedClipCount}
                      onStitchComplete={(url) => {
                        setFinalVideoUrl(url);
                        setProjectStatus('completed');
                        setProgress(100);
                      }}
                      onStatusChange={(status) => {
                        setProjectStatus(status);
                        if (status === 'stitching') updateStageStatus(5, 'active');
                        else if (status === 'completed') updateStageStatus(5, 'complete');
                      }}
                    />
                  )}
                </div>

                {/* Right Column */}
                <div className="col-span-12 lg:col-span-4 space-y-4 lg:space-y-6">
                  
                  {/* Activity Log */}
                  <ProductionActivityLog logs={pipelineLogs} isLive={isRunning} />

                  {/* Continuity Manifest Panel */}
                  {clipResults.length > 0 && (
                    <Card className="glass-card">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Eye className="w-4 h-4 text-primary" />
                            <CardTitle className="text-sm">Continuity</CardTitle>
                            {isExtractingManifest && (
                              <Loader2 className="w-3 h-3 animate-spin text-primary" />
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {clipResults.filter(c => c.status === 'completed').slice(0, 8).map((clip) => (
                              <Button
                                key={clip.index}
                                variant={selectedManifestIndex === clip.index ? "default" : "ghost"}
                                size="sm"
                                className={cn(
                                  "w-6 h-6 p-0 text-[10px] rounded",
                                  selectedManifestIndex === clip.index 
                                    ? "bg-primary text-primary-foreground" 
                                    : "text-muted-foreground hover:text-foreground"
                                )}
                                onClick={async () => {
                                  setSelectedManifestIndex(clip.index);
                                  if (!getManifestForShot(clip.index) && clip.videoUrl) {
                                    const clipData = await supabase
                                      .from('video_clips')
                                      .select('last_frame_url')
                                      .eq('project_id', projectId)
                                      .eq('shot_index', clip.index)
                                      .single();
                                    
                                    if (clipData.data?.last_frame_url) {
                                      extractManifest(
                                        clipData.data.last_frame_url,
                                        clip.index,
                                        { 
                                          shotDescription: scriptShots?.[clip.index]?.description,
                                          previousManifest: getManifestForShot(clip.index - 1),
                                        }
                                      );
                                    }
                                  }
                                }}
                              >
                                {clip.index + 1}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <ContinuityManifestPanel
                          manifest={getManifestForShot(selectedManifestIndex) || null}
                          shotIndex={selectedManifestIndex}
                          isLoading={isExtractingManifest}
                        />
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Clip Preview Modal */}
      <AnimatePresence>
        {selectedClipUrl && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl flex items-center justify-center p-4"
            onClick={() => setSelectedClipUrl(null)}
          >
            <motion.div 
              initial={{ scale: 0.9 }} 
              animate={{ scale: 1 }} 
              exit={{ scale: 0.9 }}
              className="relative max-w-4xl w-full aspect-video"
              onClick={(e) => e.stopPropagation()}
            >
              <video src={selectedClipUrl} controls autoPlay className="w-full h-full rounded-xl" />
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute top-3 right-3 bg-background/50 backdrop-blur-sm text-foreground rounded-full" 
                onClick={() => setSelectedClipUrl(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
