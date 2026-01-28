import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { 
  CheckCircle2, 
  Loader2, 
  XCircle,
  FileText,
  Users,
  Shield,
  Wand2,
  Film,
  Sparkles
} from 'lucide-react';

interface StageStatus {
  name: string;
  shortName: string;
  status: 'pending' | 'active' | 'complete' | 'error' | 'skipped';
  details?: string;
}

interface PipelineStepperPremiumProps {
  stages: StageStatus[];
  className?: string;
}

const stageIcons = [
  FileText,
  Users,
  Shield,
  Wand2,
  Film,
  Sparkles,
];

// Orbiting particles for active state
function OrbitingParticles() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {[...Array(3)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-cyan-400"
          style={{
            left: '50%',
            top: '50%',
          }}
          animate={{
            x: [0, 20, 0, -20, 0],
            y: [-20, 0, 20, 0, -20],
            opacity: [0.3, 1, 0.3],
            scale: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: i * 0.6,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

// Animated success burst
function SuccessBurst() {
  return (
    <motion.div
      className="absolute inset-0 pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-emerald-400"
          style={{
            left: '50%',
            top: '50%',
          }}
          initial={{ 
            x: 0, 
            y: 0, 
            opacity: 1,
            scale: 1 
          }}
          animate={{ 
            x: Math.cos((i * 60 * Math.PI) / 180) * 30,
            y: Math.sin((i * 60 * Math.PI) / 180) * 30,
            opacity: 0,
            scale: 0
          }}
          transition={{
            duration: 0.6,
            ease: "easeOut",
          }}
        />
      ))}
    </motion.div>
  );
}

export function PipelineStepperPremium({ stages, className }: PipelineStepperPremiumProps) {
  const completedCount = stages.filter(s => s.status === 'complete').length;
  const activeIndex = stages.findIndex(s => s.status === 'active');
  const progressPercent = stages.length > 1 
    ? (completedCount / (stages.length - 1)) * 100 
    : 0;

  return (
    <div className={cn("w-full", className)}>
      {/* Premium Container with Depth */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "relative rounded-3xl overflow-hidden",
          "bg-gradient-to-br from-zinc-900/90 via-zinc-950/95 to-black",
          "border border-white/[0.08]",
          "shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)]",
          "p-8 md:p-10"
        )}
      >
        {/* Ambient Light Effects */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Dynamic completion glow */}
          <motion.div 
            className="absolute -left-40 -top-40 w-96 h-96 rounded-full blur-[120px]"
            style={{
              background: `linear-gradient(135deg, 
                ${completedCount > 0 ? 'rgba(52, 211, 153, 0.15)' : 'rgba(255,255,255,0.02)'}, 
                transparent)`
            }}
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: completedCount > 0 ? [0.3, 0.5, 0.3] : 0.1
            }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />
          
          {/* Active stage spotlight */}
          {activeIndex >= 0 && (
            <motion.div 
              className="absolute w-64 h-64 rounded-full blur-[100px] bg-cyan-500/20"
              style={{ 
                left: `${(activeIndex / Math.max(stages.length - 1, 1)) * 70 + 15}%`,
                top: '30%',
              }}
              animate={{ 
                opacity: [0.2, 0.4, 0.2],
                scale: [0.9, 1.1, 0.9]
              }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
        </div>

        {/* Header with Progress Counter */}
        <div className="relative flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
              <Film className="w-5 h-5 text-white/60" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white/80 tracking-wide">Production Pipeline</h3>
              <p className="text-xs text-white/40">Generating your video</p>
            </div>
          </div>
          
          {/* Circular Progress Indicator */}
          <div className="relative w-16 h-16">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              {/* Background circle */}
              <circle
                cx="18"
                cy="18"
                r="14"
                fill="none"
                className="stroke-white/[0.06]"
                strokeWidth="3"
              />
              {/* Progress circle */}
              <motion.circle
                cx="18"
                cy="18"
                r="14"
                fill="none"
                className="stroke-cyan-400"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={88}
                initial={{ strokeDashoffset: 88 }}
                animate={{ strokeDashoffset: 88 - (88 * Math.min(progressPercent, 100)) / 100 }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold text-white">
                {completedCount}/{stages.length}
              </span>
            </div>
          </div>
        </div>

        {/* Desktop: Horizontal Timeline */}
        <div className="hidden md:block relative">
          {/* Track Container */}
          <div className="relative h-2 mb-10 mx-6">
            {/* Background Track */}
            <div className="absolute inset-0 rounded-full bg-white/[0.04] overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.08),transparent)]" />
            </div>
            
            {/* Animated Progress Fill */}
            <motion.div 
              className="absolute inset-y-0 left-0 rounded-full overflow-hidden"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(progressPercent, 100)}%` }}
              transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Gradient fill */}
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-cyan-400 to-cyan-300" />
              
              {/* Animated shine */}
              <motion.div 
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent"
                animate={{ x: ['-200%', '200%'] }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear", repeatDelay: 1 }}
              />
            </motion.div>

            {/* Leading orb */}
            {progressPercent > 0 && progressPercent < 100 && (
              <motion.div
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 -ml-2"
                style={{ left: `${progressPercent}%` }}
              >
                <motion.div
                  className="w-full h-full rounded-full bg-cyan-300"
                  animate={{ 
                    boxShadow: [
                      '0 0 10px 2px rgba(34, 211, 238, 0.5)',
                      '0 0 20px 4px rgba(34, 211, 238, 0.7)',
                      '0 0 10px 2px rgba(34, 211, 238, 0.5)'
                    ]
                  }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              </motion.div>
            )}
          </div>
          
          {/* Stage Nodes */}
          <div className="flex justify-between relative">
            {stages.map((stage, index) => {
              const Icon = stageIcons[index] || FileText;
              const isActive = stage.status === 'active';
              const isComplete = stage.status === 'complete';
              const isError = stage.status === 'error';
              const isPending = stage.status === 'pending';
              const isSkipped = stage.status === 'skipped';
              
              return (
                <motion.div 
                  key={stage.name}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.08, duration: 0.5, ease: "easeOut" }}
                  className={cn(
                    "flex flex-col items-center gap-4 relative flex-1",
                    isSkipped && "opacity-30"
                  )}
                >
                  {/* Node */}
                  <div className="relative">
                    {/* Orbiting particles for active */}
                    {isActive && <OrbitingParticles />}
                    
                    {/* Success burst animation */}
                    {isComplete && <SuccessBurst />}
                    
                    {/* Outer glow ring */}
                    {(isActive || isComplete) && (
                      <motion.div 
                        className={cn(
                          "absolute -inset-3 rounded-2xl",
                          isComplete && "bg-emerald-500/10",
                          isActive && "bg-cyan-500/10"
                        )}
                        animate={isActive ? { 
                          scale: [1, 1.1, 1],
                          opacity: [0.3, 0.6, 0.3]
                        } : {}}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    )}
                    
                    {/* Main Node Circle */}
                    <motion.div 
                      className={cn(
                        "relative w-14 h-14 rounded-2xl flex items-center justify-center",
                        "transition-all duration-500",
                        isPending && "bg-white/[0.03] border border-white/[0.08] text-zinc-600",
                        isActive && "bg-gradient-to-br from-cyan-500/30 to-cyan-600/20 border border-cyan-400/40 text-cyan-300 shadow-[0_0_40px_-10px_rgba(34,211,238,0.5)]",
                        isComplete && "bg-gradient-to-br from-emerald-500/30 to-emerald-600/20 border border-emerald-400/40 text-emerald-300 shadow-[0_0_40px_-10px_rgba(52,211,153,0.5)]",
                        isError && "bg-gradient-to-br from-rose-500/30 to-rose-600/20 border border-rose-400/40 text-rose-300 shadow-[0_0_40px_-10px_rgba(251,113,133,0.5)]",
                        isSkipped && "bg-zinc-900/50 border border-zinc-800/50 text-zinc-700"
                      )}
                      whileHover={{ scale: isPending ? 1 : 1.08 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <AnimatePresence mode="wait">
                        {isActive ? (
                          <motion.div
                            key="loader"
                            initial={{ opacity: 0, scale: 0.5, rotate: -180 }}
                            animate={{ opacity: 1, scale: 1, rotate: 0 }}
                            exit={{ opacity: 0, scale: 0.5, rotate: 180 }}
                            transition={{ duration: 0.3 }}
                          >
                            <Loader2 className="w-6 h-6 animate-spin" />
                          </motion.div>
                        ) : isComplete ? (
                          <motion.div
                            key="check"
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0 }}
                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                          >
                            <CheckCircle2 className="w-6 h-6" />
                          </motion.div>
                        ) : isError ? (
                          <motion.div
                            key="error"
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0 }}
                          >
                            <XCircle className="w-6 h-6" />
                          </motion.div>
                        ) : (
                          <motion.div
                            key="icon"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                          >
                            <Icon className="w-5 h-5" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  </div>
                  
                  {/* Label */}
                  <div className="text-center">
                    <motion.p 
                      className={cn(
                        "text-xs font-semibold tracking-wider uppercase transition-colors",
                        isPending && "text-zinc-600",
                        isActive && "text-cyan-300",
                        isComplete && "text-emerald-300",
                        isError && "text-rose-300",
                        isSkipped && "text-zinc-700 line-through"
                      )}
                      animate={isActive ? { opacity: [0.7, 1, 0.7] } : {}}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      {stage.shortName}
                    </motion.p>
                    <AnimatePresence>
                      {stage.details && !isSkipped && (
                        <motion.p 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="text-[10px] text-zinc-500 mt-1 max-w-[100px] truncate mx-auto"
                        >
                          {stage.details}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Mobile: Vertical Timeline */}
        <div className="md:hidden space-y-2">
          {stages.map((stage, index) => {
            const Icon = stageIcons[index] || FileText;
            const isActive = stage.status === 'active';
            const isComplete = stage.status === 'complete';
            const isError = stage.status === 'error';
            const isPending = stage.status === 'pending';
            const isLast = index === stages.length - 1;
            
            return (
              <motion.div 
                key={stage.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="relative"
              >
                {/* Connecting line */}
                {!isLast && (
                  <div className={cn(
                    "absolute left-5 top-12 w-0.5 h-8 rounded-full",
                    isComplete 
                      ? "bg-gradient-to-b from-emerald-500/60 to-emerald-500/20" 
                      : "bg-white/[0.06]"
                  )} />
                )}
                
                <motion.div 
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-2xl transition-all duration-300",
                    isActive && "bg-cyan-500/10 border border-cyan-500/20",
                    isComplete && "bg-emerald-500/5",
                    isError && "bg-rose-500/10 border border-rose-500/20",
                    isPending && "opacity-50"
                  )}
                  whileTap={{ scale: 0.98 }}
                >
                  {/* Icon */}
                  <div className={cn(
                    "relative w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                    isPending && "bg-white/[0.03] text-zinc-600",
                    isActive && "bg-cyan-500/20 text-cyan-400",
                    isComplete && "bg-emerald-500/20 text-emerald-400",
                    isError && "bg-rose-500/20 text-rose-400"
                  )}>
                    {isActive ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : isComplete ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : isError ? (
                      <XCircle className="w-4 h-4" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                  </div>
                  
                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm font-medium",
                      isPending && "text-zinc-500",
                      isActive && "text-cyan-300",
                      isComplete && "text-emerald-300",
                      isError && "text-rose-300"
                    )}>
                      {stage.name}
                    </p>
                    {stage.details && (
                      <p className="text-[11px] text-zinc-500 truncate">{stage.details}</p>
                    )}
                  </div>
                  
                  {/* Status indicator */}
                  {isActive && (
                    <motion.div 
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/20 border border-cyan-500/30"
                      animate={{ opacity: [0.7, 1, 0.7] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      <span className="text-[10px] font-semibold text-cyan-300 uppercase tracking-wider">
                        Active
                      </span>
                    </motion.div>
                  )}
                </motion.div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
