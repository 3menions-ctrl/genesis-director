import { useState, useRef, useEffect } from 'react';
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
  Coins
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';

type GenerationStatus = 'idle' | 'generating' | 'complete' | 'error';

interface ClipStatus {
  index: number;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  videoUrl?: string;
  error?: string;
}

const DEFAULT_PROMPTS = [
  "Opening shot: Establish the scene with a wide cinematic view",
  "Scene 2: Introduce the main subject with dynamic movement",
  "Scene 3: Close-up detail shot with dramatic lighting",
  "Scene 4: Action sequence with smooth camera motion",
  "Scene 5: Emotional moment with soft, atmospheric visuals",
  "Closing shot: Epic wide shot to conclude the narrative"
];

const CREDITS_COST = 300;
const TOTAL_CLIPS = 6;
const CLIP_DURATION = 4;

export function LongVideoPanel() {
  const { user } = useAuth();
  const [prompts, setPrompts] = useState<string[]>(DEFAULT_PROMPTS);
  const [status, setStatus] = useState<GenerationStatus>('idle');
  const [clipStatuses, setClipStatuses] = useState<ClipStatus[]>([]);
  const [progress, setProgress] = useState(0);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const pollingRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const updatePrompt = (index: number, value: string) => {
    setPrompts(prev => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  };

  const generateLongVideo = async () => {
    if (!user) {
      toast.error('Please sign in to generate videos');
      return;
    }

    const emptyPrompts = prompts.filter(p => !p.trim());
    if (emptyPrompts.length > 0) {
      toast.error('Please fill in all 6 scene prompts');
      return;
    }

    setStatus('generating');
    setError(null);
    setFinalVideoUrl(null);
    setProgress(0);
    
    // Initialize clip statuses
    const initialStatuses: ClipStatus[] = prompts.map((_, index) => ({
      index,
      status: 'pending'
    }));
    setClipStatuses(initialStatuses);

    try {
      // Create a temporary project for this generation
      const { data: project, error: projectError } = await supabase
        .from('movie_projects')
        .insert({
          title: `Long Video - ${new Date().toLocaleString()}`,
          user_id: user.id,
          status: 'generating',
          genre: 'cinematic',
          story_structure: 'episodic',
          target_duration_minutes: 1
        })
        .select()
        .single();

      if (projectError) throw projectError;
      setProjectId(project.id);

      toast.info('Starting long video generation...');

      // Call the generate-long-video edge function
      const { data, error: funcError } = await supabase.functions.invoke('generate-long-video', {
        body: {
          userId: user.id,
          projectId: project.id,
          clips: prompts.map((prompt, index) => ({
            index,
            prompt: prompt.trim()
          }))
        }
      });

      if (funcError) {
        throw new Error(funcError.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Generation failed');
      }

      // Update clip statuses from response
      if (data.clipResults) {
        setClipStatuses(data.clipResults.map((clip: any) => ({
          index: clip.index,
          status: clip.status === 'completed' ? 'completed' : 'failed',
          videoUrl: clip.videoUrl,
          error: clip.error
        })));
      }

      setFinalVideoUrl(data.finalVideoUrl);
      setProgress(100);
      setStatus('complete');
      toast.success('Long video generated successfully!');

    } catch (err) {
      console.error('Long video generation error:', err);
      const message = err instanceof Error ? err.message : 'Generation failed';
      setError(message);
      setStatus('error');
      toast.error(message);
    }
  };

  const getClipStatusIcon = (clipStatus: ClipStatus) => {
    switch (clipStatus.status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-destructive" />;
      case 'generating':
        return <Loader2 className="w-4 h-4 animate-spin text-primary" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const isGenerating = status === 'generating';
  const completedClips = clipStatuses.filter(c => c.status === 'completed').length;

  return (
    <Card className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <Film className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Long Video Generator</h3>
            <p className="text-sm text-muted-foreground">
              Create a 24-second video with 6 seamless clips
            </p>
          </div>
        </div>
        <Badge variant="secondary" className="gap-1">
          <Coins className="w-3 h-3" />
          {CREDITS_COST} credits
        </Badge>
      </div>

      {/* Scene Prompts */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground/80">Scene Prompts</label>
          <span className="text-xs text-muted-foreground">
            {TOTAL_CLIPS} clips × {CLIP_DURATION}s = {TOTAL_CLIPS * CLIP_DURATION}s total
          </span>
        </div>
        
        <div className="grid gap-3">
          {prompts.map((prompt, index) => (
            <div key={index} className="flex gap-3 items-start">
              <div className="flex items-center gap-2 pt-2 min-w-[80px]">
                {clipStatuses[index] ? (
                  getClipStatusIcon(clipStatuses[index])
                ) : (
                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                    {index + 1}
                  </div>
                )}
                <span className="text-xs text-muted-foreground">
                  {index === 0 ? 'Intro' : index === 5 ? 'Outro' : `Scene ${index + 1}`}
                </span>
              </div>
              <Textarea
                value={prompt}
                onChange={(e) => updatePrompt(index, e.target.value)}
                placeholder={`Describe scene ${index + 1}...`}
                rows={2}
                disabled={isGenerating}
                className="flex-1 text-sm resize-none"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Progress */}
      {isGenerating && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Generating clips...</span>
            <span className="font-medium">{completedClips} / {TOTAL_CLIPS}</span>
          </div>
          <Progress value={(completedClips / TOTAL_CLIPS) * 100} className="h-2" />
          <p className="text-xs text-muted-foreground text-center">
            This may take several minutes. Each clip is generated sequentially for seamless transitions.
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
          <XCircle className="w-5 h-5 text-destructive shrink-0" />
          <span className="text-sm text-destructive">{error}</span>
        </div>
      )}

      {/* Generate Button */}
      <Button
        onClick={generateLongVideo}
        disabled={isGenerating}
        className="w-full gap-2"
        size="lg"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating Long Video...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Generate 24-Second Video
          </>
        )}
      </Button>

      {/* Final Video */}
      {finalVideoUrl && (
        <div className="space-y-3">
          <label className="text-sm font-medium text-foreground/80">Final Video</label>
          <div className="rounded-xl overflow-hidden border border-border/30">
            <video
              src={finalVideoUrl}
              controls
              className="w-full aspect-video bg-black"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 gap-2"
              asChild
            >
              <a href={finalVideoUrl} download="long-video.mp4" target="_blank" rel="noopener noreferrer">
                <Download className="w-4 h-4" />
                Download Video
              </a>
            </Button>
            <Button
              variant="secondary"
              className="gap-2"
              onClick={() => {
                setStatus('idle');
                setFinalVideoUrl(null);
                setClipStatuses([]);
                setProgress(0);
              }}
            >
              <Play className="w-4 h-4" />
              Generate Another
            </Button>
          </div>
        </div>
      )}

      {/* Clip Results */}
      {clipStatuses.length > 0 && clipStatuses.some(c => c.videoUrl) && (
        <div className="space-y-3">
          <label className="text-sm font-medium text-foreground/80">Individual Clips</label>
          <div className="grid grid-cols-3 gap-2">
            {clipStatuses.filter(c => c.videoUrl).map((clip) => (
              <div key={clip.index} className="relative rounded-lg overflow-hidden border border-border/30">
                <video
                  src={clip.videoUrl}
                  className="w-full aspect-video bg-black"
                  muted
                  onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
                  onMouseLeave={(e) => {
                    const video = e.target as HTMLVideoElement;
                    video.pause();
                    video.currentTime = 0;
                  }}
                />
                <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-xs text-white">
                  Clip {clip.index + 1}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
