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
  Coins,
  RotateCcw,
  AlertTriangle,
  Palette
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type GenerationStatus = 'idle' | 'generating' | 'complete' | 'error' | 'resumable';

interface ClipStatus {
  index: number;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  videoUrl?: string;
  error?: string;
}

interface CheckpointState {
  lastCompletedIndex: number;
  lastFrameUrl?: string;
  pendingCount: number;
  completedCount: number;
  failedCount: number;
}

const DEFAULT_PROMPTS = [
  "Opening shot: Establish the scene with a wide cinematic view",
  "Scene 2: Introduce the main subject with dynamic movement",
  "Scene 3: Close-up detail shot with dramatic lighting",
  "Scene 4: Action sequence with smooth camera motion",
  "Scene 5: Emotional moment with soft, atmospheric visuals",
  "Closing shot: Epic wide shot to conclude the narrative"
];

const COLOR_PRESETS = [
  { value: 'cinematic', label: 'Cinematic (Orange-Teal)' },
  { value: 'warm', label: 'Warm (Golden Hour)' },
  { value: 'cool', label: 'Cool (Blue Tones)' },
  { value: 'neutral', label: 'Neutral (No Grading)' },
  { value: 'documentary', label: 'Documentary (Muted)' },
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
  const [checkpoint, setCheckpoint] = useState<CheckpointState | null>(null);
  const [colorGrading, setColorGrading] = useState('cinematic');
  const [resumedFrom, setResumedFrom] = useState<number | null>(null);
  const pollingRef = useRef<number | null>(null);

  // Check for resumable projects on mount
  useEffect(() => {
    if (user) {
      checkForResumableProject();
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [user]);

  const checkForResumableProject = async () => {
    if (!user) return;

    try {
      // Find incomplete long video projects
      const { data: projects } = await supabase
        .from('movie_projects')
        .select('id, title, status, created_at')
        .eq('user_id', user.id)
        .eq('status', 'generating')
        .order('created_at', { ascending: false })
        .limit(1);

      if (projects && projects.length > 0) {
        const project = projects[0];
        
        // Check for existing clips
        const { data: clips } = await supabase
          .from('video_clips')
          .select('*')
          .eq('project_id', project.id)
          .order('shot_index', { ascending: true });

        if (clips && clips.length > 0) {
          const completedCount = clips.filter(c => c.status === 'completed').length;
          const failedCount = clips.filter(c => c.status === 'failed').length;
          const pendingCount = TOTAL_CLIPS - completedCount - failedCount;

          if (completedCount > 0 && completedCount < TOTAL_CLIPS) {
            setProjectId(project.id);
            setCheckpoint({
              lastCompletedIndex: Math.max(...clips.filter(c => c.status === 'completed').map(c => c.shot_index)),
              lastFrameUrl: clips.find(c => c.status === 'completed' && c.last_frame_url)?.last_frame_url,
              pendingCount,
              completedCount,
              failedCount,
            });
            setStatus('resumable');
            
            // Load prompts from clips
            const loadedPrompts = [...DEFAULT_PROMPTS];
            clips.forEach(clip => {
              if (clip.prompt) {
                loadedPrompts[clip.shot_index] = clip.prompt;
              }
            });
            setPrompts(loadedPrompts);

            // Load clip statuses
            setClipStatuses(clips.map(clip => ({
              index: clip.shot_index,
              status: clip.status as ClipStatus['status'],
              videoUrl: clip.video_url,
              error: clip.error_message,
            })));

            toast.info(`Found incomplete project with ${completedCount}/${TOTAL_CLIPS} clips. You can resume.`);
          }
        }
      }
    } catch (err) {
      console.error('Error checking for resumable projects:', err);
    }
  };

  const updatePrompt = (index: number, value: string) => {
    setPrompts(prev => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  };

  const generateLongVideo = async (isResume = false) => {
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
    setResumedFrom(null);

    try {
      let currentProjectId = projectId;

      // Create new project if not resuming
      if (!isResume || !currentProjectId) {
        setFinalVideoUrl(null);
        setProgress(0);
        
        const initialStatuses: ClipStatus[] = prompts.map((_, index) => ({
          index,
          status: 'pending'
        }));
        setClipStatuses(initialStatuses);

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
        currentProjectId = project.id;
        setProjectId(currentProjectId);
        toast.info('Starting long video generation...');
      } else {
        toast.info(`Resuming from clip ${(checkpoint?.lastCompletedIndex ?? 0) + 2}...`);
      }

      // Call the generate-long-video edge function
      const { data, error: funcError } = await supabase.functions.invoke('generate-long-video', {
        body: {
          userId: user.id,
          projectId: currentProjectId,
          clips: prompts.map((prompt, index) => ({
            index,
            prompt: prompt.trim()
          })),
          colorGrading,
        }
      });

      if (funcError) {
        throw new Error(funcError.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Generation failed');
      }

      // Check if this was a resumed generation
      if (data.resumedFrom !== undefined && data.resumedFrom > 0) {
        setResumedFrom(data.resumedFrom);
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
      setCheckpoint(null);
      
      const message = data.resumedFrom > 0 
        ? `Resumed and completed! Generated clips ${data.resumedFrom + 1}-${TOTAL_CLIPS}.`
        : 'Long video generated successfully!';
      toast.success(message);

    } catch (err) {
      console.error('Long video generation error:', err);
      const message = err instanceof Error ? err.message : 'Generation failed';
      setError(message);
      setStatus('error');
      toast.error(message);
      
      // Check if we can resume
      await checkForResumableProject();
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
  const isResumable = status === 'resumable';
  const completedClips = clipStatuses.filter(c => c.status === 'completed').length;
  const failedClips = clipStatuses.filter(c => c.status === 'failed').length;

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

      {/* Resumable Project Banner */}
      {isResumable && checkpoint && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
              Incomplete Project Found
            </p>
            <p className="text-xs text-muted-foreground">
              {checkpoint.completedCount} of {TOTAL_CLIPS} clips completed. 
              {checkpoint.failedCount > 0 && ` ${checkpoint.failedCount} failed.`}
              {' '}You can resume without losing progress or credits.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 border-amber-500/30 text-amber-600 hover:bg-amber-500/10"
            onClick={() => generateLongVideo(true)}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Resume
          </Button>
        </div>
      )}

      {/* Color Grading Selection */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Palette className="w-4 h-4" />
          <span>Color Grade:</span>
        </div>
        <Select value={colorGrading} onValueChange={setColorGrading} disabled={isGenerating}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COLOR_PRESETS.map(preset => (
              <SelectItem key={preset.value} value={preset.value}>
                {preset.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
            <span className="text-muted-foreground">
              {resumedFrom !== null ? `Resuming from clip ${resumedFrom + 1}...` : 'Generating clips...'}
            </span>
            <span className="font-medium">{completedClips} / {TOTAL_CLIPS}</span>
          </div>
          <Progress value={(completedClips / TOTAL_CLIPS) * 100} className="h-2" />
          <p className="text-xs text-muted-foreground text-center">
            This may take several minutes. Each clip is generated sequentially for seamless transitions.
            {resumedFrom !== null && ' Previously completed clips were recovered from checkpoint.'}
          </p>
        </div>
      )}

      {/* Error with Resume Option */}
      {error && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
            <XCircle className="w-5 h-5 text-destructive shrink-0" />
            <span className="text-sm text-destructive">{error}</span>
          </div>
          {failedClips > 0 && completedClips > 0 && (
            <p className="text-xs text-muted-foreground text-center">
              {completedClips} clips were saved. You can retry to resume from where it stopped.
            </p>
          )}
        </div>
      )}

      {/* Generate Button */}
      <Button
        onClick={() => generateLongVideo(false)}
        disabled={isGenerating}
        className="w-full gap-2"
        size="lg"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {resumedFrom !== null ? 'Resuming Generation...' : 'Generating Long Video...'}
          </>
        ) : isResumable ? (
          <>
            <Sparkles className="w-4 h-4" />
            Start Fresh (New Project)
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
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-foreground/80">Final Video</label>
            {resumedFrom !== null && (
              <Badge variant="outline" className="text-xs">
                Resumed from clip {resumedFrom + 1}
              </Badge>
            )}
          </div>
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
                setProjectId(null);
                setCheckpoint(null);
                setResumedFrom(null);
                setPrompts(DEFAULT_PROMPTS);
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
