import { Trophy, Crown, Medal } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useGamification, LeaderboardEntry } from '@/hooks/useGamification';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

export function LeaderboardCard() {
  const { user } = useAuth();
  const { leaderboard, leaderboardLoading } = useGamification();
  
  // Take top 5 for the card preview
  const topEntries = (leaderboard || []).slice(0, 5);

  const getRankIcon = (rank: number) => {
    if (rank === 0) return <Crown className="w-4 h-4 text-amber-400" />;
    if (rank === 1) return <Medal className="w-4 h-4 text-gray-300" />;
    if (rank === 2) return <Medal className="w-4 h-4 text-amber-600" />;
    return <span className="text-xs font-bold text-white/40">#{rank + 1}</span>;
  };

  const getRankBg = (rank: number) => {
    if (rank === 0) return 'bg-gradient-to-r from-amber-500/20 to-orange-500/10 border-amber-500/30';
    if (rank === 1) return 'bg-gradient-to-r from-gray-400/10 to-gray-500/5 border-gray-400/20';
    if (rank === 2) return 'bg-gradient-to-r from-amber-700/10 to-amber-800/5 border-amber-700/20';
    return 'bg-white/[0.02] border-white/[0.06]';
  };

  return (
    <Card className="relative overflow-hidden border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-6">
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
      
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
          <Trophy className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h3 className="font-semibold text-white">Leaderboard</h3>
          <p className="text-xs text-white/40">Top creators this week</p>
        </div>
      </div>
      
      <div className="space-y-2">
        {leaderboardLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl bg-white/5" />
          ))
        ) : topEntries.length === 0 ? (
          <div className="text-center py-8 text-white/40">
            <Trophy className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No rankings yet</p>
          </div>
        ) : (
          topEntries.map((entry, index) => {
            const isCurrentUser = entry.user_id === user?.id;
            
            return (
              <div
                key={entry.user_id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl border transition-all",
                  getRankBg(index),
                  isCurrentUser && "ring-1 ring-primary/50"
                )}
              >
                <div className="w-8 h-8 flex items-center justify-center">
                  {getRankIcon(index)}
                </div>
                
                <Avatar className="h-9 w-9 border border-white/10">
                  <AvatarImage src={entry.avatar_url || undefined} />
                  <AvatarFallback className="bg-white/5 text-white/60 text-xs">
                    {entry.display_name?.charAt(0) || '?'}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "font-medium text-sm truncate",
                    isCurrentUser ? "text-primary" : "text-white"
                  )}>
                    {entry.display_name || 'Anonymous'}
                    {isCurrentUser && <span className="text-white/40 ml-1">(You)</span>}
                  </p>
                  <p className="text-xs text-white/40">Level {entry.level}</p>
                </div>
                
                <div className="text-right">
                  <p className="font-bold text-white">{entry.xp_total.toLocaleString()}</p>
                  <p className="text-xs text-white/40">XP</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
