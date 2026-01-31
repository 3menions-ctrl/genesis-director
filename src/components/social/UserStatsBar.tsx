import { memo, forwardRef, HTMLAttributes } from 'react';
import { Flame, Zap, Trophy, TrendingUp } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useGamification } from '@/hooks/useGamification';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// Reusable stat item component with proper ref forwarding for Radix TooltipTrigger
interface StatItemProps extends HTMLAttributes<HTMLDivElement> {
  icon: React.ReactNode;
  value: string | number;
}

const StatItem = forwardRef<HTMLDivElement, StatItemProps>(
  function StatItem({ icon, value, className, ...props }, ref) {
    return (
      <div 
        ref={ref} 
        className={cn("flex items-center gap-1.5 cursor-default", className)}
        {...props}
      >
        {icon}
        <span className="font-semibold text-sm">{value}</span>
      </div>
    );
  }
);
StatItem.displayName = 'StatItem';

// Level badge component with ref forwarding
const LevelBadge = forwardRef<HTMLDivElement, { 
  level: number; 
  xpCurrent: number; 
  xpNeeded: number; 
  xpPercentage: number;
}>(function LevelBadge({ level, xpCurrent, xpNeeded, xpPercentage }, ref) {
  return (
    <div ref={ref} className="flex items-center gap-2 cursor-default">
      <div className="relative">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center text-primary-foreground font-bold text-sm">
          {level}
        </div>
        <Zap className="w-4 h-4 absolute -bottom-1 -right-1 text-amber-500 fill-amber-500" />
      </div>
      <div className="hidden sm:block">
        <p className="text-xs text-muted-foreground">Level {level}</p>
        <div className="w-20">
          <Progress value={xpPercentage} className="h-1.5" />
        </div>
      </div>
    </div>
  );
});
LevelBadge.displayName = 'LevelBadge';

export const UserStatsBar = memo(forwardRef<HTMLDivElement, Record<string, never>>(function UserStatsBar(_props, ref) {
  const { stats, xpProgress, unlockedAchievements, statsLoading } = useGamification();

  // When stats aren't loaded, render an empty placeholder that still forwards ref
  // This prevents "Function components cannot be given refs" crashes
  if (statsLoading || !stats) {
    return <div ref={ref} className="hidden" aria-hidden="true" />;
  }

  // Extra safety check for required properties
  if (typeof stats.level !== 'number' || typeof stats.xp_total !== 'number') {
    console.warn('[UserStatsBar] Invalid stats structure:', stats);
    return <div ref={ref} className="hidden" aria-hidden="true" />;
  }

  return (
    <div ref={ref} className="flex items-center gap-4 px-4 py-2 bg-muted/30 rounded-lg border">
      {/* Level & XP */}
      <Tooltip>
        <TooltipTrigger asChild>
          <LevelBadge 
            level={stats.level}
            xpCurrent={xpProgress?.current ?? 0}
            xpNeeded={xpProgress?.needed ?? 0}
            xpPercentage={xpProgress?.percentage ?? 0}
          />
        </TooltipTrigger>
        <TooltipContent>
          <p>{xpProgress?.current ?? 0} / {xpProgress?.needed ?? 0} XP to next level</p>
        </TooltipContent>
      </Tooltip>

      {/* Streak */}
      <Tooltip>
        <TooltipTrigger asChild>
          <StatItem
            icon={<Flame className={cn(
              "w-5 h-5",
              stats.current_streak > 0 ? "text-orange-500" : "text-muted-foreground"
            )} />}
            value={stats.current_streak}
          />
        </TooltipTrigger>
        <TooltipContent>
          <p>{stats.current_streak} day streak (Best: {stats.longest_streak})</p>
        </TooltipContent>
      </Tooltip>

      {/* XP Total */}
      <Tooltip>
        <TooltipTrigger asChild>
          <StatItem
            icon={<TrendingUp className="w-5 h-5 text-emerald-500" />}
            value={stats.xp_total.toLocaleString()}
          />
        </TooltipTrigger>
        <TooltipContent>
          <p>Total XP earned</p>
        </TooltipContent>
      </Tooltip>

      {/* Achievements */}
      <Tooltip>
        <TooltipTrigger asChild>
          <StatItem
            icon={<Trophy className="w-5 h-5 text-amber-500" />}
            value={unlockedAchievements?.length ?? 0}
          />
        </TooltipTrigger>
        <TooltipContent>
          <p>{unlockedAchievements?.length ?? 0} achievements unlocked</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}));

UserStatsBar.displayName = 'UserStatsBar';
