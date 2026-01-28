import React, { useMemo, useEffect, useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  FileText,
  Users,
  Shield,
  Wand2,
  Film,
  Sparkles,
  CheckCircle2,
  Loader2,
  XCircle,
  Zap,
  Brain,
  Palette,
  Clapperboard,
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
  elapsedTime: number;
  className?: string;
}

// ============= STAGE METADATA =============

const STAGE_METADATA: Record<string, {
  icon: React.ElementType;
  color: string;
  glowColor: string;
  description: string;
  activities: string[];
}> = {
  'Script': {
    icon: FileText,
    color: 'from-violet-500 to-purple-600',
    glowColor: 'rgba(139, 92, 246, 0.5)',
    description: 'Crafting your cinematic narrative',
    activities: [
      'Analyzing story structure...',
      'Breaking down into shots...',
      'Optimizing visual flow...',
      'Adding camera directions...',
    ],
  },
  'Identity': {
    icon: Users,
    color: 'from-blue-500 to-cyan-500',
    glowColor: 'rgba(34, 211, 238, 0.5)',
    description: 'Building character consistency',
    activities: [
      'Extracting facial features...',
      'Mapping body proportions...',
      'Locking wardrobe elements...',
      'Creating identity anchors...',
    ],
  },
  'Audit': {
    icon: Shield,
    color: 'from-emerald-500 to-teal-500',
    glowColor: 'rgba(52, 211, 153, 0.5)',
    description: 'Quality assurance check',
    activities: [
      'Validating scene continuity...',
      'Checking lighting consistency...',
      'Verifying motion vectors...',
      'Scoring visual coherence...',
    ],
  },
  'Assets': {
    icon: Wand2,
    color: 'from-amber-500 to-orange-500',
    glowColor: 'rgba(251, 191, 36, 0.5)',
    description: 'Generating visual elements',
    activities: [
      'Creating scene images...',
      'Generating background music...',
      'Synthesizing voice narration...',
      'Preparing anchor frames...',
    ],
  },
  'Render': {
    icon: Film,
    color: 'from-rose-500 to-pink-500',
    glowColor: 'rgba(244, 63, 94, 0.5)',
    description: 'AI video generation',
    activities: [
      'Initializing neural renderer...',
      'Processing motion dynamics...',
      'Applying style consistency...',
      'Generating video frames...',
    ],
  },
  'Stitch': {
    icon: Sparkles,
    color: 'from-indigo-500 to-purple-500',
    glowColor: 'rgba(99, 102, 241, 0.5)',
    description: 'Final assembly',
    activities: [
      'Analyzing transitions...',
      'Building playback manifest...',
      'Optimizing audio sync...',
      'Finalizing production...',
    ],
  },
};

// ============= SUB-COMPONENTS =============

// Animated particle trail
function ParticleTrail({ isActive }: { isActive: boolean }) {
  if (!isActive) return null;
  
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(12)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-white"
          initial={{ 
            x: '-50%', 
            y: '50%',
            opacity: 0,
            scale: 0 
          }}
          animate={{ 
            x: ['0%', `${Math.random() * 200 - 100}%`],
            y: ['50%', `${Math.random() * 100 - 50}%`],
            opacity: [0, 1, 0],
            scale: [0, 1.5, 0]
          }}
          transition={{ 
            duration: 2 + Math.random() * 2,
            repeat: Infinity,
            delay: i * 0.2,
            ease: 'easeOut'
          }}
        />
      ))}
    </div>
  );
}

