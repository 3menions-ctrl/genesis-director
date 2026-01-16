import { Zap, TrendingUp, Flame, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useGamification } from '@/hooks/useGamification';
import { useSocial } from '@/hooks/useSocial';
import { cn } from '@/lib/utils';

export function GamificationStatsCard() {
  const { stats, xpProgress } = useGamification();
  const { followersCount, followingCount } = useSocial();

  const statItems = [
    {
      label: 'Level',
      value: stats?.level || 1,
      icon: Zap,
      color: 'from-primary/20 to-primary/5',
      iconColor: 'text-primary',
      progress: xpProgress?.percentage || 0,
      subtext: `${xpProgress?.current || 0} / ${xpProgress?.needed || 100} XP`,
    },
    {
      label: 'Total XP',
      value: (stats?.xp_total || 0).toLocaleString(),
      icon: TrendingUp,
      color: 'from-emerald-500/20 to-emerald-500/5',
      iconColor: 'text-emerald-400',
    },
    {
      label: 'Day Streak',
      value: stats?.current_streak || 0,
      icon: Flame,
      color: 'from-orange-500/20 to-orange-500/5',
      iconColor: 'text-orange-400',
      subtext: `Best: ${stats?.longest_streak || 0} days`,
    },
    {
      label: 'Followers',
      value: followersCount || 0,
      icon: Users,
      color: 'from-purple-500/20 to-purple-500/5',
      iconColor: 'text-purple-400',
      subtext: `Following: ${followingCount || 0}`,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {statItems.map((stat, index) => (
        <Card 
          key={index}
          className={cn(
            "relative overflow-hidden border-white/[0.06] p-4",
            `bg-gradient-to-br ${stat.color}`
          )}
        >
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
          
          <div className="flex items-center gap-3">
            <div className={cn("p-2.5 rounded-xl bg-white/[0.08]", stat.iconColor)}>
              <stat.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-xs text-white/50">{stat.label}</p>
            </div>
          </div>
          
          {stat.progress !== undefined && (
            <div className="mt-3">
              <Progress value={stat.progress} className="h-1.5 bg-white/[0.08]" />
              <p className="text-xs text-white/40 mt-1">{stat.subtext}</p>
            </div>
          )}
          
          {stat.subtext && !stat.progress && (
            <p className="text-xs text-white/40 mt-2">{stat.subtext}</p>
          )}
        </Card>
      ))}
    </div>
  );
}
