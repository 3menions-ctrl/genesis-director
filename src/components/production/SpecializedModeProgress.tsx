import { useEffect, useState, useCallback, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Palette, Dices, CheckCircle2, XCircle,
  Play, RefreshCw, Download, Sparkles,
  Film, Clock, Zap, Eye, PlayCircle
} from 'lucide-react';
import { PausedFrameVideo } from '@/components/ui/PausedFrameVideo';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useNavigationWithLoading } from '@/components/navigation';
import { toast } from 'sonner';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface PipelineState {
  stage: string;
  progress: number;
  message?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  predictionId?: string;
  currentClip?: number;
  totalClips?: number;
}

interface ClipInfo {
  index: number;
  videoUrl: string;
  status: 'completed' | 'failed' | 'generating' | 'pending';
}

interface SpecializedModeProgressProps {
  projectId: string;
  mode: 'avatar' | 'motion-transfer' | 'video-to-video';
  pipelineState: PipelineState;
  videoUrl?: string | null;
  allClips?: ClipInfo[];
  masterAudioUrl?: string | null;
  onComplete?: () => void;
  onRetry?: () => void;
  onCancel?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE CONFIG  — unified palette per mode
// ─────────────────────────────────────────────────────────────────────────────

const MODE_CONFIG = {
  'avatar': {
    name: 'AI Avatar',
    icon: User,
    description: 'Speaking avatar with lip sync',
    hue: 270,        // violet
    stages: ['Initializing', 'Processing Audio', 'Generating Lip Sync', 'Rendering Video', 'Finalizing'],
    activityTexts: ['Initializing avatar engine...', 'Analyzing audio...', 'Generating lip movements...', 'Rendering avatar video...', 'Applying final touches...'],
  },
  'motion-transfer': {
    name: 'Motion Transfer',
    icon: Dices,
    description: 'Transferring motion to target',
    hue: 160,        // emerald
    stages: ['Analyzing Motion', 'Extracting Pose', 'Applying Transfer', 'Rendering Output', 'Finalizing'],
    activityTexts: ['Initializing motion engine...', 'Analyzing source motion...', 'Extracting body landmarks...', 'Applying motion to target...', 'Rendering transformed video...'],
  },
  'video-to-video': {
    name: 'Style Transfer',
    icon: Palette,
    description: 'Applying artistic transformation',
    hue: 35,         // amber
    stages: ['Analyzing Style', 'Processing Frames', 'Applying Transformation', 'Rendering Video', 'Finalizing'],
    activityTexts: ['Initializing style engine...', 'Analyzing visual aesthetics...', 'Processing frame sequences...', 'Applying artistic transformation...', 'Encoding final video...'],
  },
} as const;

// helper: hsl string
function hsl(h: number, s: number, l: number, a = 1) {
  return `hsla(${h}, ${s}%, ${l}%, ${a})`;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// STAGE NODE (matches CinematicPipelineProgress aesthetic)
// ─────────────────────────────────────────────────────────────────────────────

const StageNode = memo(function StageNode({
  label, index, currentIndex, isComplete: done, hue,
}: { label: string; index: number; currentIndex: number; isComplete: boolean; hue: number }) {
  const isActive = index === currentIndex && !done;
  const isComp = index < currentIndex || done;
  const isPend = index > currentIndex && !done;

  return (
    <div className="flex flex-col items-center gap-2 min-w-0 flex-1">
      <div className="relative">
        {isActive && (
          <>
            <motion.div
              className="absolute -inset-4 rounded-xl blur-xl"
              style={{ background: hsl(hue, 80, 60, 0.2) }}
              animate={{ opacity: [0.5, 1, 0.5], scale: [0.9, 1.08, 0.9] }}
              transition={{ duration: 3, repeat: Infinity }}
            />
            <motion.div
              className="absolute -inset-2 rounded-xl border"
              style={{ borderColor: hsl(hue, 80, 65, 0.4) }}
              animate={{ opacity: [0.3, 0.8, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </>
        )}
        {isComp && (
          <motion.div
            className="absolute -inset-1.5 rounded-xl"
            style={{ background: 'hsl(160 80% 50% / 0.1)' }}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          />
        )}

        <motion.div
          className="relative w-12 h-12 rounded-xl flex items-center justify-center border overflow-hidden"
          style={{
            background: isPend
              ? 'hsl(0 0% 100% / 0.02)'
              : isComp
                ? 'hsl(160 80% 50% / 0.1)'
                : `linear-gradient(135deg, ${hsl(hue, 80, 55, 0.22)}, ${hsl(hue + 30, 70, 45, 0.12)})`,
            borderColor: isPend ? 'hsl(0 0% 100% / 0.06)' : isComp ? 'hsl(160 80% 50% / 0.3)' : hsl(hue, 80, 65, 0.3),
            boxShadow: isActive ? `0 0 20px ${hsl(hue, 80, 60, 0.25)}` : undefined,
          }}
          animate={isActive ? { scale: [1, 1.04, 1] } : {}}
          transition={{ duration: 2.5, repeat: Infinity }}
        >
          {/* Glass top */}
          <div className="absolute top-0 inset-x-0 h-1/3 bg-gradient-to-b from-white/[0.06] to-transparent rounded-t-xl pointer-events-none" />

          {isActive ? (
            <motion.span
              className="text-sm font-black relative z-10"
              style={{ color: hsl(hue, 80, 75, 1) }}
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              {index + 1}
            </motion.span>
          ) : isComp ? (
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 350, damping: 18 }}
              className="relative z-10 text-emerald-400"
            >
              <CheckCircle2 className="w-5 h-5" />
            </motion.div>
          ) : (
            <span className="text-xs font-bold relative z-10" style={{ color: 'hsl(0 0% 100% / 0.15)' }}>
              {index + 1}
            </span>
          )}

          {/* Active sweep bar */}
          {isActive && (
            <div className="absolute bottom-0 left-1.5 right-1.5 h-0.5 rounded-full overflow-hidden">
              <motion.div
                className="h-full"
                style={{ background: `linear-gradient(90deg, transparent, ${hsl(hue, 80, 70, 1)}, transparent)` }}
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>
          )}
        </motion.div>
      </div>

      <span className={cn(
        "text-[9px] font-bold uppercase tracking-widest text-center truncate w-full transition-colors",
        isPend ? "text-white/15" : isComp ? "text-emerald-400/70" : "text-white",
      )}>
        {label}
      </span>
    </div>
  );
});

// Connector between stage nodes
function StageConnector({ lit, hue, flowing }: { lit: boolean; hue: number; flowing: boolean }) {
  return (
    <div className="flex items-center flex-1 relative" style={{ marginTop: '-20px' }}>
      <div className="w-full h-px" style={{ background: 'hsl(0 0% 100% / 0.05)' }} />
      {lit && (
        <motion.div
          className="absolute inset-0 h-px"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          style={{ transformOrigin: 'left', background: `linear-gradient(90deg, ${hsl(hue, 80, 65, 0.5)}, ${hsl(hue, 80, 65, 0.15)})` }}
        />
      )}
      {flowing && (
        <motion.div
          className="absolute top-0 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
          style={{
            background: hsl(hue, 90, 75, 1),
            boxShadow: `0 0 6px ${hsl(hue, 90, 70, 0.8)}`,
          }}
          animate={{ x: ['0%', '100%'] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CLIP CARD (matches ProductionDashboard clip cards)
// ─────────────────────────────────────────────────────────────────────────────

function ClipCard({ clip, hue }: { clip: ClipInfo; hue: number }) {
  return (
    <motion.div
      whileHover={clip.status === 'completed' ? { scale: 1.07, y: -2 } : {}}
      className={cn(
        "relative w-13 h-13 rounded-xl flex items-center justify-center text-sm font-bold border overflow-hidden cursor-default transition-all",
        clip.status === 'completed' && 'cursor-pointer',
      )}
      style={{
        width: 52, height: 52,
        background: clip.status === 'completed'
          ? 'hsl(160 80% 50% / 0.08)'
          : clip.status === 'generating'
            ? hsl(hue, 80, 55, 0.08)
            : clip.status === 'failed'
              ? 'hsl(350 80% 60% / 0.08)'
              : 'hsl(0 0% 100% / 0.02)',
        borderColor: clip.status === 'completed'
          ? 'hsl(160 80% 50% / 0.25)'
          : clip.status === 'generating'
            ? hsl(hue, 80, 65, 0.25)
            : clip.status === 'failed'
              ? 'hsl(350 80% 60% / 0.25)'
              : 'hsl(0 0% 100% / 0.05)',
        color: clip.status === 'completed'
          ? 'hsl(160 80% 60%)'
          : clip.status === 'generating'
            ? hsl(hue, 80, 70, 1)
            : clip.status === 'failed'
              ? 'hsl(350 80% 65%)'
              : 'hsl(0 0% 100% / 0.12)',
      }}
      onClick={() => {
        if (clip.status === 'completed' && clip.videoUrl) {
          window.open(clip.videoUrl, '_blank');
        }
      }}
    >
      {/* Glow ring for generating */}
      {clip.status === 'generating' && (
        <motion.div
          className="absolute -inset-1 rounded-xl border"
          style={{ borderColor: hsl(hue, 80, 65, 0.3) }}
          animate={{ opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}

      <span className="relative z-10">{clip.index + 1}</span>

      {/* Bottom status bar */}
      <div className="absolute bottom-0 left-1.5 right-1.5 h-0.5 rounded-full overflow-hidden">
        {clip.status === 'completed' && <div className="h-full bg-gradient-to-r from-emerald-400 to-teal-400" />}
        {clip.status === 'generating' && (
          <motion.div
            className="h-full"
            style={{ background: `linear-gradient(90deg, ${hsl(hue, 80, 65, 1)}, ${hsl(hue + 20, 80, 70, 1)})` }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          />
        )}
        {clip.status === 'failed' && <div className="h-full bg-gradient-to-r from-rose-400 to-pink-400" />}
      </div>

      {/* Play overlay for completed */}
      {clip.status === 'completed' && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl opacity-0 hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-sm">
          <Play className="w-3.5 h-3.5 text-white" />
        </div>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function SpecializedModeProgress({
  projectId, mode, pipelineState, videoUrl, allClips = [], masterAudioUrl, onComplete, onRetry, onCancel,
}: SpecializedModeProgressProps) {
  const { navigateTo } = useNavigationWithLoading();
  const [localState, setLocalState] = useState<PipelineState>(pipelineState);
  const [localVideoUrl, setLocalVideoUrl] = useState(videoUrl);
  const [localClips, setLocalClips] = useState<ClipInfo[]>(allClips);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime] = useState(Date.now());
  const [isCancelling, setIsCancelling] = useState(false);
  const [actTextIdx, setActTextIdx] = useState(0);
  const [isPolling, setIsPolling] = useState(false);

  const config = MODE_CONFIG[mode];
  const Icon = config.icon;
  const hue = config.hue;

  // Sync props
  useEffect(() => {
    setLocalState(pipelineState);
    if (videoUrl) setLocalVideoUrl(videoUrl);
    if (allClips.length > 0) setLocalClips(allClips);
  }, [pipelineState, videoUrl, allClips]);

  // Elapsed timer
  const stageRef = useRef(localState.stage);
  useEffect(() => { stageRef.current = localState.stage; }, [localState.stage]);
  useEffect(() => {
    const interval = setInterval(() => {
      if (stageRef.current !== 'completed' && stageRef.current !== 'failed') {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  // Rotating activity text
  useEffect(() => {
    const interval = setInterval(() => setActTextIdx(i => (i + 1) % config.activityTexts.length), 3000);
    return () => clearInterval(interval);
  }, [config.activityTexts.length]);

  // Polling
  const predictionIdRef = useRef(localState.predictionId);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { predictionIdRef.current = localState.predictionId; }, [localState.predictionId]);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  const pollStatus = useCallback(async () => {
    const pid = predictionIdRef.current;
    if (!pid || stageRef.current === 'completed' || stageRef.current === 'failed') return;
    try {
      const { data } = await supabase.functions.invoke('check-specialized-status', {
        body: { projectId, predictionId: pid },
      });
      if (!data) return;
      setLocalState(prev => ({ ...prev, stage: data.stage, progress: data.progress }));
      if (data.videoUrl) setLocalVideoUrl(data.videoUrl);
      if (data.isComplete) { setIsPolling(false); onCompleteRef.current?.(); }
      else if (data.isFailed) setIsPolling(false);
    } catch { /* silent */ }
  }, [projectId]);

  useEffect(() => {
    if (localState.predictionId && localState.stage !== 'completed' && localState.stage !== 'failed') setIsPolling(true);
  }, [localState.predictionId, localState.stage]);

  useEffect(() => {
    if (!isPolling) return;
    pollStatus();
    const interval = setInterval(pollStatus, 3000);
    return () => clearInterval(interval);
  }, [isPolling, pollStatus]);

  // Cancel handler
  const handleCancel = async () => {
    if (isCancelling) return;
    setIsCancelling(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      await supabase.functions.invoke('cancel-project', { body: { projectId, userId: user.id } });
      toast.success('Project cancelled');
      onCancel?.();
      navigateTo('/projects');
    } catch { toast.error('Failed to cancel project'); }
    finally { setIsCancelling(false); }
  };

  // Derived state
  const completedClips = localClips.filter(c => c.status === 'completed');
  const hasMultipleClips = completedClips.length > 1;
  const totalExpected = localState.totalClips || 1;
  const isPlayableVideoUrl = localVideoUrl && !localVideoUrl.endsWith('.json') && !localVideoUrl.includes('manifest');
  const allClipsDone = completedClips.length >= totalExpected && totalExpected > 0;
  const isComplete = localState.stage === 'completed' || (isPlayableVideoUrl && mode !== 'avatar') || (mode === 'avatar' && allClipsDone);
  const isFailed = localState.stage === 'failed';
  const isProcessing = !isComplete && !isFailed;
  const progress = localState.progress || 0;

  const currentStageIndex = isComplete
    ? config.stages.length - 1
    : isFailed ? -1
    : Math.min(Math.floor((progress / 100) * config.stages.length), config.stages.length - 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="relative rounded-3xl overflow-hidden border border-white/[0.06] shadow-2xl shadow-black/50"
      style={{ background: 'hsl(0 0% 4% / 0.85)', backdropFilter: 'blur(40px)' }}
    >
      {/* Gradient border accent */}
      <div className="absolute inset-0 rounded-3xl pointer-events-none overflow-hidden">
        <div
          className="absolute -inset-[1px] rounded-3xl opacity-40"
          style={{
            background: isComplete
              ? 'linear-gradient(135deg, hsl(160 80% 50% / 0.5), transparent 45%, hsl(185 90% 50% / 0.2), transparent 70%)'
              : isFailed
                ? 'linear-gradient(135deg, hsl(350 80% 60% / 0.4), transparent 50%)'
                : `linear-gradient(135deg, ${hsl(hue, 80, 60, 0.35)}, transparent 40%, ${hsl(hue + 30, 70, 55, 0.15)}, transparent 70%)`,
          }}
        />
        <div className="absolute top-0 inset-x-12 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent" />
      </div>

      {/* Ambient glow */}
      {isProcessing && (
        <motion.div
          className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2/3 w-[700px] h-80 rounded-full pointer-events-none"
          style={{ background: hsl(hue, 80, 60, 0.07), filter: 'blur(80px)' }}
          animate={{ opacity: [0.5, 0.9, 0.5] }}
          transition={{ duration: 4, repeat: Infinity }}
        />
      )}
      {isComplete && (
        <div className="absolute top-0 right-0 w-[500px] h-80 translate-x-1/4 -translate-y-1/3 pointer-events-none rounded-full"
          style={{ background: 'hsl(160 80% 50% / 0.07)', filter: 'blur(80px)' }} />
      )}

      {/* Floating particles during processing */}
      {isProcessing && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[0, 1, 2, 3, 4].map(i => (
            <div
              key={i}
              className="absolute w-0.5 h-0.5 rounded-full"
              style={{
                left: `${15 + i * 15}%`,
                background: hsl(hue, 80, 75, 0.4),
                animation: `float-up-particle ${5 + i * 0.8}s ease-in-out infinite`,
                animationDelay: `${i * 0.6}s`,
              }}
            />
          ))}
        </div>
      )}

      <div className="relative p-6 md:p-8">
        {/* ── Header ── */}
        <div className="flex items-start gap-5 mb-8">
          {/* Icon */}
          <motion.div
            className="relative rounded-2xl flex items-center justify-center border overflow-hidden flex-shrink-0"
            style={{
              width: 60, height: 60,
              background: isComplete
                ? 'linear-gradient(135deg, hsl(160 80% 50% / 0.2), hsl(185 90% 50% / 0.1))'
                : isFailed
                  ? 'hsl(350 80% 60% / 0.15)'
                  : `linear-gradient(135deg, ${hsl(hue, 80, 55, 0.2)}, ${hsl(hue + 20, 70, 45, 0.1)})`,
              borderColor: isComplete ? 'hsl(160 80% 50% / 0.3)' : isFailed ? 'hsl(350 80% 60% / 0.3)' : hsl(hue, 80, 65, 0.25),
              boxShadow: isProcessing ? `0 0 30px ${hsl(hue, 80, 60, 0.3)}` : undefined,
            }}
            animate={isProcessing ? {
              boxShadow: [
                `0 0 15px ${hsl(hue, 80, 60, 0.2)}`,
                `0 0 35px ${hsl(hue, 80, 60, 0.4)}`,
                `0 0 15px ${hsl(hue, 80, 60, 0.2)}`,
              ]
            } : {}}
            transition={{ duration: 2.5, repeat: Infinity }}
          >
            {isComplete ? (
              <motion.div animate={{ rotate: [0, 8, -8, 0] }} transition={{ duration: 4, repeat: Infinity }}>
                <Sparkles className="w-7 h-7 text-emerald-400" />
              </motion.div>
            ) : isFailed ? (
              <XCircle className="w-7 h-7 text-rose-400" />
            ) : (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                style={{ color: hsl(hue, 80, 72, 1) }}
              >
                <Icon className="w-7 h-7" />
              </motion.div>
            )}
            {/* Spinning ring overlay when processing */}
            {isProcessing && (
              <motion.div
                className="absolute inset-0 rounded-2xl border-2 border-transparent"
                style={{ borderTopColor: hsl(hue, 80, 65, 0.7) }}
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              />
            )}
            <div className="absolute top-0 inset-x-0 h-1/3 bg-gradient-to-b from-white/[0.06] to-transparent rounded-t-2xl" />
          </motion.div>

          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-white tracking-tight">{config.name}</h2>
            <p className="text-sm mt-0.5" style={{ color: 'hsl(0 0% 100% / 0.4)' }}>{config.description}</p>

            {localState.totalClips && localState.totalClips > 1 && (
              <div className="flex items-center gap-1.5 mt-2">
                <Film className="w-3.5 h-3.5" style={{ color: hsl(hue, 60, 60, 0.7) }} />
                <span className="text-xs" style={{ color: hsl(hue, 60, 70, 0.7) }}>
                  Clip {localState.currentClip || 1} of {localState.totalClips}
                </span>
              </div>
            )}
          </div>

          {/* Status badge + timer */}
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            {isComplete && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300 }}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border"
                style={{ background: 'hsl(160 80% 50% / 0.1)', borderColor: 'hsl(160 80% 50% / 0.3)' }}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs font-bold text-emerald-400">Complete</span>
              </motion.div>
            )}
            {isFailed && (
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/25">
                <XCircle className="w-3.5 h-3.5 text-rose-400" />
                <span className="text-xs font-bold text-rose-400">Failed</span>
              </div>
            )}
            {isProcessing && (
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06]">
                <div className="relative w-2 h-2">
                  <div className="absolute inset-0 rounded-full bg-emerald-400" />
                  <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping" />
                </div>
                <span className="text-[9px] font-black text-emerald-400/80 uppercase tracking-[0.25em]">Live</span>
              </div>
            )}

            {/* Timer */}
            {(isProcessing || elapsedTime > 0) && (
              <div className="flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-white/25" />
                <span className="text-sm font-mono font-bold tabular-nums" style={{ color: 'hsl(0 0% 100% / 0.6)' }}>
                  {formatTime(elapsedTime)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Progress bar ── */}
        <div className="relative h-1.5 rounded-full overflow-hidden mb-8" style={{ background: 'hsl(0 0% 100% / 0.04)' }}>
          <div
            className="absolute -inset-y-2 left-0 rounded-full blur-md opacity-50 transition-all duration-700"
            style={{
              width: `${Math.min(progress, 100)}%`,
              background: isComplete ? 'hsl(160 80% 50%)' : isFailed ? 'hsl(350 80% 60%)' : hsl(hue, 80, 60, 1),
            }}
          />
          <motion.div
            className="relative h-full rounded-full"
            style={{
              background: isComplete
                ? 'linear-gradient(90deg, hsl(160 80% 50%), hsl(185 90% 55%))'
                : isFailed
                  ? 'linear-gradient(90deg, hsl(350 80% 60%), hsl(340 75% 55%))'
                  : `linear-gradient(90deg, ${hsl(hue, 80, 65, 1)}, ${hsl(hue + 20, 75, 55, 1)})`,
            }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(progress, 100)}%` }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          />
          {isProcessing && (
            <div
              className="absolute inset-y-0 left-0 pointer-events-none"
              style={{
                width: `${Math.min(progress, 100)}%`,
                background: 'linear-gradient(90deg, transparent, hsl(0 0% 100% / 0.25), transparent)',
                animation: 'shimmer-sweep 2.5s ease-in-out infinite',
              }}
            />
          )}
        </div>

        {/* ── Stage nodes ── */}
        <div className="hidden sm:flex items-center mb-8">
          {config.stages.map((label, idx) => (
            <div key={label} className={cn("flex items-center", idx < config.stages.length - 1 ? "flex-1" : "")}>
              <StageNode
                label={label}
                index={idx}
                currentIndex={currentStageIndex}
                isComplete={isComplete}
                hue={hue}
              />
              {idx < config.stages.length - 1 && (
                <StageConnector
                  lit={idx < currentStageIndex || isComplete}
                  hue={hue}
                  flowing={idx === currentStageIndex - 1 && isProcessing}
                />
              )}
            </div>
          ))}
        </div>

        {/* ── Activity label ── */}
        {isProcessing && (
          <AnimatePresence mode="wait">
            <motion.div
              key={actTextIdx}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="flex items-center gap-2.5 mb-6 px-4 py-2.5 rounded-xl"
              style={{ background: 'hsl(0 0% 100% / 0.02)', border: `1px solid ${hsl(hue, 60, 60, 0.12)}` }}
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              >
                <Zap className="w-3.5 h-3.5" style={{ color: hsl(hue, 80, 70, 0.8) }} />
              </motion.div>
              <span className="text-xs font-mono" style={{ color: hsl(hue, 60, 75, 0.7) }}>
                {config.activityTexts[actTextIdx]}
              </span>
              {/* Progress percent */}
              <span className="ml-auto text-xs font-black tabular-nums" style={{ color: hsl(hue, 80, 70, 1) }}>
                {Math.round(progress)}%
              </span>
            </motion.div>
          </AnimatePresence>
        )}

        {/* ── Clip status grid (avatar multi-clip during generation) ── */}
        {mode === 'avatar' && localClips.length > 1 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Film className="w-3.5 h-3.5 text-white/20" />
              <span className="text-[10px] font-bold text-white/25 uppercase tracking-[0.15em]">
                Render Status
              </span>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {localClips.map(clip => (
                <ClipCard key={clip.index} clip={clip} hue={hue} />
              ))}
            </div>
          </div>
        )}

        {/* ── Multi-clip gallery (avatar complete) ── */}
        {hasMultipleClips && isComplete && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Film className="w-4 h-4 text-white/40" />
                All Clips ({completedClips.length})
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  for (const clip of completedClips) {
                    const a = document.createElement('a');
                    a.href = clip.videoUrl;
                    a.download = `${mode}-clip-${clip.index + 1}.mp4`;
                    a.click();
                    await new Promise(r => setTimeout(r, 500));
                  }
                }}
                className="text-white/50 hover:text-white gap-1.5 text-xs"
              >
                <Download className="w-3.5 h-3.5" />
                Download All
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {completedClips.map((clip, idx) => (
                <motion.div
                  key={clip.index}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.08 }}
                  className="rounded-2xl overflow-hidden ring-1 ring-white/[0.08]"
                  style={{ background: 'hsl(0 0% 0% / 0.5)' }}
                >
                  <PausedFrameVideo src={clip.videoUrl} controls className="w-full aspect-video" />
                  <div className="p-3 flex items-center justify-between border-t border-white/[0.05]">
                    <span className="text-xs font-medium text-white/60">Clip {clip.index + 1}</span>
                    <button
                      onClick={() => { const a = document.createElement('a'); a.href = clip.videoUrl; a.download = `${mode}-clip-${clip.index + 1}.mp4`; a.click(); }}
                      className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/80 transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      Download
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Single video preview ── */}
        {!hasMultipleClips && isPlayableVideoUrl && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl overflow-hidden ring-1 ring-white/[0.08] mb-6"
            style={{ background: 'hsl(0 0% 0% / 0.5)' }}
          >
            <PausedFrameVideo src={localVideoUrl} controls className="w-full aspect-video" />
          </motion.div>
        )}

        {/* ── Action buttons ── */}
        <div className="flex flex-wrap items-center gap-3">
          {isComplete && (
            <>
              {hasMultipleClips ? (
                <Button
                  onClick={() => setShowFullPlayer(true)}
                  className="flex-1 min-w-[140px] h-10 text-sm font-bold text-white"
                  style={{ background: `linear-gradient(135deg, ${hsl(hue, 80, 55, 1)}, ${hsl(hue + 25, 75, 48, 1)})`, boxShadow: `0 4px 20px ${hsl(hue, 80, 60, 0.3)}` }}
                >
                  <PlayCircle className="w-4 h-4 mr-2" />
                  Play All Clips
                </Button>
              ) : isPlayableVideoUrl ? (
                <Button
                  onClick={() => window.open(localVideoUrl, '_blank')}
                  className="flex-1 min-w-[140px] h-10 text-sm font-bold text-white"
                  style={{ background: `linear-gradient(135deg, ${hsl(hue, 80, 55, 1)}, ${hsl(hue + 25, 75, 48, 1)})`, boxShadow: `0 4px 20px ${hsl(hue, 80, 60, 0.3)}` }}
                >
                  <Play className="w-4 h-4 mr-2" />
                  Play Video
                </Button>
              ) : null}

              <Button
                variant="ghost"
                onClick={() => navigateTo('/editor')}
                className="h-10 px-4 text-white/60 hover:text-white hover:bg-white/[0.06] text-sm"
              >
                <Eye className="w-4 h-4 mr-2" />
                View in Library
              </Button>
            </>
          )}

          {isFailed && onRetry && (
            <Button
              onClick={onRetry}
              className="h-10 px-6 text-sm text-white bg-white/[0.08] hover:bg-white/[0.12] border border-white/10"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-2" />
              Retry
            </Button>
          )}

          {isProcessing && onCancel && (
            <button
              onClick={handleCancel}
              disabled={isCancelling}
              className="h-10 px-4 rounded-xl text-xs text-white/40 hover:text-rose-400 hover:bg-rose-500/10 transition-all border border-transparent hover:border-rose-500/20 disabled:opacity-40"
            >
              {isCancelling ? 'Cancelling...' : 'Cancel'}
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes float-up-particle {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.3; }
          50% { transform: translateY(-100px) scale(1.8); opacity: 0; }
        }
        @keyframes shimmer-sweep {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </motion.div>
  );
}

