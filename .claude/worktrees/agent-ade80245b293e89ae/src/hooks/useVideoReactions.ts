/**
 * useVideoReactions - Emoji reactions for videos
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const EMOJI_OPTIONS = ['🔥', '❤️', '😂', '😮', '👏', '😢', '🎬'] as const;
export type EmojiType = typeof EMOJI_OPTIONS[number];

export interface VideoReaction {
  id: string;
  user_id: string;
  project_id: string;
  emoji: EmojiType;
  created_at: string;
}

export interface ReactionCount {
  emoji: EmojiType;
  count: number;
  hasReacted: boolean;
}

export function useVideoReactions(projectId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch reactions with counts
  const { data: reactions, isLoading } = useQuery({
    queryKey: ['video-reactions', projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const { data, error } = await supabase
        .from('video_reactions')
        .select('*')
        .eq('project_id', projectId);

      if (error) throw error;
      return data as VideoReaction[];
    },
    enabled: !!projectId,
  });

  // Compute reaction counts
  const reactionCounts: ReactionCount[] = EMOJI_OPTIONS.map(emoji => {
    const emojiReactions = (reactions || []).filter(r => r.emoji === emoji);
    return {
      emoji,
      count: emojiReactions.length,
      hasReacted: !!user && emojiReactions.some(r => r.user_id === user.id),
    };
  });

  // Toggle reaction
  const toggleReaction = useMutation({
    mutationFn: async (emoji: EmojiType) => {
      if (!user || !projectId) throw new Error('Not authenticated');

      const existing = (reactions || []).find(
        r => r.user_id === user.id && r.emoji === emoji
      );

      if (existing) {
        // Remove reaction
        const { error } = await supabase
          .from('video_reactions')
          .delete()
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        // Add reaction
        const { error } = await supabase
          .from('video_reactions')
          .insert({
            user_id: user.id,
            project_id: projectId,
            emoji,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['video-reactions', projectId] });
    },
  });

  return {
    reactions,
    reactionCounts,
    isLoading,
    toggleReaction,
    totalReactions: (reactions || []).length,
  };
}

export function useCommentReactions(commentId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const COMMENT_EMOJIS = ['🔥', '❤️', '😂', '😮', '👏', '😢'] as const;

  const { data: reactions } = useQuery({
    queryKey: ['comment-reactions', commentId],
    queryFn: async () => {
      if (!commentId) return [];

      const { data, error } = await supabase
        .from('comment_reactions')
        .select('*')
        .eq('comment_id', commentId);

      if (error) throw error;
      return data;
    },
    enabled: !!commentId,
  });

  const reactionCounts = COMMENT_EMOJIS.map(emoji => {
    const emojiReactions = (reactions || []).filter(r => r.emoji === emoji);
    return {
      emoji,
      count: emojiReactions.length,
      hasReacted: !!user && emojiReactions.some(r => r.user_id === user.id),
    };
  });

  const toggleReaction = useMutation({
    mutationFn: async (emoji: string) => {
      if (!user || !commentId) throw new Error('Not authenticated');

      const existing = (reactions || []).find(
        r => r.user_id === user.id && r.emoji === emoji
      );

      if (existing) {
        const { error } = await supabase
          .from('comment_reactions')
          .delete()
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('comment_reactions')
          .insert({
            user_id: user.id,
            comment_id: commentId,
            emoji,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comment-reactions', commentId] });
    },
  });

  return {
    reactionCounts,
    toggleReaction,
  };
}
