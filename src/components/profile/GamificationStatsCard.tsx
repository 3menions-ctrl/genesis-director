import { memo, forwardRef } from 'react';
import { Zap, TrendingUp, Flame, Users } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useGamification } from '@/hooks/useGamification';
import { useSocial } from '@/hooks/useSocial';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export const GamificationStatsCard = memo(forwardRef<HTMLDivElement, Record<string, never>>(function GamificationStatsCard(_, ref) {
  const { stats, xpProgress } = useGamification();
  const { followersCount, followingCount } = useSocial();

  const statItems = [
    {
      label: 'Level',
      value: stats?.level || 1,
      icon: Zap,
      gradient: 'from-violet-500 to-purple-600',
      bgGradient: 'from-violet-500/10 to-purple-600/5',
      progress: xpProgress?.percentage || 0,
      subtext: `${xpProgress?.current || 0} / ${xpProgress?.needed || 100} XP`,
    },
    {
      label: 'Total XP',
      value: (stats?.xp_total || 0).toLocaleString(),
      icon: TrendingUp,
      gradient: 'from-emerald-500 to-teal-600',
      bgGradient: 'from-emerald-500/10 to-teal-600/5',
    },
    {
      label: 'Day Streak',
      value: stats?.current_streak || 0,
      icon: Flame,
      gradient: 'from-orange-500 to-red-600',
      bgGradient: 'from-orange-500/10 to-red-600/5',
      subtext: `Best: ${stats?.longest_streak || 0} days`,
    },
    {
      label: 'Followers',
      value: followersCount || 0,
      icon: Users,
      gradient: 'from-blue-500 to-cyan-600',
      bgGradient: 'from-blue-500/10 to-cyan-600/5',
      subtext: `Following: ${followingCount || 0}`,
    },
  ];

  return (
    <div ref={ref} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {statItems.map((stat, index) => (
        <motion.div 
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className={cn(
            "relative rounded-2xl p-5 overflow-hidden transition-all hover:scale-[1.02]",
            "bg-zinc-900/50 border border-white/[0.06]"
          )}
        >
          {/* Accent line */}
          <div className={cn("absolute top-0 left-0 right-0 h-1 bg-gradient-to-r", stat.gradient)} />
          
          {/* Background glow */}
          <div className={cn("absolute inset-0 bg-gradient-to-br opacity-50", stat.bgGradient)} />
          
          <div className="relative">
            <div className="flex items-start justify-between mb-3">
              <div className={cn(
                "w-11 h-11 rounded-xl flex items-center justify-center bg-gradient-to-br",
                stat.gradient
              )}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
            </div>
            
            <p className="text-3xl font-bold text-white tracking-tight">{stat.value}</p>
            <p className="text-sm text-white/50 mt-0.5">{stat.label}</p>
            
            {stat.progress !== undefined && (
              <div className="mt-3">
                <Progress value={stat.progress} className="h-1.5 bg-white/[0.08]" />
                <p className="text-xs text-white/40 mt-1.5">{stat.subtext}</p>
              </div>
            )}
            
            {stat.subtext && !stat.progress && (
              <p className="text-xs text-white/40 mt-2">{stat.subtext}</p>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}));
