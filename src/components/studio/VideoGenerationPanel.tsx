import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Sparkles, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Video, 
  Mic, 
  FileText,
  Play,
  Pause,
  Download
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';

type GenerationStep = 'idle' | 'script' | 'voice' | 'video' | 'polling' | 'complete' | 'error';

export function VideoGenerationPanel() {
  const [topic, setTopic] = useState('');
  const [step, setStep] = useState<GenerationStep>('idle');
  const [progress, setProgress] = useState(0);
  const [script, setScript] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pollingRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const generateFullVideo = async () => {
    if (!topic.trim()) {
      toast.error('Please enter a topic');
      return;
    }

    setStep('script');
    setProgress(0);
    setScript(null);
    setAudioUrl(null);
    setVideoUrl(null);
    setError(null);

    try {
      // Step 1: Generate Script
      toast.info('Generating AI script...');
      setProgress(10);
      
      const { data: scriptData, error: scriptError } = await supabase.functions.invoke('generate-script', {
        body: { 
          topic: topic.trim(),
          style: 'Professional and engaging',
          duration: '30 seconds'
        },
      });

      if (scriptError || !scriptData.success) {
        throw new Error(scriptData?.error || scriptError?.message || 'Failed to generate script');
      }

      setScript(scriptData.script);
      setProgress(30);
      toast.success('Script generated!');

      // Step 2: Generate Voice
      setStep('voice');
      toast.info('Generating AI voice narration...');
      
      const voiceResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-voice`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ text: scriptData.script }),
        }
      );

      if (!voiceResponse.ok) {
        const errData = await voiceResponse.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to generate voice');
      }

      const audioBlob = await voiceResponse.blob();
      const audioObjectUrl = URL.createObjectURL(audioBlob);
      setAudioUrl(audioObjectUrl);
      setProgress(50);
      toast.success('Voice narration generated!');

      // Step 3: Generate Video
      setStep('video');
      toast.info('Starting AI video generation...');
      
      const { data: videoData, error: videoError } = await supabase.functions.invoke('generate-video', {
        body: { 
          prompt: `Cinematic visuals for: ${topic}. Professional, engaging, modern style.`,
          duration: 8
        },
      });

      if (videoError || !videoData.success) {
        throw new Error(videoData?.error || videoError?.message || 'Failed to start video generation');
      }

      setProgress(60);
      toast.success('Video generation started!');

      // Step 4: Poll for video completion
      setStep('polling');
      const taskId = videoData.taskId;
      
      pollingRef.current = window.setInterval(async () => {
        try {
          const { data: statusData } = await supabase.functions.invoke('check-video-status', {
            body: { taskId },
          });

          if (statusData?.status === 'SUCCEEDED' && statusData?.videoUrl) {
            if (pollingRef.current) clearInterval(pollingRef.current);
            setVideoUrl(statusData.videoUrl);
            setProgress(100);
            setStep('complete');
            toast.success('Video generation complete!');
          } else if (statusData?.status === 'FAILED') {
            if (pollingRef.current) clearInterval(pollingRef.current);
            throw new Error(statusData.error || 'Video generation failed');
          } else {
            // Update progress based on polling
            setProgress(prev => Math.min(prev + 5, 95));
          }
        } catch (pollErr) {
          console.error('Polling error:', pollErr);
        }
      }, 5000);

    } catch (err) {
      console.error('Generation error:', err);
      const message = err instanceof Error ? err.message : 'Generation failed';
      setError(message);
      setStep('error');
      toast.error(message);
      if (pollingRef.current) clearInterval(pollingRef.current);
    }
  };

  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const getStepLabel = () => {
    switch (step) {
      case 'script': return 'Generating script...';
      case 'voice': return 'Creating voice narration...';
      case 'video': return 'Starting video generation...';
      case 'polling': return 'Rendering video (this may take a few minutes)...';
      case 'complete': return 'Complete!';
      case 'error': return 'Error occurred';
      default: return 'Ready to generate';
    }
  };

  const isGenerating = ['script', 'voice', 'video', 'polling'].includes(step);

  return (
    <div className="glass-panel rounded-2xl p-6 space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="icon-container icon-glow">
          <Video className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">AI Video Generation</h3>
          <p className="text-sm text-muted-foreground">Script → Voice → Video Pipeline</p>
        </div>
      </div>

      {/* Input */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground/80">Video Topic</label>
        <Input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g., The future of artificial intelligence"
          className="glass-subtle border-border/30 focus:border-primary/50"
          disabled={isGenerating}
        />
      </div>

      {/* Generate Button */}
      <Button
        onClick={generateFullVideo}
        disabled={isGenerating}
        className="w-full btn-aurora group"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            {getStepLabel()}
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4 mr-2 group-hover:animate-pulse" />
            Generate Full Video
          </>
        )}
      </Button>

      {/* Progress */}
      {isGenerating && (
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{getStepLabel()}</span>
            <span>{progress}%</span>
          </div>
        </div>
      )}

      {/* Pipeline Steps */}
      <div className="grid grid-cols-3 gap-3">
        <div className={`glass-subtle rounded-xl p-3 text-center transition-all ${
          step === 'script' ? 'ring-2 ring-primary' : script ? 'ring-2 ring-emerald-500/50' : ''
        }`}>
          <FileText className={`w-5 h-5 mx-auto mb-1 ${script ? 'text-emerald-400' : 'text-muted-foreground'}`} />
          <p className="text-xs text-muted-foreground">Script</p>
          {script && <CheckCircle2 className="w-3 h-3 mx-auto mt-1 text-emerald-400" />}
        </div>
        <div className={`glass-subtle rounded-xl p-3 text-center transition-all ${
          step === 'voice' ? 'ring-2 ring-primary' : audioUrl ? 'ring-2 ring-emerald-500/50' : ''
        }`}>
          <Mic className={`w-5 h-5 mx-auto mb-1 ${audioUrl ? 'text-emerald-400' : 'text-muted-foreground'}`} />
          <p className="text-xs text-muted-foreground">Voice</p>
          {audioUrl && <CheckCircle2 className="w-3 h-3 mx-auto mt-1 text-emerald-400" />}
        </div>
        <div className={`glass-subtle rounded-xl p-3 text-center transition-all ${
          ['video', 'polling'].includes(step) ? 'ring-2 ring-primary' : videoUrl ? 'ring-2 ring-emerald-500/50' : ''
        }`}>
          <Video className={`w-5 h-5 mx-auto mb-1 ${videoUrl ? 'text-emerald-400' : 'text-muted-foreground'}`} />
          <p className="text-xs text-muted-foreground">Video</p>
          {videoUrl && <CheckCircle2 className="w-3 h-3 mx-auto mt-1 text-emerald-400" />}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
          <XCircle className="w-5 h-5 text-destructive" />
          <span className="text-sm text-destructive">{error}</span>
        </div>
      )}

      {/* Script Preview */}
      {script && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground/80">Generated Script</label>
          <Textarea
            value={script}
            readOnly
            rows={4}
            className="glass-subtle border-border/30 text-sm resize-none"
          />
        </div>
      )}

      {/* Audio Player */}
      {audioUrl && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground/80">Voice Narration</label>
          <div className="flex items-center gap-3 glass-subtle rounded-xl p-3">
            <Button
              size="icon"
              variant="ghost"
              onClick={toggleAudio}
              className="h-10 w-10"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </Button>
            <audio
              ref={audioRef}
              src={audioUrl}
              onEnded={() => setIsPlaying(false)}
              className="hidden"
            />
            <span className="text-sm text-muted-foreground flex-1">
              {isPlaying ? 'Playing...' : 'Click to play'}
            </span>
            <Button
              size="icon"
              variant="ghost"
              asChild
              className="h-10 w-10"
            >
              <a href={audioUrl} download="narration.mp3">
                <Download className="w-4 h-4" />
              </a>
            </Button>
          </div>
        </div>
      )}

      {/* Video Player */}
      {videoUrl && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground/80">Generated Video</label>
          <div className="rounded-xl overflow-hidden border border-border/30">
            <video
              src={videoUrl}
              controls
              className="w-full aspect-video bg-black"
            />
          </div>
          <Button
            variant="outline"
            className="w-full"
            asChild
          >
            <a href={videoUrl} download="generated-video.mp4" target="_blank" rel="noopener noreferrer">
              <Download className="w-4 h-4 mr-2" />
              Download Video
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}
