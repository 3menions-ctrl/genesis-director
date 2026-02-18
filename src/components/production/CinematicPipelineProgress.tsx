/**
 * CinematicPipelineProgress — Waveform Edition
 *
 * Beautiful animated sound-wave visualization inspired by the reference design.
 * Features: animated waveform bars, giant % counter, gradient progress bar,
 * live status text, stage stepper, and completed clip links.
 * All animations are slow and smooth — no rapid flashing or strobing.
 */

import React, { useMemo, memo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Clock, XCircle, Play, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============= TYPES =============

interface StageStatus {
  name: string;
  shortName: string;
  status: 'pending' | 'active' | 'complete' | 'error' | 'skipped';
  details?: string;
}

interface ClipData {
  index: number;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  videoUrl?: string;
  error?: string;
}

interface CinematicPipelineProgressProps {
  stages: StageStatus[];
  progress: number;
  isComplete: boolean;
  isError?: boolean;
  isRunning?: boolean;
  elapsedTime: number;
  projectTitle?: string;
  lastError?: string | null;
  onResume?: () => void;
  onCancel?: () => void;
  isResuming?: boolean;
  isCancelling?: boolean;
  className?: string;
  clips?: ClipData[];
  completedClips?: number;
  totalClips?: number;
  onPlayClip?: (url: string) => void;
}

// ============= STAGE CONFIGURATIONS =============

const STAGE_META: Record<string, {
  emoji: string;
  label: string;
  sublabel: string;
  hue: number;
}> = {
  'Script':   { emoji: '📝', label: 'Crafting Script',     sublabel: 'Narrative & structure',   hue: 220 },
  'Identity': { emoji: '👤', label: 'Locking Characters',  sublabel: 'Identity anchoring',       hue: 195 },
  'Audit':    { emoji: '🔍', label: 'Quality Check',       sublabel: 'Continuity audit',         hue: 160 },
  'Assets':   { emoji: '🎨', label: 'Creating Assets',     sublabel: 'Images, voice & music',    hue: 280 },
  'Render':   { emoji: '🎥', label: 'Rendering Video',     sublabel: 'Frame by frame',           hue: 20  },
  'Stitch':   { emoji: '✨', label: 'Final Assembly',       sublabel: 'Merging clips',            hue: 50  },
};

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ============= ANIMATED WAVEFORM =============

// ============= WAVE LAYER CONFIG =============

interface WaveLayer {
  freq: number;       // spatial frequency
  amp: number;        // amplitude (fraction of half-height)
  speed: number;      // time speed
  phase: number;      // phase offset
  colorStop: number;  // 0-1 along the blue→orange gradient
  lineWidth: number;
  glowWidth: number;
}

const WAVE_LAYERS: WaveLayer[] = [
  { freq: 1.4, amp: 0.55, speed: 0.38, phase: 0,    colorStop: 0.0, lineWidth: 2.0, glowWidth: 12 },
  { freq: 1.9, amp: 0.42, speed: 0.52, phase: 1.2,  colorStop: 0.3, lineWidth: 1.5, glowWidth: 10 },
  { freq: 2.5, amp: 0.30, speed: 0.28, phase: 2.5,  colorStop: 0.55, lineWidth: 1.2, glowWidth: 8 },
  { freq: 1.1, amp: 0.60, speed: 0.18, phase: 0.8,  colorStop: 0.78, lineWidth: 1.8, glowWidth: 14 },
  { freq: 3.0, amp: 0.22, speed: 0.65, phase: 1.8,  colorStop: 1.0, lineWidth: 1.0, glowWidth: 7 },
];

/** Interpolate the blue→purple→magenta→orange gradient */
function waveColor(
  t: number,
  filled: boolean,
  isError: boolean,
  isComplete: boolean,
  alpha = 1,
): string {
  if (isError)    return `rgba(220,50,80,${alpha * (filled ? 1 : 0.15)})`;
  if (isComplete) return `rgba(50,200,130,${alpha * (filled ? 1 : 0.15)})`;
  if (!filled)    return `rgba(55,60,90,${alpha * 0.18})`;

  let r: number, g: number, b: number;
  if (t < 0.33) {
    const s = t / 0.33;
    r = Math.round(80  + s * 100); g = Math.round(120 - s * 90); b = 255;
  } else if (t < 0.66) {
    const s = (t - 0.33) / 0.33;
    r = Math.round(180 + s * 65); g = Math.round(30  + s * 30); b = Math.round(255 - s * 130);
  } else {
    const s = (t - 0.66) / 0.34;
    r = 245; g = Math.round(60 + s * 135); b = Math.round(125 - s * 125);
  }
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Build an SVG smooth-curve path for a single wave layer */
function buildWavePath(
  layer: WaveLayer,
  W: number,
  H: number,
  time: number,
  progress: number, // 0-100
): { filledD: string; dimD: string } {
  const cy = H / 2;
  const amp = layer.amp * (H / 2) * 0.85;
  const filledX = (progress / 100) * W;
  const STEPS = 120;

  const pts: [number, number][] = [];
  for (let i = 0; i <= STEPS; i++) {
    const x = (i / STEPS) * W;
    const norm = x / W;
    // Envelope: taper at edges for natural look
    const envelope = Math.sin(norm * Math.PI) * 0.6 + 0.4;
    const y = cy - amp * envelope *
      Math.sin(layer.freq * Math.PI * 2 * norm + time * layer.speed + layer.phase);
    pts.push([x, y]);
  }

  const toD = (pts: [number, number][]) => {
    let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const cpX = (pts[i][0] + pts[i-1][0]) / 2;
      const cpY = (pts[i][1] + pts[i-1][1]) / 2;
      d += ` Q ${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)}, ${cpX.toFixed(1)} ${cpY.toFixed(1)}`;
    }
    return d;
  };

  // Split path at filledX boundary
  const filledPts = pts.filter(([x]) => x <= filledX + 5);
  const dimPts = pts.filter(([x]) => x >= filledX - 5);

  return {
    filledD: filledPts.length > 1 ? toD(filledPts) : '',
    dimD: dimPts.length > 1 ? toD(dimPts) : '',
  };
}

// ============= SVG WAVEFORM VISUALIZER =============

const WaveformVisualizer = memo(function WaveformVisualizer({
  progress,
  isRunning,
  isComplete,
  isError,
}: {
  progress: number;
  isRunning: boolean;
  isComplete: boolean;
  isError: boolean;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const animRef = useRef<number>(0);
  const startRef = useRef<number | null>(null);

  const W = 800;
  const H = 140;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    // Pre-select path elements for performance
    const filledPaths = WAVE_LAYERS.map((_, i) =>
      svg.querySelector<SVGPathElement>(`#wf-filled-${i}`)
    );
    const glowPaths = WAVE_LAYERS.map((_, i) =>
      svg.querySelector<SVGPathElement>(`#wf-filled-glow-${i}`)
    );
    const dimPaths = WAVE_LAYERS.map((_, i) =>
      svg.querySelector<SVGPathElement>(`#wf-dim-${i}`)
    );
    const sparkleGroup = svg.querySelector<SVGGElement>('#wf-sparkles');

    const draw = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const time = (ts - startRef.current) / 1000;

      WAVE_LAYERS.forEach((layer, i) => {
        const { filledD, dimD } = buildWavePath(layer, W, H, time, progress);
        if (filledPaths[i]) filledPaths[i]!.setAttribute('d', filledD);
        if (glowPaths[i])   glowPaths[i]!.setAttribute('d', filledD);
        if (dimPaths[i])    dimPaths[i]!.setAttribute('d', dimD);
      });

      // Animate sparkle dots near wave tip
      if (sparkleGroup) {
        const tipX = (progress / 100) * W;
        const children = sparkleGroup.querySelectorAll('circle');
        children.forEach((c, i) => {
          const jitter = Math.sin(time * 2.5 + i * 1.3) * 12;
          const jitterY = Math.cos(time * 1.8 + i * 0.9) * 10;
          const baseX = tipX + (i - 3) * 6 + jitter * 0.6;
          const baseY = H / 2 + jitterY;
          c.setAttribute('cx', baseX.toFixed(1));
          c.setAttribute('cy', baseY.toFixed(1));
          const opacity = Math.max(0, Math.sin(time * 3 + i * 0.7)) * 0.9;
          c.setAttribute('opacity', opacity.toFixed(2));
        });
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [progress, isRunning, isComplete, isError]);

  const filledFrac = progress / 100;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height: 140, overflow: 'visible' }}
      preserveAspectRatio="none"
    >
      <defs>
        {/* Clip to filled region */}
        <clipPath id="wf-clip-filled">
          <rect x="0" y="0" width={W * filledFrac} height={H} />
        </clipPath>
        {/* Clip to dim region */}
        <clipPath id="wf-clip-dim">
          <rect x={W * filledFrac} y="0" width={W * (1 - filledFrac)} height={H} />
        </clipPath>

        {/* Glow filters per layer */}
        {WAVE_LAYERS.map((layer, i) => (
          <filter key={i} id={`wf-glow-${i}`} x="-30%" y="-200%" width="160%" height="500%">
            <feGaussianBlur in="SourceGraphic" stdDeviation={layer.glowWidth * 0.4} result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        ))}

        {/* Horizontal baseline gradient */}
        <linearGradient id="wf-baseline-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="rgba(80,120,255,0.7)" />
          <stop offset="35%"  stopColor="rgba(180,50,230,0.8)" />
          <stop offset="65%"  stopColor="rgba(240,80,140,0.7)" />
          <stop offset="100%" stopColor="rgba(255,180,30,0.4)" />
        </linearGradient>

        {/* Sparkle dot gradient */}
        <radialGradient id="wf-sparkle-grad">
          <stop offset="0%"   stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="rgba(255,200,100,0)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* ── Dim (unfilled) wave layers ── */}
      {WAVE_LAYERS.map((layer, i) => (
        <path
          key={`dim-${i}`}
          id={`wf-dim-${i}`}
          d=""
          fill="none"
          stroke={waveColor(layer.colorStop, false, isError, isComplete, 1)}
          strokeWidth={layer.lineWidth * 0.8}
          clipPath="url(#wf-clip-dim)"
        />
      ))}

      {/* ── Filled wave layers (with glow) ── */}
      {WAVE_LAYERS.map((layer, i) => (
        <g key={`filled-${i}`} clipPath="url(#wf-clip-filled)">
          {/* Glow pass */}
          <path
            d=""
            id={`wf-filled-glow-${i}`}
            fill="none"
            stroke={waveColor(layer.colorStop, true, isError, isComplete, 0.35)}
            strokeWidth={layer.lineWidth * 6}
            filter={`url(#wf-glow-${i})`}
          />
          {/* Sharp line pass */}
          <path
            id={`wf-filled-${i}`}
            d=""
            fill="none"
            stroke={waveColor(layer.colorStop, true, isError, isComplete, 0.9)}
            strokeWidth={layer.lineWidth}
            strokeLinecap="round"
          />
        </g>
      ))}

      {/* ── Baseline glow line ── */}
      <line
        x1="0" y1={H / 2}
        x2={W * filledFrac} y2={H / 2}
        stroke="url(#wf-baseline-grad)"
        strokeWidth="1.5"
        opacity="0.6"
      />

      {/* ── Sparkle burst at wave tip ── */}
      <g id="wf-sparkles">
        {Array.from({ length: 8 }).map((_, i) => (
          <circle
            key={i}
            cx={W * filledFrac}
            cy={H / 2}
            r={i < 3 ? 2.5 : i < 6 ? 1.8 : 1.2}
            fill={i < 3 ? 'white' : i < 6 ? 'rgba(255,200,100,0.9)' : 'rgba(180,120,255,0.8)'}
            opacity="0"
          />
        ))}
      </g>

      {/* ── Vertical tip glow line ── */}
      {progress > 2 && progress < 99 && (
        <line
          x1={W * filledFrac} y1={H * 0.1}
          x2={W * filledFrac} y2={H * 0.9}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="1"
        />
      )}
    </svg>
  );
});

