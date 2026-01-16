import { useState } from 'react';
import { Trophy, Medal, Award, Flame, Heart, Users, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useGamification, LeaderboardEntry } from '@/hooks/useGamification';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const rankIcons = [Trophy, Medal, Award];
const rankColors = ['text-yellow-500', 'text-gray-400', 'text-amber-600'];

interface LeaderboardRowProps {
  entry: LeaderboardEntry;
  isCurrentUser: boolean;
}

function LeaderboardRow({ entry, isCurrentUser }: LeaderboardRowProps) {
  const RankIcon = entry.rank <= 3 ? rankIcons[entry.rank - 1] : null;
  const rankColor = entry.rank <= 3 ? rankColors[entry.rank - 1] : '';

  return (
    <div
      className={cn(
        "flex items-center gap-4 p-4 rounded-lg transition-colors",
        isCurrentUser ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50"
      )}
    >
      {/* Rank */}
      <div className="w-8 flex-shrink-0 text-center">
        {RankIcon ? (
          <RankIcon className={cn("w-6 h-6 mx-auto", rankColor)} />
        ) : (
          <span className="text-muted-foreground font-medium">#{entry.rank}</span>
        )}
      </div>

      {/* User */}
      <Avatar className="h-10 w-10 border-2 border-background">
        <AvatarImage src={entry.avatar_url || undefined} />
        <AvatarFallback>
          {(entry.display_name || 'U').charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">
            {entry.display_name || 'Anonymous'}
          </span>
          {isCurrentUser && (
            <Badge variant="secondary" className="text-xs">You</Badge>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            Level {entry.level}
          </span>
          <span className="flex items-center gap-1">
            <Flame className="w-3 h-3 text-orange-500" />
            {entry.current_streak}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm">
        <div className="text-center hidden sm:block">
          <p className="font-semibold">{entry.videos_created}</p>
          <p className="text-xs text-muted-foreground">Videos</p>
        </div>
        <div className="text-center hidden sm:block">
          <p className="font-semibold flex items-center gap-1">
            <Heart className="w-3 h-3 text-red-500" />
            {entry.total_likes_received}
          </p>
          <p className="text-xs text-muted-foreground">Likes</p>
        </div>
        <div className="text-center hidden sm:block">
          <p className="font-semibold flex items-center gap-1">
            <Users className="w-3 h-3" />
            {entry.followers_count}
          </p>
          <p className="text-xs text-muted-foreground">Followers</p>
        </div>
        <div className="text-right">
          <p className="font-bold text-primary">{entry.xp_total.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">XP</p>
        </div>
      </div>
    </div>
  );
}

export function Leaderboard() {
  const { user } = useAuth();
  const { leaderboard, leaderboardLoading } = useGamification();
  const [filter, setFilter] = useState<'xp' | 'streak' | 'videos'>('xp');

  const sortedLeaderboard = [...(leaderboard || [])].sort((a, b) => {
    switch (filter) {
      case 'streak':
        return b.current_streak - a.current_streak;
      case 'videos':
        return b.videos_created - a.videos_created;
      default:
        return b.xp_total - a.xp_total;
    }
  }).map((entry, index) => ({ ...entry, rank: index + 1 }));

  return (
    <Card className="overflow-hidden">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Leaderboard
          </h3>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <TabsList className="h-8">
              <TabsTrigger value="xp" className="text-xs px-2">XP</TabsTrigger>
              <TabsTrigger value="streak" className="text-xs px-2">Streak</TabsTrigger>
              <TabsTrigger value="videos" className="text-xs px-2">Videos</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
      <ScrollArea className="h-[400px]">
        {leaderboardLoading ? (
          <div className="p-8 text-center text-muted-foreground">
            Loading leaderboard...
          </div>
        ) : sortedLeaderboard.length > 0 ? (
          <div className="divide-y">
            {sortedLeaderboard.map((entry) => (
              <LeaderboardRow
                key={entry.user_id}
                entry={entry}
                isCurrentUser={entry.user_id === user?.id}
              />
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-muted-foreground">
            <Trophy className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p>No rankings yet</p>
            <p className="text-sm">Be the first to claim the top spot!</p>
          </div>
        )}
      </ScrollArea>
    </Card>
  );
}
