import { Video, FolderOpen, Timer, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useGamification } from '@/hooks/useGamification';
import { cn } from '@/lib/utils';

export function QuickStatsCard() {
  const { stats } = useGamification();

  const statItems = [
    {
      label: 'Videos Created',
      value: stats?.videos_created || 0,
      icon: Video,
      color: 'text-blue-400',
    },
    {
      label: 'Completed',
      value: stats?.videos_completed || 0,
      icon: Sparkles,
      color: 'text-emerald-400',
    },
    {
      label: 'Likes Received',
      value: stats?.total_likes_received || 0,
      icon: Timer,
      color: 'text-pink-400',
    },
    {
      label: 'Characters',
      value: stats?.characters_created || 0,
      icon: FolderOpen,
      color: 'text-amber-400',
    },
  ];

  return (
    <Card className="relative overflow-hidden border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-6">
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      
      <h3 className="font-semibold text-white mb-4">Your Stats</h3>
      
      <div className="grid grid-cols-2 gap-3">
        {statItems.map((stat, index) => (
          <div
            key={index}
            className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]"
          >
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className={cn("w-4 h-4", stat.color)} />
            </div>
            <p className="text-2xl font-bold text-white">{stat.value}</p>
            <p className="text-xs text-white/40">{stat.label}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
