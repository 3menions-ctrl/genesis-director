import { useState } from 'react';
import { Send, Heart, Reply, MoreHorizontal, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useProjectComments, ProjectComment } from '@/hooks/useSocial';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface CommentItemProps {
  comment: ProjectComment;
  onReply: (commentId: string) => void;
  onLike: (commentId: string) => void;
  isOwn: boolean;
}

function CommentItem({ comment, onReply, onLike, isOwn }: CommentItemProps) {
  return (
    <div className="flex gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors">
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarImage src={comment.profiles?.avatar_url || undefined} />
        <AvatarFallback className="text-xs">
          {(comment.profiles?.display_name || 'U').charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm">
            {comment.profiles?.display_name || 'Anonymous'}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
          </span>
        </div>
        
        <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words">
          {comment.content}
        </p>
        
        <div className="flex items-center gap-4 mt-2">
          <button
            onClick={() => onLike(comment.id)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 transition-colors"
          >
            <Heart className="w-3.5 h-3.5" />
            {comment.likes_count > 0 && <span>{comment.likes_count}</span>}
          </button>
          <button
            onClick={() => onReply(comment.id)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <Reply className="w-3.5 h-3.5" />
            Reply
          </button>
          {isOwn && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="text-muted-foreground hover:text-foreground transition-colors">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem className="text-destructive">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  );
}

interface VideoCommentsProps {
  projectId: string;
  className?: string;
}

export function VideoComments({ projectId, className }: VideoCommentsProps) {
  const { user } = useAuth();
  const { comments, isLoading, addComment, likeComment } = useProjectComments(projectId);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!newComment.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      await addComment.mutateAsync({
        content: newComment.trim(),
        replyToId: replyTo || undefined,
      });
      setNewComment('');
      setReplyTo(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Organize comments by parent
  const topLevelComments = comments?.filter(c => !c.reply_to_id) || [];
  const repliesMap = new Map<string, ProjectComment[]>();
  comments?.forEach(c => {
    if (c.reply_to_id) {
      const existing = repliesMap.get(c.reply_to_id) || [];
      existing.push(c);
      repliesMap.set(c.reply_to_id, existing);
    }
  });

  return (
    <div className={cn("flex flex-col", className)}>
      <h4 className="font-semibold mb-3">
        Comments {comments && comments.length > 0 && `(${comments.length})`}
      </h4>
      
      {/* Comment Input */}
      <div className="flex gap-3 mb-4">
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarFallback className="text-xs">
            {user?.email?.charAt(0).toUpperCase() || 'U'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          {replyTo && (
            <div className="text-xs text-muted-foreground mb-1 flex items-center gap-2">
              <Reply className="w-3 h-3" />
              Replying to comment
              <button 
                onClick={() => setReplyTo(null)}
                className="text-primary hover:underline"
              >
                Cancel
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add a comment..."
              className="min-h-[40px] resize-none text-sm"
              rows={1}
            />
            <Button
              size="icon"
              onClick={handleSubmit}
              disabled={!newComment.trim() || isSubmitting}
              className="flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Comments List */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Loading comments...
          </div>
        ) : topLevelComments.length > 0 ? (
          <div className="space-y-1">
            {topLevelComments.map((comment) => (
              <div key={comment.id}>
                <CommentItem
                  comment={comment}
                  onReply={setReplyTo}
                  onLike={(id) => likeComment.mutate(id)}
                  isOwn={comment.user_id === user?.id}
                />
                {/* Replies */}
                {repliesMap.has(comment.id) && (
                  <div className="ml-8 border-l-2 border-muted pl-3">
                    {repliesMap.get(comment.id)!.map((reply) => (
                      <CommentItem
                        key={reply.id}
                        comment={reply}
                        onReply={setReplyTo}
                        onLike={(id) => likeComment.mutate(id)}
                        isOwn={reply.user_id === user?.id}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No comments yet. Be the first to share your thoughts!
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
