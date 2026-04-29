/**
 * SpecializedModeProgress
 *
 * Aesthetic: APEX Studios brand system — mirrors CinemaLoader and
 * CinematicPipelineProgress. Deep blue-undertone base with conic aurora,
 * concentric halo around percentage, luminous hairlines and cinematic blue
 * progress bar. Used for Avatar, Motion Transfer, and Style Transfer modes.
 *
 * Behaviour preserved: polling, completion, multi-clip gallery, retry/cancel.
 * All expected clips are visible during creation (placeholders included).
 */

import { useEffect, useState, useCallback, useRef, memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Palette, Dices, CheckCircle2, XCircle,
  Play, RefreshCw, Download, Sparkles, AlertCircle,
  Film, Clock, Loader2, Eye, PlayCircle,
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
  onPlayClip?: (url: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE CONFIG  — unified cinematic blue palette across all modes
// ─────────────────────────────────────────────────────────────────────────────

const MODE_CONFIG = {
  'avatar': {
    name: 'AI Avatar',
    icon: User,
    description: 'Speaking avatar with native audio',
    stages: ['Initializing', 'Building Scene', 'Generating Video', 'Rendering Audio', 'Finalizing'],
    activityTexts: [
      'Initializing avatar engine…',
      'Composing scene…',
      'Generating avatar video…',
      'Rendering native audio…',
      'Applying final touches…',
    ],
  },
  'motion-transfer': {
    name: 'Motion Transfer',
    icon: Dices,
    description: 'Transferring motion to target',
    stages: ['Analyzing Motion', 'Extracting Pose', 'Applying Transfer', 'Rendering Output', 'Finalizing'],
    activityTexts: [
      'Initializing motion engine…',
      'Analyzing source motion…',
      'Extracting body landmarks…',
      'Applying motion to target…',
      'Rendering transformed video…',
    ],
  },
  'video-to-video': {
    name: 'Style Transfer',
    icon: Palette,
    description: 'Applying artistic transformation',
    stages: ['Analyzing Style', 'Processing Frames', 'Applying Transformation', 'Rendering Video', 'Finalizing'],
    activityTexts: [
      'Initializing style engine…',
      'Analyzing visual aesthetics…',
      'Processing frame sequences…',
      'Applying artistic transformation…',
      'Encoding final video…',
    ],
  },
} as const;

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// WAVEFORM — luminous cinematic blue (matches CinematicPipelineProgress)
// ─────────────────────────────────────────────────────────────────────────────

const WaveformCanvas = memo(function WaveformCanvas({
  isActive,
  progress,
}: {
  isActive: boolean;
  progress: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const tRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const setup = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      return { W: rect.width, H: rect.height };
    };

    let { W, H } = setup();
    const BARS = 48;
    const BAR_W = 3;
    const GAP = 2.2;
    const totalW = BARS * (BAR_W + GAP);

    const draw = () => {
      tRef.current += 0.014;
      const t = tRef.current;
      ctx.clearRect(0, 0, W, H);
      const startX = (W - totalW) / 2;
      const cy = H * 0.55;
      const filled = progress / 100;

      for (let i = 0; i < BARS; i++) {
        const norm = i / BARS;
        const lit = norm <= filled;
        const base = 4 + Math.sin(i * 0.31) * 3;
        const w1 = Math.sin(t * 1.9 + i * 0.18) * (10 + Math.sin(t * 0.3) * 5);
        const w2 = Math.sin(t * 1.1 + i * 0.29 + 1.2) * 6;
        const bh = Math.max(2, Math.abs(base + w1 + w2));
        const x = startX + i * (BAR_W + GAP);

        if (lit) {
          ctx.save();
          ctx.filter = 'blur(5px)';
          ctx.globalAlpha = 0.32;
          ctx.fillStyle = 'hsla(215,100%,60%,0.85)';
          ctx.beginPath();
          (ctx as any).roundRect(x - 1.5, cy - bh - 3, BAR_W + 3, bh * 2 + 6, 2);
          ctx.fill();
          ctx.restore();

          const grad = ctx.createLinearGradient(x, cy - bh, x, cy + bh);
          grad.addColorStop(0, 'hsla(215,100%,75%,0.65)');
          grad.addColorStop(0.5, 'hsla(215,100%,85%,0.98)');
          grad.addColorStop(1, 'hsla(215,100%,65%,0.65)');
          ctx.fillStyle = grad;
        } else {
          ctx.fillStyle = 'hsla(215,30%,60%,0.07)';
        }

        ctx.beginPath();
        (ctx as any).roundRect(x, cy - bh, BAR_W, bh, 1.5);
        ctx.fill();
      }

      if (isActive) rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    const ro = new ResizeObserver(() => { const r = setup(); W = r.W; H = r.H; });
    ro.observe(canvas);
    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect(); };
  }, [isActive, progress]);

  return <canvas ref={canvasRef} className="w-full h-full block" style={{ width: '100%', height: '100%' }} />;
});

