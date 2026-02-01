import { useState, useEffect, useCallback, useRef, useMemo, memo, Suspense, lazy } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Film, Loader2, X, FileText, Users, Shield, Wand2, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { parsePendingVideoTasks } from '@/types/pending-video-tasks';
import { useClipRecovery } from '@/hooks/useClipRecovery';
import { ErrorBoundaryWrapper, ErrorBoundary } from '@/components/ui/error-boundary';
import type { ProFeaturesState, PipelineState, DegradationFlag } from '@/types/pro-features';
import { getErrorMessage } from '@/types/error-handling';

// CRITICAL: Import background directly - prevents flash on page load
import PipelineBackground from '@/components/production/PipelineBackground';
import { AppHeader } from '@/components/layout/AppHeader';
import { AppLoader } from '@/components/ui/app-loader';
import type { ScriptShot } from '@/components/studio/ScriptReviewPanel';

// Lazy load non-critical heavy components only
const ProductionSidebar = lazy(() => import('@/components/production/ProductionSidebar').then(m => ({ default: m.ProductionSidebar })));
const ProductionFinalVideo = lazy(() => import('@/components/production/ProductionFinalVideo').then(m => ({ default: m.ProductionFinalVideo })));
const ProductionDashboard = lazy(() => import('@/components/production/ProductionDashboard').then(m => ({ default: m.ProductionDashboard })));
const PipelineErrorBanner = lazy(() => import('@/components/production/PipelineErrorBanner').then(m => ({ default: m.PipelineErrorBanner })));
const CinematicPipelineProgress = lazy(() => import('@/components/production/CinematicPipelineProgress').then(m => ({ default: m.CinematicPipelineProgress })));
const ScriptReviewPanel = lazy(() => import('@/components/studio/ScriptReviewPanel').then(m => ({ default: m.ScriptReviewPanel })));
const FailedClipsPanel = lazy(() => import('@/components/studio/FailedClipsPanel').then(m => ({ default: m.FailedClipsPanel })));
const SpecializedModeProgress = lazy(() => import('@/components/production/SpecializedModeProgress').then(m => ({ default: m.SpecializedModeProgress })));

// Minimal fallbacks for error boundaries - memoized for stability
const MinimalFallback = memo(() => <div className="py-8" />);
MinimalFallback.displayName = 'MinimalFallback';

const SectionLoader = memo(() => (
  <div className="py-12 flex items-center justify-center">
    <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
  </div>
));
SectionLoader.displayName = 'SectionLoader';

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

// ProFeaturesState is now imported from @/types/pro-features

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

