import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, Target, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ConsistencyMetrics {
  overall: number;
  color: number;
  motion: number;
  character: number;
  scene: number;
}

interface ConsistencyScoreCardProps {
  score?: number;
  metrics?: Partial<ConsistencyMetrics>;
  trend?: 'up' | 'down' | 'stable';
  previousScore?: number;
  className?: string;
}

export function ConsistencyScoreCard({ 
  score = 0, 
  metrics,
  trend = 'stable',
  previousScore,
  className 
}: ConsistencyScoreCardProps) {
  const getScoreColor = (value: number) => {
    if (value >= 0.85) return 'text-emerald-400';
    if (value >= 0.7) return 'text-amber-400';
    return 'text-red-400';
  };

  const getScoreBg = (value: number) => {
    if (value >= 0.85) return 'from-emerald-500/20 to-emerald-500/5';
    if (value >= 0.7) return 'from-amber-500/20 to-amber-500/5';
    return 'from-red-500/20 to-red-500/5';
  };

  const getProgressColor = (value: number) => {
    if (value >= 0.85) return 'bg-emerald-500';
    if (value >= 0.7) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-white/40';

  const metricItems = metrics ? [
    { label: 'Color', value: metrics.color },
    { label: 'Motion', value: metrics.motion },
    { label: 'Character', value: metrics.character },
    { label: 'Scene', value: metrics.scene },
  ].filter(m => m.value !== undefined) : [];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "p-4 rounded-xl border border-white/10 overflow-hidden relative",
        `bg-gradient-to-br ${getScoreBg(score)}`,
        className
      )}
    >
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-24 h-24 opacity-10">
        <Target className="w-full h-full text-white" />
      </div>

      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-white/60" />
            <span className="text-sm font-medium text-white/80">Consistency Score</span>
          </div>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1">
                  <TrendIcon className={cn("w-3.5 h-3.5", trendColor)} />
                  {previousScore !== undefined && (
                    <span className={cn("text-xs", trendColor)}>
                      {trend === 'up' ? '+' : trend === 'down' ? '-' : ''}
                      {Math.abs((score - previousScore) * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">
                  {trend === 'up' ? 'Improving' : trend === 'down' ? 'Degrading' : 'Stable'} consistency
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Main Score */}
        <div className="flex items-baseline gap-1 mb-4">
          <span className={cn("text-4xl font-bold", getScoreColor(score))}>
            {(score * 100).toFixed(0)}
          </span>
          <span className="text-lg text-white/40">%</span>
        </div>

        {/* Metric Breakdown */}
        {metricItems.length > 0 && (
          <div className="space-y-2">
            {metricItems.map((metric) => (
              <div key={metric.label} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/50">{metric.label}</span>
                  <span className={cn("text-xs font-medium", getScoreColor(metric.value || 0))}>
                    {((metric.value || 0) * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(metric.value || 0) * 100}%` }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className={cn("h-full rounded-full", getProgressColor(metric.value || 0))}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
