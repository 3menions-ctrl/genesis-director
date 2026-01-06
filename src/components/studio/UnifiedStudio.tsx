import { useState, useEffect, useCallback } from 'react';
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
  AlertTriangle,
  Eye,
  Users,
  Volume2
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
import { cn } from '@/lib/utils';

type PipelineMode = 'ai' | 'manual';
type PipelineStage = 'idle' | 'preproduction' | 'qualitygate' | 'assets' | 'production' | 'postproduction' | 'complete' | 'error';

interface StageStatus {
  name: string;
  icon: React.ReactNode;
  status: 'pending' | 'active' | 'complete' | 'error';
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
  { value: 'cinematic', label: 'Cinematic', description: 'Orange-Teal Hollywood look' },
  { value: 'warm', label: 'Warm', description: 'Golden hour atmosphere' },
  { value: 'cool', label: 'Cool', description: 'Blue tones, moody' },
  { value: 'neutral', label: 'Neutral', description: 'No color grading' },
  { value: 'documentary', label: 'Documentary', description: 'Muted, realistic' },
];

const MOOD_OPTIONS = [
  { value: 'epic', label: 'Epic & Powerful' },
  { value: 'tension', label: 'Suspenseful' },
  { value: 'emotional', label: 'Emotional' },
  { value: 'action', label: 'High-Energy Action' },
  { value: 'mysterious', label: 'Mysterious' },
  { value: 'uplifting', label: 'Uplifting' },
  { value: 'dark', label: 'Dark & Brooding' },
  { value: 'romantic', label: 'Romantic' },
];

const GENRE_OPTIONS = [
  { value: 'cinematic', label: 'Cinematic Film' },
  { value: 'documentary', label: 'Documentary' },
  { value: 'commercial', label: 'Commercial/Ad' },
  { value: 'music-video', label: 'Music Video' },
  { value: 'narrative', label: 'Narrative Short' },
];

const DEFAULT_PROMPTS = [
  "Opening shot: Establish the scene with a wide cinematic view",
  "Scene 2: Introduce the main subject with dynamic movement",
  "Scene 3: Close-up detail shot with dramatic lighting",
  "Scene 4: Action sequence with smooth camera motion",
  "Scene 5: Emotional moment with soft, atmospheric visuals",
  "Closing shot: Epic wide shot to conclude the narrative"
];

const TOTAL_CLIPS = 6;
const CLIP_DURATION = 4;
const AI_MODE_CREDITS = 350;
const MANUAL_MODE_CREDITS = 300;

