import { useState, useEffect } from 'react';
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
  Zap
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
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
import { cn } from '@/lib/utils';

type PipelineStage = 'idle' | 'preproduction' | 'qualitygate' | 'assets' | 'production' | 'postproduction' | 'complete' | 'error';

interface StageStatus {
  name: string;
  icon: React.ReactNode;
  status: 'pending' | 'active' | 'complete' | 'error';
  details?: string;
}

const COLOR_PRESETS = [
  { value: 'cinematic', label: 'Cinematic (Orange-Teal)' },
  { value: 'warm', label: 'Warm (Golden Hour)' },
  { value: 'cool', label: 'Cool (Blue Tones)' },
  { value: 'neutral', label: 'Neutral (No Grading)' },
  { value: 'documentary', label: 'Documentary (Muted)' },
];

const MOOD_OPTIONS = [
  { value: 'epic', label: 'Epic & Powerful' },
  { value: 'tension', label: 'Suspenseful' },
  { value: 'emotional', label: 'Emotional & Heartfelt' },
  { value: 'action', label: 'High-Energy Action' },
  { value: 'mysterious', label: 'Mysterious' },
  { value: 'uplifting', label: 'Uplifting & Inspiring' },
  { value: 'dark', label: 'Dark & Brooding' },
  { value: 'romantic', label: 'Romantic' },
  { value: 'adventure', label: 'Adventure' },
  { value: 'scifi', label: 'Sci-Fi' },
];

const GENRE_OPTIONS = [
  { value: 'cinematic', label: 'Cinematic' },
  { value: 'documentary', label: 'Documentary' },
  { value: 'commercial', label: 'Commercial/Ad' },
  { value: 'music-video', label: 'Music Video' },
  { value: 'narrative', label: 'Narrative Short' },
];

const PIPELINE_CREDITS = 350;
const TOTAL_CLIPS = 6;
const CLIP_DURATION = 4;

