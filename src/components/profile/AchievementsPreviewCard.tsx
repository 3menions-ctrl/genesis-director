import { Trophy, Award, Lock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useGamification } from '@/hooks/useGamification';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

export function AchievementsPreviewCard() {
  const { unlockedAchievements, achievements, statsLoading: isLoading } = useGamification();

  const totalAchievements = achievements?.length || 0;
  const unlockedCount = unlockedAchievements?.length || 0;
  const progress = totalAchievements > 0 ? (unlockedCount / totalAchievements) * 100 : 0;

  // Get 4 most recent unlocked + 2 locked for preview
  const recentUnlocked = (unlockedAchievements || []).slice(0, 4);
  const lockedAchievements = (achievements || [])
    .filter(a => !unlockedAchievements?.some(u => u.achievement_id === a.id))
    .slice(0, 2);

  return (
    <Card className="relative overflow-hidden border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-6">
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
            <Award className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Achievements</h3>
            <p className="text-xs text-white/40">{unlockedCount} of {totalAchievements} unlocked</p>
          </div>
        </div>
        <Badge variant="outline" className="border-white/20 text-white/60">
          {Math.round(progress)}%
        </Badge>
      </div>

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
            <div
              key={ua.id}
              className="relative aspect-square rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30 flex flex-col items-center justify-center p-2 group hover:scale-105 transition-transform"
            >
              <Trophy className="w-6 h-6 text-amber-400 mb-1" />
              <p className="text-[10px] text-center text-white/70 font-medium line-clamp-2">
                {ua.achievements?.name || 'Achievement'}
              </p>
            </div>
          ))}
          
          {/* Locked achievements */}
          {lockedAchievements.map((achievement, i) => (
            <div
              key={achievement.id}
              className="relative aspect-square rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col items-center justify-center p-2 opacity-50"
            >
              <Lock className="w-5 h-5 text-white/30 mb-1" />
              <p className="text-[10px] text-center text-white/40 font-medium line-clamp-2">
                {achievement.name}
              </p>
            </div>
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
    </Card>
  );
}
