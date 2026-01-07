import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Film, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Play,
  Download,
  Sparkles,
  Clock,
  Coins,
  Palette,
  Music,
  Mic,
  Image,
  Shield,
  Clapperboard,
  Wand2,
  Upload,
  Zap,
  RotateCcw,
  Users,
  FileText,
  Layers,
  Star,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Eye
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ReferenceImageUpload } from '@/components/studio/ReferenceImageUpload';
import { CostConfirmationDialog } from '@/components/studio/CostConfirmationDialog';
import { ProductionPipeline } from '@/components/studio/ProductionPipeline';
import { StickyGenerateBar } from '@/components/studio/StickyGenerateBar';
import { ScriptReviewPanel, type ScriptShot } from '@/components/studio/ScriptReviewPanel';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { ReferenceImageAnalysis } from '@/types/production-pipeline';
import { cn } from '@/lib/utils';

type PipelineMode = 'ai' | 'manual';
type PipelineStage = 'idle' | 'preproduction' | 'awaiting_approval' | 'qualitygate' | 'assets' | 'production' | 'postproduction' | 'complete' | 'error';

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
  qaResult?: {
    score: number;
    verdict: string;
    issues?: Array<{ description: string; severity: string }>;
  };
}

const COLOR_PRESETS = [
  { value: 'cinematic', label: 'Cinematic', description: 'Hollywood orange-teal' },
  { value: 'warm', label: 'Warm', description: 'Golden hour glow' },
  { value: 'cool', label: 'Cool', description: 'Moody blue tones' },
  { value: 'neutral', label: 'Neutral', description: 'Natural colors' },
  { value: 'documentary', label: 'Documentary', description: 'Muted realistic' },
  { value: 'noir', label: 'Film Noir', description: 'High contrast B&W' },
];

const MOOD_OPTIONS = [
  { value: 'epic', label: 'Epic', icon: '⚔️' },
  { value: 'tension', label: 'Suspense', icon: '🎭' },
  { value: 'emotional', label: 'Emotional', icon: '💫' },
  { value: 'action', label: 'Action', icon: '⚡' },
  { value: 'mysterious', label: 'Mystery', icon: '🌙' },
  { value: 'uplifting', label: 'Uplifting', icon: '✨' },
  { value: 'dark', label: 'Dark', icon: '🖤' },
  { value: 'romantic', label: 'Romantic', icon: '❤️' },
];

const GENRE_OPTIONS = [
  { value: 'cinematic', label: 'Cinematic' },
  { value: 'documentary', label: 'Documentary' },
  { value: 'ad', label: 'Commercial' },
  { value: 'educational', label: 'Educational' },
  { value: 'explainer', label: 'Explainer' },
  { value: 'storytelling', label: 'Narrative' },
  { value: 'motivational', label: 'Motivational' },
  { value: 'vlog', label: 'Vlog' },
];

const CLIP_DURATION = 4;

