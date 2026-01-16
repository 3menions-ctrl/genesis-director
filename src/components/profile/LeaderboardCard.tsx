import { Trophy, Crown, Medal, ChevronRight } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useGamification } from '@/hooks/useGamification';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';

export function LeaderboardCard() {
  const { user } = useAuth();
  const { leaderboard, leaderboardLoading } = useGamification();
  
  const topEntries = (leaderboard || []).slice(0, 5);

  const getRankDisplay = (rank: number) => {
    if (rank === 0) return { icon: Crown, color: 'text-amber-400', bg: 'bg-gradient-to-br from-amber-500/30 to-orange-500/20' };
    if (rank === 1) return { icon: Medal, color: 'text-gray-300', bg: 'bg-gradient-to-br from-gray-400/20 to-gray-500/10' };
    if (rank === 2) return { icon: Medal, color: 'text-amber-600', bg: 'bg-gradient-to-br from-amber-700/20 to-amber-800/10' };
    return { icon: null, color: 'text-white/40', bg: 'bg-white/[0.03]' };
  };

  return (
    <div className="rounded-2xl bg-zinc-900/50 border border-white/[0.06] overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-white/[0.06]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Trophy className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Leaderboard</h3>
              <p className="text-xs text-white/40">Top creators this week</p>
            </div>
          </div>
          <button className="flex items-center gap-1 text-xs text-white/40 hover:text-white/60 transition-colors">
            View all
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      
      {/* Leaderboard */}
      <div className="p-3">
        {leaderboardLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl bg-white/5" />
            ))}
          </div>
        ) : topEntries.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.03] flex items-center justify-center mx-auto mb-3">
              <Trophy className="w-7 h-7 text-white/15" />
            </div>
            <p className="text-sm text-white/40">No rankings yet</p>
            <p className="text-xs text-white/25 mt-1">Be the first to claim the top spot!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {topEntries.map((entry, index) => {
              const isCurrentUser = entry.user_id === user?.id;
              const rankDisplay = getRankDisplay(index);
              
              return (
                <motion.div
                  key={entry.user_id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-xl transition-all",
                    rankDisplay.bg,
                    isCurrentUser && "ring-1 ring-white/20"
                  )}
                >
                  {/* Rank */}
                  <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                    {rankDisplay.icon ? (
                      <rankDisplay.icon className={cn("w-5 h-5", rankDisplay.color)} />
                    ) : (
                      <span className="text-sm font-bold text-white/40">#{index + 1}</span>
                    )}
                  </div>
                  
                  {/* Avatar */}
                  <Avatar className={cn(
                    "h-10 w-10 border-2",
                    index === 0 ? "border-amber-500/50" : "border-white/10"
                  )}>
                    <AvatarImage src={entry.avatar_url || undefined} />
                    <AvatarFallback className="bg-zinc-800 text-white/60 text-sm font-medium">
                      {entry.display_name?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
                  
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "font-semibold text-sm truncate",
                      isCurrentUser ? "text-white" : "text-white/90"
                    )}>
                      {entry.display_name || 'Anonymous'}
                      {isCurrentUser && <span className="text-white/40 font-normal ml-1.5">(You)</span>}
                    </p>
                    <p className="text-xs text-white/40">Level {entry.level}</p>
                  </div>
                  
                  {/* XP */}
                  <div className="text-right flex-shrink-0">
                    <p className={cn(
                      "font-bold tabular-nums",
                      index === 0 ? "text-amber-400" : "text-white"
                    )}>
                      {entry.xp_total.toLocaleString()}
                    </p>
                    <p className="text-xs text-white/40">XP</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