// DNA helix animation for identity stage
function DNAHelix({ isActive }: { isActive: boolean }) {
  if (!isActive) return null;
  
  return (
    <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-8 h-16 pointer-events-none">
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1.5 h-1.5 rounded-full bg-cyan-400"
          style={{ top: `${i * 12.5}%` }}
          animate={{
            x: [0, 8, 0, -8, 0],
            opacity: [0.3, 1, 0.3],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            delay: i * 0.1,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

// Waveform visualization for audio stages
function AudioWaveform({ isActive }: { isActive: boolean }) {
  if (!isActive) return null;
  
  return (
    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-end gap-0.5 h-4 pointer-events-none">
      {[...Array(7)].map((_, i) => (
        <motion.div
          key={i}
          className="w-0.5 bg-amber-400 rounded-full"
          animate={{
            height: [4, 12 + Math.random() * 4, 4],
          }}
          transition={{
            duration: 0.4 + Math.random() * 0.3,
            repeat: Infinity,
            delay: i * 0.05,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

// Neural network nodes visualization
function NeuralNodes({ isActive }: { isActive: boolean }) {
  if (!isActive) return null;
  
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 rounded-full border border-rose-400/50"
          style={{
            left: `${20 + (i % 3) * 25}%`,
            top: `${25 + Math.floor(i / 3) * 35}%`,
          }}
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.3, 1, 0.3],
            borderColor: ['rgba(244,63,94,0.3)', 'rgba(244,63,94,1)', 'rgba(244,63,94,0.3)'],
          }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: i * 0.15,
          }}
        />
      ))}
      {/* Connection lines */}
      <svg className="absolute inset-0 w-full h-full">
        <motion.line
          x1="32%" y1="42%" x2="57%" y2="42%"
          stroke="rgba(244,63,94,0.4)"
          strokeWidth="1"
          animate={{ opacity: [0.2, 0.8, 0.2] }}
          transition={{ duration: 1, repeat: Infinity, delay: 0.5 }}
        />
        <motion.line
          x1="45%" y1="42%" x2="45%" y2="77%"
          stroke="rgba(244,63,94,0.4)"
          strokeWidth="1"
          animate={{ opacity: [0.2, 0.8, 0.2] }}
          transition={{ duration: 1, repeat: Infinity, delay: 0.7 }}
        />
      </svg>
    </div>
  );
}

// Rotating activity text
function ActivityText({ stage, isActive }: { stage: string; isActive: boolean }) {
  const [activityIndex, setActivityIndex] = useState(0);
  const metadata = STAGE_METADATA[stage];
  
  useEffect(() => {
    if (!isActive || !metadata) return;
    
    const interval = setInterval(() => {
      setActivityIndex(prev => (prev + 1) % metadata.activities.length);
    }, 2500);
    
    return () => clearInterval(interval);
  }, [isActive, metadata, stage]);
  
  if (!isActive || !metadata) return null;
  
  return (
    <AnimatePresence mode="wait">
      <motion.p
        key={activityIndex}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3 }}
        className="text-[10px] text-white/60 font-mono tracking-wider"
      >
        {metadata.activities[activityIndex]}
      </motion.p>
    </AnimatePresence>
  );
}

// Individual stage node
function StageNode({ 
  stage, 
  index, 
  isFirst,
  isLast,
  previousComplete 
}: { 
  stage: StageStatus; 
  index: number;
  isFirst: boolean;
  isLast: boolean;
  previousComplete: boolean;
}) {
  const metadata = STAGE_METADATA[stage.shortName] || STAGE_METADATA['Script'];
  const Icon = metadata.icon;
  const isActive = stage.status === 'active';
  const isComplete = stage.status === 'complete';
  const isError = stage.status === 'error';
  const isPending = stage.status === 'pending';
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative flex flex-col items-center"
    >
      {/* Connection line to previous */}
      {!isFirst && (
        <div className="absolute right-full top-8 w-full h-0.5 -mr-1">
          <div className={cn(
            "h-full transition-all duration-700",
            previousComplete ? "bg-gradient-to-r from-emerald-500/50 to-emerald-400" : "bg-white/10"
          )} />
          {previousComplete && (
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent"
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
            />
          )}
        </div>
      )}
      
      {/* Stage Circle */}
      <div className="relative">
        {/* Outer glow ring for active */}
        {isActive && (
          <>
            <motion.div
              className={cn("absolute -inset-4 rounded-full opacity-30 blur-md bg-gradient-to-r", metadata.color)}
              animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <motion.div
              className="absolute -inset-2 rounded-full border-2 border-white/20"
              animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          </>
        )}
        
        {/* Success burst */}
        {isComplete && (
          <motion.div
            initial={{ scale: 0.5, opacity: 1 }}
            animate={{ scale: 2, opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="absolute inset-0 rounded-full bg-emerald-400"
          />
        )}
        
        {/* Main node */}
        <motion.div
          className={cn(
            "relative w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden",
            "transition-all duration-500 backdrop-blur-xl",
            isPending && "bg-white/5 border border-white/10 text-white/30",
            isActive && `bg-gradient-to-br ${metadata.color} border border-white/30 text-white shadow-lg`,
            isComplete && "bg-gradient-to-br from-emerald-500/30 to-emerald-600/20 border border-emerald-400/50 text-emerald-400",
            isError && "bg-gradient-to-br from-rose-500/30 to-rose-600/20 border border-rose-400/50 text-rose-400"
          )}
          style={isActive ? { boxShadow: `0 0 40px ${metadata.glowColor}` } : {}}
          whileHover={{ scale: isPending ? 1 : 1.05 }}
        >
          {/* Background pattern */}
          {isActive && (
            <div className="absolute inset-0 opacity-20">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,white_1px,transparent_1px)] bg-[length:8px_8px]" />
            </div>
          )}
          
          {/* Stage-specific animations */}
          {stage.shortName === 'Identity' && <DNAHelix isActive={isActive} />}
          {stage.shortName === 'Assets' && <AudioWaveform isActive={isActive} />}
          {stage.shortName === 'Render' && <NeuralNodes isActive={isActive} />}
          <ParticleTrail isActive={isActive} />
          
          {/* Icon */}
          <AnimatePresence mode="wait">
            {isActive ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0, rotate: -180 }}
                animate={{ opacity: 1, rotate: 0 }}
                exit={{ opacity: 0, rotate: 180 }}
                className="relative z-10"
              >
                <Loader2 className="w-7 h-7 animate-spin" />
              </motion.div>
            ) : isComplete ? (
              <motion.div
                key="complete"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                className="relative z-10"
              >
                <CheckCircle2 className="w-7 h-7" />
              </motion.div>
            ) : isError ? (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative z-10"
              >
                <XCircle className="w-7 h-7" />
              </motion.div>
            ) : (
              <motion.div
                key="icon"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="relative z-10"
              >
                <Icon className="w-6 h-6" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
      
      {/* Label and activity */}
      <div className="mt-3 text-center min-h-[44px]">
        <p className={cn(
          "text-xs font-semibold tracking-wider uppercase transition-colors",
          isPending && "text-white/40",
          isActive && "text-white",
          isComplete && "text-emerald-400",
          isError && "text-rose-400"
        )}>
          {stage.shortName}
        </p>
        <div className="h-4 mt-1">
          <ActivityText stage={stage.shortName} isActive={isActive} />
        </div>
      </div>
    </motion.div>
  );
}

