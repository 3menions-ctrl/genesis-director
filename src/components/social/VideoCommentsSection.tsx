/**
 * VideoCommentsSection - Full comments section with emoji reactions
 * Premium glass aesthetic with threaded replies
 */

import { useState, memo, useRef, useEffect } from 'react';
import { MessageCircle, Send, Loader2, Reply, Trash2, Pencil, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useProjectComments, ProjectComment } from '@/hooks/useSocial';
import { useCommentReactions } from '@/hooks/useVideoReactions';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { confirmAsync } from '@/components/ui/global-confirm';

interface CommentItemProps {
  comment: ProjectComment & { profile?: { display_name: string | null; avatar_url: string | null } };
  onReply: (commentId: string, authorName: string) => void;
  onDelete: (commentId: string) => void | Promise<void>;
  onEdit: (commentId: string, content: string) => Promise<boolean>;
  isReply?: boolean;
}

const CommentReactions = memo(function CommentReactions({ commentId }: { commentId: string }) {
  const { user } = useAuth();
  const { reactionCounts, toggleReaction } = useCommentReactions(commentId);

  const handleReaction = async (emoji: string) => {
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

  const activeReactions = reactionCounts.filter(r => r.count > 0);

  return (
    <div className="flex items-center gap-1 mt-1">
      {activeReactions.map(({ emoji, count, hasReacted }) => (
        <button
          key={emoji}
          onClick={() => handleReaction(emoji)}
          className={cn(
            "flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs",
            "transition-all hover:scale-105",
            hasReacted
              ? "text-primary"
              : "text-zinc-400 hover:bg-white/[0.06]"
          )}
        >
          <span>{emoji}</span>
          <span>{count}</span>
        </button>
      ))}
      <div className="flex items-center gap-0.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {['🔥', '❤️', '😂'].map(emoji => (
          <button
            key={emoji}
            onClick={() => handleReaction(emoji)}
            className="text-sm hover:scale-125 transition-transform"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
});

const CommentItem = memo(function CommentItem({
  comment,
  onReply,
  onDelete,
  onEdit,
  isReply = false,
}: CommentItemProps) {
  const { user } = useAuth();
  const displayName = comment.profile?.display_name || 'Anonymous';
  const initials = displayName.slice(0, 2).toUpperCase();
  const isOwn = user?.id === comment.user_id;

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(comment.content);
  const [savingEdit, setSavingEdit] = useState(false);

  // "edited" marker: updated_at meaningfully later than created_at (>2s guard
  // covers the row's own creation write).
  const wasEdited =
    !!comment.updated_at &&
    new Date(comment.updated_at).getTime() - new Date(comment.created_at).getTime() > 2000;

  const handleDelete = async () => {
    const confirmed = await confirmAsync({
      title: 'Delete comment?',
      description: 'This permanently removes your comment. This cannot be undone.',
      destructive: true,
    });
    if (!confirmed) return;
    await onDelete(comment.id);
  };

  const startEdit = () => { setDraft(comment.content); setIsEditing(true); };
  const cancelEdit = () => { setIsEditing(false); setDraft(comment.content); };
  const saveEdit = async () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === comment.content || savingEdit) { setIsEditing(false); return; }
    setSavingEdit(true);
    const ok = await onEdit(comment.id, trimmed);
    setSavingEdit(false);
    if (ok) setIsEditing(false);
  };

  return (
    <div className={cn(
      "group flex gap-3 p-3 rounded-xl transition-colors",
      "hover:bg-glass",
      isReply && "ml-10 border-l-2 border-white/10"
    )}>
      <Avatar className="w-9 h-9 shrink-0">
        <AvatarImage src={comment.profile?.avatar_url || undefined} />
        <AvatarFallback className="bg-zinc-800 text-zinc-400 text-xs">
          {initials}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-medium text-sm text-white">{displayName}</span>
          <span className="text-[10px] text-zinc-500">
            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
          </span>
          {wasEdited && !isEditing && (
            <span className="text-[10px] text-zinc-600 italic">(edited)</span>
          )}
        </div>

        {isEditing ? (
          <div className="mt-1.5">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, 1000))}
              maxLength={1000}
              rows={2}
              autoFocus
              className="bg-zinc-900/60 border-white/10 text-sm text-zinc-200 resize-none"
            />
            <div className="flex items-center gap-2 mt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={saveEdit}
                disabled={savingEdit || !draft.trim() || draft.trim() === comment.content}
                className="h-7 px-3 text-xs text-primary hover:bg-white/[0.06]"
              >
                {savingEdit ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Check className="w-3 h-3 mr-1" />Save</>}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={cancelEdit}
                disabled={savingEdit}
                className="h-7 px-3 text-xs text-zinc-400 hover:text-white hover:bg-white/[0.06]"
              >
                <X className="w-3 h-3 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-zinc-300 mt-1 break-words">{comment.content}</p>
        )}

        <CommentReactions commentId={comment.id} />

        {!isEditing && (
          <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onReply(comment.id, displayName)}
              className="h-6 px-2 text-xs text-zinc-400 hover:text-white"
            >
              <Reply className="w-3 h-3 mr-1" />
              Reply
            </Button>
            {isOwn && (
              <Button
                variant="ghost"
                size="sm"
                onClick={startEdit}
                className="h-6 px-2 text-xs text-zinc-400 hover:text-white"
              >
                <Pencil className="w-3 h-3 mr-1" />
                Edit
              </Button>
            )}
            {isOwn && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                className="h-6 px-2 text-xs text-red-400 hover:text-red-300"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Delete
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

interface VideoCommentsSectionProps {
  projectId: string;
  className?: string;
}

export function VideoCommentsSection({ projectId, className }: VideoCommentsSectionProps) {
  const { user } = useAuth();
  const [inputValue, setInputValue] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Synchronous re-entrancy lock. addComment.isPending is React state and does
  // not flip until the next render, so rapid double-clicks all pass the guard
  // and post duplicate comments. A ref blocks them within the same tick.
  const sendingRef = useRef(false);
  
  const { comments, isLoading, addComment, updateComment, deleteComment } = useProjectComments(projectId);

  const handleDeleteComment = async (commentId: string) => {
    try {
      await deleteComment.mutateAsync(commentId);
      toast.success('Comment deleted');
    } catch (err) {
      toast.error('Failed to delete comment');
    }
  };

  const handleEditComment = async (commentId: string, content: string): Promise<boolean> => {
    try {
      await updateComment.mutateAsync({ commentId, content });
      toast.success('Comment updated');
      return true;
    } catch (err) {
      toast.error('Failed to update comment');
      return false;
    }
  };
  
  // Fetch profiles for comments
  const [commentsWithProfiles, setCommentsWithProfiles] = useState<(ProjectComment & { profile?: { display_name: string | null; avatar_url: string | null } })[]>([]);
  
  useEffect(() => {
    const fetchProfiles = async () => {
      if (!comments || comments.length === 0) {
        setCommentsWithProfiles([]);
        return;
      }
      
      const userIds = [...new Set(comments.map(c => c.user_id))];
      // Use profiles_public view for security (hides email, financial data)
      const { data: profiles } = await supabase
        .from('profiles_public')
        .select('id, display_name, avatar_url')
        .in('id', userIds);
      
      const profileMap = new Map(
        (profiles || []).map(p => [p.id, { display_name: p.display_name, avatar_url: p.avatar_url }])
      );
      
      setCommentsWithProfiles(
        comments.map(c => ({
          ...c,
          profile: profileMap.get(c.user_id),
        }))
      );
    };
    
    fetchProfiles();
  }, [comments]);

  const handleReply = (commentId: string, authorName: string) => {
    setReplyTo({ id: commentId, name: authorName });
    textareaRef.current?.focus();
  };

  const handleSend = async () => {
    if (!inputValue.trim() || addComment.isPending || sendingRef.current) return;
    sendingRef.current = true;

    try {
      await addComment.mutateAsync({
        content: inputValue.trim(),
        replyToId: replyTo?.id,
      });
      setInputValue('');
      setReplyTo(null);
      toast.success('Comment added');
    } catch (err) {
      toast.error('Failed to add comment');
    } finally {
      sendingRef.current = false;
    }
  };

  // Organize comments into threads. Replies-to-replies previously got bucketed
  // under their parent *reply* (which is never iterated for sub-replies), so
  // they silently vanished from the UI while still counting toward the total —
  // inflating the count. We now resolve every reply to its ROOT top-level
  // ancestor so nested replies render (one indent level) and the count matches
  // what's actually shown. Orphaned replies (parent missing) render top-level.
  const commentById = new Map(commentsWithProfiles.map(c => [c.id, c]));
  const topLevelComments = commentsWithProfiles.filter(
    c => !c.reply_to_id || !commentById.has(c.reply_to_id)
  );
  const resolveRoot = (c: (typeof commentsWithProfiles)[number]) => {
    let cur = c;
    const seen = new Set<string>();
    while (cur.reply_to_id && commentById.has(cur.reply_to_id) && !seen.has(cur.id)) {
      seen.add(cur.id);
      cur = commentById.get(cur.reply_to_id)!;
    }
    return cur;
  };
  const repliesMap = new Map<string, typeof commentsWithProfiles>();
  commentsWithProfiles
    .filter(c => c.reply_to_id && commentById.has(c.reply_to_id))
    .forEach(c => {
      const root = resolveRoot(c);
      if (root.id === c.id) return;
      const existing = repliesMap.get(root.id) || [];
      existing.push(c);
      repliesMap.set(root.id, existing);
    });

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <MessageCircle className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-white">
          Comments ({commentsWithProfiles.length})
        </h3>
      </div>

      {/* Input */}
      {user ? (
        <div className="space-y-2">
          {replyTo && (
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <Reply className="w-3 h-3" />
              <span>Replying to {replyTo.name}</span>
              <button 
                onClick={() => setReplyTo(null)}
                className="text-zinc-500 hover:text-white"
              >
                ✕
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <Textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Add a comment..."
              maxLength={1000}
              className="flex-1 min-h-[80px] bg-zinc-800/50 border-white/10 focus:border-primary/50 resize-none"
            />
          </div>
          <div className="flex justify-end">
            <Button
              variant="ghost"
              onClick={handleSend}
              disabled={!inputValue.trim() || addComment.isPending}
              className="text-primary hover:bg-white/[0.06]"
            >
              {addComment.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Comment
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-center py-4 text-zinc-500 text-sm rounded-xl">
          Sign in to leave a comment
        </div>
      )}

      {/* Comments List */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
          </div>
        ) : topLevelComments.length === 0 ? (
          <div className="text-center py-8 text-zinc-500 text-sm">
            No comments yet. Be the first to comment!
          </div>
        ) : (
          topLevelComments.map(comment => (
            <div key={comment.id}>
              <CommentItem comment={comment} onReply={handleReply} onDelete={handleDeleteComment} onEdit={handleEditComment} />
              {/* Replies */}
              {repliesMap.get(comment.id)?.map(reply => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  onReply={handleReply}
                  onDelete={handleDeleteComment}
                  onEdit={handleEditComment}
                  isReply
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