export function HollywoodPipelinePanel() {
  const { user } = useAuth();
  
  // Input mode
  const [inputMode, setInputMode] = useState<'concept' | 'manual'>('concept');
  const [concept, setConcept] = useState('');
  const [manualPrompts, setManualPrompts] = useState<string[]>(Array(6).fill(''));
  
  // Options
  const [colorGrading, setColorGrading] = useState('cinematic');
  const [mood, setMood] = useState('epic');
  const [genre, setGenre] = useState('cinematic');
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
  
  // Stage tracking
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

  const updateStageStatus = (stageIndex: number, status: StageStatus['status'], details?: string) => {
    setStages(prev => {
      const updated = [...prev];
      updated[stageIndex] = { ...updated[stageIndex], status, details };
      return updated;
    });
  };

  // Realtime subscription to track video clip progress during generation
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [clipProgress, setClipProgress] = useState<Map<number, string>>(new Map());

  useEffect(() => {
    if (!activeProjectId || currentStage === 'idle' || currentStage === 'complete' || currentStage === 'error') {
      return;
    }

    console.log('[HollywoodPipeline] Setting up realtime subscription for project:', activeProjectId);

    const channel = supabase
      .channel(`video_clips_${activeProjectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'video_clips',
          filter: `project_id=eq.${activeProjectId}`,
        },
        (payload) => {
          console.log('[HollywoodPipeline] Clip update:', payload);
          const clip = payload.new as any;
          if (clip) {
            setClipProgress(prev => {
              const updated = new Map(prev);
              updated.set(clip.shot_index, clip.status);
              return updated;
            });

            // Update production stage details
            const completedCount = Array.from(clipProgress.values()).filter(s => s === 'completed').length;
            const generatingCount = Array.from(clipProgress.values()).filter(s => s === 'generating').length;
            
            if (clip.status === 'completed') {
              updateStageStatus(3, 'active', `${completedCount + 1}/${TOTAL_CLIPS} clips completed`);
            } else if (clip.status === 'generating') {
              updateStageStatus(3, 'active', `Generating clip ${clip.shot_index + 1}...`);
            } else if (clip.status === 'failed') {
              updateStageStatus(3, 'active', `Clip ${clip.shot_index + 1} failed, retrying...`);
            }
          }
        }
      )
      .subscribe();

    return () => {
      console.log('[HollywoodPipeline] Cleaning up realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [activeProjectId, currentStage]);

  const runPipeline = async () => {
    if (!user) {
      toast.error('Please sign in to generate videos');
      return;
    }

    // Validation
    if (inputMode === 'concept' && !concept.trim()) {
      toast.error('Please enter a story concept');
      return;
    }
    
    if (inputMode === 'manual') {
      const emptyPrompts = manualPrompts.filter(p => !p.trim());
      if (emptyPrompts.length > 0) {
        toast.error('Please fill in all 6 scene prompts');
        return;
      }
    }

    // Reset state
    setCurrentStage('preproduction');
    setProgress(0);
    setError(null);
    setFinalVideoUrl(null);
    setPipelineDetails(null);
    setSceneImages([]);
    setIdentityBibleViews(null);
    setStages(prev => prev.map(s => ({ ...s, status: 'pending', details: undefined })));
    setClipProgress(new Map());

    try {
      toast.info('Starting Hollywood Pipeline...');
      updateStageStatus(0, 'active', 'Generating script & analyzing references...');

      const requestBody: any = {
        userId: user.id,
        genre,
        mood,
        colorGrading,
        includeVoice,
        includeMusic,
        musicMood: mood,
        qualityTier,
      };

      if (inputMode === 'concept') {
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
      
      // Extract scene images and identity bible views from response
      if (data.stages?.assets?.sceneImages) {
        setSceneImages(data.stages.assets.sceneImages);
      }
      if (data.stages?.preproduction?.identityBible?.multiViewUrls) {
        setIdentityBibleViews(data.stages.preproduction.identityBible.multiViewUrls);
      }
      
      toast.success('Hollywood-quality video generated!');

    } catch (err) {
      console.error('Pipeline error:', err);
      const message = err instanceof Error ? err.message : 'Pipeline failed';
      setError(message);
      setCurrentStage('error');
      toast.error(message);
    }
  };

  const isRunning = !['idle', 'complete', 'error'].includes(currentStage);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-primary/20">
              <Film className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                Hollywood Pipeline
                <Badge variant="secondary" className="text-xs">PRO</Badge>
              </h2>
              <p className="text-sm text-muted-foreground">
                AI-powered end-to-end video production with cinematic quality
              </p>
            </div>
          </div>
          <Badge className="gap-1.5 text-sm px-3 py-1.5">
            <Coins className="w-4 h-4" />
            {PIPELINE_CREDITS} credits
          </Badge>
        </div>
      </Card>

      {/* Input Mode Selector */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-4">
          <Button
            variant={inputMode === 'concept' ? 'default' : 'outline'}
            onClick={() => setInputMode('concept')}
            disabled={isRunning}
            className="flex-1 gap-2"
          >
            <Zap className="w-4 h-4" />
            AI Concept Mode
          </Button>
          <Button
            variant={inputMode === 'manual' ? 'default' : 'outline'}
            onClick={() => setInputMode('manual')}
            disabled={isRunning}
            className="flex-1 gap-2"
          >
            <Clapperboard className="w-4 h-4" />
            Manual Prompts
          </Button>
        </div>

        {inputMode === 'concept' ? (
          <div className="space-y-3">
            <Label className="text-sm font-medium">Story Concept</Label>
            <Textarea
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="Describe your video concept in a few sentences. Example: A lone astronaut explores an ancient alien structure on Mars, discovering evidence of a long-lost civilization. The mood should be mysterious and awe-inspiring."
              rows={4}
              disabled={isRunning}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              The AI will automatically generate a 6-shot cinematic script from your concept.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <Label className="text-sm font-medium">Scene Prompts ({TOTAL_CLIPS} clips × {CLIP_DURATION}s)</Label>
            <div className="grid gap-3">
              {manualPrompts.map((prompt, index) => (
                <div key={index} className="flex gap-3 items-start">
                  <div className="flex items-center gap-2 pt-2 min-w-[80px]">
                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                      {index + 1}
                    </div>
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
        )}
      </Card>

      {/* Quick Options */}
      <Card className="p-6 space-y-4">
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

        {/* Audio toggles & Quality Tier */}
        <div className="flex flex-wrap items-center gap-6 pt-2">
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
              <Badge variant="secondary" className="text-xs">+Visual Debugger</Badge>
            )}
          </div>
        </div>
      </Card>

      {/* Advanced Options */}
      <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between gap-2 text-muted-foreground">
            <span>Advanced Options</span>
            {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Card className="p-4 mt-2 space-y-4">
            <div className="space-y-2">
              <Label className="text-sm flex items-center gap-2">
                <Image className="w-4 h-4" />
                Reference Image URL (optional)
              </Label>
              <Input
                value={referenceImageUrl}
                onChange={(e) => setReferenceImageUrl(e.target.value)}
                placeholder="https://example.com/reference-image.jpg"
                disabled={isRunning}
              />
              <p className="text-xs text-muted-foreground">
                Provide a character or style reference for visual consistency.
              </p>
            </div>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Pipeline Progress */}
      {currentStage !== 'idle' && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Pipeline Progress</h3>
            <Badge variant={currentStage === 'complete' ? 'default' : currentStage === 'error' ? 'destructive' : 'secondary'}>
              {currentStage === 'complete' ? 'Complete' : currentStage === 'error' ? 'Error' : 'Running'}
            </Badge>
          </div>
          
          <div className="space-y-3">
            {stages.map((stage, index) => (
              <div 
                key={stage.name} 
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg transition-colors",
                  stage.status === 'active' && "bg-primary/10",
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
                <div className="flex-1">
                  <p className={cn(
                    "text-sm font-medium",
                    stage.status === 'pending' && "text-muted-foreground"
                  )}>
                    {stage.name}
                  </p>
                  {stage.details && (
                    <p className="text-xs text-muted-foreground">{stage.details}</p>
                  )}
                </div>
                {stage.status === 'complete' && pipelineDetails && (
                  <div className="text-xs text-muted-foreground">
                    {index === 0 && pipelineDetails.preproduction && (
                      `${pipelineDetails.preproduction.shotsGenerated} shots`
                    )}
                    {index === 1 && pipelineDetails.qualitygate && (
                      `Score: ${pipelineDetails.qualitygate.auditScore}%`
                    )}
                    {index === 2 && pipelineDetails.assets && (
                      <>
                        {pipelineDetails.assets.hasMusic && <Music className="w-3 h-3 inline mr-1" />}
                        {pipelineDetails.assets.hasVoice && <Mic className="w-3 h-3 inline" />}
                      </>
                    )}
                    {index === 3 && pipelineDetails.production && (
                      `${pipelineDetails.production.clipsCompleted}/${TOTAL_CLIPS} clips`
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Card className="p-4 border-destructive/20 bg-destructive/5">
          <div className="flex items-center gap-3">
            <XCircle className="w-5 h-5 text-destructive shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        </Card>
      )}

      {/* Generate Button */}
      <Button
        onClick={runPipeline}
        disabled={isRunning}
        className="w-full gap-2 h-12 text-base"
        size="lg"
      >
        {isRunning ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Running Hollywood Pipeline...
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5" />
            Generate Hollywood-Quality Video
          </>
        )}
      </Button>

      {/* Scene Images & Identity Bible Preview */}
      {(sceneImages.length > 0 || identityBibleViews) && (
        <Card className="p-4 space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Image className="w-4 h-4" />
            Generated Assets
          </h4>
          
          {/* Identity Bible Views */}
          {identityBibleViews && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Character Identity (3-Point)</p>
              <div className="grid grid-cols-3 gap-2">
                {identityBibleViews.front && (
                  <div className="relative aspect-square rounded-lg overflow-hidden border border-border/30">
                    <img src={identityBibleViews.front} alt="Front view" className="w-full h-full object-cover" />
                    <Badge className="absolute bottom-1 left-1 text-[10px] px-1">Front</Badge>
                  </div>
                )}
                {identityBibleViews.side && (
                  <div className="relative aspect-square rounded-lg overflow-hidden border border-border/30">
                    <img src={identityBibleViews.side} alt="Side view" className="w-full h-full object-cover" />
                    <Badge className="absolute bottom-1 left-1 text-[10px] px-1">Side</Badge>
                  </div>
                )}
                {identityBibleViews.threeQuarter && (
                  <div className="relative aspect-square rounded-lg overflow-hidden border border-border/30">
                    <img src={identityBibleViews.threeQuarter} alt="3/4 view" className="w-full h-full object-cover" />
                    <Badge className="absolute bottom-1 left-1 text-[10px] px-1">3/4</Badge>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Scene Reference Images */}
          {sceneImages.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Scene References</p>
              <div className="grid grid-cols-3 gap-2">
                {sceneImages.map((scene) => (
                  <div key={scene.sceneNumber} className="relative aspect-video rounded-lg overflow-hidden border border-border/30">
                    <img src={scene.imageUrl} alt={`Scene ${scene.sceneNumber}`} className="w-full h-full object-cover" />
                    <Badge className="absolute bottom-1 left-1 text-[10px] px-1">Scene {scene.sceneNumber}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Final Video */}
      {finalVideoUrl && (
        <Card className="p-6 space-y-4 border-emerald-500/20 bg-emerald-500/5">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              Your Hollywood Video is Ready
            </h3>
            {pipelineDetails?.qualitygate?.auditScore && (
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-600">
                Quality Score: {pipelineDetails.qualitygate.auditScore}%
              </Badge>
            )}
          </div>
          
          <div className="rounded-xl overflow-hidden border border-border/30">
            <video
              src={finalVideoUrl}
              controls
              className="w-full aspect-video bg-black"
              poster=""
            />
          </div>
          
          <div className="flex gap-2">
            <Button variant="default" className="flex-1 gap-2" asChild>
              <a href={finalVideoUrl} download="hollywood-video.mp4" target="_blank" rel="noopener noreferrer">
                <Download className="w-4 h-4" />
                Download Video
              </a>
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                setCurrentStage('idle');
                setFinalVideoUrl(null);
                setPipelineDetails(null);
                setSceneImages([]);
                setIdentityBibleViews(null);
                setStages(prev => prev.map(s => ({ ...s, status: 'pending', details: undefined })));
              }}
            >
              <Play className="w-4 h-4" />
              Create Another
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
