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
import { PipelineStepper } from '@/components/studio/PipelineStepper';
import { StickyGenerateBar } from '@/components/studio/StickyGenerateBar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { ReferenceImageAnalysis } from '@/types/production-pipeline';
import { cn } from '@/lib/utils';

type PipelineMode = 'ai' | 'manual';
type PipelineStage = 'idle' | 'preproduction' | 'qualitygate' | 'assets' | 'production' | 'postproduction' | 'complete' | 'error';

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
    setPipelineLogs([]); // Clear logs on reset
    setStages(prev => prev.map(s => ({ ...s, status: 'pending', details: undefined })));
    abortControllerRef.current = null;
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      toast.info('Cancelling pipeline...');
      resetState();
    }
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
      // Stage 1: Pre-production
      updateStageStatus(0, 'active', mode === 'ai' ? 'Generating script...' : 'Preparing...');
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

      // Simulate stage progress
      updateStageStatus(0, 'complete', 'Script ready');
      setProgress(15);
      
      if (referenceImageAnalysis) {
        updateStageStatus(1, 'complete', 'Analyzed');
        setProgress(25);
      } else {
        updateStageStatus(1, 'skipped');
      }

      // Call the unified Hollywood Pipeline (now returns immediately)
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
        addPipelineLog('Pipeline running in background...', 'info');
        toast.info('Pipeline started! Tracking progress in real-time...');
        
        // The pipeline is now running in background
        // Progress will be tracked via realtime subscription on movie_projects.pending_video_tasks
        // Stage updates and completion will trigger the useEffect subscription above
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

  const isRunning = !['idle', 'complete', 'error'].includes(currentStage);
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

        {/* Pipeline Progress - Premium Stepper with Live Updates */}
        {currentStage !== 'idle' && (
          <Card className="overflow-hidden">
            <CardHeader className="py-3 px-4 border-b border-border bg-muted/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-sm font-medium">Pipeline Progress</CardTitle>
                  {isRunning && (
                    <Badge variant="secondary" className="bg-primary/10 text-primary border-0 text-xs animate-pulse">
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Processing
                    </Badge>
                  )}
                  {currentStage === 'complete' && (
                    <Badge variant="secondary" className="bg-success/10 text-success border-0 text-xs">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Complete
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {isRunning && (
                    <span className="text-xs text-muted-foreground font-mono">
                      {Math.floor(elapsedTime / 60)}:{String(elapsedTime % 60).padStart(2, '0')}
                    </span>
                  )}
                  <span className="text-xs font-medium text-muted-foreground">
                    {progress}%
                  </span>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="py-4 px-4 space-y-4">
              {/* Progress Bar */}
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-primary to-success transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              
              {/* Stepper */}
              <PipelineStepper stages={stages} />
              
              {/* Live Updates Log */}
              {pipelineLogs.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Live Updates
                    </p>
                    <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                      {pipelineLogs.length} events
                    </Badge>
                  </div>
                  <ScrollArea className="h-32 rounded-lg border border-border bg-background/50">
                    <div className="p-2 space-y-1 font-mono text-xs">
                      {pipelineLogs.map((log, i) => (
                        <div 
                          key={i}
                          className={cn(
                            "flex gap-2 py-0.5 px-1 rounded transition-colors",
                            log.type === 'error' && "bg-destructive/10 text-destructive",
                            log.type === 'warning' && "bg-warning/10 text-warning",
                            log.type === 'success' && "text-success",
                            log.type === 'info' && "text-muted-foreground",
                            i === pipelineLogs.length - 1 && "bg-muted/50"
                          )}
                        >
                          <span className="text-muted-foreground/60 shrink-0">{log.time}</span>
                          <span className={cn(
                            log.type === 'success' && "text-success",
                            log.type === 'error' && "text-destructive",
                            log.type === 'warning' && "text-yellow-500"
                          )}>
                            {log.type === 'success' && '✓'}
                            {log.type === 'error' && '✗'}
                            {log.type === 'warning' && '⚠'}
                            {log.type === 'info' && '→'}
                          </span>
                          <span>{log.message}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Error Display */}
        {error && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="py-4 px-4">
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-destructive shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-destructive">Pipeline Error</p>
                  <p className="text-sm text-destructive/80 mt-0.5 break-words">{error}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetState}
                  className="shrink-0 gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Retry
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Generated Assets Preview */}
        {(sceneImages.length > 0 || identityBibleViews) && (
          <Card>
            <CardHeader className="py-3 px-4 border-b border-border">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Image className="w-4 h-4 text-muted-foreground" />
                Generated Assets
              </CardTitle>
            </CardHeader>
            <CardContent className="py-4 px-4 space-y-4">
              {/* Identity Bible Views */}
              {identityBibleViews && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    Character Reference
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {identityBibleViews.front && (
                      <div className="relative aspect-square rounded-lg overflow-hidden border border-border">
                        <img src={identityBibleViews.front} alt="Front" className="w-full h-full object-cover" />
                        <Badge className="absolute bottom-1 left-1 text-[9px] px-1 h-4">Front</Badge>
                      </div>
                    )}
                    {identityBibleViews.side && (
                      <div className="relative aspect-square rounded-lg overflow-hidden border border-border">
                        <img src={identityBibleViews.side} alt="Side" className="w-full h-full object-cover" />
                        <Badge className="absolute bottom-1 left-1 text-[9px] px-1 h-4">Side</Badge>
                      </div>
                    )}
                    {identityBibleViews.threeQuarter && (
                      <div className="relative aspect-square rounded-lg overflow-hidden border border-border">
                        <img src={identityBibleViews.threeQuarter} alt="3/4" className="w-full h-full object-cover" />
                        <Badge className="absolute bottom-1 left-1 text-[9px] px-1 h-4">3/4</Badge>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Scene Images */}
              {sceneImages.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" />
                    Scene References
                  </p>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {sceneImages.map((scene) => (
                      <div key={scene.sceneNumber} className="relative aspect-video rounded-lg overflow-hidden border border-border">
                        <img src={scene.imageUrl} alt={`Scene ${scene.sceneNumber}`} className="w-full h-full object-cover" />
                        <Badge className="absolute bottom-0.5 left-0.5 text-[8px] px-1 h-3.5">{scene.sceneNumber}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Final Video */}
        {finalVideoUrl && (
          <Card className="border-success/30 bg-gradient-to-br from-success/5 to-transparent overflow-hidden">
            <CardHeader className="py-4 px-4 border-b border-success/20">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-success/10">
                    <CheckCircle2 className="w-5 h-5 text-success" />
                  </div>
                  <div>
                    <CardTitle className="text-base text-success">Video Ready!</CardTitle>
                    {startTime && (
                      <p className="text-xs text-muted-foreground">
                        Generated in {Math.floor((Date.now() - startTime) / 1000 / 60)}m {Math.floor((Date.now() - startTime) / 1000 % 60)}s
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {auditScore && (
                    <Badge variant="outline" className="border-success/30 text-success text-xs gap-1">
                      <Star className="w-3 h-3" />
                      {auditScore}%
                    </Badge>
                  )}
                  {pipelineDetails?.assets?.hasVoice && (
                    <Badge variant="outline" className="border-success/30 text-success text-xs gap-1">
                      <Mic className="w-3 h-3" />
                    </Badge>
                  )}
                  {pipelineDetails?.assets?.hasMusic && (
                    <Badge variant="outline" className="border-success/30 text-success text-xs gap-1">
                      <Music className="w-3 h-3" />
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="py-4 px-4 space-y-4">
              <div className="rounded-xl overflow-hidden border border-success/20 shadow-lg">
                <video
                  src={finalVideoUrl}
                  controls
                  className="w-full aspect-video bg-foreground"
                />
              </div>
              
              <div className="flex gap-2">
                <Button className="flex-1 gap-2 h-10" asChild>
                  <a href={finalVideoUrl} download="video.mp4" target="_blank" rel="noopener noreferrer">
                    <Download className="w-4 h-4" />
                    Download
                  </a>
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 h-10"
                  onClick={resetState}
                >
                  <Play className="w-4 h-4" />
                  New Video
                </Button>
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
