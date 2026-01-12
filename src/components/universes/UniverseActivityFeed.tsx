import { 
  Film, Users, Clock, UserPlus, Sparkles, 
  FileText, Share2, Globe, Play
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useUniverseActivityFeed, type UniverseActivity } from '@/hooks/useUniverseActivityFeed';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface UniverseActivityFeedProps {
  universeId?: string;
  showHeader?: boolean;
  maxItems?: number;
  className?: string;
}

const ACTIVITY_CONFIG: Record<string, { icon: React.ElementType; color: string; bgColor: string }> = {
  video_created: { icon: Film, color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  video_completed: { icon: Play, color: 'text-green-400', bgColor: 'bg-green-500/20' },
  timeline_event: { icon: Clock, color: 'text-orange-400', bgColor: 'bg-orange-500/20' },
  character_added: { icon: Users, color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
  character_borrowed: { icon: Share2, color: 'text-pink-400', bgColor: 'bg-pink-500/20' },
  member_joined: { icon: UserPlus, color: 'text-cyan-400', bgColor: 'bg-cyan-500/20' },
  lore_updated: { icon: FileText, color: 'text-amber-400', bgColor: 'bg-amber-500/20' },
};

function ActivityItem({ activity }: { activity: UniverseActivity }) {
  const config = ACTIVITY_CONFIG[activity.activity_type] || { 
    icon: Sparkles, 
    color: 'text-white/60', 
    bgColor: 'bg-white/10' 
  };
  const Icon = config.icon;

  return (
    <div className="flex gap-3 p-3 rounded-lg hover:bg-white/[0.02] transition-colors group">
      {/* Icon */}
      <div className={cn(
        "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
        config.bgColor
      )}>
        <Icon className={cn("w-5 h-5", config.color)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white/90 font-medium line-clamp-2">
          {activity.title}
        </p>
        {activity.description && (
          <p className="text-xs text-white/50 mt-0.5 line-clamp-1">
            {activity.description}
          </p>
        )}
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-xs text-white/30">
            {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
          </span>
          {activity.universe && (
            <>
              <span className="text-white/20">·</span>
              <Badge variant="outline" className="text-[10px] py-0 h-4 border-white/10 text-white/40">
                {activity.universe.name}
              </Badge>
            </>
          )}
        </div>
      </div>

      {/* Thumbnail */}
      {activity.thumbnail_url && (
        <div className="w-16 h-12 rounded-md overflow-hidden bg-white/5 shrink-0">
          <img 
            src={activity.thumbnail_url} 
            alt="" 
            className="w-full h-full object-cover"
          />
        </div>
      )}
    </div>
  );
}

function ActivitySkeleton() {
  return (
    <div className="flex gap-3 p-3">
      <Skeleton className="w-10 h-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export function UniverseActivityFeed({ 
  universeId, 
  showHeader = true,
  maxItems = 20,
  className 
}: UniverseActivityFeedProps) {
  const { activities, isLoading } = useUniverseActivityFeed(universeId);
  const displayActivities = activities.slice(0, maxItems);

  if (isLoading) {
    return (
      <Card className={cn("bg-black/40 border-white/[0.06]", className)}>
        {showHeader && (
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Activity
            </CardTitle>
          </CardHeader>
        )}
        <CardContent className="p-0">
          {[1, 2, 3].map((i) => (
            <ActivitySkeleton key={i} />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (displayActivities.length === 0) {
    return (
      <Card className={cn("bg-black/40 border-white/[0.06]", className)}>
        {showHeader && (
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Activity
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="py-8 text-center">
            <Globe className="w-10 h-10 mx-auto text-white/20 mb-3" />
            <p className="text-sm text-white/40">No activity yet</p>
            <p className="text-xs text-white/30 mt-1">
              Activity will appear here when you or others create content
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("bg-black/40 border-white/[0.06]", className)}>
      {showHeader && (
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Activity
            {displayActivities.length > 0 && (
              <Badge variant="secondary" className="ml-auto text-xs">
                {displayActivities.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className="p-0">
        <div className="divide-y divide-white/[0.04]">
          {displayActivities.map((activity) => (
            <ActivityItem key={activity.id} activity={activity} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