export function UnifiedStudio() {
  const { user } = useAuth();
  
  // Pipeline mode
  const [mode, setMode] = useState<PipelineMode>('ai');
  
  // AI Mode inputs
  const [concept, setConcept] = useState('');
  const [mood, setMood] = useState('epic');
  const [genre, setGenre] = useState('cinematic');
  
  // Manual Mode inputs
  const [manualPrompts, setManualPrompts] = useState<string[]>(DEFAULT_PROMPTS);
  
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
  
  // Stage tracking for AI mode
  const [stages, setStages] = useState<StageStatus[]>([
    { name: 'Pre-Production', icon: <Clapperboard className="w-4 h-4" />, status: 'pending' },
    { name: 'Quality Gate', icon: <Shield className="w-4 h-4" />, status: 'pending' },
    { name: 'Asset Creation', icon: <Wand2 className="w-4 h-4" />, status: 'pending' },
    { name: 'Video Production', icon: <Film className="w-4 h-4" />, status: 'pending' },
    { name: 'Post-Production', icon: <Sparkles className="w-4 h-4" />, status: 'pending' },
  ]);

  const updatePrompt = (index: number, value: string) => {
    setManualPrompts(prev => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
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

            // Update stage details
            if (clip.status === 'completed') {
              const completed = clipResults.filter(c => c.status === 'completed').length + 1;
              updateStageStatus(3, 'active', `${completed}/${TOTAL_CLIPS} clips generated`);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeProjectId, currentStage, clipResults, updateStageStatus]);

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
      const emptyPrompts = manualPrompts.filter(p => !p.trim());
      if (emptyPrompts.length > 0) {
        toast.error('Please fill in all 6 scene prompts');
        return;
      }
    }

    // Reset state
    resetState();
    setCurrentStage('preproduction');
    
    // Initialize clip results
    setClipResults(Array(TOTAL_CLIPS).fill(null).map((_, i) => ({
      index: i,
      status: 'pending',
    })));

    try {
      toast.info(`Starting ${mode === 'ai' ? 'AI Hollywood' : 'Manual'} Pipeline...`);
      
      if (mode === 'ai') {
        updateStageStatus(0, 'active', 'Generating script & analyzing references...');
      }

      const requestBody: any = {
        userId: user.id,
        genre,
        mood,
        colorGrading,
        includeVoice: mode === 'ai' ? includeVoice : false,
        includeMusic: mode === 'ai' ? includeMusic : false,
        musicMood: mood,
        qualityTier,
      };

      if (mode === 'ai') {
        requestBody.concept = concept;
      } else {
        requestBody.manualPrompts = manualPrompts;
      }

      if (referenceImageUrl.trim()) {
        requestBody.referenceImageUrl = referenceImageUrl;
      }

      // Call the Hollywood Pipeline
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

      // Update all stages to complete
      setStages(prev => prev.map(s => ({ ...s, status: 'complete' })));
      
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
      
      toast.success('Video generated successfully!');

    } catch (err) {
      console.error('Pipeline error:', err);
      const message = err instanceof Error ? err.message : 'Pipeline failed';
      setError(message);
      setCurrentStage('error');
      toast.error(message);
    }
  };

  const isRunning = !['idle', 'complete', 'error'].includes(currentStage);
  const credits = mode === 'ai' ? AI_MODE_CREDITS : MANUAL_MODE_CREDITS;
  const completedClips = clipResults.filter(c => c.status === 'completed').length;

  return (
    <div className="space-y-8">
      {/* Premium Hero Header */}
      <div className="relative overflow-hidden rounded-3xl bg-card border border-border p-8 shadow-lg">
        <div className="absolute inset-0 bg-gradient-to-br from-muted/50 via-transparent to-transparent" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-primary/5 to-transparent rounded-full blur-3xl" />
        
        <div className="relative">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="p-4 rounded-2xl bg-foreground shadow-xl">
                <Film className="w-8 h-8 text-background" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">Video Studio</h1>
                <p className="text-base text-muted-foreground mt-1">
                  Create cinematic AI videos in minutes
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted border border-border">
                <Coins className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-semibold">{credits} credits</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-foreground text-background">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-semibold">{TOTAL_CLIPS * CLIP_DURATION}s video</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mode Selection */}
      <Card className="overflow-hidden border-border shadow-sm bg-card">
        <CardHeader className="pb-4 border-b border-border bg-muted/30">
          <CardTitle className="text-lg font-semibold">Creation Mode</CardTitle>
          <CardDescription>Choose how you want to create your video</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <Tabs value={mode} onValueChange={(v) => setMode(v as PipelineMode)} className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-auto p-1.5 bg-muted/50 rounded-xl">
              <TabsTrigger 
                value="ai" 
                disabled={isRunning}
                className="flex flex-col items-start gap-1.5 p-5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-foreground/10">
                    <Zap className="w-4 h-4" />
                  </div>
                  <span className="font-semibold">AI Hollywood Mode</span>
                  <Badge variant="secondary" className="text-[10px] bg-success/10 text-success border-0">RECOMMENDED</Badge>
                </div>
                <span className="text-xs text-muted-foreground text-left pl-8">
                  Describe your concept, AI handles everything
                </span>
              </TabsTrigger>
              <TabsTrigger 
                value="manual" 
                disabled={isRunning}
                className="flex flex-col items-start gap-1.5 p-5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-foreground/10">
                    <Clapperboard className="w-4 h-4" />
                  </div>
                  <span className="font-semibold">Manual Mode</span>
                </div>
                <span className="text-xs text-muted-foreground text-left pl-8">
                  Write each scene prompt yourself
                </span>
              </TabsTrigger>
            </TabsList>

            {/* AI Mode Content */}
            <TabsContent value="ai" className="mt-4 space-y-4">
              <div className="space-y-3">
                <Label className="text-sm font-medium">Story Concept</Label>
                <Textarea
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                  placeholder="Describe your video idea in a few sentences. Example: A lone astronaut explores an ancient alien structure on Mars, discovering evidence of a long-lost civilization. The mood should be mysterious and awe-inspiring."
                  rows={4}
                  disabled={isRunning}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  AI will generate a 6-shot cinematic script, voice narration, and background music.
                </p>
              </div>

              {/* AI Options Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Mood</Label>
                  <Select value={mood} onValueChange={setMood} disabled={isRunning}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MOOD_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Genre</Label>
                  <Select value={genre} onValueChange={setGenre} disabled={isRunning}>
                    <SelectTrigger>
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
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COLOR_PRESETS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Audio & Quality Options */}
              <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-border/50">
                <div className="flex items-center gap-2">
                  <Switch
                    id="voice"
                    checked={includeVoice}
                    onCheckedChange={setIncludeVoice}
                    disabled={isRunning}
                  />
                  <Label htmlFor="voice" className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Mic className="w-4 h-4" />
                    AI Narration
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="music"
                    checked={includeMusic}
                    onCheckedChange={setIncludeMusic}
                    disabled={isRunning}
                  />
                  <Label htmlFor="music" className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Music className="w-4 h-4" />
                    Background Music
                  </Label>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <Switch
                    id="proTier"
                    checked={qualityTier === 'professional'}
                    onCheckedChange={(checked) => setQualityTier(checked ? 'professional' : 'standard')}
                    disabled={isRunning}
                  />
                  <Label htmlFor="proTier" className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Shield className="w-4 h-4" />
                    Pro QA
                  </Label>
                  {qualityTier === 'professional' && (
                    <Badge variant="secondary" className="text-xs">+Visual QA</Badge>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Manual Mode Content */}
            <TabsContent value="manual" className="mt-4 space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Scene Prompts</Label>
                  <span className="text-xs text-muted-foreground">
                    {TOTAL_CLIPS} clips × {CLIP_DURATION}s = {TOTAL_CLIPS * CLIP_DURATION}s
                  </span>
                </div>
                
                <div className="grid gap-3">
                  {manualPrompts.map((prompt, index) => (
                    <div key={index} className="flex gap-3 items-start">
                      <div className="flex items-center gap-2 pt-2 min-w-[80px]">
                        {clipResults[index] && clipResults[index].status !== 'pending' ? (
                          clipResults[index].status === 'completed' ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                          ) : clipResults[index].status === 'generating' ? (
                            <Loader2 className="w-5 h-5 animate-spin text-primary" />
                          ) : (
                            <XCircle className="w-5 h-5 text-destructive" />
                          )
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                            {index + 1}
                          </div>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {index === 0 ? 'Intro' : index === 5 ? 'Outro' : `Scene`}
                        </span>
                      </div>
                      <Textarea
                        value={prompt}
                        onChange={(e) => updatePrompt(index, e.target.value)}
                        placeholder={`Describe scene ${index + 1}...`}
                        rows={2}
                        disabled={isRunning}
                        className="flex-1 text-sm resize-none"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Manual Mode Options */}
              <div className="flex items-center gap-4 pt-2 border-t border-border/50">
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
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Advanced Options */}
      <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between gap-2 text-muted-foreground hover:text-foreground">
            <span className="flex items-center gap-2">
              <Image className="w-4 h-4" />
              Advanced Options
            </span>
            {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Card className="mt-2">
            <CardContent className="pt-4 space-y-4">
              <div className="space-y-2">
                <Label className="text-sm flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Reference Image URL
                </Label>
                <Input
                  value={referenceImageUrl}
                  onChange={(e) => setReferenceImageUrl(e.target.value)}
                  placeholder="https://example.com/character-reference.jpg"
                  disabled={isRunning}
                />
                <p className="text-xs text-muted-foreground">
                  Provide a character or style reference for visual consistency. AI will generate a 3-point identity bible.
                </p>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Pipeline Progress (AI Mode) */}
      {mode === 'ai' && currentStage !== 'idle' && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Pipeline Progress</CardTitle>
              <Badge variant={currentStage === 'complete' ? 'default' : currentStage === 'error' ? 'destructive' : 'secondary'}>
                {currentStage === 'complete' ? 'Complete' : currentStage === 'error' ? 'Error' : 'Running'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stages.map((stage, index) => (
                <div 
                  key={stage.name} 
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg transition-all",
                    stage.status === 'active' && "bg-primary/10 ring-1 ring-primary/20",
                    stage.status === 'complete' && "bg-emerald-500/10",
                    stage.status === 'error' && "bg-destructive/10"
                  )}
                >
                  <div className={cn(
                    "p-1.5 rounded-full",
                    stage.status === 'pending' && "bg-muted text-muted-foreground",
                    stage.status === 'active' && "bg-primary/20 text-primary",
                    stage.status === 'complete' && "bg-emerald-500/20 text-emerald-500",
                    stage.status === 'error' && "bg-destructive/20 text-destructive"
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
                      stage.status === 'pending' && "text-muted-foreground"
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

      {/* Manual Mode Progress */}
      {mode === 'manual' && isRunning && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Generating clips...</span>
              <span className="font-medium">{completedClips} / {TOTAL_CLIPS}</span>
            </div>
            <Progress value={(completedClips / TOTAL_CLIPS) * 100} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              Each clip is generated sequentially for seamless transitions.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <XCircle className="w-5 h-5 text-destructive shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generate Button */}
      <Button
        onClick={runPipeline}
        disabled={isRunning}
        className="w-full gap-2 h-14 text-lg font-semibold shadow-lg shadow-primary/20"
        size="lg"
      >
        {isRunning ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            {mode === 'ai' ? 'Running Hollywood Pipeline...' : 'Generating Video...'}
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5" />
            Generate {TOTAL_CLIPS * CLIP_DURATION}-Second Video
          </>
        )}
      </Button>

      {/* Generated Assets Preview */}
      {(sceneImages.length > 0 || identityBibleViews) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Image className="w-4 h-4" />
              Generated Assets
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Identity Bible Views */}
            {identityBibleViews && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Character Identity (3-Point)</p>
                <div className="grid grid-cols-3 gap-2">
                  {identityBibleViews.front && (
                    <div className="relative aspect-square rounded-lg overflow-hidden border border-border/50 group">
                      <img src={identityBibleViews.front} alt="Front view" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <Badge className="absolute bottom-1 left-1 text-[10px] px-1.5">Front</Badge>
                    </div>
                  )}
                  {identityBibleViews.side && (
                    <div className="relative aspect-square rounded-lg overflow-hidden border border-border/50 group">
                      <img src={identityBibleViews.side} alt="Side view" className="w-full h-full object-cover" />
                      <Badge className="absolute bottom-1 left-1 text-[10px] px-1.5">Side</Badge>
                    </div>
                  )}
                  {identityBibleViews.threeQuarter && (
                    <div className="relative aspect-square rounded-lg overflow-hidden border border-border/50 group">
                      <img src={identityBibleViews.threeQuarter} alt="3/4 view" className="w-full h-full object-cover" />
                      <Badge className="absolute bottom-1 left-1 text-[10px] px-1.5">3/4</Badge>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Scene Reference Images */}
            {sceneImages.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Scene References</p>
                <div className="grid grid-cols-3 gap-2">
                  {sceneImages.map((scene) => (
                    <div key={scene.sceneNumber} className="relative aspect-video rounded-lg overflow-hidden border border-border/50">
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
        <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-emerald-500/10">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                Your Video is Ready
              </CardTitle>
              <div className="flex items-center gap-2">
                {pipelineDetails?.qualitygate?.auditScore && (
                  <Badge variant="outline" className="border-emerald-500/30 text-emerald-600">
                    Quality: {pipelineDetails.qualitygate.auditScore}%
                  </Badge>
                )}
                {pipelineDetails?.preproduction?.charactersExtracted > 0 && (
                  <Badge variant="outline" className="border-emerald-500/30 text-emerald-600">
                    <Users className="w-3 h-3 mr-1" />
                    {pipelineDetails.preproduction.charactersExtracted}
                  </Badge>
                )}
                {pipelineDetails?.assets?.hasVoice && (
                  <Badge variant="outline" className="border-emerald-500/30 text-emerald-600">
                    <Mic className="w-3 h-3" />
                  </Badge>
                )}
                {pipelineDetails?.assets?.hasMusic && (
                  <Badge variant="outline" className="border-emerald-500/30 text-emerald-600">
                    <Music className="w-3 h-3" />
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl overflow-hidden border border-emerald-500/20 shadow-lg">
              <video
                src={finalVideoUrl}
                controls
                className="w-full aspect-video bg-black"
              />
            </div>
            
            <div className="flex gap-2">
              <Button variant="default" className="flex-1 gap-2" asChild>
                <a href={finalVideoUrl} download="studio-video.mp4" target="_blank" rel="noopener noreferrer">
                  <Download className="w-4 h-4" />
                  Download Video
                </a>
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={resetState}
              >
                <Play className="w-4 h-4" />
                Create Another
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
