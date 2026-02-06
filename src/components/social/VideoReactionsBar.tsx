/**
 * VideoReactionsBar - Emoji reaction bar for videos
 * Premium glass aesthetic with animated interactions
 */

import { memo } from 'react';
import { cn } from '@/lib/utils';
import { useVideoReactions, EMOJI_OPTIONS, EmojiType } from '@/hooks/useVideoReactions';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface VideoReactionsBarProps {
  projectId: string;
  className?: string;
  compact?: boolean;
}

export const VideoReactionsBar = memo(function VideoReactionsBar({
  projectId,
  className,
  compact = false,
}: VideoReactionsBarProps) {
  const { user } = useAuth();
  const { reactionCounts, toggleReaction, totalReactions } = useVideoReactions(projectId);

  const handleReaction = async (emoji: EmojiType) => {
    if (!user) {
      toast.error('Sign in to react');
      return;
    }

    try {
      await toggleReaction.mutateAsync(emoji);
    } catch (err) {
      toast.error('Failed to react');
    }
  };

  return (
    <div className={cn(
      "flex items-center gap-1",
      className
    )}>
      {reactionCounts.map(({ emoji, count, hasReacted }) => (
        <button
          key={emoji}
          onClick={() => handleReaction(emoji)}
          disabled={toggleReaction.isPending}
          className={cn(
            "group relative flex items-center gap-1 px-2 py-1 rounded-full",
            "transition-all duration-200",
            "hover:scale-110 active:scale-95",
            hasReacted
              ? "bg-primary/20 border border-primary/40"
              : "bg-white/5 border border-white/10 hover:bg-white/10",
            compact ? "text-sm" : "text-base"
          )}
        >
          <span className={cn(
            "transition-transform duration-200",
            "group-hover:scale-125"
          )}>
            {emoji}
          </span>
          {count > 0 && (
            <span className={cn(
              "font-medium",
              hasReacted ? "text-primary" : "text-zinc-400",
              compact ? "text-xs" : "text-sm"
            )}>
              {count}
            </span>
          )}
        </button>
      ))}
      
      {totalReactions > 0 && !compact && (
        <span className="ml-2 text-xs text-zinc-500">
          {totalReactions} reaction{totalReactions !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  );
});

// Simplified reaction display for thumbnails/cards
export const MiniReactionsDisplay = memo(function MiniReactionsDisplay({
  projectId,
  className,
}: {
  projectId: string;
  className?: string;
}) {
  const { reactionCounts, totalReactions } = useVideoReactions(projectId);
  
  // Get top 3 reactions by count
  const topReactions = reactionCounts
    .filter(r => r.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  if (totalReactions === 0) return null;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <div className="flex -space-x-1">
        {topReactions.map(({ emoji }) => (
          <span key={emoji} className="text-sm">
            {emoji}
          </span>
        ))}
      </div>
      <span className="text-xs text-zinc-400 ml-1">
        {totalReactions}
      </span>
    </div>
  );
});
