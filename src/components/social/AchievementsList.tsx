import { Trophy, Lock, Star, Award, Film, Users, Flame, Heart, MessageCircle, UserCheck } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useGamification, Achievement } from '@/hooks/useGamification';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

const categoryIcons: Record<string, typeof Trophy> = {
  creation: Film,
  characters: Users,
  universes: Star,
  social: MessageCircle,
  streaks: Flame,
  engagement: Heart,
  general: Trophy,
};

const rarityColors: Record<string, string> = {
  common: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  rare: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  epic: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  legendary: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
};

const rarityGlow: Record<string, string> = {
  common: '',
  rare: 'shadow-blue-500/20 shadow-md',
  epic: 'shadow-purple-500/30 shadow-lg',
  legendary: 'shadow-yellow-500/40 shadow-xl animate-pulse',
};

interface AchievementCardProps {
  achievement: Achievement;
  unlocked: boolean;
  unlockedAt?: string;
}

function AchievementCard({ achievement, unlocked, unlockedAt }: AchievementCardProps) {
  const Icon = categoryIcons[achievement.category] || Trophy;

  return (
    <div
      className={cn(
        "relative p-4 rounded-xl border transition-all",
        unlocked 
          ? `${rarityColors[achievement.rarity]} ${rarityGlow[achievement.rarity]}`
          : "bg-muted/30 border-muted opacity-60"
      )}
    >
      {!unlocked && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-xl">
          <Lock className="w-6 h-6 text-muted-foreground" />
        </div>
      )}
      
      <div className="flex items-start gap-3">
        <div className={cn(
          "p-2 rounded-lg",
          unlocked ? "bg-background/50" : "bg-muted"
        )}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-sm truncate">{achievement.name}</h4>
            <Badge 
              variant="outline" 
              className={cn("text-xs capitalize", unlocked && rarityColors[achievement.rarity])}
            >
              {achievement.rarity}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">{achievement.description}</p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs font-medium text-primary">+{achievement.xp_reward} XP</span>
            {unlocked && unlockedAt && (
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(unlockedAt), { addSuffix: true })}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AchievementsList() {
  const { achievements, unlockedAchievements } = useGamification();

  const unlockedIds = new Set(unlockedAchievements?.map(ua => ua.achievement_id) || []);
  const unlockedMap = new Map(
    unlockedAchievements?.map(ua => [ua.achievement_id, ua.unlocked_at]) || []
  );

  // Group by category
  const grouped = (achievements || []).reduce((acc, achievement) => {
    if (!acc[achievement.category]) acc[achievement.category] = [];
    acc[achievement.category].push(achievement);
    return acc;
  }, {} as Record<string, Achievement[]>);

  const categories = Object.keys(grouped);

  return (
    <Card className="overflow-hidden">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <Award className="w-5 h-5 text-yellow-500" />
            Achievements
          </h3>
          <Badge variant="secondary">
            {unlockedAchievements?.length || 0} / {achievements?.length || 0}
          </Badge>
        </div>
      </div>
      <ScrollArea className="h-[500px]">
        <div className="p-4 space-y-6">
          {categories.map((category) => {
            const Icon = categoryIcons[category] || Trophy;
            const categoryAchievements = grouped[category];
            const unlockedCount = categoryAchievements.filter(a => unlockedIds.has(a.id)).length;
            
            return (
              <div key={category}>
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium capitalize">{category}</span>
                  <span className="text-xs text-muted-foreground">
                    ({unlockedCount}/{categoryAchievements.length})
                  </span>
                </div>
                <div className="grid gap-3">
                  {categoryAchievements
                    .sort((a, b) => {
                      // Sort unlocked first, then by rarity
                      const aUnlocked = unlockedIds.has(a.id);
                      const bUnlocked = unlockedIds.has(b.id);
                      if (aUnlocked !== bUnlocked) return bUnlocked ? 1 : -1;
                      const rarityOrder = { legendary: 0, epic: 1, rare: 2, common: 3 };
                      return rarityOrder[a.rarity] - rarityOrder[b.rarity];
                    })
                    .map((achievement) => (
                      <AchievementCard
                        key={achievement.id}
                        achievement={achievement}
                        unlocked={unlockedIds.has(achievement.id)}
                        unlockedAt={unlockedMap.get(achievement.id)}
                      />
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </Card>
  );
}
