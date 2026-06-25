/**
 * FeedComments — a bottom sheet of comments for a feed reel.
 *
 * Wired to the real reel-comment RPCs (migration 20260613000000):
 *   • reel_comments_for(p_reel_id, p_cursor, p_limit)
 *   • add_reel_comment(p_reel_id, p_body)         — optimistic prepend
 *   • toggle_like_reel_comment(p_comment_id)
 *
 * Styled in the app's language: translucent glass sheet, borderless. Static
 * fallback films have no backend reel, so they show a gentle empty state.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Send, X, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { hapticTap } from '@/lib/native/shell';
import { cn } from '@/lib/utils';

interface Comment {
  id: string;
  body: string;
  like_count: number;
  created_at: string;
  viewer_liked: boolean;
  author: { id: string; display_name: string | null; avatar_url: string | null };
}

function ago(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

interface Props {
  open: boolean;
  reelId: string | null;
  isStatic: boolean;
  onClose: () => void;
  onPosted?: () => void;
}

export function FeedComments({ open, reelId, isStatic, onClose, onPosted }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!reelId || isStatic) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('reel_comments_for' as never, { p_reel_id: reelId, p_cursor: null, p_limit: 50 } as never);
      if (error) throw error;
      setComments((data as unknown as Comment[]) ?? []);
    } catch {
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [reelId, isStatic]);

  useEffect(() => { if (open && reelId && !isStatic) { setComments([]); void load(); } }, [open, reelId, isStatic, load]);

  const submit = async () => {
    const body = draft.trim();
    if (!body || posting || !reelId) return;
    if (isStatic) { toast('Comments are available on published films.'); return; }
    if (!user) { onClose(); navigate('/auth'); return; }
    void hapticTap();
    setPosting(true);
    const temp: Comment = {
      id: `tmp-${Date.now()}`, body, like_count: 0, created_at: new Date().toISOString(), viewer_liked: false,
      author: { id: user.id, display_name: (user.user_metadata?.display_name as string) ?? user.email ?? 'You', avatar_url: (user.user_metadata?.avatar_url as string) ?? null },
    };
    setComments((c) => [temp, ...c]);
    setDraft('');
    onPosted?.();
    try {
      const { data, error } = await supabase.rpc('add_reel_comment' as never, { p_reel_id: reelId, p_body: body } as never);
      if (error) throw error;
      const fresh = data as unknown as Comment;
      setComments((c) => c.map((x) => (x.id === temp.id ? { ...fresh, viewer_liked: false } : x)));
    } catch (e) {
      setComments((c) => c.filter((x) => x.id !== temp.id));
      setDraft(body);
      toast.error(e instanceof Error ? e.message : 'Comment failed');
    } finally {
      setPosting(false);
    }
  };

  const like = async (c: Comment) => {
    if (!user) { onClose(); navigate('/auth'); return; }
    void hapticTap();
    const was = c.viewer_liked;
    setComments((list) => list.map((x) => x.id === c.id ? { ...x, viewer_liked: !was, like_count: Math.max(0, x.like_count + (was ? -1 : 1)) } : x));
    try {
      const { error } = await supabase.rpc('toggle_like_reel_comment' as never, { p_comment_id: c.id } as never);
      if (error) throw error;
    } catch {
      setComments((list) => list.map((x) => x.id === c.id ? { ...x, viewer_liked: was, like_count: Math.max(0, x.like_count + (was ? 1 : -1)) } : x));
    }
  };

  return (
    <div className={cn('fixed inset-0 z-[60]', open ? 'pointer-events-auto' : 'pointer-events-none')}>
      <div onClick={onClose} className={cn('absolute inset-0 bg-black/45 transition-opacity duration-300', open ? 'opacity-100' : 'opacity-0')} />
      <div
        className={cn('absolute inset-x-0 bottom-0 flex max-h-[78%] flex-col rounded-t-[28px] bg-[#0c0c12]/96 backdrop-blur-2xl transition-transform duration-300', open ? 'translate-y-0' : 'translate-y-full')}
        style={{ paddingBottom: 'calc(var(--safe-bottom,0px) + var(--tabbar-h,0px) + 12px)' }}
      >
        <div className="mx-auto mb-2 mt-3 h-1 w-10 rounded-full bg-white/15" />
        <div className="flex items-center justify-between px-5 pb-3">
          <span className="font-display text-[15px] font-semibold text-white">Comments{comments.length ? ` · ${comments.length}` : ''}</span>
          <button onClick={onClose} aria-label="Close" className="text-white/50"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5">
          {loading ? (
            <Empty label="Loading comments…" />
          ) : comments.length === 0 ? (
            <Empty label="No comments yet — be the first." />
          ) : (
            <ul className="space-y-4 pb-3">
              {comments.map((c) => (
                <li key={c.id} className="flex gap-3">
                  {c.author.avatar_url ? (
                    <img src={c.author.avatar_url} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#9c8bff] to-[#6b3bff] text-[12px] font-bold">{(c.author.display_name?.[0] ?? '?').toUpperCase()}</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[12px]">
                      <span className="font-semibold text-white/90">{c.author.display_name ?? 'Anonymous'}</span>
                      <span className="text-white/35">{ago(c.created_at)}</span>
                    </div>
                    <div className="mt-0.5 text-[14px] leading-snug text-white/85">{c.body}</div>
                  </div>
                  <button onClick={() => like(c)} className="flex shrink-0 flex-col items-center gap-0.5 pt-0.5 text-white/55">
                    <Heart className={cn('h-[15px] w-[15px]', c.viewer_liked && 'fill-[#ff3b6b] stroke-[#ff3b6b]')} />
                    {c.like_count > 0 && <span className="font-mono text-[10px] tabular-nums">{c.like_count}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Compose */}
        {(
          <div className="mt-1 flex items-center gap-2 px-4 pt-2">
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
              placeholder={user ? 'Add a comment…' : 'Sign in to comment'}
              className="surface-1 h-11 flex-1 rounded-full bg-transparent px-4 text-[14px] text-white outline-none placeholder:text-white/35"
            />
            <button onClick={submit} disabled={!draft.trim() || posting} aria-label="Send"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#2f6bff] to-[#7a3bff] text-white transition-opacity disabled:opacity-40">
              <Send className="h-[18px] w-[18px]" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center text-white/40">
      <MessageCircle className="h-7 w-7" strokeWidth={1.4} />
      <span className="text-[13px]">{label}</span>
    </div>
  );
}