// ============= GRADIENT PROGRESS BAR =============

const GradientProgressBar = memo(function GradientProgressBar({
  progress,
  isError,
  isComplete,
}: {
  progress: number;
  isError: boolean;
  isComplete: boolean;
}) {
  const gradient = isError
    ? 'linear-gradient(90deg, hsl(0 80% 50%), hsl(15 90% 55%))'
    : isComplete
    ? 'linear-gradient(90deg, hsl(160 70% 45%), hsl(180 80% 50%))'
    : 'linear-gradient(90deg, hsl(220 90% 65%), hsl(270 80% 62%), hsl(320 75% 60%), hsl(30 90% 58%), hsl(45 100% 55%))';

  const glowColor = isError
    ? 'hsl(0 80% 55% / 0.5)'
    : isComplete
    ? 'hsl(160 70% 45% / 0.5)'
    : 'hsl(270 80% 62% / 0.5)';

  return (
    <div className="w-full flex flex-col gap-2">
      {/* Bar track */}
      <div
        className="relative w-full rounded-full overflow-hidden"
        style={{
          height: 8,
          background: 'hsl(240 10% 12%)',
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.4)',
        }}
      >
        {/* Dotted texture overlay on track */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: 'radial-gradient(circle, hsl(240 20% 60%) 1px, transparent 1px)',
            backgroundSize: '6px 6px',
          }}
        />

        {/* Fill */}
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            background: gradient,
            boxShadow: `0 0 16px ${glowColor}, 0 0 4px ${glowColor}`,
          }}
          animate={{ width: `${Math.max(1, progress)}%` }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />

        {/* Shimmer sweep */}
        <motion.div
          className="absolute inset-y-0 w-12 rounded-full pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)',
          }}
          animate={{ left: [`${Math.max(0, progress - 10)}%`, `${Math.max(0, progress)}%`] }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
});

