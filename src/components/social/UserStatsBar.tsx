import { Flame, Zap, Trophy, TrendingUp } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useGamification } from '@/hooks/useGamification';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function UserStatsBar() {
  const { stats, xpProgress, unlockedAchievements, statsLoading } = useGamification();

  // Don't render until stats are loaded to prevent null access crashes
  if (statsLoading || !stats) return null;

  // Extra safety check for required properties
  if (typeof stats.level !== 'number' || typeof stats.xp_total !== 'number') {
    console.warn('[UserStatsBar] Invalid stats structure:', stats);
    return null;
  }

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-muted/30 rounded-lg border">
      {/* Level & XP */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center text-primary-foreground font-bold text-sm">
                  {stats.level}
                </div>
                <Zap className="w-4 h-4 absolute -bottom-1 -right-1 text-yellow-500 fill-yellow-500" />
              </div>
              <div className="hidden sm:block">
                <p className="text-xs text-muted-foreground">Level {stats.level}</p>
                <div className="w-20">
                  <Progress value={xpProgress?.percentage ?? 0} className="h-1.5" />
                </div>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{xpProgress?.current ?? 0} / {xpProgress?.needed ?? 0} XP to next level</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Streak */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5">
              <Flame className={cn(
                "w-5 h-5",
                stats.current_streak > 0 ? "text-orange-500" : "text-muted-foreground"
              )} />
              <span className="font-semibold text-sm">{stats.current_streak}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{stats.current_streak} day streak (Best: {stats.longest_streak})</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* XP Total */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-5 h-5 text-green-500" />
              <span className="font-semibold text-sm">{stats.xp_total.toLocaleString()}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Total XP earned</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Achievements */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5">
              <Trophy className="w-5 h-5 text-yellow-500" />
              <span className="font-semibold text-sm">{unlockedAchievements?.length ?? 0}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{unlockedAchievements?.length ?? 0} achievements unlocked</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
