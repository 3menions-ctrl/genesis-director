import { Film, Clock, Sparkles, CheckCircle2, TrendingUp, Activity, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface ProductionStatsRealtimeProps {
  completedClips: number;
  totalClips: number;
  elapsedTime: number;
  progress: number;
  auditScore: number | null;
  isComplete: boolean;
  isError: boolean;
  mode?: string;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function PremiumStatCard({ 
  icon: Icon, 
  label, 
  value, 
  subValue,
  gradient,
  glowColor,
  isActive = false,
  delay = 0 
}: { 
  icon: React.ElementType;
  label: string;
  value: string | number;
  subValue?: string;
  gradient: string;
  glowColor: string;
  isActive?: boolean;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className="group relative"
    >
      {/* Glow effect on hover */}
      <div 
        className={cn(
          "absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl",
          glowColor
        )} 
      />
      
      <div className={cn(
        "relative overflow-hidden rounded-2xl border backdrop-blur-xl transition-all duration-300",
        "bg-gradient-to-br from-white/[0.05] to-white/[0.02]",
        "border-white/[0.08] hover:border-white/[0.12]",
        "group-hover:shadow-2xl group-hover:shadow-black/20",
        isActive && "ring-1 ring-white/10"
      )}>
        {/* Gradient overlay */}
        <div className={cn(
          "absolute inset-0 opacity-40 transition-opacity duration-300 group-hover:opacity-60",
          gradient
        )} />
        
        {/* Shine effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        
        <div className="relative p-4 lg:p-5">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 font-medium">{label}</span>
              <span className="text-2xl lg:text-3xl font-bold text-white tabular-nums tracking-tight">{value}</span>
              {subValue && (
                <span className="text-[11px] text-zinc-500 font-medium">{subValue}</span>
              )}
            </div>
            <div className={cn(
              "w-10 h-10 lg:w-12 lg:h-12 rounded-xl flex items-center justify-center",
              "bg-white/[0.06] border border-white/[0.08]",
              "group-hover:bg-white/[0.08] transition-colors duration-300"
            )}>
              <Icon className="w-5 h-5 lg:w-6 lg:h-6 text-white/70 group-hover:text-white transition-colors" />
            </div>
          </div>
          
          {/* Mini progress indicator for active stats */}
          {isActive && (
            <motion.div 
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary/50 via-primary to-primary/50"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function ProductionStatsRealtime({
  completedClips,
  totalClips,
  elapsedTime,
  progress,
  auditScore,
  isComplete,
  isError,
  mode = 'text-to-video',
}: ProductionStatsRealtimeProps) {
  const modeLabel = mode === 'avatar' ? 'Avatar' : 
                    mode === 'motion-transfer' ? 'Motion' :
                    mode === 'video-to-video' ? 'Style' : 'Cinematic';

  const progressStatus = isComplete ? 'Complete' : isError ? 'Error' : 'Processing';
  const qualityLabel = auditScore !== null 
    ? (auditScore >= 80 ? 'Excellent' : auditScore >= 60 ? 'Good' : 'Fair') 
    : 'Analyzing';

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4">
      {/* Progress */}
      <PremiumStatCard 
        icon={isComplete ? CheckCircle2 : Activity}
        label="Progress"
        value={`${Math.round(progress)}%`}
        subValue={progressStatus}
        gradient={
          isComplete 
            ? "bg-gradient-to-br from-emerald-500/20 to-teal-500/10" 
            : isError 
              ? "bg-gradient-to-br from-rose-500/20 to-red-500/10"
              : "bg-gradient-to-br from-sky-500/20 to-blue-500/10"
        }
        glowColor={
          isComplete 
            ? "bg-emerald-500/20" 
            : isError 
              ? "bg-rose-500/20" 
              : "bg-sky-500/20"
        }
        isActive={!isComplete && !isError}
        delay={0}
      />

      {/* Clips */}
      <PremiumStatCard 
        icon={Film}
        label="Clips"
        value={`${completedClips}/${totalClips}`}
        subValue={completedClips === totalClips ? 'All ready' : `${totalClips - completedClips} pending`}
        gradient="bg-gradient-to-br from-violet-500/20 to-purple-500/10"
        glowColor="bg-violet-500/20"
        delay={0.05}
      />

      {/* Time Elapsed */}
      <PremiumStatCard 
        icon={Clock}
        label="Elapsed"
        value={formatTime(elapsedTime)}
        subValue={`~${Math.ceil((totalClips * 120) / 60)}min est.`}
        gradient="bg-gradient-to-br from-amber-500/20 to-orange-500/10"
        glowColor="bg-amber-500/20"
        delay={0.1}
      />

      {/* Quality Score */}
      <PremiumStatCard 
        icon={Sparkles}
        label="Quality"
        value={auditScore !== null ? `${auditScore}%` : '—'}
        subValue={qualityLabel}
        gradient={
          auditScore !== null && auditScore >= 80 
            ? "bg-gradient-to-br from-emerald-500/20 to-green-500/10" 
            : auditScore !== null && auditScore >= 60 
              ? "bg-gradient-to-br from-amber-500/20 to-yellow-500/10"
              : "bg-gradient-to-br from-zinc-500/20 to-zinc-600/10"
        }
        glowColor={
          auditScore !== null && auditScore >= 80 
            ? "bg-emerald-500/20" 
            : "bg-amber-500/20"
        }
        delay={0.15}
      />

      {/* Mode */}
      <PremiumStatCard 
        icon={Zap}
        label="Mode"
        value={modeLabel}
        subValue="Pipeline"
        gradient="bg-gradient-to-br from-cyan-500/20 to-sky-500/10"
        glowColor="bg-cyan-500/20"
        delay={0.2}
      />
    </div>
  );
}
