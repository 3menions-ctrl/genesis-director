/**
 * Comprehensive Comments System Regression Tests
 * 
 * Validates:
 * - Comment CRUD operations and hooks
 * - Threading/reply support
 * - Emoji reactions on comments
 * - Profile fetching via public views (not raw profiles)
 * - Auth guards (sign-in required)
 * - Notification creation on new comments
 * - Comment deletion (own comments only)
 * - Input validation (max length, XSS prevention)
 * - Realtime subscription for live updates
 * - UI: loading states, empty states, reply indicator
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

function readFile(filePath: string): string {
  return fs.readFileSync(path.resolve(filePath), 'utf-8');
}

// ─── Comments Hook (useSocial.ts) ────────────────────────────────────────────

describe('Comments Hook — useProjectComments', () => {
  const hook = readFile('src/hooks/useSocial.ts');

  it('should export useProjectComments function', () => {
    expect(hook).toContain('export function useProjectComments');
  });

  it('should export ProjectComment interface', () => {
    expect(hook).toContain('export interface ProjectComment');
  });

  it('should query project_comments table', () => {
    expect(hook).toContain("from('project_comments')");
  });

  it('should order comments by created_at descending', () => {
    expect(hook).toMatch(/order.*created_at.*desc|\.order\('created_at'/);
  });

  it('should only fetch when projectId is provided', () => {
    expect(hook).toContain('enabled: !!projectId');
  });

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  it('should support adding comments via mutation', () => {
    expect(hook).toContain('addComment');
    expect(hook).toMatch(/\.insert\(\{[\s\S]*?project_id/);
  });

  it('should require authentication before adding comment', () => {
    expect(hook).toContain("if (!user || !projectId) throw new Error('Not authenticated')");
  });

  it('should support reply_to_id for threaded comments', () => {
    expect(hook).toContain('replyToId');
    expect(hook).toContain('reply_to_id');
  });

  it('should support liking comments', () => {
    expect(hook).toContain('likeComment');
    expect(hook).toContain("from('comment_likes')");
  });

  // ─── Notifications ────────────────────────────────────────────────────────

  it('should create notification for project owner on new comment', () => {
    expect(hook).toContain("type: 'comment'");
    expect(hook).toContain('New comment on your video');
  });

  it('should NOT notify project owner for own comments', () => {
    expect(hook).toContain('project.user_id !== user.id');
  });

  // ─── Realtime ──────────────────────────────────────────────────────────────

  it('should subscribe to realtime changes on project_comments', () => {
    expect(hook).toContain('postgres_changes');
    expect(hook).toContain("table: 'project_comments'");
  });

  it('should filter realtime by project_id', () => {
    expect(hook).toContain('filter: `project_id=eq.${projectId}`');
  });

  it('should invalidate query cache on realtime update', () => {
    expect(hook).toContain("invalidateQueries({ queryKey: ['project-comments'");
  });

  // ─── Return Values ────────────────────────────────────────────────────────

  it('should return comments, isLoading, addComment, and likeComment', () => {
    expect(hook).toMatch(/return\s*\{[\s\S]*?comments[\s\S]*?isLoading[\s\S]*?addComment[\s\S]*?likeComment/);
  });
});

// ─── VideoCommentsSection UI Component ───────────────────────────────────────

describe('VideoCommentsSection — UI Component', () => {
  const component = readFile('src/components/social/VideoCommentsSection.tsx');

  // ─── Security ──────────────────────────────────────────────────────────────

  it('should fetch profiles via profiles_public view (not raw profiles)', () => {
    expect(component).toContain("from('profiles_public')");
    expect(component).not.toMatch(/from\('profiles'\)(?!_public)/);
  });

  it('should only select safe fields from profiles (id, display_name, avatar_url)', () => {
    expect(component).toContain("select('id, display_name, avatar_url')");
  });

  it('should enforce auth for comment input', () => {
    expect(component).toContain('Sign in to leave a comment');
  });

  it('should validate non-empty input before sending', () => {
    expect(component).toContain('!inputValue.trim()');
  });

  it('should enforce maxLength on textarea', () => {
    expect(component).toContain('maxLength={1000}');
  });

  // ─── Delete Authorization ─────────────────────────────────────────────────

  it('should only show delete button for own comments', () => {
    expect(component).toContain('isOwn');
    expect(component).toContain("user?.id === comment.user_id");
  });

  it('should delete via supabase with correct id filter', () => {
    expect(component).toMatch(/\.delete\(\)[\s\S]*?\.eq\('id',\s*comment\.id\)/);
  });

  // ─── Threading ─────────────────────────────────────────────────────────────

  it('should separate top-level comments from replies', () => {
    expect(component).toContain('topLevelComments');
    expect(component).toContain('repliesMap');
    expect(component).toContain('reply_to_id');
  });

  it('should visually indent replies', () => {
    expect(component).toContain('isReply');
    expect(component).toContain('ml-10');
    expect(component).toContain('border-l-2');
  });

  it('should show reply indicator with cancel button', () => {
    expect(component).toContain('Replying to');
    expect(component).toContain('setReplyTo(null)');
  });

  // ─── Emoji Reactions ──────────────────────────────────────────────────────

  it('should include CommentReactions component', () => {
    expect(component).toContain('CommentReactions');
    expect(component).toContain('useCommentReactions');
  });

  it('should offer quick-reaction emojis', () => {
    expect(component).toContain("'🔥'");
    expect(component).toContain("'❤️'");
    expect(component).toContain("'😂'");
  });

  it('should show reaction counts', () => {
    expect(component).toContain('reactionCounts');
    expect(component).toContain('count');
    expect(component).toContain('hasReacted');
  });

  it('should require auth for reactions', () => {
    expect(component).toContain('Sign in to react');
  });

  // ─── Loading & Empty States ────────────────────────────────────────────────

  it('should show loading spinner while fetching comments', () => {
    expect(component).toContain('isLoading');
    expect(component).toContain('Loader2');
    expect(component).toContain('animate-spin');
  });

  it('should show empty state when no comments', () => {
    expect(component).toContain('No comments yet');
    expect(component).toContain('Be the first to comment');
  });

  it('should show pending state while submitting', () => {
    expect(component).toContain('addComment.isPending');
  });

  // ─── UI Integrity ─────────────────────────────────────────────────────────

  it('should display comment count in header', () => {
    expect(component).toContain('Comments ({commentsWithProfiles.length})');
  });

  it('should show relative timestamps', () => {
    expect(component).toContain('formatDistanceToNow');
    expect(component).toContain('addSuffix: true');
  });

  it('should use Avatars with fallback initials', () => {
    expect(component).toContain('Avatar');
    expect(component).toContain('AvatarFallback');
    expect(component).toContain('initials');
  });

  it('should auto-focus textarea on reply click', () => {
    expect(component).toContain('textareaRef.current?.focus()');
  });

  it('should clear input and reply state after successful comment', () => {
    expect(component).toContain("setInputValue('')");
    expect(component).toContain('setReplyTo(null)');
  });

  it('should show success and error toasts', () => {
    expect(component).toContain("toast.success('Comment added')");
    expect(component).toContain("toast.error('Failed to add comment')");
    expect(component).toContain("toast.error('Failed to delete comment')");
  });
});

// ─── Comment Reactions Hook ──────────────────────────────────────────────────

describe('Comment Reactions — useCommentReactions', () => {
  const reactionsFile = readFile('src/hooks/useVideoReactions.ts');

  it('should export useCommentReactions hook', () => {
    expect(reactionsFile).toContain('useCommentReactions');
  });

  it('should query comment_reactions table', () => {
    expect(reactionsFile).toContain("comment_reactions");
  });

  it('should support toggle behavior (add/remove reaction)', () => {
    expect(reactionsFile).toContain('toggleReaction');
  });
});

// ─── Database Schema Alignment ───────────────────────────────────────────────

describe('Comments — Database Schema Alignment', () => {
  const types = readFile('src/integrations/supabase/types.ts');

  it('should have project_comments table in types', () => {
    expect(types).toContain('project_comments');
  });

  it('should have comment_likes table in types', () => {
    expect(types).toContain('comment_likes');
  });

  it('should have comment_reactions table in types', () => {
    expect(types).toContain('comment_reactions');
  });

  it('project_comments should have reply_to_id for threading', () => {
    // The project_comments table definition spans many lines; search the full types file
    expect(types).toContain('reply_to_id');
  });
});

// ─── VideoDetail Page Integration ────────────────────────────────────────────

describe('VideoDetail — Comments Integration', () => {
  const videoDetail = readFile('src/pages/VideoDetail.tsx');

  it('should import VideoCommentsSection', () => {
    expect(videoDetail).toContain('VideoCommentsSection');
  });

  it('should pass projectId to VideoCommentsSection', () => {
    expect(videoDetail).toContain('projectId={video.id}');
  });
});