// ============= STAGE STEPPER =============

const StageStepper = memo(function StageStepper({ stages }: { stages: StageStatus[] }) {
  const visible = stages.filter(s => s.status !== 'skipped');
  if (visible.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap justify-center">
      {visible.map((stage, i) => {
        const meta = STAGE_META[stage.shortName];
        const isDone = stage.status === 'complete';
        const isActive = stage.status === 'active';
        const isError = stage.status === 'error';
        const hue = meta?.hue ?? 263;
        const color = isError ? '0 72% 55%' : isDone ? '160 60% 48%' : `${hue} 65% 60%`;

        return (
          <React.Fragment key={stage.shortName}>
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.06, duration: 0.3 }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full"
              style={{
                background: (isActive || isDone)
                  ? `hsl(${color} / 0.12)`
                  : 'hsl(240 10% 8% / 0.6)',
                border: `1px solid hsl(${color} / ${isActive ? '0.45' : isDone ? '0.3' : '0.12'})`,
              }}
            >
              <span className="text-[10px]">{meta?.emoji ?? '•'}</span>
              <span
                className="text-[10px] font-semibold"
                style={{ color: `hsl(${color} / ${isActive || isDone ? '1' : '0.4'})` }}
              >
                {stage.shortName}
              </span>
              {isDone && <CheckCircle2 className="w-3 h-3" style={{ color: 'hsl(160 60% 48%)' }} />}
              {isError && <XCircle className="w-3 h-3 text-destructive" />}
              {isActive && (
                <motion.div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: `hsl(${color})` }}
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
            </motion.div>

            {i < visible.length - 1 && (
              <div
                className="w-3 h-px flex-shrink-0"
                style={{
                  background: isDone
                    ? 'hsl(160 60% 48% / 0.4)'
                    : 'hsl(240 5% 30% / 0.3)',
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
});

// ============= CLIP LINKS PANEL =============

const ClipLinksPanel = memo(function ClipLinksPanel({
  clips,
  onPlayClip,
}: {
  clips: ClipData[];
  onPlayClip?: (url: string) => void;
}) {
  const completedClips = clips.filter(c => c.status === 'completed' && c.videoUrl);
  if (completedClips.length === 0) return null;

  return (
    <div className="w-full">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
        Completed Clips ({completedClips.length})
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {clips.map((clip) => {
          const isDone = clip.status === 'completed' && clip.videoUrl;
          const isGenerating = clip.status === 'generating';
          const isFailed = clip.status === 'failed';

          return (
            <motion.div
              key={clip.index}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: clip.index * 0.05, duration: 0.3 }}
              className="relative rounded-xl overflow-hidden flex flex-col"
              style={{
                background: isDone
                  ? 'hsl(160 60% 48% / 0.06)'
                  : isGenerating
                  ? 'hsl(263 65% 58% / 0.06)'
                  : isFailed
                  ? 'hsl(0 72% 55% / 0.06)'
                  : 'hsl(240 10% 8%)',
                border: `1px solid ${
                  isDone
                    ? 'hsl(160 60% 48% / 0.25)'
                    : isGenerating
                    ? 'hsl(263 65% 58% / 0.25)'
                    : isFailed
                    ? 'hsl(0 72% 55% / 0.25)'
                    : 'hsl(240 10% 14%)'
                }`,
              }}
            >
              {/* Status bar at top */}
              <div
                className="h-0.5 w-full"
                style={{
                  background: isDone
                    ? 'hsl(160 60% 48%)'
                    : isGenerating
                    ? 'hsl(263 65% 58%)'
                    : isFailed
                    ? 'hsl(0 72% 55%)'
                    : 'transparent',
                }}
              />

              <div className="p-3 flex flex-col gap-2 flex-1">
                <div className="flex items-center justify-between">
                  <span
                    className="text-[11px] font-bold tabular-nums"
                    style={{
                      color: isDone
                        ? 'hsl(160 60% 55%)'
                        : isGenerating
                        ? 'hsl(263 65% 65%)'
                        : isFailed
                        ? 'hsl(0 72% 60%)'
                        : 'hsl(240 5% 45%)',
                    }}
                  >
                    Clip {clip.index + 1}
                  </span>
                  {isDone && (
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: 'hsl(160 60% 48%)' }} />
                  )}
                  {isFailed && (
                    <XCircle className="w-3.5 h-3.5 shrink-0 text-destructive" />
                  )}
                  {isGenerating && (
                    <motion.div
                      className="w-2 h-2 rounded-full"
                      style={{ background: 'hsl(263 65% 58%)' }}
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 1.8, repeat: Infinity }}
                    />
                  )}
                </div>

                {/* Action buttons for completed clips */}
                {isDone && clip.videoUrl && (
                  <div className="flex gap-1.5 mt-auto">
                    <button
                      onClick={() => onPlayClip?.(clip.videoUrl!)}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-semibold transition-all hover:brightness-110"
                      style={{
                        background: 'hsl(160 60% 48% / 0.15)',
                        border: '1px solid hsl(160 60% 48% / 0.3)',
                        color: 'hsl(160 60% 58%)',
                      }}
                    >
                      <Play className="w-2.5 h-2.5 fill-current" />
                      Play
                    </button>
                    <a
                      href={clip.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center w-7 h-7 rounded-lg transition-all hover:brightness-110"
                      style={{
                        background: 'hsl(263 65% 58% / 0.12)',
                        border: '1px solid hsl(263 65% 58% / 0.25)',
                        color: 'hsl(263 65% 65%)',
                      }}
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}

                {/* Generating state — tiny progress shimmer */}
                {isGenerating && (
                  <div
                    className="h-1 rounded-full overflow-hidden mt-auto"
                    style={{ background: 'hsl(263 65% 58% / 0.1)' }}
                  >
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: 'hsl(263 65% 58%)' }}
                      animate={{ x: ['-100%', '200%'] }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  </div>
                )}

                {/* Failed error message */}
                {isFailed && clip.error && (
                  <p className="text-[9px] text-destructive/70 leading-tight mt-1 line-clamp-2">
                    {clip.error}
                  </p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
});

// ============= MAIN COMPONENT =============

export function CinematicPipelineProgress({
  stages,
  progress,
  isComplete,
  isError = false,
  isRunning = false,
  elapsedTime,
  projectTitle,
  lastError,
  onResume,
  onCancel,
  isResuming,
  isCancelling,
  className,
  clips = [],
  completedClips = 0,
  totalClips = 0,
  onPlayClip,
}: CinematicPipelineProgressProps) {
  const activeStage = useMemo(
    () => stages.find(s => s.status === 'active') ?? null,
    [stages]
  );

  const activeMeta = useMemo(() => {
    if (!activeStage) return null;
    return STAGE_META[activeStage.shortName] ?? {
      emoji: '⚡', label: activeStage.name, sublabel: '', hue: 263,
    };
  }, [activeStage]);

  const roundedProgress = Math.round(progress);

  // Particle dots for atmosphere
  const particles = useMemo(
    () => Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 1 + Math.random() * 2,
      delay: Math.random() * 4,
      duration: 3 + Math.random() * 5,
    })),
    []
  );

  return (
    <div
      className={cn('relative flex flex-col gap-6 w-full rounded-2xl overflow-hidden', className)}
      style={{
        background: 'linear-gradient(160deg, hsl(240 20% 6%) 0%, hsl(260 25% 5%) 50%, hsl(240 15% 4%) 100%)',
        border: '1px solid hsl(263 40% 25% / 0.3)',
        padding: '28px 24px',
      }}
    >
      {/* Atmospheric particle field */}
      {isRunning && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {particles.map(p => (
            <motion.div
              key={p.id}
              className="absolute rounded-full"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: p.size,
                height: p.size,
                background: p.x < 40
                  ? 'hsl(220 90% 70% / 0.6)'
                  : p.x < 70
                  ? 'hsl(280 80% 65% / 0.5)'
                  : 'hsl(35 100% 65% / 0.5)',
              }}
              animate={{
                opacity: [0, 0.8, 0],
                scale: [0, 1.5, 0],
              }}
              transition={{
                duration: p.duration,
                delay: p.delay,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
      )}

      {/* ── Header: Stage stepper + time ── */}
      <div className="flex flex-col gap-3 relative">
        <StageStepper stages={stages} />
      </div>

      {/* ── Active stage label ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeStage?.shortName ?? (isComplete ? 'complete' : 'error')}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="text-center relative"
        >
          {!isComplete && !isError && activeMeta && (
            <>
              <p className="text-2xl font-bold tracking-wide text-foreground/90 leading-tight">
                {activeMeta.emoji}&nbsp;&nbsp;{activeMeta.label}
              </p>
              <p className="text-sm text-muted-foreground mt-1">{activeMeta.sublabel}</p>
              {activeStage?.details && (
                <p className="text-xs text-muted-foreground/60 mt-1 max-w-md mx-auto leading-relaxed">
                  {activeStage.details}
                </p>
              )}
            </>
          )}

          {isComplete && (
            <p className="text-2xl font-bold text-foreground/90">
              ✅&nbsp;&nbsp;Video Ready!
            </p>
          )}

          {isError && (
            <p className="text-2xl font-bold text-destructive">
              ❌&nbsp;&nbsp;Generation Failed
            </p>
          )}
        </motion.div>
      </AnimatePresence>

      {/* ── Giant % counter ── */}
      {/* ── Giant % counter with radial glow ── */}
      <div className="flex items-end justify-center gap-2 relative py-2">
        {/* Radial ambient glow behind number */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: isError
              ? 'radial-gradient(ellipse 60% 80% at 50% 55%, hsl(0 80% 50% / 0.12) 0%, transparent 75%)'
              : isComplete
              ? 'radial-gradient(ellipse 60% 80% at 50% 55%, hsl(160 70% 45% / 0.12) 0%, transparent 75%)'
              : 'radial-gradient(ellipse 60% 80% at 50% 55%, hsl(270 80% 60% / 0.14) 0%, transparent 75%)',
          }}
        />

        <motion.span
          key={roundedProgress}
          className="font-black tabular-nums leading-none select-none relative z-10"
          style={{
            fontSize: 'clamp(72px, 14vw, 130px)',
            background: isError
              ? 'linear-gradient(160deg, hsl(0 80% 65%), hsl(15 90% 58%))'
              : isComplete
              ? 'linear-gradient(160deg, hsl(140 75% 55%), hsl(180 85% 60%))'
              : 'linear-gradient(160deg, hsl(215 95% 75%) 0%, hsl(270 85% 70%) 35%, hsl(320 85% 68%) 65%, hsl(35 95% 65%) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            filter: isError
              ? 'drop-shadow(0 0 40px hsl(0 80% 55% / 0.5))'
              : isComplete
              ? 'drop-shadow(0 0 40px hsl(160 70% 50% / 0.5))'
              : 'drop-shadow(0 0 50px hsl(270 85% 65% / 0.45)) drop-shadow(0 0 20px hsl(215 95% 70% / 0.3))',
            letterSpacing: '-0.04em',
          }}
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          {roundedProgress}
        </motion.span>

        <div className="flex flex-col items-start pb-4 relative z-10">
          <span
            className="font-bold text-5xl leading-none"
            style={{
              background: isComplete
                ? 'linear-gradient(160deg, hsl(180 85% 60%), hsl(160 70% 50%))'
                : 'linear-gradient(160deg, hsl(320 85% 68%), hsl(35 95% 65%))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              opacity: 0.85,
            }}
          >
            %
          </span>
        </div>
      </div>

      {/* ── Waveform animation ── */}
      <div className="relative w-full -my-2">
        <WaveformVisualizer
          progress={progress}
          isRunning={isRunning}
          isComplete={isComplete}
          isError={isError}
        />
      </div>

      {/* ── Gradient progress bar ── */}
      <GradientProgressBar
        progress={progress}
        isError={isError}
        isComplete={isComplete}
      />

      {/* ── Clip progress counter (during rendering) ── */}
      {totalClips > 0 && !isComplete && (
        <div className="flex items-center justify-center gap-3">
          <div className="flex items-end gap-1">
            {Array.from({ length: Math.min(totalClips, 12) }).map((_, i) => {
              const done = i < completedClips;
              return (
                <motion.div
                  key={i}
                  className="rounded-sm flex-shrink-0"
                  style={{
                    width: 5,
                    background: done
                      ? 'linear-gradient(to top, hsl(160 70% 45%), hsl(180 80% 55%))'
                      : 'hsl(240 10% 18%)',
                    boxShadow: done ? '0 0 6px hsl(160 70% 45% / 0.5)' : 'none',
                  }}
                  animate={{ height: done ? 20 : 8 }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              );
            })}
          </div>
          <span className="text-sm text-muted-foreground font-medium tabular-nums">
            {completedClips} / {totalClips} clips rendered
          </span>
        </div>
      )}

      {/* ── Footer: elapsed time + cancel ── */}
      {isRunning && !isComplete && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span className="text-xs tabular-nums font-medium">{formatTime(elapsedTime)}</span>
          </div>
          {onCancel && (
            <button
              onClick={onCancel}
              disabled={isCancelling}
              className="text-xs text-muted-foreground/50 hover:text-muted-foreground/80 transition-colors disabled:opacity-40 px-3 py-1.5 rounded-lg hover:bg-destructive/10 border border-transparent hover:border-destructive/20"
            >
              {isCancelling ? 'Cancelling…' : 'Cancel'}
            </button>
          )}
        </div>
      )}

      {/* ── Error state extras ── */}
      {isError && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-3"
        >
          {lastError && (
            <p
              className="text-sm text-center max-w-sm leading-relaxed px-4 py-3 rounded-xl"
              style={{
                color: 'hsl(0 72% 65%)',
                background: 'hsl(0 72% 55% / 0.06)',
                border: '1px solid hsl(0 72% 55% / 0.15)',
              }}
            >
              {lastError}
            </p>
          )}
          {onResume && (
            <button
              onClick={onResume}
              disabled={isResuming}
              className="text-sm px-6 py-2.5 rounded-xl font-semibold transition-all disabled:opacity-50 hover:brightness-110"
              style={{
                background: 'linear-gradient(135deg, hsl(263 65% 55% / 0.2), hsl(280 60% 60% / 0.15))',
                border: '1px solid hsl(263 65% 60% / 0.4)',
                color: 'hsl(263 65% 72%)',
              }}
            >
              {isResuming ? 'Resuming…' : '↩ Try Again'}
            </button>
          )}
        </motion.div>
      )}

      {/* ── Clip links panel ── */}
      {clips.length > 0 && (
        <div
          className="pt-4"
          style={{ borderTop: '1px solid hsl(240 10% 14%)' }}
        >
          <ClipLinksPanel clips={clips} onPlayClip={onPlayClip} />
        </div>
      )}

      {/* ── Complete: project title ── */}
      {isComplete && projectTitle && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center text-sm text-muted-foreground"
        >
          "{projectTitle}" has been generated
        </motion.p>
      )}
    </div>
  );
}