// ─────────────────────────────────────────────────────────────────────────────
// STAGE PILLS — premium uppercase pill row
// ─────────────────────────────────────────────────────────────────────────────

const StagePills = memo(function StagePills({
  stages, currentIndex, isComplete, isFailed,
}: { stages: readonly string[]; currentIndex: number; isComplete: boolean; isFailed: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {stages.map((label, i) => {
        const done = isComplete || i < currentIndex;
        const active = !isComplete && !isFailed && i === currentIndex;
        const error = isFailed && i === currentIndex;
        return (
          <motion.div
            key={label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.04, duration: 0.25, ease: 'easeOut' }}
            className="flex items-center gap-1.5 px-3 py-1.5"
            style={{
              fontSize: 9,
              fontWeight: 400,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              borderRadius: 999,
              fontFamily: 'Sora, system-ui, sans-serif',
              background: active
                ? 'hsla(215,100%,55%,0.10)'
                : done
                ? 'hsla(0,0%,100%,0.025)'
                : error
                ? 'hsla(0,75%,55%,0.08)'
                : 'hsla(0,0%,100%,0.02)',
              boxShadow: active
                ? 'inset 0 0 0 1px hsla(215,100%,55%,0.4), inset 0 1px 0 hsla(215,100%,80%,0.12), 0 0 18px hsla(215,100%,55%,0.18)'
                : done
                ? 'inset 0 0 0 1px hsla(0,0%,100%,0.06)'
                : error
                ? 'inset 0 0 0 1px hsla(0,75%,55%,0.3)'
                : 'inset 0 0 0 1px hsla(0,0%,100%,0.04)',
              color: active
                ? 'hsla(215,100%,85%,0.95)'
                : done
                ? 'rgba(255,255,255,0.4)'
                : error
                ? 'hsl(0 75% 70%)'
                : 'rgba(255,255,255,0.18)',
            }}
          >
            {done && <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />}
            {error && <XCircle className="w-2.5 h-2.5 shrink-0" />}
            {active && (
              <motion.span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: 'hsl(215,100%,75%)', boxShadow: '0 0 8px hsla(215,100%,60%,0.85)' }}
                animate={{ opacity: [1, 0.2, 1] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
            <span>{label}</span>
          </motion.div>
        );
      })}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// CLIP TILE — premium glass tile (mirrors CinematicPipelineProgress.ClipGrid)
// ─────────────────────────────────────────────────────────────────────────────

function ClipTile({
  clip, onPlay,
}: { clip: ClipInfo; onPlay?: (url: string) => void }) {
  const isComp = clip.status === 'completed' && !!clip.videoUrl;
  const isBusy = clip.status === 'generating';
  const isFail = clip.status === 'failed';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: clip.index * 0.03, duration: 0.28 }}
      className="overflow-hidden"
      style={{
        borderRadius: 8,
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${
          isComp ? 'rgba(255,255,255,0.15)'
          : isBusy ? 'hsla(215,100%,60%,0.28)'
          : isFail ? 'hsl(0 75% 55% / 0.2)'
          : 'rgba(255,255,255,0.05)'
        }`,
        boxShadow: isBusy ? '0 0 18px hsla(215,100%,55%,0.12)' : undefined,
      }}
    >
      <div
        style={{
          height: 1,
          background: isComp
            ? 'rgba(255,255,255,0.6)'
            : isBusy
            ? 'hsla(215,100%,75%,0.7)'
            : isFail
            ? 'hsl(0 75% 55%)'
            : 'rgba(255,255,255,0.06)',
        }}
      />

      <div className="p-2.5 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span style={{
            fontSize: 10, fontWeight: 500, letterSpacing: '0.05em',
            color: isComp ? 'rgba(255,255,255,0.75)'
              : isBusy ? 'hsla(215,100%,85%,0.75)'
              : isFail ? 'hsl(0 75% 65%)'
              : 'rgba(255,255,255,0.25)',
            fontFamily: 'Sora, system-ui, sans-serif',
          }}>
            Clip {clip.index + 1}
          </span>
          {isComp && <CheckCircle2 style={{ width: 12, height: 12, color: 'rgba(255,255,255,0.5)' }} />}
          {isFail && <AlertCircle style={{ width: 12, height: 12, color: 'hsl(0 75% 55%)' }} />}
          {isBusy && <Loader2 style={{ width: 12, height: 12, color: 'hsla(215,100%,75%,0.85)' }} className="animate-spin" />}
          {!isComp && !isBusy && !isFail && (
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
          )}
        </div>

        {isComp && clip.videoUrl && (
          <button
            onClick={() => onPlay?.(clip.videoUrl)}
            className="flex items-center justify-center gap-1 py-1.5 transition-all hover:brightness-125"
            style={{
              fontSize: 9, fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.18)',
              color: 'rgba(255,255,255,0.7)',
              borderRadius: 4,
              fontFamily: 'Sora, system-ui, sans-serif',
            }}
          >
            <Play style={{ width: 9, height: 9 }} className="fill-current" />
            Play
          </button>
        )}

        {isBusy && (
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            <motion.div
              className="h-full"
              style={{ background: 'linear-gradient(90deg, transparent, hsla(215,100%,75%,0.95), transparent)' }}
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
        )}

        {!isComp && !isBusy && !isFail && (
          <div style={{ height: 1, background: 'rgba(255,255,255,0.04)' }} />
        )}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function SpecializedModeProgress({
  projectId, mode, pipelineState, videoUrl, allClips = [], masterAudioUrl,
  onComplete, onRetry, onCancel, onPlayClip,
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
  const [showFullPlayer, setShowFullPlayer] = useState(false);

  const config = MODE_CONFIG[mode];
  const Icon = config.icon;

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
  const completedClipsArr = localClips.filter(c => c.status === 'completed');
  const completedCount = completedClipsArr.length;
  const hasMultipleClips = completedCount > 1;
  const totalExpected = localState.totalClips || (mode === 'avatar' && localClips.length > 0 ? localClips.length : 1);
  const isPlayableVideoUrl = localVideoUrl && !localVideoUrl.endsWith('.json') && !localVideoUrl.includes('manifest');
  const allClipsDone = completedCount >= totalExpected && totalExpected > 1;
  const isComplete = localState.stage === 'completed'
    || (isPlayableVideoUrl && mode !== 'avatar')
    || (mode === 'avatar' && allClipsDone);
  const isFailed = localState.stage === 'failed';
  const isProcessing = !isComplete && !isFailed;
  const progress = Math.max(0, Math.min(100, localState.progress || 0));
  const pct = Math.round(progress);

  const currentStageIndex = isComplete
    ? config.stages.length - 1
    : isFailed ? Math.max(0, Math.min(config.stages.length - 1, Math.floor((progress / 100) * config.stages.length)))
    : Math.min(Math.floor((progress / 100) * config.stages.length), config.stages.length - 1);

  const statusText = isComplete
    ? 'Your video is ready'
    : isFailed
    ? (localState.error ?? 'Something went wrong')
    : config.activityTexts[Math.min(currentStageIndex, config.activityTexts.length - 1)];

  // Build a rendered clip list that always shows ALL expected clips (placeholders included)
  const renderedClips = useMemo<ClipInfo[]>(() => {
    const total = Math.max(totalExpected, localClips.length);
    if (total <= 1) return localClips;
    const map = new Map<number, ClipInfo>();
    for (const c of localClips) map.set(c.index, c);
    const list: ClipInfo[] = [];
    for (let i = 0; i < total; i++) {
      list.push(map.get(i) ?? { index: i, videoUrl: '', status: 'pending' });
    }
    return list;
  }, [localClips, totalExpected]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="relative flex flex-col gap-7 w-full overflow-hidden"
      style={{
        backgroundColor: 'hsl(220, 14%, 2%)',
        borderRadius: 24,
        boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.05), inset 0 0 0 1px hsla(0,0%,100%,0.04), 0 40px 100px -20px rgba(0,0,0,0.9)',
        padding: '40px 32px 32px',
      }}
    >
      {/* Layer 1 — deep base wash */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          borderRadius: 24,
          background:
            'radial-gradient(1200px 700px at 50% 30%, hsla(215, 95%, 26%, 0.22), transparent 62%),' +
            'radial-gradient(900px 540px at 100% 110%, hsla(210, 80%, 18%, 0.14), transparent 58%),' +
            'radial-gradient(700px 480px at 0% 100%, hsla(220, 70%, 12%, 0.16), transparent 60%),' +
            'linear-gradient(180deg, hsl(220, 16%, 3.4%) 0%, hsl(220, 14%, 2%) 100%)',
        }}
      />

      {/* Layer 2 — slow conic aurora sweep */}
      {!isFailed && (
        <div
          className="absolute -inset-[20%] pointer-events-none opacity-[0.18]"
          style={{
            background:
              'conic-gradient(from 0deg at 50% 50%, transparent 0deg, hsla(215,100%,60%,0.32) 60deg, transparent 130deg, hsla(210,100%,55%,0.2) 220deg, transparent 300deg, hsla(215,100%,60%,0.26) 360deg)',
            filter: 'blur(80px)',
            animation: 'specAurora 50s linear infinite',
          }}
        />
      )}

      {/* Layer 3 — vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          borderRadius: 24,
          background: 'radial-gradient(ellipse at center, transparent 50%, hsla(220,30%,1%,0.7) 100%)',
        }}
      />

      {/* Layer 4 — film grain */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.045] mix-blend-overlay"
        style={{
          borderRadius: 24,
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.9'/></svg>\")",
        }}
      />

      {/* Top + bottom luminous hairlines */}
      <div
        className="absolute top-0 left-0 right-0 h-px pointer-events-none"
        style={{
          background: isFailed
            ? 'linear-gradient(90deg, transparent 10%, hsl(0 75% 55% / 0.55) 50%, transparent 90%)'
            : isComplete
            ? 'linear-gradient(90deg, transparent 10%, hsla(160, 84%, 55%, 0.55) 50%, transparent 90%)'
            : 'linear-gradient(90deg, transparent 0%, hsla(215,100%,60%,0.55) 50%, transparent 100%)',
        }}
      />
      <div
        className="absolute bottom-0 left-0 right-0 h-px pointer-events-none"
        style={{
          background: isFailed
            ? 'linear-gradient(90deg, transparent 10%, hsl(0 75% 55% / 0.35) 50%, transparent 90%)'
            : 'linear-gradient(90deg, transparent 0%, hsla(215,100%,60%,0.38) 50%, transparent 100%)',
        }}
      />

      {/* ── Header strip ── */}
      <div className="relative z-10 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="relative flex items-center justify-center"
            style={{
              width: 38, height: 38, borderRadius: 12,
              background: 'linear-gradient(135deg, hsla(215,100%,55%,0.18), hsla(215,100%,42%,0.08))',
              boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.1), inset 0 0 0 1px hsla(215,100%,55%,0.28), 0 0 20px hsla(215,100%,55%,0.18)',
            }}
          >
            {isComplete ? (
              <Sparkles className="w-4 h-4" style={{ color: 'hsl(160 84% 70%)' }} />
            ) : isFailed ? (
              <XCircle className="w-4 h-4" style={{ color: 'hsl(0 75% 70%)' }} />
            ) : (
              <Icon className="w-4 h-4" style={{ color: 'hsl(215,100%,80%)' }} />
            )}
          </div>
          <div className="flex flex-col">
            <span
              className="font-light"
              style={{
                fontSize: 13, letterSpacing: '0.32em', textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.85)', fontFamily: 'Sora, system-ui, sans-serif',
              }}
            >
              {config.name}
            </span>
            <span style={{
              fontSize: 10, color: 'rgba(255,255,255,0.35)',
              letterSpacing: '0.18em', textTransform: 'uppercase',
              fontFamily: 'Sora, system-ui, sans-serif',
            }}>
              {config.description}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isProcessing && (
            <div className="flex items-center gap-1.5">
              <motion.div
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: 'hsl(215,100%,72%)', boxShadow: '0 0 8px hsla(215,100%,60%,0.85)' }}
                animate={{ opacity: [1, 0.25, 1] }}
                transition={{ duration: 1.8, repeat: Infinity }}
              />
              <span style={{
                fontSize: 9, color: 'hsla(215,100%,80%,0.7)',
                letterSpacing: '0.28em', textTransform: 'uppercase',
                fontFamily: 'Sora, system-ui, sans-serif',
              }}>Live</span>
            </div>
          )}
          <div className="flex items-center gap-1.5" style={{ color: 'hsla(215,30%,75%,0.45)' }}>
            <Clock style={{ width: 11, height: 11 }} />
            <span style={{ fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.18em' }}>
              {formatTime(elapsedTime)}
            </span>
          </div>
        </div>
      </div>

      {/* ── PERCENTAGE / HALO ── */}
      <div className="relative z-10 flex flex-col items-center gap-5 select-none">
        <div className="relative flex items-center justify-center" style={{ width: 'clamp(220px, 30vw, 300px)', height: 'clamp(220px, 30vw, 300px)' }}>
          {/* Pulsing inner aura */}
          {!isFailed && (
            <div
              className="absolute inset-[15%] rounded-full"
              style={{
                background: isComplete
                  ? 'radial-gradient(circle at 50% 50%, hsla(160,84%,55%,0.3) 0%, hsla(160,84%,40%,0.1) 35%, transparent 70%)'
                  : 'radial-gradient(circle at 50% 50%, hsla(215,100%,55%,0.35) 0%, hsla(215,100%,42%,0.12) 35%, transparent 70%)',
                animation: 'specAura 3.6s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                filter: 'blur(10px)',
              }}
            />
          )}

          {/* Outer rotating ring with orbital pip */}
          <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full" style={{ animation: 'specSpin 18s linear infinite' }}>
            <defs>
              <linearGradient id="specRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
                <stop offset="50%" stopColor={isFailed ? 'hsla(0,75%,65%,0.6)' : 'hsla(215,100%,68%,0.65)'} />
                <stop offset="100%" stopColor="rgba(255,255,255,0.05)" />
              </linearGradient>
            </defs>
            <circle cx="100" cy="100" r="98" fill="none" stroke="url(#specRingGrad)" strokeWidth="0.6" />
            <circle cx="100" cy="2" r="2.4" fill={isFailed ? 'hsl(0,75%,68%)' : 'hsl(215,100%,72%)'}>
              <animate attributeName="opacity" values="0.6;1;0.6" dur="2s" repeatCount="indefinite" />
            </circle>
          </svg>

          {/* Counter-rotating dashed arc */}
          <svg viewBox="0 0 200 200" className="absolute inset-3 w-[calc(100%-1.5rem)] h-[calc(100%-1.5rem)]" style={{ animation: 'specSpinReverse 26s linear infinite' }}>
            <circle cx="100" cy="100" r="92" fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="0.4" strokeDasharray="2 7" />
          </svg>

          {/* Progress arc */}
          <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full -rotate-90">
            <circle cx="100" cy="100" r="80" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
            <circle
              cx="100" cy="100" r="80"
              fill="none"
              stroke={isFailed ? 'hsla(0,75%,60%,0.85)' : isComplete ? 'hsla(160,84%,55%,0.9)' : 'hsla(215,100%,68%,0.9)'}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray={`${pct * 5.0265} ${502.65 - pct * 5.0265}`}
              style={{
                transition: 'stroke-dasharray 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                filter: isFailed
                  ? 'drop-shadow(0 0 8px hsla(0,75%,55%,0.55))'
                  : isComplete
                  ? 'drop-shadow(0 0 8px hsla(160,84%,48%,0.55))'
                  : 'drop-shadow(0 0 10px hsla(215,100%,60%,0.65))',
              }}
            />
          </svg>

          {/* Centered percentage */}
          <div
            className="relative z-10 font-light tabular-nums leading-none"
            style={{
              fontSize: 'clamp(64px, 9vw, 96px)',
              letterSpacing: '-0.06em',
              fontFamily: 'Sora, system-ui, sans-serif',
              color: isFailed ? 'hsl(0 75% 75%)' : 'rgba(255,255,255,0.96)',
              textShadow: isFailed
                ? '0 0 50px hsla(0,75%,45%,0.4)'
                : isComplete
                ? '0 0 50px hsla(160,84%,55%,0.25)'
                : '0 0 60px hsla(215,100%,55%,0.35)',
            }}
          >
            {pct}
            <span style={{ fontSize: '0.32em', fontWeight: 200, opacity: 0.4, marginLeft: '0.05em' }}>%</span>
          </div>
        </div>

        {/* Live status text */}
        <AnimatePresence mode="wait">
          <motion.p
            key={statusText + actTextIdx}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            style={{
              fontSize: 11,
              fontWeight: 300,
              fontFamily: 'Sora, system-ui, sans-serif',
              color: isFailed ? 'hsl(0 75% 65%)' : isComplete ? 'hsla(160,84%,70%,0.85)' : 'hsla(215,100%,80%,0.7)',
              letterSpacing: '0.28em',
              textTransform: 'uppercase',
              textAlign: 'center',
              maxWidth: 480,
              textShadow: isFailed ? 'none' : '0 0 16px hsla(215,100%,55%,0.25)',
            }}
          >
            {statusText}
          </motion.p>
        </AnimatePresence>

        {/* Wordmark divider */}
        <div className="flex items-center gap-3 mt-1">
          <div className="h-px w-10" style={{ background: 'linear-gradient(90deg, transparent, hsla(215,100%,65%,0.5))' }} />
          <p className="text-white/65 text-[10px] font-medium tracking-[0.4em] uppercase" style={{ fontFamily: 'Sora, system-ui, sans-serif' }}>
            {mode === 'avatar' ? 'Avatar · Live' : mode === 'motion-transfer' ? 'Motion · Live' : 'Style · Live'}
          </p>
          <div className="h-px w-10" style={{ background: 'linear-gradient(90deg, hsla(215,100%,65%,0.5), transparent)' }} />
        </div>
      </div>

      {/* ── WAVEFORM ── */}
      <div
        className="relative z-10 overflow-hidden"
        style={{
          height: 96,
          borderRadius: 14,
          background: 'hsla(215,40%,8%,0.35)',
          boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.04), inset 0 0 0 1px hsla(215,100%,55%,0.08)',
        }}
      >
        <WaveformCanvas isActive={isProcessing} progress={progress} />
      </div>

      {/* ── STAGE PILLS ── */}
      <div className="relative z-10">
        <StagePills stages={config.stages} currentIndex={currentStageIndex} isComplete={isComplete} isFailed={isFailed} />
      </div>

      {/* ── PROGRESS BAR ── */}
      <div className="relative z-10 flex flex-col gap-3">
        <div className="relative w-full overflow-hidden rounded-full" style={{ height: 2, background: 'rgba(255,255,255,0.04)' }}>
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              background: isFailed
                ? 'linear-gradient(90deg, hsla(0,75%,50%,0.7) 0%, hsla(0,75%,68%,0.95) 100%)'
                : isComplete
                ? 'linear-gradient(90deg, hsla(160,84%,48%,0.7) 0%, hsla(160,84%,68%,0.95) 100%)'
                : 'linear-gradient(90deg, hsla(215,100%,55%,0.7) 0%, hsla(215,100%,75%,0.95) 60%, rgba(255,255,255,0.95) 100%)',
              boxShadow: isFailed
                ? '0 0 12px hsla(0,75%,55%,0.6)'
                : isComplete
                ? '0 0 12px hsla(160,84%,55%,0.6)'
                : '0 0 14px hsla(215,100%,60%,0.65), 0 0 2px rgba(255,255,255,0.7)',
            }}
            animate={{ width: `${Math.max(1, pct)}%` }}
            transition={{ duration: 0.9, ease: [0.4, 0, 0.2, 1] }}
          >
            {!isFailed && pct > 2 && pct < 100 && (
              <div
                className="absolute -right-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
                style={{
                  background: 'rgba(255,255,255,0.95)',
                  boxShadow: isComplete
                    ? '0 0 10px hsla(160,84%,65%,0.9), 0 0 18px hsla(160,84%,50%,0.6)'
                    : '0 0 10px hsla(215,100%,70%,0.9), 0 0 18px hsla(215,100%,55%,0.6)',
                }}
              />
            )}
          </motion.div>
        </div>

        <div className="flex items-center justify-between">
          <span style={{
            fontSize: 9, fontWeight: 400, letterSpacing: '0.22em',
            color: 'hsla(215,30%,75%,0.45)', textTransform: 'uppercase',
            fontFamily: 'Sora, system-ui, sans-serif',
          }}>
            {totalExpected > 1 ? `${completedCount} / ${totalExpected} clips` : 'Render'}
          </span>

          {/* Diagnostic ticker */}
          {!isComplete && !isFailed && (
            <div className="flex items-center gap-5">
              {['Engine', 'Render', 'Stream'].map((label, i) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div
                    className="w-1 h-1 rounded-full"
                    style={{
                      background: 'hsla(215,100%,65%,0.85)',
                      boxShadow: '0 0 6px hsla(215,100%,65%,0.7)',
                      animation: `specTick 1.4s cubic-bezier(0.4, 0, 0.6, 1) ${i * 0.25}s infinite`,
                    }}
                  />
                  <span className="text-[9px] text-white/35 font-mono tracking-[0.22em] uppercase">{label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── CLIP BAR SPARKS (always visible when multi-clip) ── */}
      {totalExpected > 1 && !isComplete && (
        <div className="relative z-10 flex items-end justify-center gap-1.5">
          {Array.from({ length: Math.min(totalExpected, 16) }).map((_, i) => {
            const filled = i < completedCount;
            return (
              <motion.div
                key={i}
                className="rounded-sm flex-shrink-0"
                style={{
                  width: 3,
                  background: filled
                    ? 'linear-gradient(180deg, hsla(215,100%,80%,0.95), hsla(215,100%,55%,0.85))'
                    : 'rgba(255,255,255,0.06)',
                  boxShadow: filled ? '0 0 8px hsla(215,100%,55%,0.5)' : 'none',
                }}
                animate={{ height: filled ? 18 : 4 }}
                transition={{ duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }}
              />
            );
          })}
        </div>
      )}

      {/* ── CLIP TILES — ALL clips visible during creation ── */}
      {renderedClips.length > 1 && (
        <div className="relative z-10 w-full flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.06)' }} />
            <span style={{
              fontSize: 9, fontWeight: 400, letterSpacing: '0.22em',
              color: 'rgba(255,255,255,0.22)', textTransform: 'uppercase',
              fontFamily: 'Sora, system-ui, sans-serif',
            }}>
              {completedCount} / {renderedClips.length} clips ready
            </span>
            <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.06)' }} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {renderedClips.map((clip) => (
              <ClipTile key={clip.index} clip={clip} onPlay={onPlayClip} />
            ))}
          </div>
        </div>
      )}

      {/* ── COMPLETED MULTI-CLIP GALLERY ── */}
      {hasMultipleClips && isComplete && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Film className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.4)' }} />
              <span style={{
                fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.55)', fontFamily: 'Sora, system-ui, sans-serif',
              }}>
                All Clips · {completedClipsArr.length}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                const clipUrls = completedClipsArr.map(c => c.videoUrl);
                if (clipUrls.length <= 1) {
                  const a = document.createElement('a');
                  a.href = clipUrls[0]; a.download = `${mode}-clip-1.mp4`; a.click();
                  return;
                }
                toast.info('Downloading clips individually…');
                for (const clip of completedClipsArr) {
                  const a = document.createElement('a');
                  a.href = clip.videoUrl;
                  a.download = `${mode}-clip-${clip.index + 1}.mp4`;
                  a.click();
                  await new Promise(r => setTimeout(r, 500));
                }
              }}
              className="text-white/50 hover:text-white gap-1.5 text-[10px] uppercase tracking-[0.2em]"
              style={{ fontFamily: 'Sora, system-ui, sans-serif' }}
            >
              <Download className="w-3 h-3" />
              Download All
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {completedClipsArr.map((clip, idx) => (
              <motion.div
                key={clip.index}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.06 }}
                className="rounded-2xl overflow-hidden cursor-pointer group/clip"
                style={{
                  background: 'hsla(220,16%,4%,0.65)',
                  boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.05), inset 0 0 0 1px hsla(215,100%,55%,0.10), 0 14px 40px -16px rgba(0,0,0,0.7)',
                }}
                onClick={() => onPlayClip?.(clip.videoUrl)}
              >
                <div className="relative">
                  <PausedFrameVideo src={clip.videoUrl} controls={false} className="w-full aspect-video" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover/clip:opacity-100 transition-opacity">
                    <PlayCircle className="w-10 h-10 text-white/90" />
                  </div>
                </div>
                <div className="p-3 flex items-center justify-between" style={{ borderTop: '1px solid hsla(0,0%,100%,0.05)' }}>
                  <span style={{
                    fontSize: 10, color: 'rgba(255,255,255,0.6)',
                    letterSpacing: '0.2em', textTransform: 'uppercase',
                    fontFamily: 'Sora, system-ui, sans-serif',
                  }}>Clip {clip.index + 1}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); const a = document.createElement('a'); a.href = clip.videoUrl; a.download = `${mode}-clip-${clip.index + 1}.mp4`; a.click(); }}
                    className="flex items-center gap-1.5 text-[10px] text-white/40 hover:text-white/80 transition-colors uppercase tracking-[0.2em]"
                    style={{ fontFamily: 'Sora, system-ui, sans-serif' }}
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

      {/* ── SINGLE VIDEO PREVIEW ── */}
      {!hasMultipleClips && isPlayableVideoUrl && isComplete && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 rounded-2xl overflow-hidden"
          style={{
            background: 'hsla(220,16%,4%,0.65)',
            boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.05), inset 0 0 0 1px hsla(215,100%,55%,0.12), 0 14px 40px -16px rgba(0,0,0,0.7)',
          }}
        >
          <PausedFrameVideo src={localVideoUrl as string} controls className="w-full aspect-video" />
        </motion.div>
      )}

      {/* ── ACTION BUTTONS ── */}
      <div className="relative z-10 flex flex-wrap items-center justify-center gap-3">
        {isComplete && hasMultipleClips && (
          <button
            onClick={() => setShowFullPlayer(true)}
            className="transition-all hover:brightness-110"
            style={{
              fontSize: 10, fontWeight: 400, padding: '11px 32px', borderRadius: 999,
              letterSpacing: '0.28em', textTransform: 'uppercase',
              fontFamily: 'Sora, system-ui, sans-serif',
              background: 'linear-gradient(135deg, hsla(215,100%,55%,0.22), hsla(215,100%,45%,0.14))',
              boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.12), inset 0 0 0 1px hsla(215,100%,55%,0.42), 0 0 26px hsla(215,100%,55%,0.22)',
              color: 'hsla(215,100%,92%,0.96)',
            }}
          >
            ▶ Play All Clips
          </button>
        )}
        {isComplete && !hasMultipleClips && isPlayableVideoUrl && (
          <button
            onClick={() => window.open(localVideoUrl as string, '_blank')}
            className="transition-all hover:brightness-110"
            style={{
              fontSize: 10, fontWeight: 400, padding: '11px 32px', borderRadius: 999,
              letterSpacing: '0.28em', textTransform: 'uppercase',
              fontFamily: 'Sora, system-ui, sans-serif',
              background: 'linear-gradient(135deg, hsla(215,100%,55%,0.22), hsla(215,100%,45%,0.14))',
              boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.12), inset 0 0 0 1px hsla(215,100%,55%,0.42), 0 0 26px hsla(215,100%,55%,0.22)',
              color: 'hsla(215,100%,92%,0.96)',
            }}
          >
            ▶ Play Video
          </button>
        )}
        {isComplete && (
          <button
            onClick={() => navigateTo('/projects')}
            className="transition-all hover:brightness-125"
            style={{
              fontSize: 10, fontWeight: 400, padding: '11px 24px', borderRadius: 999,
              letterSpacing: '0.28em', textTransform: 'uppercase',
              fontFamily: 'Sora, system-ui, sans-serif',
              background: 'transparent',
              boxShadow: 'inset 0 0 0 1px hsla(0,0%,100%,0.12)',
              color: 'rgba(255,255,255,0.65)',
            }}
          >
            <Eye className="inline w-3 h-3 mr-2 -mt-0.5" />
            Library
          </button>
        )}

        {isFailed && onRetry && (
          <button
            onClick={onRetry}
            className="transition-all hover:brightness-110"
            style={{
              fontSize: 10, fontWeight: 400, padding: '11px 28px', borderRadius: 999,
              letterSpacing: '0.28em', textTransform: 'uppercase',
              fontFamily: 'Sora, system-ui, sans-serif',
              background: 'linear-gradient(135deg, hsla(215,100%,55%,0.18), hsla(215,100%,45%,0.12))',
              boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.12), inset 0 0 0 1px hsla(215,100%,55%,0.4), 0 0 24px hsla(215,100%,55%,0.2)',
              color: 'hsla(215,100%,90%,0.95)',
            }}
          >
            <RefreshCw className="inline w-3 h-3 mr-2 -mt-0.5" />
            Try Again
          </button>
        )}

        {isProcessing && onCancel && (
          <button
            onClick={handleCancel}
            disabled={isCancelling}
            className="transition-all disabled:opacity-40 hover:brightness-125"
            style={{
              fontSize: 9, fontWeight: 400, padding: '9px 22px', borderRadius: 999,
              letterSpacing: '0.28em', textTransform: 'uppercase',
              fontFamily: 'Sora, system-ui, sans-serif',
              color: 'hsl(0 75% 70%)',
              background: 'hsla(0,75%,55%,0.06)',
              boxShadow: 'inset 0 0 0 1px hsla(0,75%,55%,0.25)',
            }}
          >
            {isCancelling ? 'Cancelling…' : 'Cancel Production'}
          </button>
        )}
      </div>

      {/* Keyframes */}
      <style>{`
        @keyframes specSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes specSpinReverse { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
        @keyframes specAurora { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes specAura {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.08); }
        }
        @keyframes specTick {
          0%, 100% { opacity: 0.35; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.5); }
        }
      `}</style>
    </motion.div>
  );
}
