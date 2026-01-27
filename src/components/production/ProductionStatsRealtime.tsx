import { Film, Clock, Sparkles, Zap, CheckCircle2, TrendingUp, Activity } from 'lucide-react';
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

function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  subValue,
  color = 'default',
  isActive = false,
  delay = 0 
}: { 
  icon: React.ElementType;
  label: string;
  value: string | number;
  subValue?: string;
  color?: 'default' | 'sky' | 'emerald' | 'amber' | 'violet' | 'rose';
  isActive?: boolean;
  delay?: number;
}) {
  const colorConfig = {
    default: { bg: 'bg-white/[0.03]', icon: 'text-zinc-400', border: 'border-white/[0.06]' },
    sky: { bg: 'bg-sky-500/[0.08]', icon: 'text-sky-400', border: 'border-sky-500/20' },
    emerald: { bg: 'bg-emerald-500/[0.08]', icon: 'text-emerald-400', border: 'border-emerald-500/20' },
    amber: { bg: 'bg-amber-500/[0.08]', icon: 'text-amber-400', border: 'border-amber-500/20' },
    violet: { bg: 'bg-violet-500/[0.08]', icon: 'text-violet-400', border: 'border-violet-500/20' },
    rose: { bg: 'bg-rose-500/[0.08]', icon: 'text-rose-400', border: 'border-rose-500/20' },
  };
  const config = colorConfig[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "relative p-4 rounded-xl border backdrop-blur-xl transition-all duration-300",
        config.bg, config.border,
        isActive && "ring-1 ring-white/10"
      )}
    >
      {/* Subtle glow on active */}
      {isActive && (
        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
      )}
      
      <div className="relative flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">{label}</span>
          <span className="text-xl font-bold text-white tabular-nums">{value}</span>
          {subValue && (
            <span className="text-xs text-zinc-500">{subValue}</span>
          )}
        </div>
        <div className={cn(
          "w-9 h-9 rounded-lg flex items-center justify-center",
          config.bg, "border", config.border
        )}>
          <Icon className={cn("w-4 h-4", config.icon)} />
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

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      {/* Progress */}
      <StatCard 
        icon={isComplete ? CheckCircle2 : Activity}
        label="Progress"
        value={`${Math.round(progress)}%`}
        subValue={isComplete ? 'Complete' : isError ? 'Error' : 'Processing'}
        color={isComplete ? 'emerald' : isError ? 'rose' : 'sky'}
        isActive={!isComplete && !isError}
        delay={0}
      />

      {/* Clips */}
      <StatCard 
        icon={Film}
        label="Clips"
        value={`${completedClips}/${totalClips}`}
        subValue={completedClips === totalClips ? 'All ready' : `${totalClips - completedClips} pending`}
        color="violet"
        delay={0.05}
      />

      {/* Time Elapsed */}
      <StatCard 
        icon={Clock}
        label="Elapsed"
        value={formatTime(elapsedTime)}
        subValue={`~${Math.ceil((totalClips * 120) / 60)}min est.`}
        color="amber"
        delay={0.1}
      />

      {/* Quality Score */}
      <StatCard 
        icon={Sparkles}
        label="Quality"
        value={auditScore !== null ? `${auditScore}%` : '—'}
        subValue={auditScore !== null ? (auditScore >= 80 ? 'Excellent' : auditScore >= 60 ? 'Good' : 'Fair') : 'Pending'}
        color={auditScore !== null && auditScore >= 80 ? 'emerald' : auditScore !== null && auditScore >= 60 ? 'amber' : 'default'}
        delay={0.15}
      />

      {/* Mode */}
      <StatCard 
        icon={TrendingUp}
        label="Mode"
        value={modeLabel}
        subValue="Pipeline"
        color="sky"
        delay={0.2}
      />
    </div>
  );
}