// Main progress line with energy flow
function ProgressLine({ progress, stages }: { progress: number; stages: StageStatus[] }) {
  const completedCount = stages.filter(s => s.status === 'complete').length;
  const activeIndex = stages.findIndex(s => s.status === 'active');
  const progressValue = activeIndex >= 0 
    ? ((completedCount + 0.5) / stages.length) * 100 
    : (completedCount / stages.length) * 100;

  return (
    <div className="absolute top-8 left-8 right-8 h-0.5 pointer-events-none">
      {/* Background track */}
      <div className="absolute inset-0 bg-white/5 rounded-full" />
      
      {/* Progress fill */}
      <motion.div
        className="absolute inset-y-0 left-0 rounded-full overflow-hidden"
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(progressValue, 100)}%` }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-violet-500 via-cyan-400 to-emerald-400" />
        
        {/* Animated shine */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent"
          animate={{ x: ['-200%', '200%'] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear', repeatDelay: 0.5 }}
        />
      </motion.div>
      
      {/* Energy orb at progress head */}
      {progressValue > 0 && progressValue < 100 && (
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3"
          style={{ left: `${progressValue}%` }}
        >
          <motion.div
            className="absolute inset-0 rounded-full bg-white"
            animate={{
              boxShadow: [
                '0 0 10px 2px rgba(255,255,255,0.5)',
                '0 0 20px 4px rgba(255,255,255,0.8)',
                '0 0 10px 2px rgba(255,255,255,0.5)',
              ],
            }}
            transition={{ duration: 1, repeat: Infinity }}
          />
          {/* Trailing particles */}
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 rounded-full bg-cyan-300"
              initial={{ x: 0, opacity: 1 }}
              animate={{ x: -20 - i * 8, opacity: 0 }}
              transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </motion.div>
      )}
    </div>
  );
}

// Overall progress ring
function ProgressRing({ progress }: { progress: number }) {
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  
  return (
    <div className="relative w-28 h-28">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        {/* Background ring */}
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="6"
        />
        {/* Progress ring */}
        <motion.circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="url(#progressGradient)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        />
        <defs>
          <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8B5CF6" />
            <stop offset="50%" stopColor="#22D3EE" />
            <stop offset="100%" stopColor="#34D399" />
          </linearGradient>
        </defs>
      </svg>
      
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span 
          className="text-2xl font-bold text-white tabular-nums"
          key={Math.floor(progress)}
          initial={{ scale: 1.2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          {Math.round(progress)}%
        </motion.span>
        <span className="text-[10px] text-white/40 uppercase tracking-wider">Complete</span>
      </div>
      
      {/* Orbiting dot */}
      {progress > 0 && progress < 100 && (
        <motion.div
          className="absolute w-2 h-2 rounded-full bg-cyan-400"
          style={{
            left: '50%',
            top: '50%',
            marginLeft: '-4px',
            marginTop: '-4px',
          }}
          animate={{
            rotate: 360,
            x: [0, 45, 0, -45, 0],
            y: [-45, 0, 45, 0, -45],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        />
      )}
    </div>
  );
}

// ============= MAIN COMPONENT =============

export function CinematicPipelineProgress({
  stages,
  progress,
  isComplete,
  elapsedTime,
  className,
}: CinematicPipelineProgressProps) {
  const activeStage = stages.find(s => s.status === 'active');
  const activeMetadata = activeStage ? STAGE_METADATA[activeStage.shortName] : null;
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "relative rounded-3xl overflow-hidden",
        "bg-gradient-to-br from-zinc-900/95 via-zinc-950/98 to-black",
        "border border-white/[0.08]",
        "shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]",
        "backdrop-blur-2xl",
        className
      )}
    >
      {/* Animated background gradient */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Dynamic glow based on active stage */}
        {activeMetadata && (
          <motion.div
            className={cn("absolute w-[600px] h-[600px] rounded-full blur-[150px] bg-gradient-to-r opacity-20", activeMetadata.color)}
            animate={{ 
              x: ['-20%', '20%', '-20%'],
              y: ['-20%', '10%', '-20%'],
              scale: [1, 1.2, 1],
            }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            style={{ left: '30%', top: '-50%' }}
          />
        )}
        
        {/* Completion glow */}
        {isComplete && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 0.3, scale: 1 }}
            className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 via-transparent to-cyan-500/20"
          />
        )}
        
        {/* Noise texture */}
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.8\' numOctaves=\'4\' /%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' /%3E%3C/svg%3E")',
          }}
        />
      </div>

      <div className="relative p-8 md:p-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-14 h-14 rounded-2xl flex items-center justify-center",
              "bg-gradient-to-br from-white/10 to-white/5 border border-white/10"
            )}>
              {isComplete ? (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                >
                  <Sparkles className="w-7 h-7 text-emerald-400" />
                </motion.div>
              ) : (
                <Clapperboard className="w-6 h-6 text-white/60" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                {isComplete ? 'Production Complete' : 'Production Pipeline'}
              </h2>
              <p className="text-sm text-white/40">
                {isComplete 
                  ? 'Your video is ready to preview'
                  : activeStage 
                    ? activeMetadata?.description 
                    : 'Preparing your production...'
                }
              </p>
            </div>
          </div>
          
          {/* Progress ring and timer */}
          <div className="flex items-center gap-6">
            <div className="text-right hidden sm:block">
              <p className="text-3xl font-mono font-bold text-white tracking-tighter tabular-nums">
                {formatTime(elapsedTime)}
              </p>
              <p className="text-[10px] text-white/40 uppercase tracking-[0.2em]">Elapsed</p>
            </div>
            <ProgressRing progress={progress} />
          </div>
        </div>

        {/* Desktop: Horizontal stage display */}
        <div className="hidden md:block relative">
          <ProgressLine progress={progress} stages={stages} />
          
          <div className="grid grid-cols-6 gap-4 pt-6">
            {stages.map((stage, index) => (
              <StageNode
                key={stage.name}
                stage={stage}
                index={index}
                isFirst={index === 0}
                isLast={index === stages.length - 1}
                previousComplete={index > 0 && stages[index - 1].status === 'complete'}
              />
            ))}
          </div>
        </div>

        {/* Mobile: Vertical compact display */}
        <div className="md:hidden space-y-3">
          {stages.map((stage, index) => {
            const metadata = STAGE_METADATA[stage.shortName];
            const Icon = metadata?.icon || FileText;
            const isActive = stage.status === 'active';
            const isComplete = stage.status === 'complete';
            const isError = stage.status === 'error';
            const isPending = stage.status === 'pending';
            
            return (
              <motion.div
                key={stage.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "relative flex items-center gap-4 p-4 rounded-2xl transition-all",
                  isActive && `bg-gradient-to-r ${metadata?.color} bg-opacity-10 border border-white/20`,
                  isComplete && "bg-emerald-500/10 border border-emerald-500/20",
                  isError && "bg-rose-500/10 border border-rose-500/20",
                  isPending && "opacity-40"
                )}
              >
                {/* Icon */}
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center",
                  isPending && "bg-white/5 text-white/30",
                  isActive && "bg-white/20 text-white",
                  isComplete && "bg-emerald-500/20 text-emerald-400",
                  isError && "bg-rose-500/20 text-rose-400"
                )}>
                  {isActive ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : isComplete ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : isError ? (
                    <XCircle className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                
                {/* Text */}
                <div className="flex-1">
                  <p className={cn(
                    "text-sm font-semibold",
                    isPending && "text-white/40",
                    isActive && "text-white",
                    isComplete && "text-emerald-400",
                    isError && "text-rose-400"
                  )}>
                    {stage.shortName}
                  </p>
                  <AnimatePresence mode="wait">
                    {isActive && metadata && (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-xs text-white/50"
                      >
                        {metadata.description}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
                
                {/* Status indicator */}
                {isActive && (
                  <motion.div
                    className="w-2 h-2 rounded-full bg-white"
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Active stage detail panel */}
        <AnimatePresence>
          {activeStage && activeMetadata && (
            <motion.div
              initial={{ opacity: 0, y: 20, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="mt-8 hidden md:block"
            >
              <div className={cn(
                "relative p-5 rounded-2xl overflow-hidden",
                "bg-gradient-to-r from-white/[0.03] to-transparent",
                "border border-white/[0.06]"
              )}>
                {/* Decorative gradient */}
                <div 
                  className={cn("absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b", activeMetadata.color)}
                />
                
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                      Now Processing
                    </span>
                  </div>
                  <div className="flex-1" />
                  <motion.div
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="flex items-center gap-2"
                  >
                    <Brain className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs text-white/40">AI Engine Active</span>
                  </motion.div>
                </div>
                
                <div className="mt-3 flex items-center gap-6">
                  <div>
                    <p className="text-lg font-bold text-white">{activeStage.shortName}</p>
                    <p className="text-sm text-white/50">{activeMetadata.description}</p>
                  </div>
                  <div className="flex-1" />
                  <ActivityText stage={activeStage.shortName} isActive={true} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
