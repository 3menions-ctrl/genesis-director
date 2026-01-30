import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, Palette, Dices, CheckCircle2, XCircle, 
  Loader2, Play, RefreshCw, Download, ExternalLink,
  Sparkles, Wand2, Film, Clock, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
    gradient: 'from-violet-500/30 via-purple-500/20 to-fuchsia-500/30',
    accentColor: 'violet',
    stages: ['Initializing', 'Processing Audio', 'Generating Lip Sync', 'Rendering Video', 'Finalizing'],
  },
  'motion-transfer': {
    name: 'Motion Transfer',
    icon: Dices,
    description: 'Transferring motion to target',
    gradient: 'from-emerald-500/30 via-teal-500/20 to-cyan-500/30',
    accentColor: 'emerald',
    stages: ['Analyzing Motion', 'Extracting Pose', 'Applying Transfer', 'Rendering Output', 'Finalizing'],
  },
  'video-to-video': {
    name: 'Style Transfer',
    icon: Palette,
    description: 'Applying artistic transformation',
    gradient: 'from-orange-500/30 via-amber-500/20 to-yellow-500/30',
    accentColor: 'amber',
    stages: ['Analyzing Style', 'Processing Frames', 'Applying Transformation', 'Rendering Video', 'Finalizing'],
  },
};

