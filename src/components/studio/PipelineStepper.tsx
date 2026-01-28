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

interface PipelineStepperProps {
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

// Animated pulse ring for active state
function PulseRing({ color }: { color: string }) {
  return (
    <>
      <motion.div
        className={cn("absolute inset-0 rounded-full", color)}
        initial={{ scale: 1, opacity: 0.5 }}
        animate={{ scale: 1.8, opacity: 0 }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
      />
      <motion.div
        className={cn("absolute inset-0 rounded-full", color)}
        initial={{ scale: 1, opacity: 0.3 }}
        animate={{ scale: 2.2, opacity: 0 }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut", delay: 0.3 }}
      />
    </>
  );
}

// Animated checkmark for completion
function AnimatedCheck() {
  return (
    <motion.div
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 15 }}
    >
      <CheckCircle2 className="w-5 h-5" />
    </motion.div>
  );
}

export function PipelineStepper({ stages, className }: PipelineStepperProps) {
  const completedCount = stages.filter(s => s.status === 'complete').length;
  const activeIndex = stages.findIndex(s => s.status === 'active');
  const progressPercent = completedCount > 0 
    ? ((completedCount) / (stages.length - 1)) * 100 
    : 0;

  return (
    <div className={cn("w-full", className)}>
      {/* Premium Glass Container */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className={cn(
          "relative rounded-2xl overflow-hidden",
          "bg-gradient-to-br from-white/[0.04] via-white/[0.02] to-transparent",
          "border border-white/[0.08]",
          "backdrop-blur-xl",
          "p-6 md:p-8"
        )}
      >
        {/* Ambient glow effects */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Left glow - completed stages */}
          <motion.div 
            className="absolute -left-20 top-1/2 -translate-y-1/2 w-60 h-60 bg-emerald-500/10 blur-[80px] rounded-full"
            animate={{ 
              opacity: completedCount > 0 ? [0.3, 0.5, 0.3] : 0,
              scale: completedCount > 0 ? [1, 1.1, 1] : 1 
            }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
          {/* Center glow - active stage */}
          {activeIndex >= 0 && (
            <motion.div 
              className="absolute top-1/2 -translate-y-1/2 w-40 h-40 bg-cyan-500/15 blur-[60px] rounded-full"
              style={{ left: `${(activeIndex / (stages.length - 1)) * 80 + 10}%` }}
              animate={{ 
                opacity: [0.4, 0.7, 0.4],
                scale: [1, 1.2, 1]
              }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
          {/* Noise texture */}
          <div className="absolute inset-0 opacity-[0.02]" style={{ 
            backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.8\' numOctaves=\'4\' /%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' /%3E%3C/svg%3E")' 
          }} />
        </div>

        {/* Desktop: Premium Horizontal Stepper */}
        <div className="hidden md:block relative">
          {/* Track Container */}
          <div className="relative mx-8 mb-8">
            {/* Background Track - Frosted Glass */}
            <div className="absolute top-1/2 left-0 right-0 h-1.5 -translate-y-1/2 rounded-full bg-white/[0.06] backdrop-blur-sm overflow-hidden border border-white/[0.04]">
              {/* Inner shadow for depth */}
              <div className="absolute inset-0 shadow-inner" />
            </div>
            
            {/* Animated Progress Fill */}
            <motion.div 
              className="absolute top-1/2 left-0 h-1.5 -translate-y-1/2 rounded-full overflow-hidden"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(progressPercent, 100)}%` }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Gradient fill */}
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400" />
              
              {/* Shimmer effect */}
              <motion.div 
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", repeatDelay: 1 }}
              />
              
              {/* Glow overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/50 to-transparent" />
            </motion.div>

            {/* Glowing orb at progress head */}
            {progressPercent > 0 && progressPercent < 100 && (
              <motion.div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3"
                style={{ left: `${progressPercent}%` }}
                animate={{ scale: [1, 1.3, 1], opacity: [0.8, 1, 0.8] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              >
                <div className="absolute inset-0 rounded-full bg-cyan-400 shadow-[0_0_20px_6px_rgba(34,211,238,0.5)]" />
              </motion.div>
            )}
          </div>
          
          {/* Stage Nodes */}
          <div className="flex items-start justify-between relative px-4">
            {stages.map((stage, index) => {
              const Icon = stageIcons[index] || FileText;
              const isActive = stage.status === 'active';
              const isComplete = stage.status === 'complete';
              const isError = stage.status === 'error';
              const isSkipped = stage.status === 'skipped';
              const isPending = stage.status === 'pending';
              
              return (
                <motion.div 
                  key={stage.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1, duration: 0.4 }}
                  className={cn(
                    "flex flex-col items-center gap-3 relative",
                    isSkipped && "opacity-30"
                  )}
                >
                  {/* Step Circle with Effects */}
                  <div className="relative">
                    {/* Pulse rings for active */}
                    {isActive && <PulseRing color="bg-cyan-400/30" />}
                    
                    {/* Glow background for non-pending */}
                    {!isPending && !isSkipped && (
                      <motion.div 
                        className={cn(
                          "absolute -inset-2 rounded-full blur-md",
                          isComplete && "bg-emerald-500/30",
                          isActive && "bg-cyan-500/30",
                          isError && "bg-rose-500/30"
                        )}
                        animate={isActive ? { 
                          opacity: [0.5, 0.8, 0.5],
                          scale: [1, 1.1, 1]
                        } : {}}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    )}
                    
                    {/* Main Circle */}
                    <motion.div 
                      className={cn(
                        "relative w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500",
                        "border backdrop-blur-sm",
                        isPending && "bg-white/[0.03] border-white/[0.08] text-zinc-600",
                        isActive && "bg-gradient-to-br from-cyan-500/20 to-blue-500/10 border-cyan-400/50 text-cyan-400 shadow-[0_0_30px_-5px_rgba(34,211,238,0.5)]",
                        isComplete && "bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border-emerald-400/50 text-emerald-400 shadow-[0_0_30px_-5px_rgba(52,211,153,0.5)]",
                        isError && "bg-gradient-to-br from-rose-500/20 to-red-500/10 border-rose-400/50 text-rose-400 shadow-[0_0_30px_-5px_rgba(251,113,133,0.5)]",
                        isSkipped && "bg-zinc-800/50 border-zinc-700/30 text-zinc-600"
                      )}
                      whileHover={{ scale: isPending ? 1 : 1.05 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <AnimatePresence mode="wait">
                        {isActive ? (
                          <motion.div
                            key="loader"
                            initial={{ opacity: 0, rotate: -90 }}
                            animate={{ opacity: 1, rotate: 0 }}
                            exit={{ opacity: 0, rotate: 90 }}
                          >
                            <Loader2 className="w-6 h-6 animate-spin" />
                          </motion.div>
                        ) : isComplete ? (
                          <motion.div
                            key="check"
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0 }}
                          >
                            <AnimatedCheck />
                          </motion.div>
                        ) : isError ? (
                          <motion.div
                            key="error"
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0 }}
                          >
                            <XCircle className="w-5 h-5" />
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
                        "text-xs font-semibold tracking-wide transition-colors uppercase",
                        isPending && "text-zinc-600",
                        isActive && "text-cyan-400",
                        isComplete && "text-emerald-400",
                        isError && "text-rose-400",
                        isSkipped && "text-zinc-700 line-through"
                      )}
                      animate={isActive ? { opacity: [0.7, 1, 0.7] } : {}}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      {stage.shortName}
                    </motion.p>
                    <AnimatePresence>
                      {stage.details && !isSkipped && (
                        <motion.p 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="text-[10px] text-zinc-500 mt-1 max-w-[90px] truncate"
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

        {/* Mobile: Premium Vertical Timeline */}
        <div className="md:hidden space-y-1">
          {/* Progress indicator */}
          <div className="flex items-center justify-between mb-4 px-2">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Pipeline Progress</span>
            <span className="text-sm font-bold text-white">
              {completedCount}/{stages.length}
            </span>
          </div>
          
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
                    "absolute left-5 top-12 w-0.5 h-6",
                    isComplete ? "bg-gradient-to-b from-emerald-500/50 to-emerald-500/20" : "bg-white/[0.06]"
                  )} />
                )}
                
                <div 
                  className={cn(
                    "flex items-center gap-4 p-3 rounded-xl transition-all duration-300",
                    isActive && "bg-cyan-500/10 border border-cyan-500/20",
                    isComplete && "bg-emerald-500/5",
                    isError && "bg-rose-500/10 border border-rose-500/20",
                    isPending && "opacity-40"
                  )}
                >
                  {/* Icon */}
                  <div className={cn(
                    "relative w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                    isPending && "bg-white/[0.03] text-zinc-600",
                    isActive && "bg-cyan-500/20 text-cyan-400",
                    isComplete && "bg-emerald-500/20 text-emerald-400",
                    isError && "bg-rose-500/20 text-rose-400"
                  )}>
                    {isActive && <PulseRing color="bg-cyan-400/20" />}
                    {isActive ? (
                      <Loader2 className="w-4 h-4 animate-spin relative z-10" />
                    ) : isComplete ? (
                      <CheckCircle2 className="w-4 h-4 relative z-10" />
                    ) : isError ? (
                      <XCircle className="w-4 h-4 relative z-10" />
                    ) : (
                      <Icon className="w-4 h-4 relative z-10" />
                    )}
                  </div>
                  
                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm font-medium",
                      isPending && "text-zinc-600",
                      isActive && "text-cyan-400",
                      isComplete && "text-emerald-400",
                      isError && "text-rose-400"
                    )}>
                      {stage.name}
                    </p>
                    {stage.details && (
                      <p className="text-[11px] text-zinc-500 truncate">{stage.details}</p>
                    )}
                  </div>
                  
                  {/* Status badge */}
                  {isActive && (
                    <motion.div 
                      className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] font-semibold uppercase tracking-wider"
                      animate={{ opacity: [0.7, 1, 0.7] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      Active
                    </motion.div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
