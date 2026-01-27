import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  User, Palette, Dices, CheckCircle2, XCircle, 
  Loader2, Play, RefreshCw, ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface PipelineState {
  stage: string;
  progress: number;
  message?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  predictionId?: string;
}

interface SpecializedModeProgressProps {
  projectId: string;
  mode: 'avatar' | 'motion-transfer' | 'video-to-video';
  pipelineState: PipelineState;
  videoUrl?: string | null;
  onComplete?: () => void;
  onRetry?: () => void;
}

const MODE_CONFIG = {
  'avatar': {
    name: 'AI Avatar',
    icon: User,
    description: 'Speaking avatar with lip sync',
    gradient: 'from-blue-500/20 to-purple-500/20',
  },
  'motion-transfer': {
    name: 'Motion Transfer',
    icon: Dices,
    description: 'Transferring motion to target',
    gradient: 'from-green-500/20 to-teal-500/20',
  },
  'video-to-video': {
    name: 'Style Transfer',
    icon: Palette,
    description: 'Applying style transformation',
    gradient: 'from-orange-500/20 to-pink-500/20',
  },
};

export function SpecializedModeProgress({
  projectId,
  mode,
  pipelineState,
  videoUrl,
  onComplete,
  onRetry,
}: SpecializedModeProgressProps) {
  const [isPolling, setIsPolling] = useState(false);
  const [localState, setLocalState] = useState<PipelineState>(pipelineState);
  const [localVideoUrl, setLocalVideoUrl] = useState(videoUrl);
  
  const config = MODE_CONFIG[mode];
  const Icon = config.icon;

  // Poll for status updates
  const pollStatus = useCallback(async () => {
    if (!localState.predictionId || localState.stage === 'completed' || localState.stage === 'failed') {
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('check-specialized-status', {
        body: {
          projectId,
          predictionId: localState.predictionId,
        },
      });

      if (error) throw error;

      setLocalState(prev => ({
        ...prev,
        stage: data.stage,
        progress: data.progress,
        message: data.isComplete ? 'Generation complete!' : 
                 data.isFailed ? 'Generation failed' : prev.message,
      }));

      if (data.videoUrl) {
        setLocalVideoUrl(data.videoUrl);
      }

      if (data.isComplete) {
        setIsPolling(false);
        onComplete?.();
      } else if (data.isFailed) {
        setIsPolling(false);
      }
    } catch (err) {
      console.error('Status poll error:', err);
    }
  }, [projectId, localState.predictionId, localState.stage, onComplete]);

  // Start polling when predictionId is available
  useEffect(() => {
    if (localState.predictionId && localState.stage !== 'completed' && localState.stage !== 'failed') {
      setIsPolling(true);
    }
  }, [localState.predictionId, localState.stage]);

  // Polling interval
  useEffect(() => {
    if (!isPolling) return;

    const interval = setInterval(pollStatus, 3000);
    return () => clearInterval(interval);
  }, [isPolling, pollStatus]);

  // Sync with props
  useEffect(() => {
    setLocalState(pipelineState);
    if (videoUrl) setLocalVideoUrl(videoUrl);
  }, [pipelineState, videoUrl]);

  const isComplete = localState.stage === 'completed' || !!localVideoUrl;
  const isFailed = localState.stage === 'failed';
  const isProcessing = !isComplete && !isFailed;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative rounded-3xl overflow-hidden"
    >
      {/* Background gradient */}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-br opacity-30",
        config.gradient
      )} />
      
      <div className="relative p-8 backdrop-blur-sm">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className={cn(
            "w-16 h-16 rounded-2xl flex items-center justify-center",
            "bg-white/[0.08] border border-white/[0.1]"
          )}>
            <Icon className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">{config.name}</h2>
            <p className="text-white/50">{config.description}</p>
          </div>
          <div className="ml-auto">
            {isComplete && (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                Complete
              </Badge>
            )}
            {isFailed && (
              <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                <XCircle className="w-3.5 h-3.5 mr-1" />
                Failed
              </Badge>
            )}
            {isProcessing && (
              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                Processing
              </Badge>
            )}
          </div>
        </div>

        {/* Progress Section */}
        {isProcessing && (
          <div className="space-y-4 mb-6">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/70">
                {localState.message || 'Generating video...'}
              </span>
              <span className="text-white font-medium">{localState.progress}%</span>
            </div>
            <Progress value={localState.progress} className="h-2 bg-white/10" />
            
            {/* Stage indicator */}
            <div className="flex items-center gap-2 text-xs text-white/50">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Stage: {localState.stage || 'initializing'}</span>
            </div>
          </div>
        )}

        {/* Video Preview */}
        {localVideoUrl && (
          <div className="rounded-2xl overflow-hidden bg-black/50 mb-6">
            <video
              src={localVideoUrl}
              controls
              className="w-full aspect-video"
              poster="/placeholder.svg"
            />
          </div>
        )}

        {/* Error Message */}
        {isFailed && localState.error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 mb-6">
            <p className="text-red-400 text-sm">{localState.error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          {isComplete && localVideoUrl && (
            <>
              <Button
                onClick={() => window.open(localVideoUrl, '_blank')}
                className="bg-white text-black hover:bg-white/90"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open Full Video
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = localVideoUrl;
                  link.download = `${mode}-video.mp4`;
                  link.click();
                }}
                className="border-white/20 text-white hover:bg-white/10"
              >
                Download
              </Button>
            </>
          )}
          
          {isFailed && onRetry && (
            <Button
              onClick={onRetry}
              className="bg-white/10 text-white hover:bg-white/20"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry Generation
            </Button>
          )}

          {isProcessing && (
            <div className="flex items-center gap-2 text-white/50 text-sm">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span>AI is working on your video...</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