// Content component wrapped for error boundary with hook resilience
// CRITICAL: Use standard memo() without forwardRef to prevent "Component is not a function" crash
const ProductionContent = memo(function ProductionContent() {
  // Hook resilience - wrap in try-catch with fallbacks
  let navigate: ReturnType<typeof useNavigate>;
  try {
    navigate = useNavigate();
  } catch {
    navigate = () => {};
  }
  
  const [searchParams] = useSearchParams();
  const params = useParams();
  // Support both /production/:projectId and /production?projectId=xxx
  const projectId = params.projectId || searchParams.get('projectId');
  
  let authData: { user: any };
  try {
    authData = useAuth();
  } catch {
    authData = { user: null };
  }
  const { user } = authData;
  
  // Proactive clip recovery - checks for stuck clips on page load
  const { isRecovering: isRecoveringClips } = useClipRecovery(projectId || null, user?.id || null);
  
  // UI State - Sidebar starts collapsed for cleaner experience
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  
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
  const [clipDuration, setClipDuration] = useState(5); // 5s or 10s per clip
  const [isSimpleStitching, setIsSimpleStitching] = useState(false);
  const [autoStitchAttempted, setAutoStitchAttempted] = useState(false);
  const [allProductionProjects, setAllProductionProjects] = useState<ProductionProject[]>([]);
  const [scriptShots, setScriptShots] = useState<ScriptShot[] | null>(null);
  const [isApprovingScript, setIsApprovingScript] = useState(false);
  const [pipelineStage, setPipelineStage] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [proFeatures, setProFeatures] = useState<ProFeaturesState | null>(null);
  const [projectMode, setProjectMode] = useState<string>('text-to-video');
  const [pipelineState, setPipelineState] = useState<PipelineState | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [degradationFlags, setDegradationFlags] = useState<DegradationFlag[]>([]);

  // REMOVED: useSpring - causes continuous re-renders during progress updates
  // Progress animation is now handled in CSS for GPU acceleration
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
      setClipResults(clips.map(clip => {
        // Handle motion_vectors that might be double-stringified
        let motionVectors = clip.motion_vectors;
        if (typeof motionVectors === 'string') {
          try {
            motionVectors = JSON.parse(motionVectors);
          } catch {
            // Keep as is if parse fails
          }
        }
        
        return {
          index: clip.shot_index,
          status: clip.status as ClipResult['status'],
          videoUrl: clip.video_url || undefined,
          error: clip.error_message || undefined,
          id: clip.id,
          motionVectors: motionVectors as ClipResult['motionVectors'],
        };
      }));
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

  // OPTIMIZED: Timer only runs when pipeline is active, not on every render
  const isRunningRef = useRef(false);
  useEffect(() => {
    // Only tick when actively generating
    const isActivelyGenerating = ['generating', 'producing', 'rendering', 'stitching'].includes(projectStatus);
    isRunningRef.current = isActivelyGenerating;
    
    if (!isActivelyGenerating) return;
    
    const interval = setInterval(() => {
      if (isRunningRef.current) {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime, projectStatus]);

  useEffect(() => {
    // Abort controller for cleanup on unmount or projectId change
    const abortController = new AbortController();
    
    // OPTIMIZED: Batch all state resets into a single update cycle using functional updates
    // This prevents multiple re-renders from cascading setState calls
    const resetState = () => {
      setScriptShots(null);
      setClipResults([]);
      setFinalVideoUrl(null);
      setProgress(0);
      setCompletedClips(0);
      setAuditScore(null);
      setPipelineStage(null);
      setError(null);
      setLastError(null);
      setDegradationFlags([]);
      setAutoStitchAttempted(false);
      setStages(STAGE_CONFIG.map(s => ({ ...s, status: 'pending' as const })));
      setPipelineLogs([]);
    };
    
    // Only reset if projectId actually changes (not on initial mount with same ID)
    resetState();
    
    const loadProject = async () => {
      // Check if request was aborted before starting
      if (abortController.signal.aborted) return;
      
      const { data: { session } } = await supabase.auth.getSession();
      if (abortController.signal.aborted) return;
      
      if (!session?.user) {
        navigate('/auth');
        return;
      }

      // No projectId provided - find most recent active project
      if (!projectId) {
        try {
          const { data: recentProject, error: recentError } = await supabase
            .from('movie_projects')
            .select('id')
            .eq('user_id', session.user.id)
            .in('status', ['generating', 'producing', 'rendering', 'stitching', 'stitching_failed', 'failed', 'completed', 'awaiting_approval'])
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (abortController.signal.aborted) return;

          if (recentProject) {
            navigate(`/production/${recentProject.id}`, { replace: true });
            return;
          }
          
          if (recentError) {
            console.warn('[Production] Error fetching recent project:', recentError);
          }
          
          // Load all projects to show in sidebar
          await loadAllProductionProjects();
          if (abortController.signal.aborted) return;
          
          setIsLoading(false);
          return;
        } catch (err) {
          if (abortController.signal.aborted) return;
          console.error('[Production] Failed to load recent project:', err);
          setIsLoading(false);
          return;
        }
      }

      // Retry logic for newly created projects that may not be immediately available
      let project = null;
      let projectError = null;
      const maxRetries = 3;
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        // Check abort before each attempt
        if (abortController.signal.aborted) return;
        
        const { data, error } = await supabase
          .from('movie_projects')
          .select('*')
          .eq('id', projectId)
          .eq('user_id', session.user.id)
          .maybeSingle();
        
        if (abortController.signal.aborted) return;
        
        if (data) {
          project = data;
          projectError = null;
          break;
        }
        
        if (error) {
          projectError = error;
        }
        
        // Wait before retrying (project might still be creating)
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          if (abortController.signal.aborted) return;
          addLog(`Waiting for project to initialize... (attempt ${attempt + 2}/${maxRetries})`, 'info');
        }
      }

      if (!project) {
        if (abortController.signal.aborted) return;
        console.error('[Production] Project not found after retries:', projectId, projectError);
        toast.error('Project not found or still initializing. Redirecting to projects...');
        navigate('/projects');
        return;
      }

      setProjectTitle(project.title);
      setProjectStatus(project.status);
      setProjectMode(project.mode || 'text-to-video');
      
      // Load pipeline state for specialized modes
      if (project.pipeline_state) {
        const state = typeof project.pipeline_state === 'string' 
          ? JSON.parse(project.pipeline_state) 
          : project.pipeline_state;
        setPipelineState(state);
      }
      
      // PRIORITY: Use manifest URL from pending_video_tasks if available (permanent storage)
      // Fallback to video_url only if no manifest exists
      const pendingTasksForVideo = parsePendingVideoTasks(project.pending_video_tasks);
      const manifestUrl = pendingTasksForVideo?.manifestUrl;
      const isManifestMode = pendingTasksForVideo?.mode === 'manifest_playback';
      
      if (manifestUrl) {
        // Manifest URL is preferred - always points to permanent Supabase storage
        setFinalVideoUrl(manifestUrl);
      } else if (project.video_url && !project.video_url.includes('replicate.delivery')) {
        // Only use video_url if it's NOT a temporary Replicate URL
        setFinalVideoUrl(project.video_url);
      } else if (project.video_url?.endsWith('.json')) {
        // It's already a manifest URL
        setFinalVideoUrl(project.video_url);
      }
      
      // Load last error for display
      if (project.last_error) {
        setLastError(project.last_error);
        addLog(`Error: ${project.last_error}`, 'error');
      }
      
      // Extract degradation flags from pending_video_tasks
      const pendingTasks = parsePendingVideoTasks(project.pending_video_tasks);
      if (pendingTasks?.degradation) {
        const flags: Array<{type: string; message: string; severity: 'info' | 'warning' | 'error'}> = [];
        const deg = pendingTasks.degradation;
        
        if (deg.identityBibleFailed) {
          flags.push({ type: 'Identity Bible', message: 'Character identity extraction failed. Using fallback.', severity: 'warning' });
        }
        if (deg.musicGenerationFailed) {
          flags.push({ type: 'Music', message: 'Background music generation failed.', severity: 'info' });
        }
        if (deg.voiceGenerationFailed) {
          flags.push({ type: 'Voice', message: 'Voice narration generation failed.', severity: 'info' });
        }
        if (deg.auditFailed) {
          flags.push({ type: 'Quality Audit', message: 'Script quality audit was skipped.', severity: 'warning' });
        }
        if (deg.characterExtractionFailed) {
          flags.push({ type: 'Characters', message: 'Character extraction incomplete.', severity: 'warning' });
        }
        if (deg.sfxGenerationFailed) {
          flags.push({ type: 'Sound Effects', message: 'SFX generation failed.', severity: 'info' });
        }
        if (deg.reducedConsistencyMode) {
          flags.push({ type: 'Consistency', message: 'Running in reduced consistency mode.', severity: 'warning' });
        }
        if (deg.sceneImagePartialFail && deg.sceneImagePartialFail > 0) {
          flags.push({ type: 'Scene Images', message: `${deg.sceneImagePartialFail} scene image(s) failed to generate.`, severity: 'warning' });
        }
        
        setDegradationFlags(flags);
      }
      
      // Load pro features data
      const proData = project.pro_features_data as any;
      if (proData) {
        const continuityPlan = proData.continuityPlan;
        const continuityAnalysis = proData.continuityAnalysis;
        const envLock = continuityPlan?.environmentLock;
        
        // Build consistency score from multiple sources
        const consistencyScore = 
          proData.consistencyScore ?? 
          (continuityAnalysis?.score ? continuityAnalysis.score / 100 : undefined) ??
          (continuityPlan?.overallContinuityScore ? continuityPlan.overallContinuityScore / 100 : undefined);
        
        setProFeatures({
          masterSceneAnchor: proData.masterSceneAnchor || (envLock ? {
            lighting: envLock.lighting,
            environment: `${envLock.weather || ''} ${envLock.timeOfDay || ''}`.trim(),
            dominantColors: envLock.colorPalette ? [envLock.colorPalette] : [],
          } : null),
          characters: proData.characters || [],
          identityBible: proData.identityBible,
          consistencyScore,
          qualityTier: project.quality_tier,
          continuityAnalysis: continuityAnalysis ? {
            score: continuityAnalysis.score,
            transitions: continuityAnalysis.transitions || [],
            clipsToRetry: continuityAnalysis.clipsToRetry || [],
            bridgeClipsNeeded: continuityAnalysis.bridgeClipsNeeded || 0,
          } : undefined,
        });
        
        // Set audit score from continuity analysis if available
        if (continuityAnalysis?.score && !auditScore) {
          setAuditScore(continuityAnalysis.score);
        }
      }

      let scriptLoaded = false;
      const tasks = parsePendingVideoTasks(project.pending_video_tasks);
      if (tasks) {
        if (tasks.progress) setProgress(tasks.progress);
        // Try multiple sources for clip count: clipCount > shotCount > stages.preproduction.shotCount
        const clipCountValue = tasks.clipCount 
          || tasks.shotCount 
          || (tasks.stages as any)?.preproduction?.shotCount;
        if (clipCountValue) setExpectedClipCount(clipCountValue);
        // Extract clip duration from script shots or clipDuration
        const scriptDuration = tasks.clipDuration || tasks.script?.shots?.[0]?.durationSeconds;
        if (scriptDuration) setClipDuration(scriptDuration);
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
            const shots: ScriptShot[] = scriptData.shots.map((shot: Record<string, unknown>, idx: number) => ({
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
            
            // CRITICAL FIX: Set expectedClipCount from script shots
            setExpectedClipCount(shots.length);
            
            // Also extract clip duration from first shot
            const firstShotDuration = shots[0]?.durationSeconds;
            if (firstShotDuration && (firstShotDuration === 5 || firstShotDuration === 10)) {
              setClipDuration(firstShotDuration);
            }
            
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

      if (abortController.signal.aborted) return;
      await loadVideoClips();
      if (abortController.signal.aborted) return;
      await loadAllProductionProjects();
      if (abortController.signal.aborted) return;
      addLog('Connected to pipeline', 'info');
      setIsLoading(false);
    };

    loadProject();
    
    // Cleanup: abort pending operations on unmount or projectId change
    return () => {
      abortController.abort();
    };
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
        // PRIORITY: Check for manifest URL in pending_video_tasks first (realtime update)
        const realtimeTasks = parsePendingVideoTasks(project.pending_video_tasks);
        const realtimeManifestUrl = realtimeTasks?.manifestUrl;
        
        if (realtimeManifestUrl) {
          setFinalVideoUrl(realtimeManifestUrl);
        } else if (project.video_url && !(project.video_url as string).includes('replicate.delivery')) {
          setFinalVideoUrl(project.video_url as string);
        } else if ((project.video_url as string)?.endsWith('.json')) {
          setFinalVideoUrl(project.video_url as string);
        }
        
        // Update error state from realtime
        if (project.last_error) {
          setLastError(project.last_error as string);
        } else {
          setLastError(null);
        }
        
        const proData = project.pro_features_data as any;
        if (proData) {
          const continuityPlan = proData.continuityPlan;
          const continuityAnalysis = proData.continuityAnalysis;
          const envLock = continuityPlan?.environmentLock;
          
          const consistencyScore = 
            proData.consistencyScore ?? 
            (continuityAnalysis?.score ? continuityAnalysis.score / 100 : undefined) ??
            (continuityPlan?.overallContinuityScore ? continuityPlan.overallContinuityScore / 100 : undefined);
          
          setProFeatures({
            masterSceneAnchor: proData.masterSceneAnchor || (envLock ? {
              lighting: envLock.lighting,
              environment: `${envLock.weather || ''} ${envLock.timeOfDay || ''}`.trim(),
              dominantColors: envLock.colorPalette ? [envLock.colorPalette] : [],
            } : null),
            characters: proData.characters || [],
            identityBible: proData.identityBible,
            consistencyScore,
            qualityTier: project.quality_tier as string,
            continuityAnalysis: continuityAnalysis ? {
              score: continuityAnalysis.score,
              transitions: continuityAnalysis.transitions || [],
              clipsToRetry: continuityAnalysis.clipsToRetry || [],
              bridgeClipsNeeded: continuityAnalysis.bridgeClipsNeeded || 0,
            } : undefined,
          });
          
          if (continuityAnalysis?.score) {
            setAuditScore(continuityAnalysis.score);
          }
        }

        const tasks = parsePendingVideoTasks(project.pending_video_tasks);
        if (tasks) {
          if (tasks.progress) {
            setProgress(tasks.progress);
          }
          
          // Update clip count from any available source
          const clipCountValue = tasks.clipCount 
            || tasks.shotCount 
            || (tasks.stages as any)?.preproduction?.shotCount;
          if (clipCountValue) setExpectedClipCount(clipCountValue);
          
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
        // Always reload clips on any change (INSERT, UPDATE, DELETE)
        loadVideoClips();
        
        if (payload.new) {
          const clip = payload.new as Record<string, unknown>;
          const status = clip.status as string;
          const shotIndex = (clip.shot_index as number) + 1;
          
          if (status === 'completed') {
            addLog(`Clip ${shotIndex} done`, 'success');
          } else if (status === 'generating' && payload.eventType === 'INSERT') {
            addLog(`Clip ${shotIndex} generating...`, 'info');
          } else if (status === 'failed') {
            addLog(`Clip ${shotIndex} failed`, 'error');
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(projectChannel);
      supabase.removeChannel(clipsChannel);
    };
  }, [projectId, user, stages, updateStageStatus, addLog, loadVideoClips]);

  // CRITICAL: Auto-clear errors when all clips complete successfully
  // This prevents stale CONTINUITY_FAILURE errors from showing after recovery
  useEffect(() => {
    const allComplete = completedClips >= expectedClipCount && expectedClipCount > 0;
    const hasNoFailedClips = !clipResults.some(c => c.status === 'failed');
    
    // If all clips are done and none failed, clear any lingering transient errors
    if (allComplete && hasNoFailedClips && lastError) {
      // Clear transient errors that auto-recovered
      const transientPatterns = [
        'continuity', 'frame', 'production incomplete', 'mutex', 'locked'
      ];
      const isTransient = transientPatterns.some(p => 
        lastError.toLowerCase().includes(p)
      );
      
      if (isTransient) {
        setLastError(null);
        setDegradationFlags([]);
        // Also persist the clear to database
        if (projectId) {
          supabase
            .from('movie_projects')
            .update({ last_error: null })
            .eq('id', projectId);
        }
        addLog('All clips completed - cleared transient error', 'success');
      }
    }
  }, [completedClips, expectedClipCount, clipResults, lastError, projectId, addLog]);
  
  // Auto-stitch
  useEffect(() => {
    const allComplete = completedClips >= expectedClipCount && expectedClipCount > 0;
    const shouldTrigger = allComplete && 
      !['completed', 'stitching', 'failed'].includes(projectStatus) &&
      !autoStitchAttempted && !isSimpleStitching;

    if (shouldTrigger) {
      const timer = setTimeout(async () => {
        setAutoStitchAttempted(true);
        
        // CRITICAL: Clear any lingering errors before stitching
        // All clips are done, so any previous errors were transient
        setLastError(null);
        setDegradationFlags([]);
        
        addLog('Stitching...', 'info');
        updateStageStatus(5, 'active');
        setProgress(85);

        try {
          // Clear error in database before stitch
          if (projectId) {
            await supabase
              .from('movie_projects')
              .update({ last_error: null, status: 'stitching' })
              .eq('id', projectId);
          }
          
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
        } catch (err) {
          addLog(`Stitch failed: ${getErrorMessage(err)}`, 'error');
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [completedClips, expectedClipCount, projectStatus, autoStitchAttempted, isSimpleStitching, projectId, user, addLog, updateStageStatus]);


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
    
    // CRITICAL: Clear error state BEFORE resuming to reset UI
    // This prevents stale error banners from persisting during recovery
    setLastError(null);
    setDegradationFlags([]);
    
    try {
      // Determine best resume stage based on current state
      let resumeFrom: 'qualitygate' | 'assets' | 'production' | 'postproduction' = 'production';
      
      // If we have completed clips, resume from production
      const completedCount = clipResults.filter(c => c.status === 'completed').length;
      if (completedCount > 0 && completedCount === expectedClipCount) {
        // All clips done but no final video - resume from postproduction
        resumeFrom = 'postproduction';
      } else if (pipelineStage === 'assets' || (scriptShots && scriptShots.length > 0 && completedCount === 0)) {
        // Has script but no clips - check if assets stage
        resumeFrom = 'assets';
      }
      
      addLog(`Resuming pipeline from ${resumeFrom}...`, 'info');
      
      // Clear error in database before resuming
      await supabase
        .from('movie_projects')
        .update({ last_error: null })
        .eq('id', projectId);
      
      const { data, error } = await supabase.functions.invoke('resume-pipeline', {
        body: { 
          userId: user.id, 
          projectId, 
          resumeFrom,
          // Pass the current script if available for consistency
          approvedShots: scriptShots?.map(shot => ({
            id: shot.id,
            title: shot.title,
            description: shot.description,
            durationSeconds: shot.durationSeconds,
          })),
        },
      });
      
      if (error) throw error;
      if (data?.success) {
        toast.success(`Resumed from ${resumeFrom}`);
        setProjectStatus('generating');
        addLog(`Pipeline resumed successfully`, 'success');
      } else if (data?.error) {
        throw new Error(data.error);
      }
    } catch (err) {
      const errorMsg = getErrorMessage(err, 'Resume failed');
      toast.error(errorMsg);
      addLog(`Resume failed: ${errorMsg}`, 'error');
      // Restore error state on failure
      setLastError(errorMsg);
    } finally {
      setIsResuming(false);
    }
  };

  const handleCancelPipeline = async () => {
    if (!projectId || !user || isCancelling) return;
    
    if (!window.confirm('Are you sure you want to cancel this production? This will stop all background processing and cannot be undone.')) return;
    
    setIsCancelling(true);
    
    try {
      addLog('Cancelling pipeline and all background processes...', 'warning');
      
      // Call the comprehensive cancel-project edge function
      const { data, error } = await supabase.functions.invoke('cancel-project', {
        body: {
          projectId,
          userId: user.id,
        },
      });
      
      if (error) {
        throw new Error(error.message || 'Failed to cancel project');
      }
      
      if (!data?.success) {
        throw new Error(data?.error || 'Cancellation failed');
      }
      
      // Log what was cancelled
      const details = data.details || {};
      addLog(`Cancelled: ${details.predictionsCanelled || 0} predictions, ${details.clipsCancelled || 0} clips`, 'success');
      
      setProjectStatus('cancelled');
      toast.success('Project cancelled successfully. All background processes stopped.');
      
      // Navigate after a brief delay to show the success message
      setTimeout(() => navigate('/projects'), 500);
    } catch (err) {
      const errorMsg = getErrorMessage(err, 'Failed to cancel');
      toast.error(errorMsg);
      addLog(`Cancel failed: ${errorMsg}`, 'error');
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
    } catch (err) {
      const msg = getErrorMessage(err, 'Failed to approve script');
      toast.error(msg);
      addLog(`Script approval failed: ${msg}`, 'error');
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
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to regenerate script'));
    }
  };

  // Determine running/complete/error states with better granularity
  const isRunning = ['generating', 'producing', 'rendering', 'stitching', 'assembling'].includes(projectStatus);
  const isComplete = projectStatus === 'completed' && !!finalVideoUrl;
  const isError = projectStatus === 'failed' || projectStatus === 'stitching_failed';
  const canResume = isError || (projectStatus === 'failed' && clipResults.some(c => c.status === 'completed'));

  // Memoized data transformations to prevent re-renders
  const clipResultsForDashboard = useMemo(() => 
    clipResults.map(c => ({
      index: c.index,
      status: c.status,
      videoUrl: c.videoUrl,
      error: c.error,
    })), [clipResults]
  );

  const consistencyScoreValue = useMemo(() => 
    proFeatures?.consistencyScore ?? 
    (proFeatures?.continuityAnalysis?.score ? proFeatures.continuityAnalysis.score / 100 : undefined),
    [proFeatures?.consistencyScore, proFeatures?.continuityAnalysis?.score]
  );

  const transitionsData = useMemo(() => 
    proFeatures?.continuityAnalysis?.transitions?.map(t => ({
      fromIndex: t.fromIndex,
      toIndex: t.toIndex,
      overallScore: t.overallScore,
      needsBridge: t.needsBridge,
    })),
    [proFeatures?.continuityAnalysis?.transitions]
  );

  const failedClipsData = useMemo(() => 
    clipResults.filter(c => c.status === 'failed').map(c => ({
      index: c.index,
      error: c.error,
      prompt: scriptShots?.[c.index]?.description,
      id: c.id,
    })),
    [clipResults, scriptShots]
  );

  // Stable callback for play clip
  const handlePlayClip = useCallback((url: string) => {
    setSelectedClipUrl(url);
  }, []);

  if (isLoading) {
    return <AppLoader message="Loading production..." />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Premium Green Pipeline Background - CRITICAL: Direct render, no lazy load */}
      <PipelineBackground />
      
      {/* App Header */}
      <AppHeader showCreate={false} />

      {/* Main Layout */}
      <div className="relative z-10 flex-1 flex overflow-hidden">
        {/* Sidebar - Hidden on mobile */}
        <div className="hidden md:block">
          <ErrorBoundaryWrapper fallback={<MinimalFallback />}>
            <Suspense fallback={<MinimalFallback />}>
              <ProductionSidebar
                projects={allProductionProjects}
                activeProjectId={projectId}
                isCollapsed={sidebarCollapsed}
                onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
              />
            </Suspense>
          </ErrorBoundaryWrapper>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Content Grid */}
          <div className="flex-1 overflow-auto p-4 lg:p-6">
            <div className="max-w-5xl mx-auto space-y-5">
              
              {/* Script Review Panel - Only shown when awaiting approval */}
              {scriptShots && scriptShots.length > 0 && pipelineStage === 'awaiting_approval' && (
                <ErrorBoundaryWrapper fallback={<MinimalFallback />}>
                  <Suspense fallback={<SectionLoader />}>
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
                  </Suspense>
                </ErrorBoundaryWrapper>
              )}
              
              {/* Specialized Mode Progress - Avatar, Motion Transfer, Style Transfer */}
              {['avatar', 'motion-transfer', 'video-to-video'].includes(projectMode) && pipelineState && (
                <ErrorBoundaryWrapper fallback={<MinimalFallback />}>
                  <Suspense fallback={<SectionLoader />}>
                    <SpecializedModeProgress
                      projectId={projectId!}
                      mode={projectMode as 'avatar' | 'motion-transfer' | 'video-to-video'}
                      pipelineState={pipelineState}
                      videoUrl={finalVideoUrl}
                      onComplete={() => {
                        setProjectStatus('completed');
                        setProgress(100);
                        toast.success('Video generation complete!');
                      }}
                      onRetry={() => {
                        toast.info('Retry feature coming soon');
                      }}
                    />
                  </Suspense>
                </ErrorBoundaryWrapper>
              )}
              
              {/* Pipeline Error Banner - Shows errors and degradation warnings */}
              {/* CRITICAL FIX: Hide ALL error banners during active generation OR completed projects */}
              {/* Transient errors (continuity failures, frame extraction) auto-recover - don't alarm users */}
              {(() => {
                // CRITICAL: Never show error banners for completed projects
                // The video is done - showing old transient errors is confusing
                if (projectStatus === 'completed' && finalVideoUrl) {
                  return null;
                }
                
                const hasGeneratingClips = clipResults.some(c => c.status === 'generating');
                const hasCompletedClips = clipResults.some(c => c.status === 'completed');
                const hasPendingClips = clipResults.some(c => c.status === 'pending');
                const failedClipCount = clipResults.filter(c => c.status === 'failed').length;
                
                // Determine if pipeline is actively working (any clips generating OR more to process)
                const isActivelyProducing = ['generating', 'producing', 'rendering'].includes(projectStatus) && 
                  (hasGeneratingClips || hasPendingClips || (hasCompletedClips && completedClips < expectedClipCount));
                
                // CRITICAL: Suppress ALL transient errors during active production
                // These errors auto-recover and confuse users when shown mid-generation
                const transientErrorPatterns = [
                  'production incomplete',
                  'continuity_failure',
                  'strict_continuity',
                  'frame extraction',
                  'last frame',
                  'no last frame',
                  'generation_locked',
                  'mutex',
                  'rate limit'
                ];
                
                const isTransientError = lastError && transientErrorPatterns.some(
                  pattern => lastError.toLowerCase().includes(pattern)
                );
                
                // Only show error banner when:
                // 1. Pipeline has actually failed (not just transient error during generation)
                // 2. OR we have real non-transient errors when not actively producing
                const shouldShowBanner = !isActivelyProducing && 
                  (lastError || degradationFlags.length > 0 || projectStatus === 'failed');
                
                // If actively producing, never show transient errors
                // If done/failed and still have error, show it
                const showBanner = shouldShowBanner && !(isActivelyProducing && isTransientError);
                
                // Handler to dismiss error and clear from database
                const handleDismissError = async () => {
                  setLastError(null);
                  setDegradationFlags([]);
                  
                  // Clear last_error from database to prevent it coming back on refresh
                  if (projectId) {
                    await supabase
                      .from('movie_projects')
                      .update({ last_error: null })
                      .eq('id', projectId);
                  }
                };
                
                return showBanner ? (
                  <ErrorBoundaryWrapper fallback={null}>
                    <Suspense fallback={null}>
                      <PipelineErrorBanner
                        error={lastError}
                        degradationFlags={degradationFlags}
                        projectStatus={projectStatus}
                        failedClipCount={failedClipCount}
                        totalClipCount={expectedClipCount}
                        onRetry={handleResume}
                        onDismiss={handleDismissError}
                        isRetrying={isResuming}
                      />
                    </Suspense>
                  </ErrorBoundaryWrapper>
                ) : null;
              })()}
              
              {/* Final Video (for cinematic pipeline) */}
              {finalVideoUrl && !['avatar', 'motion-transfer', 'video-to-video'].includes(projectMode) && (
                <ErrorBoundaryWrapper fallback={<MinimalFallback />}>
                  <Suspense fallback={<SectionLoader />}>
                    <ProductionFinalVideo videoUrl={finalVideoUrl} />
                  </Suspense>
                </ErrorBoundaryWrapper>
              )}

              {/* NEW: World-Class Cinematic Pipeline Animation */}
              {!['avatar', 'motion-transfer', 'video-to-video'].includes(projectMode) && (
                <ErrorBoundaryWrapper fallback={<MinimalFallback />}>
                  <Suspense fallback={<SectionLoader />}>
                    <CinematicPipelineProgress
                      stages={stages}
                      progress={progress}
                      isComplete={isComplete}
                      isError={isError}
                      isRunning={isRunning}
                      elapsedTime={elapsedTime}
                      projectTitle={projectTitle}
                      lastError={lastError}
                      onResume={handleResume}
                      onCancel={handleCancelPipeline}
                      isResuming={isResuming}
                      isCancelling={isCancelling}
                    />
                  </Suspense>
                </ErrorBoundaryWrapper>
              )}

              {/* Streamlined Production Dashboard - Real data only */}
              {/* HIDDEN for specialized modes (avatar/motion-transfer/video-to-video) - they use SpecializedModeProgress instead */}
              {!['avatar', 'motion-transfer', 'video-to-video'].includes(projectMode) && (
                <ErrorBoundaryWrapper fallback={<MinimalFallback />}>
                  <Suspense fallback={<SectionLoader />}>
                    <ProductionDashboard
                      projectTitle={projectTitle}
                      progress={progress}
                      elapsedTime={elapsedTime}
                      isRunning={isRunning}
                      isComplete={isComplete}
                      clips={clipResultsForDashboard}
                      totalClips={expectedClipCount}
                      completedClips={completedClips}
                      consistencyScore={consistencyScoreValue}
                      transitions={transitionsData}
                      onPlayClip={handlePlayClip}
                      onRetryClip={handleRetryClip}
                      onStitch={handleSimpleStitch}
                      onResume={handleResume}
                      isStitching={isSimpleStitching}
                      isResuming={isResuming}
                      finalVideoUrl={finalVideoUrl}
                      clipDuration={clipDuration}
                    />
                  </Suspense>
                </ErrorBoundaryWrapper>
              )}

              {/* Failed Clips Panel - Keep for detailed error handling */}
              {failedClipsData.length > 0 && user && projectId && (
                <ErrorBoundaryWrapper fallback={<MinimalFallback />}>
                  <Suspense fallback={<SectionLoader />}>
                    <FailedClipsPanel
                      clips={failedClipsData}
                      projectId={projectId}
                      userId={user.id}
                      onRetry={handleRetryClip}
                      isRetrying={retryingClipIndex !== null}
                      retryingIndex={retryingClipIndex}
                    />
                  </Suspense>
                </ErrorBoundaryWrapper>
              )}

              {/* Stitch Progress - Simple inline message */}
              {projectId && ['stitching', 'post_production', 'processing'].includes(projectStatus) && (
                <Card className="bg-white/5 border-white/10">
                  <CardContent className="p-4 flex items-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    <span className="text-white/70">Stitching video clips together...</span>
                  </CardContent>
                </Card>
              )}

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
});

// Wrapper with error boundary
export default function Production() {
  return (
    <ErrorBoundary>
      <ProductionContent />
    </ErrorBoundary>
  );
}
