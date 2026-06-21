import { memo, forwardRef } from 'react';
import { Trophy, Award, Lock, ChevronRight, Sparkles } from 'lucide-react';
import { useGamification } from '@/hooks/useGamification';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import { Progress } from '@/components/ui/progress';

export const AchievementsPreviewCard = memo(forwardRef<HTMLDivElement, Record<string, never>>(function AchievementsPreviewCard(_, ref) {
  const { unlockedAchievements, achievements, statsLoading: isLoading } = useGamification();

  const totalAchievements = achievements?.length || 0;
  const unlockedCount = unlockedAchievements?.length || 0;
  const progress = totalAchievements > 0 ? (unlockedCount / totalAchievements) * 100 : 0;

  // Get most recent unlocked + locked for preview
  const recentUnlocked = (unlockedAchievements || []).slice(0, 3);
  const lockedAchievements = (achievements || [])
    .filter(a => !unlockedAchievements?.some(u => u.achievement_id === a.id))
    .slice(0, 3);

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return 'from-amber-500 to-orange-600';
      case 'epic': return 'from-purple-500 to-pink-600';
      case 'rare': return 'from-blue-500 to-cyan-600';
      default: return 'from-gray-400 to-gray-500';
    }
  };

  return (
    <div ref={ref} className="rounded-2xl bg-zinc-900/50 border border-white/[0.06] overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-white/[0.06]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Award className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Achievements</h3>
              <p className="text-xs text-white/40">{unlockedCount} of {totalAchievements} unlocked</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-16">
              <Progress value={progress} className="h-1.5 bg-white/[0.08]" />
            </div>
            <span className="text-xs font-semibold text-white/60">{Math.round(progress)}%</span>
          </div>
        </div>
      </div>

      {/* Achievements Grid */}
      <div className="p-4">
        {isLoading ? (
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-xl bg-white/5" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {/* Unlocked achievements */}
            {recentUnlocked.map((ua, i) => (
              <motion.div
                key={ua.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="group relative aspect-square rounded-xl overflow-hidden cursor-pointer"
              >
                <div className={cn(
                  "absolute inset-0 bg-gradient-to-br",
                  getRarityColor(ua.achievements?.rarity || 'common')
                )} />
                <div className="absolute inset-0 bg-black/20" />
                <div className="absolute inset-[1px] rounded-[10px] bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center p-2 text-center">
                  <Sparkles className="w-6 h-6 text-amber-400 mb-1.5" />
                  <p className="text-[10px] font-semibold text-white leading-tight line-clamp-2">
                    {ua.achievements?.name || 'Achievement'}
                  </p>
                </div>
                {/* Glow effect */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-white/10 to-transparent" />
              </motion.div>
            ))}
            
            {/* Locked achievements */}
            {lockedAchievements.map((achievement, i) => (
              <motion.div
                key={achievement.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: (recentUnlocked.length + i) * 0.05 }}
                className="relative aspect-square rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col items-center justify-center p-2 opacity-50 hover:opacity-70 transition-opacity cursor-pointer"
              >
                <Lock className="w-5 h-5 text-white/25 mb-1.5" />
                <p className="text-[10px] text-center text-white/40 font-medium leading-tight line-clamp-2">
                  {achievement.name}
                </p>
              </motion.div>
            ))}
            
            {/* Fill empty slots */}
            {Array.from({ length: Math.max(0, 6 - recentUnlocked.length - lockedAchievements.length) }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="aspect-square rounded-xl bg-white/[0.01] border border-dashed border-white/[0.06] flex items-center justify-center"
              >
                <Lock className="w-4 h-4 text-white/10" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-white/[0.06]">
        <button className="w-full flex items-center justify-center gap-2 text-xs text-white/40 hover:text-white/60 transition-colors py-1">
          View all achievements
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}));
