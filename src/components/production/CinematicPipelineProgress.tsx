import React, { useMemo, useEffect, useState, useRef, memo } from 'react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Users, Shield, Wand2, Film, Sparkles,
  CheckCircle2, Loader2, XCircle, Clapperboard, Zap,
} from 'lucide-react';

// ============= TYPES =============

interface StageStatus {
  name: string;
  shortName: string;
  status: 'pending' | 'active' | 'complete' | 'error' | 'skipped';
  details?: string;
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
}

// ============= STAGE METADATA =============

const STAGE_META: Record<string, {
  icon: React.ElementType;
  gradient: string;
  glowColor: string;
  ringColor: string;
  label: string;
  particleHue: number;
}> = {
  'Script':   { icon: FileText, gradient: 'from-violet-500 to-purple-600',  glowColor: 'rgba(139,92,246,0.35)', ringColor: '#8b5cf6', label: 'Crafting narrative',    particleHue: 270 },
  'Identity': { icon: Users,    gradient: 'from-cyan-500 to-blue-600',      glowColor: 'rgba(6,182,212,0.35)',   ringColor: '#06b6d4', label: 'Locking characters',   particleHue: 190 },
  'Audit':    { icon: Shield,   gradient: 'from-emerald-500 to-teal-600',   glowColor: 'rgba(16,185,129,0.35)',  ringColor: '#10b981', label: 'Quality check',        particleHue: 160 },
  'Assets':   { icon: Wand2,    gradient: 'from-amber-500 to-orange-600',   glowColor: 'rgba(245,158,11,0.35)',  ringColor: '#f59e0b', label: 'Generating assets',    particleHue: 35  },
  'Render':   { icon: Film,     gradient: 'from-rose-500 to-pink-600',      glowColor: 'rgba(244,63,94,0.35)',   ringColor: '#f43f5e', label: 'Rendering video',      particleHue: 350 },
  'Stitch':   { icon: Sparkles, gradient: 'from-indigo-500 to-violet-600',  glowColor: 'rgba(99,102,241,0.35)',  ringColor: '#6366f1', label: 'Final assembly',       particleHue: 240 },
};

// ============= SUB-COMPONENTS =============

const ActivityText = memo(function ActivityText({ stage }: { stage: string }) {
  const activities: Record<string, string[]> = {
    'Script': ['Analyzing structure...', 'Breaking into shots...', 'Adding camera cues...'],
    'Identity': ['Extracting features...', 'Mapping proportions...', 'Creating anchors...'],
    'Audit': ['Validating continuity...', 'Scoring coherence...', 'Checking lighting...'],
    'Assets': ['Creating images...', 'Generating music...', 'Synthesizing voice...'],
    'Render': ['Processing frames...', 'Applying style...', 'Generating video...'],
    'Stitch': ['Analyzing transitions...', 'Building manifest...', 'Finalizing...'],
  };

  const [index, setIndex] = useState(0);
  const list = activities[stage] || ['Processing...'];

  useEffect(() => {
    const interval = setInterval(() => setIndex(i => (i + 1) % list.length), 2800);
    return () => clearInterval(interval);
  }, [list.length]);

  return (
    <motion.span 
      key={index}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="text-[10px] text-white/40 font-mono block"
    >
      {list[index]}
    </motion.span>
  );
});