// Cinematic stage messages for each mode
const STAGE_MESSAGES: Record<string, Record<string, string[]>> = {
  'video-to-video': {
    'init': ['Initializing style engine...', 'Loading neural networks...'],
    'processing': ['Analyzing visual aesthetics...', 'Extracting style patterns...', 'Processing frame sequences...'],
    'style_rendering': ['Applying artistic transformation...', 'Rendering stylized frames...', 'Blending visual elements...'],
    'rendering': ['Encoding final video...', 'Optimizing output quality...'],
    'completed': ['Style transfer complete!'],
    'failed': ['Generation encountered an error'],
  },
  'motion-transfer': {
    'init': ['Initializing motion engine...', 'Loading pose detection...'],
    'processing': ['Analyzing source motion...', 'Extracting body landmarks...', 'Mapping motion vectors...'],
    'rendering': ['Applying motion to target...', 'Rendering transformed video...'],
    'completed': ['Motion transfer complete!'],
    'failed': ['Transfer encountered an error'],
  },
  'avatar': {
    'init': ['Initializing avatar engine...', 'Loading speech synthesis...'],
    'processing': ['Analyzing audio...', 'Generating lip movements...', 'Synchronizing expressions...'],
    'rendering': ['Rendering avatar video...', 'Applying final touches...'],
    'completed': ['Avatar generation complete!'],
    'failed': ['Generation encountered an error'],
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
  const [messageIndex, setMessageIndex] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime] = useState(Date.now());
  
  const config = MODE_CONFIG[mode];
  const Icon = config.icon;

  // Refs for stable interval management - prevents flickering from state changes
  const messageIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const elapsedIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const stageRef = useRef(localState.stage);
  
  // Keep ref in sync with state for interval callbacks
  useEffect(() => {
    stageRef.current = localState.stage;
  }, [localState.stage]);

  // Rotate through stage messages - stable interval
  useEffect(() => {
    const stage = localState.stage || 'init';
    const messages = STAGE_MESSAGES[mode]?.[stage] || STAGE_MESSAGES[mode]?.['processing'] || [];
    if (messages.length <= 1) {
      if (messageIntervalRef.current) clearInterval(messageIntervalRef.current);
      return;
    }

    messageIntervalRef.current = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % messages.length);
    }, 3000);
    
    return () => {
      if (messageIntervalRef.current) clearInterval(messageIntervalRef.current);
    };
  }, [localState.stage, mode]);

  // Elapsed time tracker - uses ref to avoid restart on stage change
  useEffect(() => {
    // Start timer immediately
    elapsedIntervalRef.current = setInterval(() => {
      // Check ref, not state, to avoid dependency
      if (stageRef.current !== 'completed' && stageRef.current !== 'failed') {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }
    }, 1000);
    
    return () => {
      if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
    };
  }, [startTime]); // Only depend on startTime

  // Get current display message
  const getCurrentMessage = () => {
    const stage = localState.stage || 'init';
    const messages = STAGE_MESSAGES[mode]?.[stage] || STAGE_MESSAGES[mode]?.['processing'] || ['Processing...'];
    return messages[messageIndex % messages.length] || localState.message || 'Processing...';
  };

  // Refs for polling stability - prevents callback recreation from state changes
  const predictionIdRef = useRef(localState.predictionId);
  const onCompleteRef = useRef(onComplete);
  
  useEffect(() => {
    predictionIdRef.current = localState.predictionId;
  }, [localState.predictionId]);
  
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Poll for status updates - stable callback using refs
  const pollStatus = useCallback(async () => {
    const currentPredictionId = predictionIdRef.current;
    if (!currentPredictionId || stageRef.current === 'completed' || stageRef.current === 'failed') {
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('check-specialized-status', {
        body: {
          projectId,
          predictionId: currentPredictionId,
        },
      });

      if (error) throw error;

      setLocalState(prev => ({
        ...prev,
        stage: data.stage,
        progress: data.progress,
        message: data.isComplete ? 'Generation complete!' : 
                 data.isFailed ? 'Generation failed' : prev.message,
        error: data.isFailed ? (data.error || 'Unknown error') : undefined,
      }));

      if (data.videoUrl) {
        setLocalVideoUrl(data.videoUrl);
      }

      if (data.isComplete) {
        setIsPolling(false);
        onCompleteRef.current?.();
      } else if (data.isFailed) {
        setIsPolling(false);
      }
    } catch (err) {
      console.error('Status poll error:', err);
    }
  }, [projectId]); // Only projectId - refs handle the rest

  // Start polling when predictionId is available
  useEffect(() => {
    if (localState.predictionId && localState.stage !== 'completed' && localState.stage !== 'failed') {
      setIsPolling(true);
    }
  }, [localState.predictionId, localState.stage]);

  // Polling interval
  useEffect(() => {
    if (!isPolling) return;
    pollStatus(); // Initial poll
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
  const progress = localState.progress || 0;

  // Format elapsed time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate current stage index for visualization
  const getCurrentStageIndex = () => {
    if (isComplete) return config.stages.length - 1;
    if (isFailed) return -1;
    const progressStage = Math.floor((progress / 100) * config.stages.length);
    return Math.min(progressStage, config.stages.length - 1);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative rounded-3xl overflow-hidden"
    >
      {/* Background with animated gradient */}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-br opacity-40",
        config.gradient
      )} />
      
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden">
        {isProcessing && (
          <>
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                className={cn(
                  "absolute w-1 h-1 rounded-full",
                  config.accentColor === 'amber' ? 'bg-amber-400/60' :
                  config.accentColor === 'emerald' ? 'bg-emerald-400/60' : 'bg-violet-400/60'
                )}
                initial={{ 
                  x: Math.random() * 100 + '%', 
                  y: '100%',
                  opacity: 0 
                }}
                animate={{ 
                  y: '-20%',
                  opacity: [0, 1, 0],
                }}
                transition={{
                  duration: 4 + Math.random() * 2,
                  repeat: Infinity,
                  delay: i * 0.5,
                  ease: 'easeOut',
                }}
              />
            ))}
          </>
        )}
      </div>
      
      {/* Glass card */}
      <div className="relative backdrop-blur-xl bg-zinc-900/80 border border-white/[0.08] rounded-3xl">
        <div className="p-8">
          {/* Header */}
          <div className="flex items-center gap-5 mb-8">
            {/* Icon with glow effect */}
            <motion.div 
              className={cn(
                "relative w-20 h-20 rounded-2xl flex items-center justify-center",
                "bg-gradient-to-br",
                config.accentColor === 'amber' ? 'from-amber-500/20 to-orange-500/10' :
                config.accentColor === 'emerald' ? 'from-emerald-500/20 to-teal-500/10' : 
                'from-violet-500/20 to-purple-500/10',
                "border border-white/[0.1]"
              )}
              animate={isProcessing ? { 
                boxShadow: [
                  `0 0 20px ${config.accentColor === 'amber' ? 'rgba(245,158,11,0.2)' : config.accentColor === 'emerald' ? 'rgba(16,185,129,0.2)' : 'rgba(139,92,246,0.2)'}`,
                  `0 0 40px ${config.accentColor === 'amber' ? 'rgba(245,158,11,0.4)' : config.accentColor === 'emerald' ? 'rgba(16,185,129,0.4)' : 'rgba(139,92,246,0.4)'}`,
                  `0 0 20px ${config.accentColor === 'amber' ? 'rgba(245,158,11,0.2)' : config.accentColor === 'emerald' ? 'rgba(16,185,129,0.2)' : 'rgba(139,92,246,0.2)'}`,
                ]
              } : {}}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Icon className={cn(
                "w-10 h-10",
                config.accentColor === 'amber' ? 'text-amber-400' :
                config.accentColor === 'emerald' ? 'text-emerald-400' : 'text-violet-400'
              )} />
              
              {/* Processing spinner overlay */}
              {isProcessing && (
                <motion.div 
                  className="absolute inset-0 rounded-2xl border-2 border-transparent"
                  style={{
                    borderTopColor: config.accentColor === 'amber' ? '#f59e0b' : 
                                    config.accentColor === 'emerald' ? '#10b981' : '#8b5cf6',
                  }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                />
              )}
            </motion.div>
            
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-white mb-1">{config.name}</h2>
              <p className="text-white/50">{config.description}</p>
            </div>
            
            {/* Status badge */}
            <div className="flex flex-col items-end gap-2">
              {isComplete && (
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/20 border border-emerald-500/30"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400 font-medium">Complete</span>
                </motion.div>
              )}
              {isFailed && (
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-rose-500/20 border border-rose-500/30"
                >
                  <XCircle className="w-4 h-4 text-rose-400" />
                  <span className="text-rose-400 font-medium">Failed</span>
                </motion.div>
              )}
              {isProcessing && (
                <motion.div 
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.08] border border-white/[0.1]"
                  animate={{ opacity: [1, 0.7, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <Loader2 className="w-4 h-4 text-white/70 animate-spin" />
                  <span className="text-white/70 font-medium">Processing</span>
                </motion.div>
              )}
              
              {/* Elapsed time */}
              {isProcessing && (
                <div className="flex items-center gap-1.5 text-white/40 text-sm">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{formatTime(elapsedTime)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Stage Progress Visualization */}
          <div className="mb-8">
            {/* Stage dots */}
            <div className="flex items-center justify-between mb-4">
              {config.stages.map((stage, idx) => {
                const currentIdx = getCurrentStageIndex();
                const isActive = idx === currentIdx && isProcessing;
                const isCompleted = idx < currentIdx || isComplete;
                const isFuture = idx > currentIdx && !isComplete;
                
                return (
                  <div key={stage} className="flex flex-col items-center gap-2 flex-1">
                    <motion.div
                      className={cn(
                        "relative w-10 h-10 rounded-full flex items-center justify-center",
                        "transition-all duration-500",
                        isCompleted ? cn(
                          "bg-gradient-to-br",
                          config.accentColor === 'amber' ? 'from-amber-500 to-orange-500' :
                          config.accentColor === 'emerald' ? 'from-emerald-500 to-teal-500' : 
                          'from-violet-500 to-purple-500'
                        ) : isActive ? 'bg-white/10 border-2 border-white/30' : 'bg-white/[0.05] border border-white/[0.1]'
                      )}
                      animate={isActive ? { scale: [1, 1.1, 1] } : {}}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-5 h-5 text-white" />
                      ) : isActive ? (
                        <Loader2 className="w-5 h-5 text-white animate-spin" />
                      ) : (
                        <span className="text-white/40 text-sm font-medium">{idx + 1}</span>
                      )}
                      
                      {/* Active glow */}
                      {isActive && (
                        <motion.div
                          className={cn(
                            "absolute inset-0 rounded-full",
                            config.accentColor === 'amber' ? 'bg-amber-500/30' :
                            config.accentColor === 'emerald' ? 'bg-emerald-500/30' : 'bg-violet-500/30'
                          )}
                          animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        />
                      )}
                    </motion.div>
                    <span className={cn(
                      "text-xs text-center transition-colors",
                      isCompleted || isActive ? 'text-white/70' : 'text-white/30'
                    )}>
                      {stage}
                    </span>
                  </div>
                );
              })}
            </div>
            
            {/* Progress bar */}
            <div className="relative h-2 bg-white/[0.08] rounded-full overflow-hidden">
              <motion.div
                className={cn(
                  "absolute inset-y-0 left-0 rounded-full",
                  "bg-gradient-to-r",
                  config.accentColor === 'amber' ? 'from-amber-500 to-orange-500' :
                  config.accentColor === 'emerald' ? 'from-emerald-500 to-teal-500' : 
                  'from-violet-500 to-purple-500'
                )}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
              
              {/* Shimmer effect */}
              {isProcessing && (
                <motion.div
                  className="absolute inset-y-0 w-20 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                  animate={{ x: ['-100%', '500%'] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
            </div>
            
            {/* Progress percentage and message */}
            <div className="flex items-center justify-between mt-3">
              <AnimatePresence mode="wait">
                <motion.span
                  key={getCurrentMessage()}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="text-white/60 text-sm flex items-center gap-2"
                >
                  {isProcessing && <Sparkles className="w-3.5 h-3.5" />}
                  {getCurrentMessage()}
                </motion.span>
              </AnimatePresence>
              <span className={cn(
                "font-bold text-lg",
                config.accentColor === 'amber' ? 'text-amber-400' :
                config.accentColor === 'emerald' ? 'text-emerald-400' : 'text-violet-400'
              )}>
                {progress}%
              </span>
            </div>
          </div>

          {/* Video Preview */}
          {localVideoUrl && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl overflow-hidden bg-black/50 mb-6 ring-1 ring-white/[0.1]"
            >
              <video
                src={localVideoUrl}
                controls
                className="w-full aspect-video"
                poster="/placeholder.svg"
              />
            </motion.div>
          )}

          {/* Error Message */}
          {isFailed && localState.error && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 mb-6"
            >
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-rose-400 font-medium mb-1">Generation Failed</p>
                  <p className="text-rose-300/70 text-sm">{localState.error}</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-4">
            {isComplete && localVideoUrl && (
              <>
                <Button
                  onClick={() => window.open(localVideoUrl, '_blank')}
                  className={cn(
                    "flex-1 h-12 font-medium",
                    "bg-gradient-to-r text-white",
                    config.accentColor === 'amber' ? 'from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600' :
                    config.accentColor === 'emerald' ? 'from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600' : 
                    'from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600'
                  )}
                >
                  <Play className="w-4 h-4 mr-2" />
                  Play Full Video
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = localVideoUrl;
                    link.download = `${mode}-video.mp4`;
                    link.click();
                  }}
                  className="h-12 px-6 border-white/20 text-white hover:bg-white/10"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              </>
            )}
            
            {isFailed && onRetry && (
              <Button
                onClick={onRetry}
                className="h-12 px-8 bg-white/10 text-white hover:bg-white/20 border border-white/10"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry Generation
              </Button>
            )}

            {isProcessing && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08]">
                <motion.div
                  className={cn(
                    "w-3 h-3 rounded-full",
                    config.accentColor === 'amber' ? 'bg-amber-500' :
                    config.accentColor === 'emerald' ? 'bg-emerald-500' : 'bg-violet-500'
                  )}
                  animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <span className="text-white/60 text-sm">AI is generating your video...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
