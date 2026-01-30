import { memo, forwardRef } from 'react';
import { Video, FolderOpen, Heart, Sparkles } from 'lucide-react';
import { useGamification } from '@/hooks/useGamification';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export const QuickStatsCard = memo(forwardRef<HTMLDivElement, Record<string, never>>(function QuickStatsCard(_, ref) {
  const { stats } = useGamification();

  const statItems = [
    {
      label: 'Videos Created',
      value: stats?.videos_created || 0,
      icon: Video,
      color: 'from-blue-500 to-cyan-500',
    },
    {
      label: 'Completed',
      value: stats?.videos_completed || 0,
      icon: Sparkles,
      color: 'from-emerald-500 to-teal-500',
    },
    {
      label: 'Likes Received',
      value: stats?.total_likes_received || 0,
      icon: Heart,
      color: 'from-pink-500 to-rose-500',
    },
    {
      label: 'Characters',
      value: stats?.characters_created || 0,
      icon: FolderOpen,
      color: 'from-amber-500 to-orange-500',
    },
  ];

  return (
    <div ref={ref} className="rounded-2xl bg-zinc-900/50 border border-white/[0.06] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/[0.06]">
        <h3 className="font-semibold text-white">Your Stats</h3>
      </div>
      
      {/* Stats Grid */}
      <div className="p-3 grid grid-cols-2 gap-2">
        {statItems.map((stat, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            className="relative p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] transition-all group overflow-hidden"
          >
            {/* Gradient accent */}
            <div className={cn(
              "absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity",
              stat.color
            )} />
            
            <div className="flex items-center gap-2 mb-3">
              <div className={cn(
                "w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center",
                stat.color
              )}>
                <stat.icon className="w-4 h-4 text-white" />
              </div>
            </div>
            
            <p className="text-2xl font-bold text-white tracking-tight">{stat.value}</p>
            <p className="text-xs text-white/40 mt-0.5">{stat.label}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}));
