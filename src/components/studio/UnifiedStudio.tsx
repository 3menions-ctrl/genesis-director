import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
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
  ChevronDown,
  ChevronUp,
  Upload,
  Zap,
  RotateCcw,
  Eye,
  Users,
  Volume2,
  FileText,
  Layers,
  Target,
  Star,
  ArrowRight,
  Plus,
  Trash2
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

type PipelineMode = 'ai' | 'manual';
type PipelineStage = 'idle' | 'preproduction' | 'qualitygate' | 'assets' | 'production' | 'postproduction' | 'complete' | 'error';

interface StageStatus {
  name: string;
  icon: React.ReactNode;
  status: 'pending' | 'active' | 'complete' | 'error' | 'skipped';
  details?: string;
  duration?: number;
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

interface GeneratedShot {
  id: string;
  title: string;
  description: string;
  dialogue?: string;
  durationSeconds: number;
  mood?: string;
  cameraMovement?: string;
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
  { value: 'epic', label: 'Epic & Powerful', icon: '⚔️' },
  { value: 'tension', label: 'Suspenseful', icon: '🎭' },
  { value: 'emotional', label: 'Emotional', icon: '💫' },
  { value: 'action', label: 'High-Energy', icon: '⚡' },
  { value: 'mysterious', label: 'Mysterious', icon: '🌙' },
  { value: 'uplifting', label: 'Uplifting', icon: '✨' },
  { value: 'dark', label: 'Dark & Brooding', icon: '🖤' },
  { value: 'romantic', label: 'Romantic', icon: '❤️' },
];

const GENRE_OPTIONS = [
  { value: 'cinematic', label: 'Cinematic Film' },
  { value: 'documentary', label: 'Documentary' },
  { value: 'commercial', label: 'Commercial/Ad' },
  { value: 'music-video', label: 'Music Video' },
  { value: 'narrative', label: 'Narrative Short' },
  { value: 'trailer', label: 'Trailer' },
];

const CLIP_DURATION = 4;

export function UnifiedStudio() {
  const { user } = useAuth();
  
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
  const [referenceImageUrl, setReferenceImageUrl] = useState('');
  const [qualityTier, setQualityTier] = useState<'standard' | 'professional'>('standard');
  
  // UI State
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [currentStage, setCurrentStage] = useState<PipelineStage>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [pipelineDetails, setPipelineDetails] = useState<any>(null);
  const [sceneImages, setSceneImages] = useState<Array<{ sceneNumber: number; imageUrl: string }>>([]);
  const [identityBibleViews, setIdentityBibleViews] = useState<{ front?: string; side?: string; threeQuarter?: string } | null>(null);
  const [clipResults, setClipResults] = useState<ClipResult[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [generatedShots, setGeneratedShots] = useState<GeneratedShot[]>([]);
  const [auditScore, setAuditScore] = useState<number | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  
  // Stage tracking
  const [stages, setStages] = useState<StageStatus[]>([
    { name: 'Script Generation', icon: <FileText className="w-4 h-4" />, status: 'pending' },
    { name: 'Identity Analysis', icon: <Users className="w-4 h-4" />, status: 'pending' },
    { name: 'Quality Audit', icon: <Shield className="w-4 h-4" />, status: 'pending' },
    { name: 'Asset Creation', icon: <Wand2 className="w-4 h-4" />, status: 'pending' },
    { name: 'Video Production', icon: <Film className="w-4 h-4" />, status: 'pending' },
    { name: 'Final Assembly', icon: <Sparkles className="w-4 h-4" />, status: 'pending' },
  ]);

  const totalDuration = clipCount * CLIP_DURATION;
  const estimatedCredits = mode === 'ai' 
    ? (qualityTier === 'professional' ? 400 : 350)
    : (qualityTier === 'professional' ? 350 : 300);

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

  // Realtime subscription for clip progress
  useEffect(() => {
    if (!activeProjectId || currentStage === 'idle' || currentStage === 'complete' || currentStage === 'error') {
      return;
    }

    const channel = supabase
      .channel(`studio_clips_${activeProjectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'video_clips',
          filter: `project_id=eq.${activeProjectId}`,
        },
        (payload) => {
          const clip = payload.new as any;
          if (clip) {
            setClipResults(prev => {
              const updated = [...prev];
              const idx = updated.findIndex(c => c.index === clip.shot_index);
              if (idx >= 0) {
                updated[idx] = {
                  ...updated[idx],
                  status: clip.status,
                  videoUrl: clip.video_url,
                  error: clip.error_message,
                };
              }
              return updated;
            });

            // Update progress
            const completed = clipResults.filter(c => c.status === 'completed').length;
            const progressPercent = 60 + (completed / clipCount) * 30;
            setProgress(progressPercent);
            
            if (clip.status === 'completed') {
              updateStageStatus(4, 'active', `${completed + 1}/${clipCount} clips complete`);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeProjectId, currentStage, clipResults, clipCount, updateStageStatus]);

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
    setGeneratedShots([]);
    setAuditScore(null);
    setStartTime(null);
    setStages(prev => prev.map(s => ({ ...s, status: 'pending', details: undefined })));
  };

  const runPipeline = async () => {
    if (!user) {
      toast.error('Please sign in to generate videos');
      return;
    }

    // Validation
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

    // Reset and start
    resetState();
    setStartTime(Date.now());
    setCurrentStage('preproduction');
    setProgress(5);
    
    // Initialize clip results
    setClipResults(Array(clipCount).fill(null).map((_, i) => ({
      index: i,
      status: 'pending',
    })));

    try {
      // Stage 1: Pre-production
      updateStageStatus(0, 'active', mode === 'ai' ? 'Generating script...' : 'Preparing prompts...');
      toast.info(`Starting ${mode === 'ai' ? 'AI Hollywood' : 'Manual'} Pipeline...`);

      const requestBody: any = {
        userId: user.id,
        genre,
        mood,
        colorGrading,
        includeVoice: mode === 'ai' ? includeVoice : false,
        includeMusic: mode === 'ai' ? includeMusic : false,
        musicMood: mood,
        qualityTier,
        totalDuration: clipCount * CLIP_DURATION,
      };

      if (mode === 'ai') {
        requestBody.concept = concept;
      } else {
        requestBody.manualPrompts = manualPrompts.slice(0, clipCount);
      }

      if (referenceImageUrl.trim()) {
        requestBody.referenceImageUrl = referenceImageUrl;
      }

      // Simulate stage progress for better UX
      updateStageStatus(0, 'complete', 'Script ready');
      setProgress(15);
      
      if (referenceImageUrl) {
        updateStageStatus(1, 'active', 'Analyzing reference...');
        setProgress(25);
      } else {
        updateStageStatus(1, 'skipped');
      }

      // Call the unified Hollywood Pipeline
      const { data, error: funcError } = await supabase.functions.invoke('hollywood-pipeline', {
        body: requestBody
      });

      if (funcError) {
        throw new Error(funcError.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Pipeline failed');
      }

      // Set project ID for realtime tracking
      if (data.projectId) {
        setActiveProjectId(data.projectId);
      }

      // Update stages based on response
      if (data.stages?.preproduction) {
        updateStageStatus(0, 'complete', `${data.stages.preproduction.shotCount || clipCount} shots`);
        if (data.stages.preproduction.charactersExtracted) {
          updateStageStatus(1, 'complete', `${data.stages.preproduction.charactersExtracted} characters`);
        }
      }
      
      if (data.stages?.qualitygate) {
        setAuditScore(data.stages.qualitygate.auditScore);
        updateStageStatus(2, 'complete', `Score: ${data.stages.qualitygate.auditScore}%`);
      } else {
        updateStageStatus(2, 'complete');
      }
      
      if (data.stages?.assets) {
        const assetDetails = [];
        if (data.stages.assets.hasVoice) assetDetails.push('Voice');
        if (data.stages.assets.hasMusic) assetDetails.push('Music');
        if (data.stages.assets.sceneImages?.length) assetDetails.push(`${data.stages.assets.sceneImages.length} images`);
        updateStageStatus(3, 'complete', assetDetails.join(', ') || 'Assets ready');
      }
      
      updateStageStatus(4, 'complete', `${clipCount} clips generated`);
      updateStageStatus(5, 'complete', 'Video assembled');
      
      setFinalVideoUrl(data.finalVideoUrl);
      setPipelineDetails(data.stages);
      setProgress(100);
      setCurrentStage('complete');
      
      // Extract assets from response
      if (data.stages?.assets?.sceneImages) {
        setSceneImages(data.stages.assets.sceneImages);
      }
      if (data.stages?.preproduction?.identityBible?.multiViewUrls) {
        setIdentityBibleViews(data.stages.preproduction.identityBible.multiViewUrls);
      }
      if (data.stages?.production?.clipResults) {
        setClipResults(data.stages.production.clipResults.map((c: any) => ({
          index: c.index,
          status: c.status === 'completed' ? 'completed' : 'failed',
          videoUrl: c.videoUrl,
          qaResult: c.qaResult,
        })));
      }
      if (data.stages?.preproduction?.script?.shots) {
        setGeneratedShots(data.stages.preproduction.script.shots);
      }
      
      toast.success('Video generated successfully!');

    } catch (err) {
      console.error('Pipeline error:', err);
      const message = err instanceof Error ? err.message : 'Pipeline failed';
      setError(message);
      setCurrentStage('error');
      
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
  const elapsedTime = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Premium Hero Header */}
      <div className="relative overflow-hidden bg-card border-b border-border">
        <div className="absolute inset-0 bg-gradient-to-br from-muted/30 via-transparent to-transparent" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-primary/3 to-transparent rounded-full blur-3xl" />
        
        <div className="relative max-w-6xl mx-auto px-6 py-10">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="p-4 rounded-2xl bg-foreground shadow-xl">
                <Film className="w-8 h-8 text-background" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">Video Studio</h1>
                <p className="text-base text-muted-foreground mt-1">
                  Create Hollywood-quality AI videos in minutes
                </p>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-muted border border-border">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-semibold">{totalDuration}s video</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-muted border border-border">
                <Layers className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-semibold">{clipCount} clips</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-foreground text-background">
                <Coins className="w-4 h-4" />
                <span className="text-sm font-semibold">~{estimatedCredits} credits</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Mode Selection */}
        <Card className="overflow-hidden border-border shadow-sm bg-card">
          <CardContent className="p-0">
            <Tabs value={mode} onValueChange={(v) => setMode(v as PipelineMode)} className="w-full">
              <div className="border-b border-border bg-muted/20 p-4">
                <TabsList className="grid w-full grid-cols-2 h-auto p-1 bg-muted/50 rounded-xl">
                  <TabsTrigger 
                    value="ai" 
                    disabled={isRunning}
                    className="flex items-center gap-3 p-4 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all"
                  >
                    <div className="p-2 rounded-lg bg-foreground/5 group-data-[state=active]:bg-foreground/10">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">AI Hollywood Mode</span>
                        <Badge variant="secondary" className="text-[10px] bg-success/10 text-success border-0 px-1.5">
                          RECOMMENDED
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Full AI script, voice, music & video
                      </span>
                    </div>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="manual" 
                    disabled={isRunning}
                    className="flex items-center gap-3 p-4 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all"
                  >
                    <div className="p-2 rounded-lg bg-foreground/5">
                      <Clapperboard className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <span className="font-semibold">Manual Mode</span>
                      <span className="text-xs text-muted-foreground block">
                        Write your own scene prompts
                      </span>
                    </div>
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* AI Mode Content */}
              <TabsContent value="ai" className="m-0 p-6 space-y-6">
                <div className="space-y-3">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-muted-foreground" />
                    Story Concept
                  </Label>
                  <Textarea
                    value={concept}
                    onChange={(e) => setConcept(e.target.value)}
                    placeholder="Describe your video idea in a few sentences. Example: A lone astronaut explores an ancient alien structure on Mars, discovering evidence of a long-lost civilization. The mood should be mysterious and awe-inspiring."
                    rows={4}
                    disabled={isRunning}
                    className="resize-none text-base"
                  />
                  <p className="text-xs text-muted-foreground">
                    AI will generate a complete {clipCount}-shot script with voice narration and background music.
                  </p>
                </div>

                {/* Options Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Mood</Label>
                    <Select value={mood} onValueChange={setMood} disabled={isRunning}>
                      <SelectTrigger className="h-11">
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
                  
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Genre</Label>
                    <Select value={genre} onValueChange={setGenre} disabled={isRunning}>
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GENRE_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Color Grade</Label>
                    <Select value={colorGrading} onValueChange={setColorGrading} disabled={isRunning}>
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COLOR_PRESETS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            <span className="flex flex-col">
                              <span>{opt.label}</span>
                              <span className="text-[10px] text-muted-foreground">{opt.description}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Clip Count</Label>
                    <Select 
                      value={clipCount.toString()} 
                      onValueChange={(v) => setClipCount(parseInt(v))} 
                      disabled={isRunning}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[4, 6, 8, 10, 12].map(n => (
                          <SelectItem key={n} value={n.toString()}>
                            {n} clips ({n * CLIP_DURATION}s)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                {/* Audio & Quality Options */}
                <div className="flex flex-wrap items-center gap-6">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50">
                    <Switch
                      id="voice"
                      checked={includeVoice}
                      onCheckedChange={setIncludeVoice}
                      disabled={isRunning}
                    />
                    <Label htmlFor="voice" className="flex items-center gap-2 text-sm cursor-pointer">
                      <Mic className="w-4 h-4 text-muted-foreground" />
                      AI Narration
                    </Label>
                  </div>
                  
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50">
                    <Switch
                      id="music"
                      checked={includeMusic}
                      onCheckedChange={setIncludeMusic}
                      disabled={isRunning}
                    />
                    <Label htmlFor="music" className="flex items-center gap-2 text-sm cursor-pointer">
                      <Music className="w-4 h-4 text-muted-foreground" />
                      Background Music
                    </Label>
                  </div>
                  
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50 ml-auto">
                    <Switch
                      id="proTier"
                      checked={qualityTier === 'professional'}
                      onCheckedChange={(checked) => setQualityTier(checked ? 'professional' : 'standard')}
                      disabled={isRunning}
                    />
                    <Label htmlFor="proTier" className="flex items-center gap-2 text-sm cursor-pointer">
                      <Shield className="w-4 h-4 text-muted-foreground" />
                      Pro QA
                    </Label>
                    {qualityTier === 'professional' && (
                      <Badge variant="outline" className="text-xs border-success/30 text-success">
                        +Visual QA
                      </Badge>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* Manual Mode Content */}
              <TabsContent value="manual" className="m-0 p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Scene Prompts</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Write a visual description for each scene ({CLIP_DURATION}s each)
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addPrompt}
                    disabled={isRunning || clipCount >= 12}
                    className="gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Scene
                  </Button>
                </div>
                
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-4">
                    {manualPrompts.slice(0, clipCount).map((prompt, index) => (
                      <div key={index} className="group relative">
                        <div className="flex gap-4 items-start p-4 rounded-xl bg-muted/20 border border-border/50 hover:border-border transition-colors">
                          <div className="flex flex-col items-center gap-2 pt-1">
                            <div className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold",
                              clipResults[index]?.status === 'completed' 
                                ? "bg-success/10 text-success"
                                : clipResults[index]?.status === 'generating'
                                ? "bg-primary/10 text-primary"
                                : clipResults[index]?.status === 'failed'
                                ? "bg-destructive/10 text-destructive"
                                : "bg-muted text-muted-foreground"
                            )}>
                              {clipResults[index]?.status === 'completed' ? (
                                <CheckCircle2 className="w-4 h-4" />
                              ) : clipResults[index]?.status === 'generating' ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : clipResults[index]?.status === 'failed' ? (
                                <XCircle className="w-4 h-4" />
                              ) : (
                                index + 1
                              )}
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                              {CLIP_DURATION}s
                            </span>
                          </div>
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-muted-foreground">
                                {index === 0 ? 'Opening' : index === clipCount - 1 ? 'Closing' : `Scene ${index + 1}`}
                              </span>
                              {clipCount > 2 && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => removePrompt(index)}
                                  disabled={isRunning}
                                >
                                  <Trash2 className="w-3 h-3 text-muted-foreground" />
                                </Button>
                              )}
                            </div>
                            <Textarea
                              value={prompt}
                              onChange={(e) => updatePrompt(index, e.target.value)}
                              placeholder={`Describe the visual content for scene ${index + 1}...`}
                              rows={2}
                              disabled={isRunning}
                              className="resize-none text-sm bg-transparent border-0 p-0 focus-visible:ring-0 shadow-none"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                <Separator />

                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Palette className="w-4 h-4" />
                    Color Grade:
                  </div>
                  <Select value={colorGrading} onValueChange={setColorGrading} disabled={isRunning}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COLOR_PRESETS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 border border-border/50 ml-auto">
                    <Switch
                      id="proTierManual"
                      checked={qualityTier === 'professional'}
                      onCheckedChange={(checked) => setQualityTier(checked ? 'professional' : 'standard')}
                      disabled={isRunning}
                    />
                    <Label htmlFor="proTierManual" className="flex items-center gap-2 text-sm cursor-pointer">
                      <Shield className="w-4 h-4" />
                      Pro QA
                    </Label>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Advanced Options */}
        <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
          <CollapsibleTrigger asChild>
            <Button 
              variant="ghost" 
              className="w-full justify-between gap-2 text-muted-foreground hover:text-foreground h-12"
            >
              <span className="flex items-center gap-2">
                <Target className="w-4 h-4" />
                Advanced Options
              </span>
              {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="mt-3">
              <CardContent className="pt-6 space-y-6">
                <div className="space-y-3">
                  <Label className="text-sm flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    Reference Image URL
                  </Label>
                  <Input
                    value={referenceImageUrl}
                    onChange={(e) => setReferenceImageUrl(e.target.value)}
                    placeholder="https://example.com/character-reference.jpg"
                    disabled={isRunning}
                    className="h-11"
                  />
                  <p className="text-xs text-muted-foreground">
                    Provide a character or style reference. AI will generate a 3-point identity bible for visual consistency across all shots.
                  </p>
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>

        {/* Pipeline Progress */}
        {currentStage !== 'idle' && (
          <Card className="overflow-hidden">
            <CardHeader className="pb-4 border-b border-border bg-muted/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-lg font-semibold">Pipeline Progress</CardTitle>
                  {isRunning && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      {Math.floor(elapsedTime / 60)}:{String(elapsedTime % 60).padStart(2, '0')}
                    </div>
                  )}
                </div>
                <Badge 
                  variant={currentStage === 'complete' ? 'default' : currentStage === 'error' ? 'destructive' : 'secondary'}
                  className={cn(
                    currentStage === 'complete' && "bg-success text-success-foreground"
                  )}
                >
                  {currentStage === 'complete' ? 'Complete' : currentStage === 'error' ? 'Error' : 'Running'}
                </Badge>
              </div>
              <Progress value={progress} className="h-2 mt-3" />
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {stages.map((stage, index) => (
                  <div 
                    key={stage.name} 
                    className={cn(
                      "flex items-center gap-3 p-4 rounded-xl transition-all border",
                      stage.status === 'active' && "bg-primary/5 border-primary/20 ring-1 ring-primary/10",
                      stage.status === 'complete' && "bg-success/5 border-success/20",
                      stage.status === 'error' && "bg-destructive/5 border-destructive/20",
                      stage.status === 'skipped' && "opacity-50",
                      stage.status === 'pending' && "bg-muted/30 border-border/50"
                    )}
                  >
                    <div className={cn(
                      "p-2 rounded-lg",
                      stage.status === 'pending' && "bg-muted text-muted-foreground",
                      stage.status === 'active' && "bg-primary/10 text-primary",
                      stage.status === 'complete' && "bg-success/10 text-success",
                      stage.status === 'error' && "bg-destructive/10 text-destructive",
                      stage.status === 'skipped' && "bg-muted/50 text-muted-foreground"
                    )}>
                      {stage.status === 'active' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : stage.status === 'complete' ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : stage.status === 'error' ? (
                        <XCircle className="w-4 h-4" />
                      ) : (
                        stage.icon
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-sm font-medium truncate",
                        stage.status === 'pending' && "text-muted-foreground",
                        stage.status === 'skipped' && "text-muted-foreground line-through"
                      )}>
                        {stage.name}
                      </p>
                      {stage.details && (
                        <p className="text-xs text-muted-foreground truncate">{stage.details}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error Display */}
        {error && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-destructive">Pipeline Error</p>
                  <p className="text-sm text-destructive/80 mt-1">{error}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetState}
                  className="ml-auto shrink-0"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Generate Button */}
        {currentStage === 'idle' && (
          <Button
            onClick={runPipeline}
            disabled={isRunning}
            className="w-full gap-3 h-16 text-lg font-semibold shadow-xl hover:shadow-2xl transition-all"
            size="lg"
          >
            <Sparkles className="w-6 h-6" />
            Generate {totalDuration}-Second Video
            <ArrowRight className="w-5 h-5" />
          </Button>
        )}

        {/* Generated Assets Preview */}
        {(sceneImages.length > 0 || identityBibleViews) && (
          <Card>
            <CardHeader className="pb-4 border-b border-border">
              <CardTitle className="text-base flex items-center gap-2">
                <Image className="w-4 h-4" />
                Generated Assets
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {/* Identity Bible Views */}
              {identityBibleViews && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <p className="text-sm font-medium">Character Identity (3-Point Reference)</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {identityBibleViews.front && (
                      <div className="relative aspect-square rounded-xl overflow-hidden border border-border group">
                        <img src={identityBibleViews.front} alt="Front view" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <Badge className="absolute bottom-2 left-2 text-xs">Front</Badge>
                      </div>
                    )}
                    {identityBibleViews.side && (
                      <div className="relative aspect-square rounded-xl overflow-hidden border border-border group">
                        <img src={identityBibleViews.side} alt="Side view" className="w-full h-full object-cover" />
                        <Badge className="absolute bottom-2 left-2 text-xs">Side</Badge>
                      </div>
                    )}
                    {identityBibleViews.threeQuarter && (
                      <div className="relative aspect-square rounded-xl overflow-hidden border border-border group">
                        <img src={identityBibleViews.threeQuarter} alt="3/4 view" className="w-full h-full object-cover" />
                        <Badge className="absolute bottom-2 left-2 text-xs">3/4 View</Badge>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Scene Reference Images */}
              {sceneImages.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-muted-foreground" />
                    <p className="text-sm font-medium">Scene References</p>
                  </div>
                  <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
                    {sceneImages.map((scene) => (
                      <div key={scene.sceneNumber} className="relative aspect-video rounded-lg overflow-hidden border border-border group">
                        <img src={scene.imageUrl} alt={`Scene ${scene.sceneNumber}`} className="w-full h-full object-cover" />
                        <Badge className="absolute bottom-1 left-1 text-[10px] px-1.5">Scene {scene.sceneNumber}</Badge>
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
          <Card className="border-success/30 bg-gradient-to-br from-success/5 to-success/10 overflow-hidden">
            <CardHeader className="pb-4 border-b border-success/20">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-success/10">
                    <CheckCircle2 className="w-6 h-6 text-success" />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-success">Your Video is Ready!</CardTitle>
                    {startTime && (
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Generated in {Math.floor((Date.now() - startTime) / 1000 / 60)}m {Math.floor((Date.now() - startTime) / 1000 % 60)}s
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {auditScore && (
                    <Badge variant="outline" className="border-success/30 text-success gap-1">
                      <Star className="w-3 h-3" />
                      Quality: {auditScore}%
                    </Badge>
                  )}
                  {pipelineDetails?.preproduction?.charactersExtracted > 0 && (
                    <Badge variant="outline" className="border-success/30 text-success gap-1">
                      <Users className="w-3 h-3" />
                      {pipelineDetails.preproduction.charactersExtracted} Characters
                    </Badge>
                  )}
                  {pipelineDetails?.assets?.hasVoice && (
                    <Badge variant="outline" className="border-success/30 text-success gap-1">
                      <Mic className="w-3 h-3" />
                      Voice
                    </Badge>
                  )}
                  {pipelineDetails?.assets?.hasMusic && (
                    <Badge variant="outline" className="border-success/30 text-success gap-1">
                      <Music className="w-3 h-3" />
                      Music
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="rounded-2xl overflow-hidden border border-success/20 shadow-xl">
                <video
                  src={finalVideoUrl}
                  controls
                  className="w-full aspect-video bg-foreground"
                />
              </div>
              
              <div className="flex gap-3">
                <Button className="flex-1 gap-2 h-12" asChild>
                  <a href={finalVideoUrl} download="studio-video.mp4" target="_blank" rel="noopener noreferrer">
                    <Download className="w-5 h-5" />
                    Download Video
                  </a>
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 h-12"
                  onClick={resetState}
                >
                  <Play className="w-5 h-5" />
                  Create Another
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