export function UnifiedStudio() {
  const { user } = useAuth();
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Pipeline mode and configuration
  const [mode, setMode] = useState<PipelineMode>('ai');
  const [clipCount, setClipCount] = useState(6);
  
  // AI Mode inputs
  const [concept, setConcept] = useState('');
  const [mood, setMood] = useState('epic');
  const [genre, setGenre] = useState('cinematic');
  
  // Manual Mode inputs
  const [manualPrompts, setManualPrompts] = useState<string[]>(
    Array(6).fill('').map((_, i) => i === 0 ? 'Opening shot: Wide cinematic establishing view' : '')
  );
  
  // Shared options
  const [colorGrading, setColorGrading] = useState('cinematic');
  const [includeVoice, setIncludeVoice] = useState(true);
  const [includeMusic, setIncludeMusic] = useState(true);
  const [referenceImageAnalysis, setReferenceImageAnalysis] = useState<ReferenceImageAnalysis | undefined>();
  const [qualityTier, setQualityTier] = useState<'standard' | 'professional'>('standard');
  
  // UI State
  const [currentStage, setCurrentStage] = useState<PipelineStage>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [pipelineDetails, setPipelineDetails] = useState<any>(null);
  const [sceneImages, setSceneImages] = useState<Array<{ sceneNumber: number; imageUrl: string }>>([]);
  const [identityBibleViews, setIdentityBibleViews] = useState<{ front?: string; side?: string; threeQuarter?: string } | null>(null);
  const [clipResults, setClipResults] = useState<ClipResult[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [auditScore, setAuditScore] = useState<number | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [showCostDialog, setShowCostDialog] = useState(false);
  const [referenceExpanded, setReferenceExpanded] = useState(false);
  const [userCredits, setUserCredits] = useState(0);
  const [pipelineLogs, setPipelineLogs] = useState<Array<{ time: string; message: string; type: 'info' | 'success' | 'warning' | 'error' }>>([]);
  const [pendingScript, setPendingScript] = useState<ScriptShot[] | null>(null);
  const [isResumingPipeline, setIsResumingPipeline] = useState(false);
  
  // Stage tracking
  const [stages, setStages] = useState<StageStatus[]>([
    { name: 'Script Generation', shortName: 'Script', status: 'pending' },
    { name: 'Identity Analysis', shortName: 'Identity', status: 'pending' },
    { name: 'Quality Audit', shortName: 'QA', status: 'pending' },
    { name: 'Asset Creation', shortName: 'Assets', status: 'pending' },
    { name: 'Video Production', shortName: 'Production', status: 'pending' },
    { name: 'Final Assembly', shortName: 'Assembly', status: 'pending' },
  ]);

  // Helper to add pipeline log entry
  const addPipelineLog = useCallback((message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setPipelineLogs(prev => [...prev, { time, message, type }].slice(-50)); // Keep last 50 logs
  }, []);

  const totalDuration = clipCount * CLIP_DURATION;
  const estimatedCredits = mode === 'ai' 
    ? (qualityTier === 'professional' ? 400 : 350)
    : (qualityTier === 'professional' ? 350 : 300);

  // Fetch user credits
  useEffect(() => {
    const fetchCredits = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('credits_balance')
        .eq('id', user.id)
        .single();
      if (data) setUserCredits(data.credits_balance);
    };
    fetchCredits();
  }, [user]);

  // Check for projects awaiting approval on mount
  useEffect(() => {
    const checkForAwaitingApproval = async () => {
      console.log('[Studio] Checking for awaiting approval, user:', !!user, 'stage:', currentStage);
      if (!user) return;
      if (currentStage !== 'idle') {
        console.log('[Studio] Skipping check - not idle');
        return;
      }
      
      try {
        // Find projects that are awaiting approval
        const { data: projects, error } = await supabase
          .from('movie_projects')
          .select('id, pending_video_tasks, generated_script, status')
          .eq('user_id', user.id)
          .eq('status', 'awaiting_approval')
          .order('updated_at', { ascending: false })
          .limit(1);
        
        console.log('[Studio] Awaiting approval query result:', projects?.length, error);
        
        if (error) {
          console.error('Error checking for awaiting approval:', error);
          return;
        }
        
        if (projects && projects.length > 0) {
          const project = projects[0];
          const tasks = project.pending_video_tasks as any;
          
          console.log('[Studio] Found awaiting project:', project.id, 'tasks:', !!tasks?.script?.shots);
          
          // Check if there's a script to review (either in tasks or generated_script)
          let scriptData = tasks?.script?.shots;
          if (!scriptData && project.generated_script) {
            try {
              const parsed = typeof project.generated_script === 'string' 
                ? JSON.parse(project.generated_script) 
                : project.generated_script;
              scriptData = parsed?.shots;
              console.log('[Studio] Parsed generated_script, shots:', scriptData?.length);
            } catch (e) {
              console.error('Failed to parse generated_script:', e);
            }
          }
          
          if (scriptData && Array.isArray(scriptData)) {
            console.log('[Studio] Loading script with', scriptData.length, 'shots');
            
            // Convert shots to ScriptShot format
            const scriptShots: ScriptShot[] = scriptData.map((shot: any, index: number) => ({
              id: shot.id || `shot_${index + 1}`,
              index,
              title: shot.title || `Shot ${index + 1}`,
              description: shot.description || '',
              durationSeconds: shot.durationSeconds || 4,
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
            
            // Restore the awaiting approval state
            setActiveProjectId(project.id);
            setPendingScript(scriptShots);
            setCurrentStage('awaiting_approval');
            setProgress(30);
            setClipCount(scriptShots.length);
            
            // Update stages
            setStages(prev => {
              const updated = [...prev];
              updated[0] = { ...updated[0], status: 'complete', details: `${scriptShots.length} shots` };
              return updated;
            });
            
            toast.info('You have a script waiting for approval!');
          }
        }
      } catch (err) {
        console.error('Error checking awaiting approval:', err);
      }
    };
    
    checkForAwaitingApproval();
  }, [user]);

  const updatePrompt = (index: number, value: string) => {
    setManualPrompts(prev => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  };

  const addPrompt = () => {
    if (clipCount < 12) {
      setClipCount(prev => prev + 1);
      setManualPrompts(prev => [...prev, '']);
    }
  };

  const removePrompt = (index: number) => {
    if (clipCount > 2) {
      setClipCount(prev => prev - 1);
      setManualPrompts(prev => prev.filter((_, i) => i !== index));
    }
  };

  const updateStageStatus = useCallback((stageIndex: number, status: StageStatus['status'], details?: string) => {
    setStages(prev => {
      const updated = [...prev];
      updated[stageIndex] = { ...updated[stageIndex], status, details };
      return updated;
    });
  }, []);

  // Elapsed time tracker
  const [elapsedTime, setElapsedTime] = useState(0);
  useEffect(() => {
    if (!startTime || currentStage === 'complete' || currentStage === 'error' || currentStage === 'idle') {
      return;
    }
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime, currentStage]);

  // Realtime subscription for pipeline progress via movie_projects.pending_video_tasks
  useEffect(() => {
    if (!activeProjectId || currentStage === 'idle' || currentStage === 'complete' || currentStage === 'error') {
      return;
    }

    const channel = supabase
      .channel(`studio_project_${activeProjectId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'movie_projects',
          filter: `id=eq.${activeProjectId}`,
        },
        (payload) => {
          const project = payload.new as any;
          if (!project) return;
          
          const tasks = project.pending_video_tasks;
          if (!tasks) return;
          
          // Update progress from background task
          if (tasks.progress) {
            setProgress(tasks.progress);
          }
          
          // Map stage names to display names and indices
          const stageMap: Record<string, { index: number; name: string }> = {
            'initializing': { index: -1, name: 'Initializing pipeline' },
            'preproduction': { index: 0, name: 'Pre-production' },
            'qualitygate': { index: 2, name: 'Quality audit' },
            'assets': { index: 3, name: 'Asset creation' },
            'production': { index: 4, name: 'Video production' },
            'postproduction': { index: 5, name: 'Post-production' },
          };
          
          // Log stage changes
          if (tasks.stage && stageMap[tasks.stage]) {
            const stageInfo = stageMap[tasks.stage];
            if (stageInfo.index >= 0) {
              addPipelineLog(`Stage: ${stageInfo.name} (${tasks.progress || 0}%)`, 'info');
            }
          }
          
          // Update stage status based on current stage
          if (tasks.stage && stageMap[tasks.stage] && stageMap[tasks.stage].index >= 0) {
            const stageIdx = stageMap[tasks.stage].index;
            // Mark previous stages as complete
            for (let i = 0; i < stageIdx; i++) {
              if (stages[i].status !== 'complete' && stages[i].status !== 'skipped') {
                updateStageStatus(i, 'complete');
              }
            }
            // Mark current stage as active
            updateStageStatus(stageIdx, 'active');
          }
          
          // Log and update specific stage details
          if (tasks.scriptGenerated && !pipelineLogs.some(l => l.message.includes('Script generated'))) {
            addPipelineLog('Script generated successfully', 'success');
          }
          
          if (tasks.auditScore) {
            setAuditScore(tasks.auditScore);
            updateStageStatus(2, 'complete', `${tasks.auditScore}%`);
            if (!pipelineLogs.some(l => l.message.includes('Quality score'))) {
              addPipelineLog(`Quality score: ${tasks.auditScore}/100`, 'success');
            }
          }
          
          if (tasks.charactersExtracted) {
            updateStageStatus(1, 'complete', `${tasks.charactersExtracted} chars`);
            if (!pipelineLogs.some(l => l.message.includes('characters extracted'))) {
              addPipelineLog(`${tasks.charactersExtracted} characters extracted`, 'info');
            }
          }
          
          if (tasks.hasVoice !== undefined) {
            if (tasks.hasVoice && !pipelineLogs.some(l => l.message.includes('Voice narration'))) {
              addPipelineLog('Voice narration generated', 'success');
            }
          }
          
          if (tasks.hasMusic !== undefined) {
            if (tasks.hasMusic && !pipelineLogs.some(l => l.message.includes('Background music'))) {
              addPipelineLog('Background music generated', 'success');
            }
          }
          
          if (tasks.clipsCompleted) {
            updateStageStatus(4, 'active', `${tasks.clipsCompleted}/${clipCount} clips`);
            addPipelineLog(`Video clips: ${tasks.clipsCompleted}/${clipCount} completed`, 'info');
          }
          
          // Handle completion
          if (tasks.stage === 'complete' && tasks.finalVideoUrl) {
            setFinalVideoUrl(tasks.finalVideoUrl);
            setCurrentStage('complete');
            setProgress(100);
            addPipelineLog('Pipeline completed successfully!', 'success');
            
            // Mark all stages complete
            stages.forEach((_, i) => updateStageStatus(i, 'complete'));
            
            // Extract stage details if available
            if (tasks.stages) {
              if (tasks.stages.preproduction) {
                updateStageStatus(0, 'complete', `${tasks.stages.preproduction.shotCount || clipCount} shots`);
                if (tasks.stages.preproduction.charactersExtracted) {
                  updateStageStatus(1, 'complete', `${tasks.stages.preproduction.charactersExtracted} chars`);
                }
              }
              if (tasks.stages.qualitygate) {
                setAuditScore(tasks.stages.qualitygate.auditScore);
                updateStageStatus(2, 'complete', `${tasks.stages.qualitygate.auditScore}%`);
              }
              if (tasks.stages.assets) {
                const assetDetails = [];
                if (tasks.stages.assets.hasVoice) assetDetails.push('Voice');
                if (tasks.stages.assets.hasMusic) assetDetails.push('Music');
                updateStageStatus(3, 'complete', assetDetails.join(' + ') || 'Ready');
              }
              if (tasks.stages.production) {
                updateStageStatus(4, 'complete', `${tasks.stages.production.clipsCompleted || clipCount} clips`);
              }
            }
            
            updateStageStatus(5, 'complete', 'Done');
            toast.success('Video generated successfully!');
          }
          
          // Handle awaiting_approval stage - show script for review
          if (tasks.stage === 'awaiting_approval' && tasks.script?.shots) {
            console.log('[Studio] Script ready for approval:', tasks.script.shots.length, 'shots');
            setCurrentStage('awaiting_approval');
            setProgress(30);
            updateStageStatus(0, 'complete', `${tasks.script.shots.length} shots`);
            addPipelineLog('Script generated! Awaiting your approval...', 'success');
            
            // Convert shots to ScriptShot format
            const scriptShots: ScriptShot[] = tasks.script.shots.map((shot: any, index: number) => ({
              id: shot.id || `shot_${index + 1}`,
              index,
              title: shot.title || `Shot ${index + 1}`,
              description: shot.description || '',
              durationSeconds: shot.durationSeconds || 4,
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
            
            setPendingScript(scriptShots);
            toast.info('Script ready! Please review and approve to continue.');
          }
          
          // Handle error
          if (tasks.stage === 'error') {
            setError(tasks.error || 'Pipeline failed');
            setCurrentStage('error');
            addPipelineLog(`Error: ${tasks.error || 'Pipeline failed'}`, 'error');
            toast.error(tasks.error || 'Pipeline failed');
          }
          
          // Handle status change to completed
          if (project.status === 'completed' && project.video_url) {
            setFinalVideoUrl(project.video_url);
            setCurrentStage('complete');
          }
          
          if (project.status === 'failed') {
            setError('Pipeline failed');
            setCurrentStage('error');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeProjectId, currentStage, clipCount, updateStageStatus, stages, addPipelineLog]);

  const resetState = () => {
    setCurrentStage('idle');
    setProgress(0);
    setError(null);
    setFinalVideoUrl(null);
    setPipelineDetails(null);
    setSceneImages([]);
    setIdentityBibleViews(null);
    setClipResults([]);
    setActiveProjectId(null);
    setAuditScore(null);
    setStartTime(null);
    setElapsedTime(0);
    setPipelineLogs([]);
    setPendingScript(null);
    setIsResumingPipeline(false);
    setStages(prev => prev.map(s => ({ ...s, status: 'pending', details: undefined })));
    abortControllerRef.current = null;
  };

  // Handle script approval - resume pipeline with approved/edited shots
  const handleScriptApprove = async (approvedShots: ScriptShot[]) => {
    if (!activeProjectId || !user) {
      toast.error('Missing project or user information');
      return;
    }

    setIsResumingPipeline(true);
    addPipelineLog('Script approved! Resuming pipeline...', 'success');
    toast.info('Resuming video production pipeline...');

    try {
      const { data, error: funcError } = await supabase.functions.invoke('resume-pipeline', {
        body: {
          projectId: activeProjectId,
          userId: user.id,
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

      if (funcError) throw funcError;

      if (data?.success) {
        setPendingScript(null);
        setCurrentStage('qualitygate');
        updateStageStatus(0, 'complete', `${approvedShots.length} shots`);
        updateStageStatus(2, 'active', 'Auditing...');
        addPipelineLog('Pipeline resumed! Starting quality audit...', 'info');
      } else {
        throw new Error(data?.error || 'Failed to resume pipeline');
      }
    } catch (err) {
      console.error('Resume pipeline error:', err);
      const message = err instanceof Error ? err.message : 'Failed to resume pipeline';
      setError(message);
      addPipelineLog(`Error: ${message}`, 'error');
      toast.error(message);
    } finally {
      setIsResumingPipeline(false);
    }
  };

  // Handle script regeneration
  const handleScriptRegenerate = async () => {
    if (!activeProjectId || !user) {
      toast.error('Missing project or user information');
      return;
    }

    setPendingScript(null);
    setIsResumingPipeline(true);
    addPipelineLog('Regenerating script...', 'info');
    toast.info('Regenerating script...');

    try {
      // Reset to preproduction and call pipeline again
      setCurrentStage('preproduction');
      updateStageStatus(0, 'active', 'Regenerating...');

      const requestBody: any = {
        userId: user.id,
        projectId: activeProjectId,
        clipCount,
        totalDuration: clipCount * CLIP_DURATION,
        includeVoice,
        includeMusic,
        genre,
        mood,
        colorGrading,
        qualityTier,
      };

      if (mode === 'ai') {
        requestBody.concept = concept;
      } else {
        requestBody.manualPrompts = manualPrompts.slice(0, clipCount);
      }

      if (referenceImageAnalysis) {
        requestBody.referenceImageAnalysis = referenceImageAnalysis;
      }

      const { data, error: funcError } = await supabase.functions.invoke('hollywood-pipeline', {
        body: requestBody,
      });

      if (funcError) throw funcError;

      if (data?.success) {
        addPipelineLog('Script regeneration started...', 'info');
      } else {
        throw new Error(data?.error || 'Failed to regenerate script');
      }
    } catch (err) {
      console.error('Regenerate script error:', err);
      const message = err instanceof Error ? err.message : 'Failed to regenerate script';
      setError(message);
      setCurrentStage('error');
      addPipelineLog(`Error: ${message}`, 'error');
      toast.error(message);
    } finally {
      setIsResumingPipeline(false);
    }
  };

  // Handle canceling script review
  const handleScriptCancel = () => {
    setPendingScript(null);
    resetState();
    toast.info('Pipeline cancelled');
  };

  const handleCancel = () => {
    // Abort any in-flight requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Always reset state to release UI
    toast.info('Pipeline cancelled');
    resetState();
  };

  const handleGenerateClick = () => {
    // Validation first
    if (!user) {
      toast.error('Please sign in to generate videos');
      return;
    }

    if (mode === 'ai' && !concept.trim()) {
      toast.error('Please enter a story concept');
      return;
    }
    
    if (mode === 'manual') {
      const emptyPrompts = manualPrompts.slice(0, clipCount).filter(p => !p.trim());
      if (emptyPrompts.length > 0) {
        toast.error(`Please fill in all ${clipCount} scene prompts`);
        return;
      }
    }

    // Show cost confirmation
    setShowCostDialog(true);
  };

  const runPipeline = async () => {
    setShowCostDialog(false);
    
    // Create abort controller
    abortControllerRef.current = new AbortController();

    // Reset and start
    resetState();
    setStartTime(Date.now());
    setCurrentStage('preproduction');
    setProgress(5);
    
    // Add initial log entries
    addPipelineLog(`Starting ${mode === 'ai' ? 'AI Hollywood' : 'Manual'} Pipeline`, 'info');
    addPipelineLog(`Configuration: ${clipCount} clips × ${CLIP_DURATION}s = ${clipCount * CLIP_DURATION}s`, 'info');
    if (referenceImageAnalysis) {
      addPipelineLog('Reference image loaded', 'info');
    }
    
    // Initialize clip results
    setClipResults(Array(clipCount).fill(null).map((_, i) => ({
      index: i,
      status: 'pending',
    })));

    try {
      // Mark first stage as active - wait for real backend updates
      updateStageStatus(0, 'active', 'Initializing...');
      addPipelineLog('Connecting to pipeline...', 'info');
      toast.info(`Starting ${mode === 'ai' ? 'AI Hollywood' : 'Manual'} Pipeline...`);

      const requestBody: any = {
        userId: user!.id,
        genre,
        mood,
        colorGrading,
        includeVoice,
        includeMusic,
        musicMood: mood,
        qualityTier,
        clipCount,
        totalDuration: clipCount * CLIP_DURATION,
      };

      if (mode === 'ai') {
        requestBody.concept = concept;
      } else {
        requestBody.manualPrompts = manualPrompts.slice(0, clipCount);
      }

      // Pass full reference analysis
      if (referenceImageAnalysis) {
        requestBody.referenceImageUrl = referenceImageAnalysis.imageUrl;
        requestBody.referenceImageAnalysis = referenceImageAnalysis;
      }

      // Call the unified Hollywood Pipeline (returns immediately, runs in background)
      const { data, error: funcError } = await supabase.functions.invoke('hollywood-pipeline', {
        body: requestBody
      });

      // Check if cancelled
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

      if (funcError) {
        throw new Error(funcError.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Pipeline failed');
      }

      // Set project ID for realtime tracking - pipeline now runs in background
      if (data.projectId) {
        setActiveProjectId(data.projectId);
        addPipelineLog(`Project created: ${data.projectId.substring(0, 8)}...`, 'success');
        addPipelineLog('Waiting for real-time updates from backend...', 'info');
        toast.success('Pipeline started! Tracking real progress...');
        
        // Real progress tracked via realtime subscription on movie_projects.pending_video_tasks
        // All stage updates come from backend via the useEffect subscription above
      }

    } catch (err) {
      if (abortControllerRef.current?.signal.aborted) {
        addPipelineLog('Pipeline cancelled by user', 'warning');
        return;
      }
      
      console.error('Pipeline error:', err);
      const message = err instanceof Error ? err.message : 'Pipeline failed';
      setError(message);
      setCurrentStage('error');
      addPipelineLog(`Error: ${message}`, 'error');
      
      // Mark current stage as error
      const activeStageIdx = stages.findIndex(s => s.status === 'active');
      if (activeStageIdx >= 0) {
        updateStageStatus(activeStageIdx, 'error', message);
      }
      
      toast.error(message);
    }
  };

  const isRunning = !['idle', 'complete', 'error', 'awaiting_approval'].includes(currentStage);
  const isAwaitingApproval = currentStage === 'awaiting_approval';
  const completedClips = clipResults.filter(c => c.status === 'completed').length;
  const hasEmptyPrompts = mode === 'manual' && manualPrompts.slice(0, clipCount).some(p => !p.trim());
  const canGenerate = mode === 'ai' ? concept.trim().length > 0 : !hasEmptyPrompts;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Compact Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-foreground">
                <Film className="w-5 h-5 text-background" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight">Video Studio</h1>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  Create AI-powered videos
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="hidden sm:flex gap-1.5">
                <Clock className="w-3 h-3" />
                {totalDuration}s
              </Badge>
              <Badge variant="outline" className="gap-1.5">
                <Layers className="w-3 h-3" />
                {clipCount}
              </Badge>
              <Badge className="bg-foreground text-background gap-1.5">
                <Coins className="w-3 h-3" />
                ~{estimatedCredits}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Mode Selection - Compact */}
        <Card className="overflow-hidden border-border">
          <Tabs value={mode} onValueChange={(v) => setMode(v as PipelineMode)} className="w-full">
            <div className="border-b border-border bg-muted/30 p-2">
              <TabsList className="grid w-full grid-cols-2 h-11 bg-background/50">
                <TabsTrigger 
                  value="ai" 
                  disabled={isRunning}
                  className="gap-2 data-[state=active]:bg-foreground data-[state=active]:text-background transition-all"
                >
                  <Zap className="w-4 h-4" />
                  <span className="font-medium">AI Hollywood</span>
                  <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 hidden sm:flex bg-success/20 text-success border-0">
                    PRO
                  </Badge>
                </TabsTrigger>
                <TabsTrigger 
                  value="manual" 
                  disabled={isRunning}
                  className="gap-2 data-[state=active]:bg-foreground data-[state=active]:text-background transition-all"
                >
                  <Clapperboard className="w-4 h-4" />
                  <span className="font-medium">Manual Mode</span>
                </TabsTrigger>
              </TabsList>
            </div>

            {/* AI Mode */}
            <TabsContent value="ai" className="m-0 p-4 space-y-4">
              {/* Concept Input */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-muted-foreground" />
                  Story Concept
                </Label>
                <Textarea
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                  placeholder="Describe your video idea... Example: A lone astronaut discovers ancient alien ruins on Mars."
                  rows={3}
                  disabled={isRunning}
                  className="resize-none"
                />
              </div>

              {/* Compact Options Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Mood</Label>
                  <Select value={mood} onValueChange={setMood} disabled={isRunning}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MOOD_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <span className="flex items-center gap-2">
                            <span>{opt.icon}</span>
                            <span>{opt.label}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Genre</Label>
                  <Select value={genre} onValueChange={setGenre} disabled={isRunning}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GENRE_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Color</Label>
                  <Select value={colorGrading} onValueChange={setColorGrading} disabled={isRunning}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COLOR_PRESETS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Clips</Label>
                  <Select 
                    value={clipCount.toString()} 
                    onValueChange={(v) => setClipCount(parseInt(v))} 
                    disabled={isRunning}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[4, 6, 8, 10, 12].map(n => (
                        <SelectItem key={n} value={n.toString()}>
                          {n} ({n * CLIP_DURATION}s)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Feature Toggles - Inline */}
              <div className="flex flex-wrap items-center gap-2">
                <div className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors",
                  includeVoice ? "bg-foreground/5 border-foreground/20" : "bg-muted/30 border-border/50"
                )}>
                  <Switch
                    id="voice"
                    checked={includeVoice}
                    onCheckedChange={setIncludeVoice}
                    disabled={isRunning}
                    className="scale-90"
                  />
                  <Label htmlFor="voice" className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Mic className="w-3.5 h-3.5" />
                    Voice
                  </Label>
                </div>
                
                <div className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors",
                  includeMusic ? "bg-foreground/5 border-foreground/20" : "bg-muted/30 border-border/50"
                )}>
                  <Switch
                    id="music"
                    checked={includeMusic}
                    onCheckedChange={setIncludeMusic}
                    disabled={isRunning}
                    className="scale-90"
                  />
                  <Label htmlFor="music" className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Music className="w-3.5 h-3.5" />
                    Music
                  </Label>
                </div>
                
                <div className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ml-auto",
                  qualityTier === 'professional' ? "bg-success/10 border-success/30" : "bg-muted/30 border-border/50"
                )}>
                  <Switch
                    id="proTier"
                    checked={qualityTier === 'professional'}
                    onCheckedChange={(checked) => setQualityTier(checked ? 'professional' : 'standard')}
                    disabled={isRunning}
                    className="scale-90"
                  />
                  <Label htmlFor="proTier" className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Shield className="w-3.5 h-3.5" />
                    Pro QA
                  </Label>
                </div>
              </div>
            </TabsContent>

            {/* Manual Mode */}
            <TabsContent value="manual" className="m-0 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Scene Prompts</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {CLIP_DURATION}s per scene • {hasEmptyPrompts && (
                      <span className="text-destructive">Fill all scenes to continue</span>
                    )}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addPrompt}
                  disabled={isRunning || clipCount >= 12}
                  className="gap-1.5 h-8"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </Button>
              </div>
              
              <ScrollArea className="h-[320px] pr-3">
                <div className="space-y-3">
                  {manualPrompts.slice(0, clipCount).map((prompt, index) => {
                    const isEmpty = !prompt.trim();
                    const clipStatus = clipResults[index]?.status;
                    
                    return (
                      <div 
                        key={index} 
                        className={cn(
                          "group relative flex gap-3 items-start p-3 rounded-xl border transition-all",
                          isEmpty && "border-destructive/30 bg-destructive/5",
                          !isEmpty && "border-border/50 bg-muted/20 hover:border-border",
                          clipStatus === 'completed' && "border-success/30 bg-success/5",
                          clipStatus === 'generating' && "border-primary/30 bg-primary/5",
                          clipStatus === 'failed' && "border-destructive/30 bg-destructive/5"
                        )}
                      >
                        <div className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0",
                          clipStatus === 'completed' && "bg-success/20 text-success",
                          clipStatus === 'generating' && "bg-primary/20 text-primary",
                          clipStatus === 'failed' && "bg-destructive/20 text-destructive",
                          !clipStatus && isEmpty && "bg-destructive/10 text-destructive",
                          !clipStatus && !isEmpty && "bg-muted text-muted-foreground"
                        )}>
                          {clipStatus === 'completed' ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : clipStatus === 'generating' ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : clipStatus === 'failed' ? (
                            <XCircle className="w-3.5 h-3.5" />
                          ) : (
                            index + 1
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <Textarea
                            value={prompt}
                            onChange={(e) => updatePrompt(index, e.target.value)}
                            placeholder={`Scene ${index + 1}: Describe the visual content...`}
                            rows={2}
                            disabled={isRunning}
                            className={cn(
                              "resize-none text-sm bg-transparent border-0 p-0 focus-visible:ring-0 shadow-none min-h-[52px]",
                              isEmpty && "placeholder:text-destructive/50"
                            )}
                          />
                        </div>
                        
                        {clipCount > 2 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                            onClick={() => removePrompt(index)}
                            disabled={isRunning}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              {/* Manual Mode Options */}
              <Separator />
              <div className="flex flex-wrap items-center gap-2">
                <Select value={colorGrading} onValueChange={setColorGrading} disabled={isRunning}>
                  <SelectTrigger className="w-[140px] h-9 text-sm">
                    <Palette className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COLOR_PRESETS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Voice & Music toggles for Manual Mode */}
                <div className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors",
                  includeVoice ? "bg-foreground/5 border-foreground/20" : "bg-muted/30 border-border/50"
                )}>
                  <Switch
                    id="voiceManual"
                    checked={includeVoice}
                    onCheckedChange={setIncludeVoice}
                    disabled={isRunning}
                    className="scale-90"
                  />
                  <Label htmlFor="voiceManual" className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Mic className="w-3.5 h-3.5" />
                    Voice
                  </Label>
                </div>
                
                <div className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors",
                  includeMusic ? "bg-foreground/5 border-foreground/20" : "bg-muted/30 border-border/50"
                )}>
                  <Switch
                    id="musicManual"
                    checked={includeMusic}
                    onCheckedChange={setIncludeMusic}
                    disabled={isRunning}
                    className="scale-90"
                  />
                  <Label htmlFor="musicManual" className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Music className="w-3.5 h-3.5" />
                    Music
                  </Label>
                </div>
                
                <div className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ml-auto",
                  qualityTier === 'professional' ? "bg-success/10 border-success/30" : "bg-muted/30 border-border/50"
                )}>
                  <Switch
                    id="proTierManual"
                    checked={qualityTier === 'professional'}
                    onCheckedChange={(checked) => setQualityTier(checked ? 'professional' : 'standard')}
                    disabled={isRunning}
                    className="scale-90"
                  />
                  <Label htmlFor="proTierManual" className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Shield className="w-3.5 h-3.5" />
                    Pro
                  </Label>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </Card>

        {/* Reference Image - Collapsible */}
        <Collapsible open={referenceExpanded} onOpenChange={setReferenceExpanded}>
          <Card className="overflow-hidden">
            <CollapsibleTrigger asChild>
              <CardHeader className="py-3 px-4 cursor-pointer hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-muted">
                      <Upload className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-medium">Reference Image</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {referenceImageAnalysis ? 'Character analyzed' : 'Optional: Upload for consistency'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {referenceImageAnalysis && (
                      <Badge variant="secondary" className="bg-success/10 text-success border-0 text-xs">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Ready
                      </Badge>
                    )}
                    {referenceExpanded ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 pb-4 px-4">
                <ReferenceImageUpload
                  onAnalysisComplete={(analysis) => setReferenceImageAnalysis(analysis)}
                  onClear={() => setReferenceImageAnalysis(undefined)}
                  existingAnalysis={referenceImageAnalysis}
                />
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Script Review Panel - Show when awaiting approval */}
        {isAwaitingApproval && pendingScript && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-6">
              <ScriptReviewPanel
                shots={pendingScript}
                onApprove={handleScriptApprove}
                onRegenerate={handleScriptRegenerate}
                onCancel={handleScriptCancel}
                isLoading={isResumingPipeline}
                totalDuration={clipCount * CLIP_DURATION}
              />
            </CardContent>
          </Card>
        )}

        {/* Premium Production Pipeline - Show when running (not awaiting approval) */}
        {currentStage !== 'idle' && !isAwaitingApproval && (
          <ProductionPipeline
            stages={stages}
            progress={progress}
            elapsedTime={elapsedTime}
            isRunning={isRunning}
            finalVideoUrl={finalVideoUrl}
            pipelineLogs={pipelineLogs}
            clipResults={clipResults}
            auditScore={auditScore}
            sceneImages={sceneImages}
            identityBibleViews={identityBibleViews}
            onCancel={handleCancel}
            projectId={activeProjectId || undefined}
          />
        )}
      </div>

      {/* Sticky Generate Bar */}
      <StickyGenerateBar
        isRunning={isRunning}
        isComplete={currentStage === 'complete'}
        isError={currentStage === 'error'}
        progress={progress}
        totalDuration={totalDuration}
        clipCount={clipCount}
        estimatedCredits={estimatedCredits}
        elapsedTime={elapsedTime}
        completedClips={completedClips}
        onGenerate={handleGenerateClick}
        onCancel={handleCancel}
        disabled={!canGenerate}
      />

      {/* Cost Confirmation Dialog */}
      <CostConfirmationDialog
        open={showCostDialog}
        onOpenChange={setShowCostDialog}
        onConfirm={runPipeline}
        mode={mode}
        clipCount={clipCount}
        totalDuration={totalDuration}
        includeVoice={includeVoice}
        includeMusic={includeMusic}
        qualityTier={qualityTier}
        userCredits={userCredits}
      />
    </div>
  );
}
