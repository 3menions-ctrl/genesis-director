import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Eye,
  Volume2,
  LayoutTemplate,
  TreePine
} from 'lucide-react';
import { useTemplateEnvironment, TemplateShotSequence, TemplateStyleAnchor, TemplateCharacter, TemplateEnvironmentLock } from '@/hooks/useTemplateEnvironment';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useStudio } from '@/contexts/StudioContext';
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
import { StickyGenerateBar } from '@/components/studio/StickyGenerateBar';
import { StoryApprovalPanel } from '@/components/studio/StoryApprovalPanel';
import { ScriptReviewPanel, ScriptShot } from '@/components/studio/ScriptReviewPanel';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { ReferenceImageAnalysis } from '@/types/production-pipeline';
import { parsePendingVideoTasks, type PendingVideoTasks } from '@/types/pending-video-tasks';
import { cn } from '@/lib/utils';
import { PromotionalBanner } from '@/components/studio/PromotionalBanner';
import { TemplatePreviewPanel } from '@/components/studio/TemplatePreviewPanel';

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

const CLIP_DURATION = 6;

export function UnifiedStudio() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Import StudioContext for synced project selection
  const { activeProjectId: contextActiveProjectId, activeProject: contextActiveProject, createProject: contextCreateProject } = useStudio();
  
  // Template/Environment loading from URL params
  const { appliedSettings, isLoading: isLoadingPreset, clearAppliedSettings } = useTemplateEnvironment();
  
  // Pipeline mode and configuration
  const [mode, setMode] = useState<PipelineMode>('ai');
  const [clipCount, setClipCount] = useState(6);
  
  // AI Mode inputs
  const [concept, setConcept] = useState('');
  const [mood, setMood] = useState('epic');
  const [genre, setGenre] = useState('cinematic');
  const [environmentPrompt, setEnvironmentPrompt] = useState('');
  
  // Story-first flow state
  const [storyFlowStage, setStoryFlowStage] = useState<'prompt' | 'story' | 'script'>('prompt');
  const [generatedStory, setGeneratedStory] = useState<string>('');
  const [storyTitle, setStoryTitle] = useState<string>('');
  const [storyEstimatedScenes, setStoryEstimatedScenes] = useState<number>(6);
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const [isBreakingDownStory, setIsBreakingDownStory] = useState(false);
  
  // Manual Mode inputs
  const [manualPrompts, setManualPrompts] = useState<string[]>(
    Array(6).fill('').map((_, i) => i === 0 ? 'Opening shot: Wide cinematic establishing view' : '')
  );
  
  // Shared options
  const [colorGrading, setColorGrading] = useState('cinematic');
  const [includeVoice, setIncludeVoice] = useState(false);
  const [includeMusic, setIncludeMusic] = useState(false);
  const [includeSfx, setIncludeSfx] = useState(false); // SFX only for pro tier
  const [referenceImageAnalysis, setReferenceImageAnalysis] = useState<ReferenceImageAnalysis | undefined>();
  const [qualityTier, setQualityTier] = useState<'standard' | 'professional'>('professional'); // IRON-CLAD: Default to highest quality
  
  // Applied template/environment info for display
  const [appliedTemplateName, setAppliedTemplateName] = useState<string | null>(null);
  const [appliedEnvironmentName, setAppliedEnvironmentName] = useState<string | null>(null);
  
  // Rich template data from database templates
  const [templateShotSequence, setTemplateShotSequence] = useState<TemplateShotSequence[] | null>(null);
  const [templateStyleAnchor, setTemplateStyleAnchor] = useState<TemplateStyleAnchor | null>(null);
  const [templateCharacters, setTemplateCharacters] = useState<TemplateCharacter[] | null>(null);
  const [templateEnvironmentLock, setTemplateEnvironmentLock] = useState<TemplateEnvironmentLock | null>(null);
  const [templatePacingStyle, setTemplatePacingStyle] = useState<string | null>(null);
  
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
  const [pipelineLogs, setPipelineLogs] = useState<Array<{ time: string; message: string; type: 'info' | 'success' | 'warning' | 'error' }>>([]);
  const [awaitingApprovalProjectId, setAwaitingApprovalProjectId] = useState<string | null>(null);
  const [awaitingApprovalShotCount, setAwaitingApprovalShotCount] = useState<number>(0);
  const [scriptShots, setScriptShots] = useState<ScriptShot[]>([]);
  const [projectTitle, setProjectTitle] = useState<string>('');
  
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
  // Use proper per-shot credit calculation (25 standard, 50 professional)
  const creditsPerShot = qualityTier === 'professional' ? 50 : 25;
  const estimatedCredits = clipCount * creditsPerShot;
  
  // Get user credits from auth context profile
  const userCredits = profile?.credits_balance ?? 0;
  
  // Sync with StudioContext's activeProjectId when a new project is created
  useEffect(() => {
    if (contextActiveProjectId && contextActiveProjectId !== activeProjectId && currentStage === 'idle') {
      // A project was selected in context - check if it's a draft we should work with
      if (contextActiveProject && contextActiveProject.status === 'idle') {
        setActiveProjectId(contextActiveProjectId);
        setProjectTitle(contextActiveProject.name || 'Untitled Project');
        console.log('[UnifiedStudio] Synced to context project:', contextActiveProjectId);
      }
    }
  }, [contextActiveProjectId, contextActiveProject, activeProjectId, currentStage]);

  // Check for projects awaiting approval OR in-progress on mount
  useEffect(() => {
    const checkForActiveProjects = async () => {
      if (!user) return;
      if (currentStage !== 'idle') {
        return;
      }
      
      // CRITICAL: Verify Supabase client has valid session before querying
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log('UnifiedStudio: No valid session yet, skipping check');
        return;
      }
      
      try {
        // Find projects that are awaiting approval OR actively producing
        const { data: projects, error } = await supabase
          .from('movie_projects')
          .select('id, pending_video_tasks, generated_script, status, title')
          .eq('user_id', session.user.id) // Use session user ID, not React state
          .in('status', ['awaiting_approval', 'producing', 'generating', 'rendering'])
          .order('updated_at', { ascending: false })
          .limit(1);
        
        if (error) {
          console.error('Error checking active projects:', error);
          return;
        }
        
        if (projects && projects.length > 0) {
          const project = projects[0];
          const tasks = parsePendingVideoTasks(project.pending_video_tasks);
          
          // Handle awaiting_approval status
          if (project.status === 'awaiting_approval') {
            let scriptData = tasks?.script?.shots;
            if (!scriptData && project.generated_script) {
              try {
                const parsed = typeof project.generated_script === 'string' 
                  ? JSON.parse(project.generated_script) 
                  : project.generated_script;
                scriptData = parsed?.shots;
              } catch {
                // Failed to parse generated_script - continue without it
              }
            }
            
            if (scriptData && Array.isArray(scriptData)) {
              setActiveProjectId(project.id);
              setAwaitingApprovalProjectId(project.id);
              setAwaitingApprovalShotCount(scriptData.length);
              setCurrentStage('awaiting_approval');
              setProgress(30);
              setClipCount(scriptData.length);
              setProjectTitle(project.title || 'Untitled Project');
              
              // Convert to ScriptShot format
              const formattedShots: ScriptShot[] = scriptData.map((shot: any, idx: number) => ({
                id: shot.id || `shot-${idx}`,
                index: idx,
                title: shot.title || `Shot ${idx + 1}`,
                description: shot.description || '',
                durationSeconds: shot.durationSeconds || 6,
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
              setScriptShots(formattedShots);
              
              setStages(prev => {
                const updated = [...prev];
                updated[0] = { ...updated[0], status: 'complete', details: `${scriptData.length} shots` };
                return updated;
              });
              
              toast.info('You have a script waiting for approval!');
            }
          } 
          // Handle in-progress statuses - show info card instead of redirecting
          // User can click to view production if they want
          else if (['producing', 'generating', 'rendering'].includes(project.status)) {
            setActiveProjectId(project.id);
            setCurrentStage('production');
          }
        }
      } catch {
        // Error checking active projects - non-critical
      }
    };
    
    checkForActiveProjects();
  }, [user]);

  // Apply template/environment settings when loaded from URL params
  useEffect(() => {
    if (appliedSettings && currentStage === 'idle') {
      // Apply all settings from template/environment
      if (appliedSettings.concept) {
        setConcept(appliedSettings.concept);
      }
      if (appliedSettings.mood) {
        setMood(appliedSettings.mood);
      }
      if (appliedSettings.genre) {
        setGenre(appliedSettings.genre);
      }
      if (appliedSettings.clipCount) {
        setClipCount(appliedSettings.clipCount);
        // Update manual prompts array to match new clip count
        setManualPrompts(Array(appliedSettings.clipCount).fill('').map((_, i) => 
          i === 0 ? 'Opening shot: Wide cinematic establishing view' : ''
        ));
      }
      if (appliedSettings.colorGrading) {
        setColorGrading(appliedSettings.colorGrading);
      }
      if (appliedSettings.environmentPrompt) {
        setEnvironmentPrompt(appliedSettings.environmentPrompt);
      }
      
      // Store names for display
      if (appliedSettings.templateName) {
        setAppliedTemplateName(appliedSettings.templateName);
      }
      if (appliedSettings.environmentName) {
        setAppliedEnvironmentName(appliedSettings.environmentName);
      }
      
      // Store rich template data for pipeline
      if (appliedSettings.shotSequence) {
        setTemplateShotSequence(appliedSettings.shotSequence);
        // If we have a shot sequence, populate manual prompts with template shots
        setManualPrompts(appliedSettings.shotSequence.map(shot => 
          `[${shot.title}] ${shot.description}`
        ));
      }
      if (appliedSettings.styleAnchor) {
        setTemplateStyleAnchor(appliedSettings.styleAnchor);
      }
      if (appliedSettings.characterTemplates) {
        setTemplateCharacters(appliedSettings.characterTemplates);
      }
      if (appliedSettings.environmentLock) {
        setTemplateEnvironmentLock(appliedSettings.environmentLock);
      }
      if (appliedSettings.pacingStyle) {
        setTemplatePacingStyle(appliedSettings.pacingStyle);
      }
      
      // Clear the applied settings after applying
      clearAppliedSettings();
    }
  }, [appliedSettings, currentStage, clearAppliedSettings]);

  const updatePrompt = (index: number, value: string) => {
    setManualPrompts(prev => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  };

  const addPrompt = () => {
    if (clipCount < 30) { // Allow up to 30 clips for rich templates
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

    const channelName = `studio_project_${activeProjectId}`;
    console.log(`[UnifiedStudio] Setting up realtime subscription: ${channelName}`);
    
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'movie_projects',
          filter: `id=eq.${activeProjectId}`,
        },
        (payload) => {
          const project = payload.new as Record<string, unknown>;
          if (!project) return;
          
          const tasks = parsePendingVideoTasks(project.pending_video_tasks);
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
          
          // Handle awaiting_approval stage - store project ID and script data for review panel
          // Only process if we don't already have an awaiting project to avoid duplicate updates
          if (tasks.stage === 'awaiting_approval' && tasks.script?.shots && !awaitingApprovalProjectId) {
            console.log('[Studio] Script ready for approval:', tasks.script.shots.length, 'shots');
            setCurrentStage('awaiting_approval');
            setProgress(30);
            updateStageStatus(0, 'complete', `${tasks.script.shots.length} shots`);
            addPipelineLog('Script generated! Awaiting your approval...', 'success');
            
            // Store project info for navigation
            setAwaitingApprovalProjectId(activeProjectId);
            setAwaitingApprovalShotCount(tasks.script.shots.length);
            
            // Convert to ScriptShot format for the review panel
            const formattedShots: ScriptShot[] = tasks.script.shots.map((shot: any, idx: number) => ({
              id: shot.id || `shot-${idx}`,
              index: idx,
              title: shot.title || `Shot ${idx + 1}`,
              description: shot.description || '',
              durationSeconds: shot.durationSeconds || 6,
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
            setScriptShots(formattedShots);
            
            toast.info('Script ready! Review and approve to continue.');
          }
          
          // Handle error
          if (tasks.stage === 'error') {
            setError(tasks.error || 'Pipeline failed');
            setCurrentStage('error');
            addPipelineLog(`Error: ${tasks.error || 'Pipeline failed'}`, 'error');
            toast.error(tasks.error || 'Pipeline failed');
          }
          
          // Handle status change to completed
          if (project.status === 'completed' && typeof project.video_url === 'string') {
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

    // CRITICAL: Proper cleanup of realtime channel to prevent leaks
    return () => {
      console.log(`[UnifiedStudio] Cleaning up realtime subscription: ${channelName}`);
      supabase.removeChannel(channel);
    };
  }, [activeProjectId, currentStage, clipCount, updateStageStatus, stages, addPipelineLog, awaitingApprovalProjectId, pipelineLogs]);

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
    setAwaitingApprovalProjectId(null);
    setAwaitingApprovalShotCount(0);
    setStages(prev => prev.map(s => ({ ...s, status: 'pending', details: undefined })));
    abortControllerRef.current = null;
    // Reset story flow
    setStoryFlowStage('prompt');
    setGeneratedStory('');
    setStoryTitle('');
    setIsGeneratingStory(false);
    setIsBreakingDownStory(false);
  };

  // Generate continuous story from concept
  const handleGenerateStory = async () => {
    if (!concept.trim()) {
      toast.error('Please enter a story concept');
      return;
    }

    setIsGeneratingStory(true);
    addPipelineLog('Generating continuous story...', 'info');

    try {
      const { data, error: funcError } = await supabase.functions.invoke('generate-story', {
        body: {
          prompt: concept.trim(),
          genre,
          mood,
          targetDurationSeconds: clipCount * CLIP_DURATION,
          referenceAnalysis: referenceImageAnalysis,
          environmentPrompt: environmentPrompt || undefined,
          // CRITICAL: Pass includeVoice to prevent dialogue/narration when disabled
          includeVoice,
        },
      });

      if (funcError) throw new Error(funcError.message);
      if (!data?.success) throw new Error(data?.error || 'Failed to generate story');

      setGeneratedStory(data.story);
      setStoryTitle(data.title || concept.substring(0, 50));
      setStoryEstimatedScenes(data.estimatedScenes || clipCount);
      setStoryFlowStage('story');
      addPipelineLog('Story generated successfully!', 'success');
      toast.success('Story generated! Review and approve to continue.');
    } catch (err) {
      console.error('Story generation error:', err);
      const message = err instanceof Error ? err.message : 'Failed to generate story';
      toast.error(message);
      addPipelineLog(`Error: ${message}`, 'error');
    } finally {
      setIsGeneratingStory(false);
    }
  };

  // Approve story and proceed to cost confirmation
  const handleApproveStory = (editedStory: string) => {
    setGeneratedStory(editedStory);
    setShowCostDialog(true);
  };

  // Regenerate story
  const handleRegenerateStory = () => {
    setGeneratedStory('');
    setStoryTitle('');
    setStoryFlowStage('prompt');
  };

  // Cancel story flow
  const handleCancelStoryFlow = () => {
    setStoryFlowStage('prompt');
    setGeneratedStory('');
    setStoryTitle('');
  };

  // Navigate to script review page
  const handleReviewScript = () => {
    if (awaitingApprovalProjectId) {
      navigate(`/script-review?projectId=${awaitingApprovalProjectId}`);
    }
  };

  // Handle canceling awaiting approval
  const handleCancelAwaitingApproval = async () => {
    if (awaitingApprovalProjectId) {
      try {
        await supabase
          .from('movie_projects')
          .update({ status: 'draft' })
          .eq('id', awaitingApprovalProjectId);
      } catch (err) {
        console.error('Error canceling:', err);
      }
    }
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
      // Manual mode: skip story generation, go straight to cost dialog
      setShowCostDialog(true);
      return;
    }

    // AI mode: Start story-first flow
    handleGenerateStory();
  };

  const runPipeline = async (projectName: string) => {
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
    addPipelineLog(`Project: ${projectName}`, 'info');
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
        projectName,
        genre,
        mood,
        colorGrading,
        includeVoice,
        includeMusic,
        includeSfx: qualityTier === 'professional' ? includeSfx : false,
        musicMood: mood,
        qualityTier,
        clipCount,
        totalDuration: clipCount * CLIP_DURATION,
      };

      if (mode === 'ai') {
        requestBody.concept = concept;
        // Story-first flow: pass the approved story for shot breakdown
        if (generatedStory) {
          requestBody.approvedStory = generatedStory;
          requestBody.storyTitle = storyTitle;
        }
        // Pass environment DNA if applied
        if (environmentPrompt) {
          requestBody.environmentPrompt = environmentPrompt;
        }
      } else {
        requestBody.manualPrompts = manualPrompts.slice(0, clipCount);
      }

      // Pass full reference analysis
      if (referenceImageAnalysis) {
        requestBody.referenceImageUrl = referenceImageAnalysis.imageUrl;
        requestBody.referenceImageAnalysis = referenceImageAnalysis;
      }

      // Pass rich template data if available
      if (templateShotSequence && templateShotSequence.length > 0) {
        requestBody.templateShotSequence = templateShotSequence;
        requestBody.useTemplateShots = true;
      }
      if (templateStyleAnchor) {
        requestBody.templateStyleAnchor = templateStyleAnchor;
      }
      if (templateCharacters && templateCharacters.length > 0) {
        requestBody.templateCharacters = templateCharacters;
      }
      if (templateEnvironmentLock) {
        requestBody.templateEnvironmentLock = templateEnvironmentLock;
      }
      if (templatePacingStyle) {
        requestBody.pacingStyle = templatePacingStyle;
      }
      if (appliedTemplateName) {
        requestBody.templateName = appliedTemplateName;
      }

      // Call the unified Hollywood Pipeline (returns immediately, runs in background)
      const { data, error: funcError } = await supabase.functions.invoke('hollywood-pipeline', {
        body: requestBody
      });

      // Check if cancelled
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

      // Handle errors - Supabase functions may return error details in data even with funcError
      if (funcError) {
        // Extract error message from response data if available (e.g., 402 insufficient credits)
        const errorMessage = data?.error || funcError.message || 'Pipeline failed';
        throw new Error(errorMessage);
      }

      if (!data?.success) {
        // Handle explicit failure response from pipeline
        const errorMessage = data?.error || 'Pipeline failed';
        throw new Error(errorMessage);
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

  // Handle script approval - resume pipeline with approved shots
  const handleApproveScript = async (approvedShots: ScriptShot[]) => {
    if (!awaitingApprovalProjectId || !user) return;
    
    console.log('[Studio] Approving script with', approvedShots.length, 'shots');
    addPipelineLog('Script approved, resuming pipeline...', 'info');
    
    try {
      // Update project status and call resume-pipeline
      const { error: updateError } = await supabase
        .from('movie_projects')
        .update({
          status: 'producing',
          pending_video_tasks: {
            stage: 'qualitygate',
            progress: 35,
            scriptApproved: true,
            shotCount: approvedShots.length,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', awaitingApprovalProjectId);
      
      if (updateError) throw updateError;
      
      // Resume the pipeline from qualitygate stage
      const { error: resumeError } = await supabase.functions.invoke('resume-pipeline', {
        body: {
          projectId: awaitingApprovalProjectId,
          userId: user.id,
          resumeFrom: 'qualitygate',
          approvedScript: {
            shots: approvedShots.map(shot => ({
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
        },
      });
      
      if (resumeError) throw resumeError;
      
      setCurrentStage('qualitygate');
      setProgress(35);
      updateStageStatus(1, 'active', 'Analyzing');
      addPipelineLog('Pipeline resumed from quality gate', 'success');
      toast.success('Script approved! Production starting...');
      
    } catch (err) {
      console.error('Failed to approve script:', err);
      toast.error('Failed to resume pipeline');
      addPipelineLog(`Error resuming pipeline: ${err instanceof Error ? err.message : 'Unknown'}`, 'error');
    }
  };

  const isRunning = !['idle', 'complete', 'error', 'awaiting_approval'].includes(currentStage);
  const isAwaitingApproval = currentStage === 'awaiting_approval';
  const completedClips = clipResults.filter(c => c.status === 'completed').length;
  const hasEmptyPrompts = mode === 'manual' && manualPrompts.slice(0, clipCount).some(p => !p.trim());
  const canGenerate = mode === 'ai' ? concept.trim().length > 0 : !hasEmptyPrompts;
  const isInStoryFlow = mode === 'ai' && storyFlowStage === 'story' && generatedStory;

  // Show Script Review Panel when awaiting approval
  if (isAwaitingApproval && scriptShots.length > 0) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] py-8 px-4">
        <ScriptReviewPanel
          shots={scriptShots}
          onApprove={handleApproveScript}
          onRegenerate={async () => {
            // Regenerate script by calling the pipeline again
            if (!awaitingApprovalProjectId) return;
            toast.info('Regenerating script...');
            setCurrentStage('preproduction');
            try {
              await supabase.functions.invoke('resume-pipeline', {
                body: {
                  projectId: awaitingApprovalProjectId,
                  userId: user?.id,
                  resumeFrom: 'preproduction',
                  regenerateScript: true,
                },
              });
            } catch {
              toast.error('Failed to regenerate script');
              setCurrentStage('awaiting_approval');
            }
          }}
          onCancel={() => {
            // Cancel and reset state
            setCurrentStage('idle');
            setAwaitingApprovalProjectId(null);
            setScriptShots([]);
            setActiveProjectId(null);
            toast.info('Script review cancelled');
          }}
          isLoading={isRunning}
          totalDuration={scriptShots.reduce((sum, s) => sum + (s.durationSeconds || 6), 0)}
          projectTitle={projectTitle}
        />
      </div>
    );
  }

  // Show Story Approval Panel when in story review stage
  if (isInStoryFlow) {
    return (
      <div className="min-h-screen bg-background py-8 px-4">
        <StoryApprovalPanel
          story={generatedStory}
          title={storyTitle}
          estimatedScenes={storyEstimatedScenes}
          onApprove={handleApproveStory}
          onRegenerate={handleRegenerateStory}
          onCancel={handleCancelStoryFlow}
          isLoading={isGeneratingStory}
          isBreakingDown={isBreakingDownStory}
        />
        
        {/* Cost Confirmation Dialog - must be included here too */}
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
          defaultProjectName={storyTitle || concept.substring(0, 50) || 'AI Video'}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#030308] via-[#0a0a12] to-[#050510] pb-24 sm:pb-32 relative overflow-hidden">
      {/* Premium Ambient Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Primary ambient orbs */}
        <div className="absolute top-[-30%] left-[-15%] w-[70vw] h-[70vw] rounded-full bg-gradient-to-br from-violet-600/[0.08] via-purple-500/[0.04] to-transparent blur-[150px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-[-25%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-tl from-cyan-500/[0.06] via-blue-500/[0.03] to-transparent blur-[140px] animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }} />
        <div className="absolute top-[40%] right-[20%] w-[30vw] h-[30vw] rounded-full bg-gradient-to-bl from-emerald-500/[0.04] to-transparent blur-[100px] animate-pulse" style={{ animationDuration: '12s', animationDelay: '4s' }} />
        
        {/* Subtle grid pattern overlay */}
        <div 
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }}
        />
        
        {/* Radial vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]" />
      </div>

      {/* Premium Glass Header */}
      <header className="sticky top-0 z-50">
        {/* Gradient border line */}
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-violet-500/30 to-transparent blur-sm" />
        
        <div className="bg-black/40 backdrop-blur-2xl border-b border-white/[0.05]">
          <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8">
            <div className="h-14 sm:h-16 flex items-center justify-between">
              {/* Left - Logo & Branding with glow */}
              <button 
                onClick={() => navigate('/projects')} 
                className="flex items-center gap-2 sm:gap-3 group"
              >
                <div className="relative">
                  <div className="absolute inset-0 bg-violet-500/30 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-all duration-500" />
                  <div className="relative w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-gradient-to-br from-white/[0.12] to-white/[0.04] border border-white/[0.15] flex items-center justify-center group-hover:border-violet-400/40 group-hover:from-violet-500/20 group-hover:to-purple-500/10 transition-all duration-300 shadow-lg shadow-black/20">
                    <Film className="w-4 h-4 sm:w-5 sm:h-5 text-white/90 group-hover:text-violet-300 transition-colors" />
                  </div>
                </div>
                <div className="hidden md:block">
                  <span className="text-lg font-bold bg-gradient-to-r from-white via-white to-white/80 bg-clip-text text-transparent tracking-tight">Create</span>
                  <p className="text-[11px] text-white/40 -mt-0.5 font-medium">AI Video Studio</p>
                </div>
              </button>
              
              {/* Center - Premium Glass Stats Pills */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.06] backdrop-blur-xl border border-white/[0.1] text-sm shadow-lg shadow-black/10">
                  <Clock className="w-3.5 h-3.5 text-cyan-400/80" />
                  <span className="font-semibold text-white/90">{totalDuration}s</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-white/[0.06] backdrop-blur-xl border border-white/[0.1] text-xs sm:text-sm shadow-lg shadow-black/10">
                  <Layers className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-violet-400/80" />
                  <span className="font-semibold text-white/90">{clipCount}</span>
                </div>
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-500/40 to-orange-500/40 blur-lg opacity-60 group-hover:opacity-80 transition-opacity rounded-full" />
                  <div className="relative flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-400 text-black text-xs sm:text-sm font-bold shadow-lg shadow-amber-500/25">
                    <Coins className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    <span>~{estimatedCredits}</span>
                  </div>
                </div>
              </div>
              
              {/* Right - Navigation */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => navigate('/projects')}
                  className="h-8 sm:h-9 px-2 sm:px-4 text-white/60 hover:text-white hover:bg-white/[0.08] rounded-full text-sm font-medium transition-all duration-200"
                >
                  <Eye className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Library</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-10 max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-4 sm:space-y-6">
        {/* Promotional Banner - Hidden on mobile */}
        <div className="hidden sm:block">
          <PromotionalBanner />
        </div>
        
        {/* Premium Hero Section */}
        <div className="text-center space-y-3 sm:space-y-4 mb-4 sm:mb-8">
          {/* Project Title - Show when a project is active */}
          {activeProjectId && projectTitle && currentStage === 'idle' && (
            <div className="flex items-center justify-center gap-2 mb-3">
              <Badge variant="outline" className="bg-violet-500/10 border-violet-500/30 text-violet-300 text-xs px-4 py-1.5 backdrop-blur-sm">
                <Film className="w-3 h-3 mr-1.5" />
                {projectTitle}
              </Badge>
            </div>
          )}
          
          {/* Glowing title */}
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-gradient-to-r from-violet-500/20 via-purple-500/20 to-cyan-500/20 blur-3xl" />
            <h2 className="relative text-3xl sm:text-5xl font-bold tracking-tight bg-gradient-to-r from-white via-white to-white/70 bg-clip-text text-transparent">
              What will you create?
            </h2>
          </div>
          <p className="text-sm sm:text-base text-white/50 max-w-xl mx-auto hidden sm:block font-medium">
            Transform your ideas into stunning videos with AI-powered production
          </p>
          
          {/* Template/Environment Applied Indicator - Premium pills */}
          {(appliedTemplateName || appliedEnvironmentName) && (
            <div className="flex items-center justify-center gap-2 sm:gap-3 pt-2 sm:pt-3 flex-wrap">
              {appliedTemplateName && (
                <div className="group relative">
                  <div className="absolute inset-0 bg-violet-500/30 blur-lg opacity-60 rounded-full" />
                  <div className="relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-gradient-to-r from-violet-500/20 to-purple-500/20 border border-violet-400/40 backdrop-blur-xl">
                    <LayoutTemplate className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-violet-300" />
                    <span className="text-xs sm:text-sm font-semibold text-violet-200 truncate max-w-[100px] sm:max-w-none">{appliedTemplateName}</span>
                    <button 
                      onClick={() => {
                        setAppliedTemplateName(null);
                        setConcept('');
                      }}
                      className="ml-0.5 sm:ml-1 text-violet-300 hover:text-white transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                  </div>
                </div>
              )}
              {appliedEnvironmentName && (
                <div className="group relative">
                  <div className="absolute inset-0 bg-emerald-500/30 blur-lg opacity-60 rounded-full" />
                  <div className="relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-400/40 backdrop-blur-xl">
                    <TreePine className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-300" />
                    <span className="text-xs sm:text-sm font-semibold text-emerald-200 truncate max-w-[100px] sm:max-w-none">{appliedEnvironmentName}</span>
                    <button 
                      onClick={() => {
                        setAppliedEnvironmentName(null);
                        setEnvironmentPrompt('');
                      }}
                      className="ml-0.5 sm:ml-1 text-emerald-300 hover:text-white transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Template Preview Panel - Shows rich template data when a template is applied */}
        {appliedTemplateName && (templateShotSequence || templateStyleAnchor || templateCharacters || templateEnvironmentLock) && (
          <TemplatePreviewPanel
            templateName={appliedTemplateName}
            shotSequence={templateShotSequence}
            styleAnchor={templateStyleAnchor}
            characters={templateCharacters}
            environmentLock={templateEnvironmentLock}
            pacingStyle={templatePacingStyle}
            onClear={() => {
              setAppliedTemplateName(null);
              setTemplateShotSequence(null);
              setTemplateStyleAnchor(null);
              setTemplateCharacters(null);
              setTemplateEnvironmentLock(null);
              setTemplatePacingStyle(null);
              setConcept('');
              setClipCount(6);
              setManualPrompts(Array(6).fill('').map((_, i) => i === 0 ? 'Opening shot: Wide cinematic establishing view' : ''));
            }}
          />
        )}

        {/* Premium Glass Mode Selection Tabs */}
        <div className="relative group">
          {/* Glow effect behind card */}
          <div className="absolute -inset-1 bg-gradient-to-r from-violet-500/20 via-purple-500/10 to-cyan-500/20 rounded-3xl blur-xl opacity-50 group-hover:opacity-70 transition-opacity duration-500" />
          
          <div className="relative bg-gradient-to-br from-white/[0.08] via-white/[0.04] to-white/[0.02] border border-white/[0.12] rounded-2xl sm:rounded-3xl overflow-hidden backdrop-blur-2xl shadow-2xl shadow-black/20">
            <Tabs value={mode} onValueChange={(v) => setMode(v as PipelineMode)} className="w-full">
              {/* Premium tab header */}
              <div className="border-b border-white/[0.08] bg-gradient-to-r from-white/[0.04] via-white/[0.02] to-white/[0.04] p-2.5 sm:p-4">
                <TabsList className="grid w-full grid-cols-2 h-11 sm:h-14 bg-black/30 p-1 sm:p-1.5 rounded-xl sm:rounded-2xl border border-white/[0.08] backdrop-blur-xl">
                  <TabsTrigger 
                    value="ai" 
                    disabled={isRunning}
                    className="gap-2 sm:gap-3 rounded-lg sm:rounded-xl text-white/60 data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-violet-500/30 transition-all duration-300 text-xs sm:text-sm font-semibold"
                  >
                    <Zap className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span>AI</span>
                    <span className="hidden sm:inline">Hollywood</span>
                    <Badge className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 h-4 sm:h-5 hidden md:flex bg-emerald-400/20 text-emerald-300 border border-emerald-400/40 font-bold">
                      PRO
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="manual" 
                    disabled={isRunning}
                    className="gap-2 sm:gap-3 rounded-lg sm:rounded-xl text-white/60 data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-amber-500/30 transition-all duration-300 text-xs sm:text-sm font-semibold"
                  >
                    <Clapperboard className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span>Manual</span>
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* AI Mode - Premium styling */}
              <TabsContent value="ai" className="m-0 p-4 sm:p-8 space-y-5 sm:space-y-8 bg-gradient-to-b from-transparent to-white/[0.01]">
                {/* Concept Input - Hero Section with glow */}
                <div className="space-y-4">
                  <Label className="text-sm sm:text-base font-semibold flex items-center gap-2 text-white">
                    <div className="p-1.5 rounded-lg bg-violet-500/20 border border-violet-500/30">
                      <Sparkles className="w-4 h-4 text-violet-400" />
                    </div>
                    Story Concept
                  </Label>
                  <div className="relative group/input">
                    {/* Input glow effect */}
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-500/30 via-purple-500/20 to-cyan-500/30 rounded-2xl blur-lg opacity-0 group-focus-within/input:opacity-100 transition-opacity duration-300" />
                    <Textarea
                      value={concept}
                      onChange={(e) => setConcept(e.target.value)}
                      placeholder="Describe your video idea... Example: A lone astronaut discovers ancient alien ruins on Mars, revealing humanity's true origins."
                      rows={4}
                      disabled={isRunning}
                      className="relative resize-none text-base sm:text-lg leading-relaxed pr-4 bg-black/40 border-white/[0.12] text-white placeholder:text-white/30 focus:border-violet-400/50 focus:ring-2 focus:ring-violet-500/20 rounded-xl sm:rounded-2xl backdrop-blur-xl transition-all duration-200"
                    />
                    {concept.length > 0 && (
                      <div className="absolute bottom-3 right-3 text-xs text-white/40 font-medium">
                        {concept.length} chars
                      </div>
                    )}
                  </div>
                </div>

                {/* Premium Creative Options Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                  <div className="space-y-2.5">
                    <Label className="text-[11px] sm:text-xs font-bold text-white/50 uppercase tracking-wider">Mood</Label>
                    <Select value={mood} onValueChange={setMood} disabled={isRunning}>
                      <SelectTrigger className="h-11 sm:h-12 bg-black/40 border-white/[0.12] text-white rounded-xl backdrop-blur-xl hover:border-white/25 transition-colors">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0a0a12] border-white/[0.15] backdrop-blur-2xl rounded-xl">
                        {MOOD_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value} className="text-white/80 focus:bg-white/10 focus:text-white rounded-lg">
                            <span className="flex items-center gap-2">
                              <span className="text-lg">{opt.icon}</span>
                              <span className="font-medium">{opt.label}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2.5">
                    <Label className="text-[11px] sm:text-xs font-bold text-white/50 uppercase tracking-wider">Genre</Label>
                    <Select value={genre} onValueChange={setGenre} disabled={isRunning}>
                      <SelectTrigger className="h-11 sm:h-12 bg-black/40 border-white/[0.12] text-white rounded-xl backdrop-blur-xl hover:border-white/25 transition-colors">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0a0a12] border-white/[0.15] backdrop-blur-2xl rounded-xl">
                        {GENRE_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value} className="text-white/80 focus:bg-white/10 focus:text-white rounded-lg font-medium">{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2.5">
                    <Label className="text-[11px] sm:text-xs font-bold text-white/50 uppercase tracking-wider">Color</Label>
                    <Select value={colorGrading} onValueChange={setColorGrading} disabled={isRunning}>
                      <SelectTrigger className="h-11 sm:h-12 bg-black/40 border-white/[0.12] text-white rounded-xl backdrop-blur-xl hover:border-white/25 transition-colors">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0a0a12] border-white/[0.15] backdrop-blur-2xl rounded-xl">
                        {COLOR_PRESETS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value} className="text-white/80 focus:bg-white/10 focus:text-white rounded-lg font-medium">{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2.5">
                    <Label className="text-[11px] sm:text-xs font-bold text-white/50 uppercase tracking-wider">Clips</Label>
                    <Select 
                      value={clipCount.toString()} 
                      onValueChange={(v) => setClipCount(parseInt(v))} 
                      disabled={isRunning}
                    >
                      <SelectTrigger className="h-11 sm:h-12 bg-black/40 border-white/[0.12] text-white rounded-xl backdrop-blur-xl hover:border-white/25 transition-colors">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0a0a12] border-white/[0.15] backdrop-blur-2xl rounded-xl">
                        {[2, 3, 4, 5, 6].map(n => (
                          <SelectItem key={n} value={n.toString()} className="text-white/80 focus:bg-white/10 focus:text-white rounded-lg font-medium">
                            {n} clips ({n * CLIP_DURATION}s)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Premium Feature Toggles */}
                <div className="flex flex-wrap items-center gap-3 pt-3">
                  <div className={cn(
                    "flex items-center gap-2.5 px-4 py-3 rounded-xl border transition-all duration-300 cursor-pointer backdrop-blur-xl",
                    includeVoice 
                      ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-cyan-400/40 shadow-lg shadow-cyan-500/10" 
                      : "bg-black/30 border-white/[0.1] hover:border-white/20 hover:bg-white/[0.05]"
                  )}
                  onClick={() => !isRunning && setIncludeVoice(!includeVoice)}
                  >
                    <Switch
                      id="voice"
                      checked={includeVoice}
                      onCheckedChange={setIncludeVoice}
                      disabled={isRunning}
                      className="scale-90"
                    />
                    <Label htmlFor="voice" className="flex items-center gap-2 text-sm font-semibold cursor-pointer text-white/90">
                      <Mic className={cn("w-4 h-4", includeVoice ? "text-cyan-400" : "text-white/60")} />
                      Narration
                    </Label>
                  </div>
                  
                  <div className={cn(
                    "flex items-center gap-2.5 px-4 py-3 rounded-xl border transition-all duration-300 cursor-pointer backdrop-blur-xl",
                    includeMusic 
                      ? "bg-gradient-to-r from-pink-500/20 to-purple-500/20 border-pink-400/40 shadow-lg shadow-pink-500/10" 
                      : "bg-black/30 border-white/[0.1] hover:border-white/20 hover:bg-white/[0.05]"
                  )}
                  onClick={() => !isRunning && setIncludeMusic(!includeMusic)}
                  >
                    <Switch
                      id="music"
                      checked={includeMusic}
                      onCheckedChange={setIncludeMusic}
                      disabled={isRunning}
                      className="scale-90"
                    />
                    <Label htmlFor="music" className="flex items-center gap-2 text-sm font-semibold cursor-pointer text-white/90">
                      <Music className={cn("w-4 h-4", includeMusic ? "text-pink-400" : "text-white/60")} />
                      Music
                    </Label>
                  </div>

                  {qualityTier === 'professional' && (
                    <div className={cn(
                      "flex items-center gap-2.5 px-4 py-3 rounded-xl border transition-all duration-300 cursor-pointer backdrop-blur-xl",
                      includeSfx 
                        ? "bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-amber-400/40 shadow-lg shadow-amber-500/10" 
                        : "bg-black/30 border-white/[0.1] hover:border-white/20 hover:bg-white/[0.05]"
                    )}
                    onClick={() => !isRunning && setIncludeSfx(!includeSfx)}
                    >
                      <Switch
                        id="sfx"
                        checked={includeSfx}
                        onCheckedChange={setIncludeSfx}
                        disabled={isRunning}
                        className="scale-90"
                      />
                      <Label htmlFor="sfx" className="flex items-center gap-2 text-sm font-semibold cursor-pointer text-white/90">
                        <Volume2 className={cn("w-4 h-4", includeSfx ? "text-amber-400" : "text-white/60")} />
                        SFX
                      </Label>
                    </div>
                  )}
                  
                  <div className="flex-1" />
                  
                  {/* Premium Pro Quality Toggle */}
                  <div className="relative group/pro">
                    <div className={cn(
                      "absolute -inset-1 rounded-2xl blur-lg transition-opacity duration-300",
                      qualityTier === 'professional' ? "bg-gradient-to-r from-emerald-500/40 to-teal-500/40 opacity-60" : "opacity-0"
                    )} />
                    <div className={cn(
                      "relative flex items-center gap-2.5 px-4 py-3 rounded-xl border transition-all duration-300 cursor-pointer backdrop-blur-xl",
                      qualityTier === 'professional' 
                        ? "bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border-emerald-400/50" 
                        : "bg-black/30 border-white/[0.1] hover:border-white/20 hover:bg-white/[0.05]"
                    )}
                    onClick={() => {
                      if (!isRunning) {
                        const newTier = qualityTier === 'professional' ? 'standard' : 'professional';
                        setQualityTier(newTier);
                        if (newTier === 'professional') setIncludeSfx(true);
                      }
                    }}
                    >
                      <Switch
                        id="proTier"
                        checked={qualityTier === 'professional'}
                        onCheckedChange={(checked) => {
                          setQualityTier(checked ? 'professional' : 'standard');
                          if (checked) setIncludeSfx(true);
                        }}
                        disabled={isRunning}
                        className="scale-90"
                      />
                      <Label htmlFor="proTier" className="flex items-center gap-2 text-sm font-bold cursor-pointer text-white">
                        <Shield className={cn("w-4 h-4", qualityTier === 'professional' ? "text-emerald-400" : "text-white/60")} />
                        Pro Quality
                      </Label>
                    </div>
                  </div>
                </div>
              </TabsContent>

            {/* Manual Mode */}
            <TabsContent value="manual" className="m-0 p-5 sm:p-6 space-y-6 bg-white/[0.01]">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-semibold flex items-center gap-2 text-white/90">
                    <Clapperboard className="w-4 h-4 text-amber-400" />
                    Scene Prompts
                  </Label>
                  <p className="text-xs text-white/50 mt-1">
                    {CLIP_DURATION}s per scene • {hasEmptyPrompts && (
                      <span className="text-red-400 font-medium">Fill all scenes to continue</span>
                    )}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addPrompt}
                  disabled={isRunning || clipCount >= 6}
                  className="gap-2 h-9 px-4 bg-white/[0.03] border-white/[0.1] text-white/80 hover:bg-white/[0.08] hover:text-white"
                >
                  <Plus className="w-4 h-4" />
                  Add Scene
                </Button>
              </div>
              
              <ScrollArea className="h-[360px] pr-3">
                <div className="space-y-3">
                  {manualPrompts.slice(0, clipCount).map((prompt, index) => {
                    const isEmpty = !prompt.trim();
                    const clipStatus = clipResults[index]?.status;
                    
                    return (
                      <div 
                        key={index} 
                        className={cn(
                          "group relative flex gap-3 items-start p-3 rounded-xl border transition-all",
                          isEmpty && "border-red-500/30 bg-red-500/5",
                          !isEmpty && "border-white/[0.08] bg-white/[0.02] hover:border-white/15",
                          clipStatus === 'completed' && "border-emerald-500/30 bg-emerald-500/10",
                          clipStatus === 'generating' && "border-blue-500/30 bg-blue-500/10",
                          clipStatus === 'failed' && "border-red-500/30 bg-red-500/10"
                        )}
                      >
                        <div className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0",
                          clipStatus === 'completed' && "bg-emerald-500/20 text-emerald-400",
                          clipStatus === 'generating' && "bg-blue-500/20 text-blue-400",
                          clipStatus === 'failed' && "bg-red-500/20 text-red-400",
                          !clipStatus && isEmpty && "bg-red-500/10 text-red-400",
                          !clipStatus && !isEmpty && "bg-white/10 text-white/60"
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
                              "resize-none text-sm bg-transparent border-0 p-0 focus-visible:ring-0 shadow-none min-h-[52px] text-white/90 placeholder:text-white/30",
                              isEmpty && "placeholder:text-red-400/50"
                            )}
                          />
                        </div>
                        
                        {clipCount > 2 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-white/40 hover:text-white/80 hover:bg-white/10"
                            onClick={() => removePrompt(index)}
                            disabled={isRunning}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              {/* Manual Mode Options */}
              <Separator className="my-4 bg-white/[0.06]" />
              
              {/* Feature Toggles */}
              <div className="flex flex-wrap items-center gap-3">
                <div className={cn(
                  "flex items-center gap-2.5 px-4 py-2.5 rounded-xl border transition-all duration-200 cursor-pointer",
                  includeVoice 
                    ? "bg-white/[0.08] border-white/20" 
                    : "bg-white/[0.02] border-white/[0.08] hover:border-white/15"
                )}
                onClick={() => !isRunning && setIncludeVoice(!includeVoice)}
                >
                  <Switch
                    id="voiceManual"
                    checked={includeVoice}
                    onCheckedChange={setIncludeVoice}
                    disabled={isRunning}
                    className="scale-90"
                  />
                  <Label htmlFor="voiceManual" className="flex items-center gap-2 text-sm font-medium cursor-pointer text-white/80">
                    <Mic className="w-4 h-4" />
                    Narration
                  </Label>
                </div>
                
                <div className={cn(
                  "flex items-center gap-2.5 px-4 py-2.5 rounded-xl border transition-all duration-200 cursor-pointer",
                  includeMusic 
                    ? "bg-white/[0.08] border-white/20" 
                    : "bg-white/[0.02] border-white/[0.08] hover:border-white/15"
                )}
                onClick={() => !isRunning && setIncludeMusic(!includeMusic)}
                >
                  <Switch
                    id="musicManual"
                    checked={includeMusic}
                    onCheckedChange={setIncludeMusic}
                    disabled={isRunning}
                    className="scale-90"
                  />
                  <Label htmlFor="musicManual" className="flex items-center gap-2 text-sm font-medium cursor-pointer text-white/80">
                    <Music className="w-4 h-4" />
                    Music
                  </Label>
                </div>
                
                <div className="flex-1" />
                
                <div className={cn(
                  "flex items-center gap-2.5 px-4 py-2.5 rounded-xl border transition-all duration-200 cursor-pointer",
                  qualityTier === 'professional' 
                    ? "bg-emerald-500/20 border-emerald-500/40" 
                    : "bg-white/[0.02] border-white/[0.08] hover:border-white/15"
                )}
                onClick={() => !isRunning && setQualityTier(qualityTier === 'professional' ? 'standard' : 'professional')}
                >
                  <Switch
                    id="proTierManual"
                    checked={qualityTier === 'professional'}
                    onCheckedChange={(checked) => setQualityTier(checked ? 'professional' : 'standard')}
                    disabled={isRunning}
                    className="scale-90"
                  />
                  <Label htmlFor="proTierManual" className="flex items-center gap-2 text-sm font-medium cursor-pointer text-white/80">
                    <Shield className="w-4 h-4" />
                    Pro Quality
                  </Label>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Reference Image - Collapsible */}
        <Collapsible open={referenceExpanded} onOpenChange={setReferenceExpanded}>
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
            <CollapsibleTrigger asChild>
              <div className="py-4 px-5 cursor-pointer hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08]">
                      <Image className="w-5 h-5 text-white/60" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-white/90">Reference Image</h3>
                      <p className="text-sm text-white/50 mt-0.5">
                        {referenceImageAnalysis ? 'Character consistency ready' : 'Optional: Upload for visual consistency'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {referenceImageAnalysis && (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                        Analyzed
                      </Badge>
                    )}
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white/[0.05]">
                      {referenceExpanded ? (
                        <ChevronUp className="w-4 h-4 text-white/50" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-white/50" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="pt-0 pb-5 px-5">
                <ReferenceImageUpload
                  onAnalysisComplete={(analysis) => setReferenceImageAnalysis(analysis)}
                  onClear={() => setReferenceImageAnalysis(undefined)}
                  existingAnalysis={referenceImageAnalysis}
                />
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* Script Review Button - Show when awaiting approval */}
        {isAwaitingApproval && awaitingApprovalProjectId && (
          <Card className="border-success/40 bg-gradient-to-r from-success/10 via-success/5 to-transparent shadow-lg overflow-hidden">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-success/20 border border-success/30 flex items-center justify-center shadow-lg">
                    <FileText className="w-7 h-7 text-success" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-success">Script Ready for Review</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {awaitingApprovalShotCount} shots generated • Review and approve to continue
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <Button variant="outline" onClick={handleCancelAwaitingApproval} className="flex-1 sm:flex-none">
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleReviewScript}
                    className="flex-1 sm:flex-none bg-success hover:bg-success/90 text-success-foreground min-w-[160px] shadow-lg"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Review Script
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pipeline Running - Show link to production page */}
        {currentStage !== 'idle' && !isAwaitingApproval && activeProjectId && (
          <Card className="border-primary/40 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent shadow-lg overflow-hidden">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center shadow-lg relative">
                    <Film className="w-7 h-7 text-primary" />
                    <div className="absolute inset-0 rounded-2xl animate-pulse-ring bg-primary/20" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Pipeline Running</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Video generation in progress • <span className="font-semibold text-primary">{Math.round(progress)}%</span> complete
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <Button variant="outline" onClick={handleCancel} className="flex-1 sm:flex-none">
                    Cancel
                  </Button>
                  <Button 
                    onClick={() => navigate(`/production?projectId=${activeProjectId}`)}
                    className="flex-1 sm:flex-none min-w-[160px] shadow-lg"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    View Progress
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
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
        currentStage={currentStage}
        pipelineLogs={pipelineLogs}
        isInitializing={isGeneratingStory || isBreakingDownStory}
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
        defaultProjectName={mode === 'ai' && concept ? concept.slice(0, 50) : ''}
      />
    </div>
  );
}