// Premium holographic stage node
function StageNode({ stage, index, totalStages }: { stage: StageStatus; index: number; totalStages: number }) {
  const meta = STAGE_META[stage.shortName] || STAGE_META['Script'];
  const Icon = meta.icon;
  const isActive = stage.status === 'active';
  const isComplete = stage.status === 'complete';
  const isError = stage.status === 'error';
  const isPending = stage.status === 'pending';

  return (
    <div className="flex flex-col items-center gap-3 min-w-0">
      {/* Node */}
      <div className="relative">
        {/* Outer pulsing ring for active */}
        {isActive && (
          <>
            <div 
              className="absolute -inset-4 rounded-2xl opacity-40 blur-xl animate-[pulse_3s_ease-in-out_infinite]"
              style={{ background: meta.glowColor }}
            />
            <div 
              className="absolute -inset-2 rounded-xl border opacity-50 animate-[pulse_2s_ease-in-out_infinite]"
              style={{ borderColor: meta.ringColor + '40' }}
            />
          </>
        )}
        {/* Complete halo */}
        {isComplete && (
          <div className="absolute -inset-2 rounded-xl bg-emerald-500/10 blur-md" />
        )}
        
        <motion.div 
          className={cn(
            "relative w-16 h-16 rounded-xl flex items-center justify-center transition-all duration-500 border",
            isPending && "bg-white/[0.02] border-white/[0.05] text-white/12",
            isActive && `bg-gradient-to-br ${meta.gradient} border-white/25 text-white shadow-2xl`,
            isComplete && "bg-emerald-500/12 border-emerald-500/25 text-emerald-400",
            isError && "bg-rose-500/12 border-rose-500/25 text-rose-400",
          )}
          animate={isActive ? { scale: [1, 1.04, 1] } : {}}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* Inner glow ring for active */}
          {isActive && (
            <div 
              className="absolute inset-0 rounded-xl opacity-30"
              style={{
                background: `radial-gradient(circle at center, ${meta.glowColor}, transparent 70%)`,
              }}
            />
          )}
          
          {isActive ? (
            <Loader2 className="w-5 h-5 animate-spin relative z-10" />
          ) : isComplete ? (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300 }}>
              <CheckCircle2 className="w-5 h-5" />
            </motion.div>
          ) : isError ? (
            <XCircle className="w-5 h-5" />
          ) : (
            <Icon className="w-5 h-5" />
          )}

          {/* Holographic shimmer overlay */}
          {isActive && (
            <div 
              className="absolute inset-0 rounded-xl overflow-hidden"
              style={{
                background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.08) 45%, transparent 50%)',
                animation: 'holographic-shimmer 3s ease-in-out infinite',
              }}
            />
          )}
        </motion.div>
      </div>

      {/* Label */}
      <div className="text-center min-h-[32px]">
        <p className={cn(
          "text-[11px] font-semibold tracking-wide uppercase transition-colors duration-300",
          isPending && "text-white/15",
          isActive && "text-white",
          isComplete && "text-emerald-400/80",
          isError && "text-rose-400/80",
        )}>
          {stage.shortName}
        </p>
        {isActive && (
          <div className="mt-0.5 h-4 overflow-hidden">
            <AnimatePresence mode="wait">
              <ActivityText stage={stage.shortName} />
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ============= MAIN COMPONENT =============

export function CinematicPipelineProgress({
  stages, progress, isComplete, isError, isRunning,
  elapsedTime, projectTitle, lastError,
  onResume, onCancel, isResuming, isCancelling, className,
}: CinematicPipelineProgressProps) {
  const activeStage = stages.find(s => s.status === 'active');
  const activeMeta = activeStage ? STAGE_META[activeStage.shortName] : null;
  const completedCount = stages.filter(s => s.status === 'complete').length;
  const activeIndex = stages.findIndex(s => s.status === 'active');
  const lineProgress = activeIndex >= 0
    ? ((completedCount + 0.5) / stages.length) * 100
    : (completedCount / stages.length) * 100;

  return (
    <div className={cn(
      "relative rounded-3xl overflow-hidden",
      "bg-black/40 border border-white/[0.06]",
      "backdrop-blur-3xl shadow-2xl shadow-black/40",
      className
    )}>
      {/* Layered gradient border effect */}
      <div className="absolute inset-0 rounded-3xl pointer-events-none overflow-hidden">
        <div 
          className="absolute -inset-[1px] rounded-3xl opacity-40"
          style={{
            background: isComplete
              ? 'linear-gradient(135deg, rgba(16,185,129,0.4), transparent 40%, rgba(20,184,166,0.2), transparent 70%, rgba(16,185,129,0.15))'
              : isError
                ? 'linear-gradient(135deg, rgba(244,63,94,0.3), transparent 50%, rgba(244,63,94,0.1))'
                : activeMeta 
                  ? `linear-gradient(135deg, ${activeMeta.glowColor}, transparent 35%, rgba(99,102,241,0.15), transparent 65%, ${activeMeta.glowColor.replace('0.35', '0.1')})`
                  : 'linear-gradient(135deg, rgba(139,92,246,0.25), transparent 40%, rgba(99,102,241,0.15))',
          }}
        />
        {/* Top edge light */}
        <div className="absolute top-0 inset-x-8 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      </div>

      {/* Ambient light effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {isComplete && (
          <>
            <div className="absolute top-0 right-0 w-[500px] h-[400px] bg-emerald-500/[0.06] blur-[150px] rounded-full translate-x-1/4 -translate-y-1/3" />
            <div className="absolute bottom-0 left-0 w-80 h-64 bg-teal-500/[0.04] blur-[100px] rounded-full -translate-x-1/4 translate-y-1/4" />
          </>
        )}
        {isRunning && !isComplete && !isError && activeMeta && (
          <>
            <div 
              className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-96 blur-[120px] rounded-full -translate-y-1/2 opacity-30"
              style={{ background: activeMeta.glowColor }}
            />
            {/* Secondary ambient */}
            <div 
              className="absolute bottom-0 right-1/4 w-72 h-48 blur-[80px] rounded-full translate-y-1/3 opacity-15"
              style={{ background: activeMeta.glowColor }}
            />
          </>
        )}
        {isError && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-80 bg-rose-500/[0.06] blur-[120px] rounded-full -translate-y-1/2" />
        )}

        {/* Floating particles */}
        {isRunning && !isComplete && !isError && (
          <div className="absolute inset-0">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="absolute w-0.5 h-0.5 rounded-full bg-white/20"
                style={{
                  left: `${12 + i * 11}%`,
                  top: `${80 + Math.sin(i) * 15}%`,
                  animation: `float-particle ${5 + i * 0.7}s ease-in-out infinite`,
                  animationDelay: `${i * 0.4}s`,
                }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="relative p-6 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <motion.div 
              className={cn(
                "w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 border relative overflow-hidden",
                isComplete
                  ? "bg-gradient-to-br from-emerald-500/20 to-teal-500/15 border-emerald-500/25"
                  : isError
                    ? "bg-gradient-to-br from-rose-500/20 to-pink-500/15 border-rose-500/25"
                    : "bg-white/[0.04] border-white/[0.08]",
              )}
              animate={isRunning && !isComplete && !isError ? { scale: [1, 1.03, 1] } : {}}
              transition={{ duration: 3, repeat: Infinity }}
            >
              {isComplete ? (
                <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 4, repeat: Infinity }}>
                  <Sparkles className="w-6 h-6 text-emerald-400" />
                </motion.div>
              ) : isError ? (
                <XCircle className="w-6 h-6 text-rose-400" />
              ) : isRunning ? (
                <Zap className="w-6 h-6 text-white/60" />
              ) : (
                <Clapperboard className="w-6 h-6 text-white/40" />
              )}
              {/* Glass highlight */}
              <div className="absolute top-0 inset-x-0 h-1/2 bg-gradient-to-b from-white/[0.06] to-transparent rounded-t-2xl" />
            </motion.div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                {projectTitle || 'Production Pipeline'}
              </h2>
              <p className="text-xs text-white/35 mt-0.5 max-w-[300px] truncate">
                {isComplete ? '✦ Your cinematic masterpiece is ready' : isError ? (lastError?.slice(0, 80) || 'Production failed') : activeMeta ? activeMeta.label : 'Initializing pipeline...'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Action buttons */}
            {onCancel && isRunning && !isComplete && (
              <button
                onClick={onCancel}
                disabled={isCancelling}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-medium transition-all",
                  "bg-white/[0.03] border border-white/[0.06] text-white/40",
                  "hover:bg-rose-500/10 hover:border-rose-500/20 hover:text-rose-400",
                  isCancelling && "opacity-50 cursor-not-allowed"
                )}
              >
                {isCancelling ? 'Cancelling...' : 'Cancel'}
              </button>
            )}

            {onResume && isError && (
              <button
                onClick={onResume}
                disabled={isResuming}
                className={cn(
                  "px-5 py-2 rounded-xl text-xs font-bold transition-all",
                  "bg-gradient-to-r from-violet-500 to-indigo-500 text-white",
                  "hover:from-violet-400 hover:to-indigo-400 shadow-lg shadow-violet-500/20",
                  isResuming && "opacity-50 cursor-not-allowed"
                )}
              >
                {isResuming ? 'Resuming...' : 'Resume'}
              </button>
            )}

            {/* Live indicator */}
            {isRunning && !isComplete && !isError && (
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/[0.03] border border-white/[0.06]">
                <div className="relative">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                </div>
                <span className="text-[10px] font-bold text-emerald-400/80 uppercase tracking-[0.2em]">Live</span>
              </div>
            )}

            {/* Timer + Premium Ring */}
            <div className="flex items-center gap-5">
              <div className="text-right hidden sm:block">
                <p className="text-3xl font-mono font-black text-white/85 tracking-tighter tabular-nums">
                  {formatTime(elapsedTime)}
                </p>
              </div>

              {/* Holographic progress ring */}
              <div className="relative" style={{ width: 76, height: 76 }}>
                <svg className="w-full h-full -rotate-90" viewBox="0 0 76 76">
                  {/* Background tracks */}
                  <circle cx="38" cy="38" r="32" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="3" />
                  <circle cx="38" cy="38" r="28" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="1" />
                  
                  {/* Gradient progress */}
                  <defs>
                    <linearGradient id="pipelineProgressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      {isError ? (
                        <>
                          <stop offset="0%" stopColor="#f43f5e" />
                          <stop offset="100%" stopColor="#e11d48" />
                        </>
                      ) : isComplete ? (
                        <>
                          <stop offset="0%" stopColor="#10b981" />
                          <stop offset="50%" stopColor="#14b8a6" />
                          <stop offset="100%" stopColor="#06b6d4" />
                        </>
                      ) : (
                        <>
                          <stop offset="0%" stopColor={activeMeta?.ringColor || '#8b5cf6'} />
                          <stop offset="100%" stopColor="#6366f1" />
                        </>
                      )}
                    </linearGradient>
                    {/* Glow filter */}
                    <filter id="progressGlow">
                      <feGaussianBlur stdDeviation="2" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  <circle
                    cx="38" cy="38" r="32" fill="none"
                    stroke="url(#pipelineProgressGrad)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 32}
                    strokeDashoffset={2 * Math.PI * 32 * (1 - progress / 100)}
                    className="transition-all duration-700 ease-out"
                    filter="url(#progressGlow)"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={cn(
                    "text-base font-black tabular-nums",
                    isError ? "text-rose-400" : isComplete ? "text-emerald-400" : "text-white"
                  )}>
                    {Math.round(progress)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Premium gradient progress bar with glow */}
        <div className="relative h-1.5 bg-white/[0.03] mb-10 overflow-hidden rounded-full">
          {/* Glow underneath */}
          <div
            className={cn(
              "absolute -inset-y-2 left-0 rounded-full blur-md transition-all duration-700 ease-out opacity-50",
              isError ? "bg-rose-500" : isComplete ? "bg-emerald-500" : "bg-violet-500"
            )}
            style={{ width: `${Math.min(lineProgress, 100)}%` }}
          />
          <div
            className={cn(
              "relative inset-y-0 left-0 h-full rounded-full transition-all duration-700 ease-out",
              isError ? "bg-gradient-to-r from-rose-500 via-pink-500 to-rose-400" 
                : isComplete ? "bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400" 
                : "bg-gradient-to-r from-violet-500 via-indigo-500 to-purple-400"
            )}
            style={{ width: `${Math.min(lineProgress, 100)}%` }}
          />
          {/* Shimmer */}
          {isRunning && !isComplete && !isError && (
            <div 
              className="absolute inset-y-0 left-0"
              style={{ 
                width: `${Math.min(lineProgress, 100)}%`,
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                animation: 'shimmer 2s ease-in-out infinite',
              }}
            />
          )}
        </div>

        {/* Desktop: Horizontal stage nodes with premium connecting lines */}
        <div className="hidden md:block">
          <div className="relative">
            {/* Background connection track with dots */}
            <div className="absolute top-8 left-[7%] right-[7%] h-px">
              <div className="w-full h-full bg-white/[0.04]" />
              {/* Animated dots pattern */}
              <div 
                className="absolute inset-0 opacity-30"
                style={{
                  backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)',
                  backgroundSize: '12px 4px',
                  backgroundPosition: 'center',
                }}
              />
            </div>
            
            {/* Animated progress line with glow */}
            <div className="absolute top-8 left-[7%] h-px" style={{ width: `${Math.min(lineProgress * 0.86, 86)}%` }}>
              <div 
                className="h-full transition-all duration-700 ease-out rounded-full"
                style={{ 
                  background: isComplete 
                    ? 'linear-gradient(90deg, rgba(16,185,129,0.6), rgba(20,184,166,0.4), rgba(6,182,212,0.3))' 
                    : activeMeta
                      ? `linear-gradient(90deg, ${activeMeta.glowColor}, ${activeMeta.glowColor.replace('0.35', '0.15')})`
                      : 'linear-gradient(90deg, rgba(139,92,246,0.5), rgba(99,102,241,0.3))'
                }}
              />
              {/* Glow effect on progress line */}
              <div 
                className="absolute inset-0 h-[3px] -top-[1px] blur-sm transition-all duration-700"
                style={{ 
                  background: isComplete 
                    ? 'linear-gradient(90deg, rgba(16,185,129,0.4), transparent)' 
                    : activeMeta
                      ? `linear-gradient(90deg, ${activeMeta.glowColor.replace('0.35', '0.3')}, transparent)`
                      : 'linear-gradient(90deg, rgba(139,92,246,0.3), transparent)'
                }}
              />
            </div>
            
            <div className="grid grid-cols-6 gap-2 relative">
              {stages.map((stage, index) => (
                <StageNode key={stage.name} stage={stage} index={index} totalStages={stages.length} />
              ))}
            </div>
          </div>
        </div>

        {/* Mobile: Compact vertical list */}
        <div className="md:hidden space-y-1.5">
          {stages.map((stage) => {
            const meta = STAGE_META[stage.shortName] || STAGE_META['Script'];
            const Icon = meta.icon;
            const isActive = stage.status === 'active';
            const isComp = stage.status === 'complete';
            const isErr = stage.status === 'error';
            const isPend = stage.status === 'pending';

            return (
              <div
                key={stage.name}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300",
                  isActive && "bg-white/[0.04] border border-white/[0.08] shadow-lg",
                  isPend && "opacity-20",
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center border",
                  isPend && "bg-white/[0.02] border-white/[0.04] text-white/15",
                  isActive && `bg-gradient-to-br ${meta.gradient} border-white/20 text-white`,
                  isComp && "bg-emerald-500/12 border-emerald-500/20 text-emerald-400",
                  isErr && "bg-rose-500/12 border-rose-500/20 text-rose-400",
                )}>
                  {isActive ? <Loader2 className="w-4 h-4 animate-spin" /> :
                   isComp ? <CheckCircle2 className="w-4 h-4" /> :
                   isErr ? <XCircle className="w-4 h-4" /> :
                   <Icon className="w-4 h-4" />}
                </div>
                <span className={cn(
                  "text-xs font-semibold",
                  isPend && "text-white/25",
                  isActive && "text-white",
                  isComp && "text-emerald-400/80",
                  isErr && "text-rose-400/80",
                )}>
                  {stage.shortName}
                </span>
                {isActive && (
                  <span className="ml-auto text-[10px] text-white/30 font-mono">
                    {meta.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* CSS keyframes */}
      <style>{`
        @keyframes holographic-shimmer {
          0%, 100% { transform: translateX(-100%); }
          50% { transform: translateX(200%); }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        @keyframes float-particle {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.2; }
          50% { transform: translateY(-120px) scale(1.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export default CinematicPipelineProgress;
