/**
 * ReelComments — text comments under a published reel.
 *
 * Sits below the action rail in the Theater. Top-level only (no threading)
 * to keep the surface light. Composes:
 *
 *   • Compose box at the top — only when signed in.
 *   • List below — newest first.
 *   • Per-comment: avatar, name, body, like button, relative timestamp.
 *
 * Wired to three RPCs from migration 20260613000000:
 *   • reel_comments_for(reel_id, cursor, limit)
 *   • add_reel_comment(reel_id, body)
 *   • toggle_like_reel_comment(comment_id)
 *
 * Optimistic add: the new comment is prepended immediately on submit; if
 * the RPC fails the row is removed and an error toast surfaces.
 */
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Heart, MessageCircle, Send, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSafeNavigation } from "@/lib/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Author {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface Comment {
  id: string;
  reel_id: string;
  author_id: string;
  body: string;
  like_count: number;
  created_at: string;
  author: Author;
  viewer_liked: boolean;
}

interface Props {
  reelId: string;
}

const PAGE_SIZE = 30;

export const ReelComments = memo(function ReelComments({ reelId }: Props) {
  const { user } = useAuth();
  const { navigate } = useSafeNavigation();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async (cursor?: string) => {
    if (!cursor) setLoading(true);
    try {
      const { data, error } = await supabase.rpc("reel_comments_for" as never, {
        p_reel_id: reelId,
        p_cursor: cursor ?? null,
        p_limit: PAGE_SIZE,
      } as never);
      if (error) throw error;
      const arr = (data as unknown as Comment[]) ?? [];
      if (cursor) {
        setComments((prev) => [...prev, ...arr]);
      } else {
        setComments(arr);
      }
      if (arr.length < PAGE_SIZE) setExhausted(true);
    } catch (e) {
      console.warn("[ReelComments] load failed", e);
    } finally {
      setLoading(false);
    }
  }, [reelId]);

  useEffect(() => { void load(); }, [load]);

  const submit = async () => {
    if (!user) { navigate("/auth"); return; }
    const body = draft.trim();
    if (body.length === 0 || posting) return;
    if (body.length > 1000) {
      toast.error("Comment is too long (max 1,000 characters)");
      return;
    }
    setPosting(true);

    // Optimistic prepend.
    const tempId = `tmp-${Date.now()}`;
    const optimistic: Comment = {
      id: tempId,
      reel_id: reelId,
      author_id: user.id,
      body,
      like_count: 0,
      created_at: new Date().toISOString(),
      author: {
        id: user.id,
        // Best-effort placeholder; the real row comes back with proper display name.
        display_name: (user.user_metadata?.display_name as string | undefined) ?? user.email ?? "You",
        avatar_url: (user.user_metadata?.avatar_url as string | undefined) ?? null,
      },
      viewer_liked: false,
    };
    setComments((prev) => [optimistic, ...prev]);
    setDraft("");

    try {
      const { data, error } = await supabase.rpc("add_reel_comment" as never, {
        p_reel_id: reelId, p_body: body,
      } as never);
      if (error) throw error;
      const fresh = data as unknown as Comment;
      setComments((prev) => prev.map((c) => (c.id === tempId ? { ...fresh, viewer_liked: false } : c)));
    } catch (e) {
      // Roll back.
      setComments((prev) => prev.filter((c) => c.id !== tempId));
      setDraft(body); // restore so the user doesn't lose their text
      const msg = e instanceof Error ? e.message : "Comment failed";
      toast.error(msg.includes("too_long") ? "Comment is too long" : msg);
    } finally {
      setPosting(false);
    }
  };

  const toggleLike = async (c: Comment) => {
    if (!user) { navigate("/auth"); return; }
    // Optimistic.
    setComments((prev) => prev.map((row) => row.id === c.id
      ? { ...row, viewer_liked: !row.viewer_liked, like_count: row.like_count + (row.viewer_liked ? -1 : 1) }
      : row));
    try {
      const { data, error } = await supabase.rpc("toggle_like_reel_comment" as never, {
        p_comment_id: c.id,
      } as never);
      if (error) throw error;
      const out = data as unknown as { liked: boolean; like_count: number };
      setComments((prev) => prev.map((row) => row.id === c.id
        ? { ...row, viewer_liked: out.liked, like_count: Number(out.like_count) }
        : row));
    } catch (e) {
      // Rollback.
      setComments((prev) => prev.map((row) => row.id === c.id
        ? { ...row, viewer_liked: c.viewer_liked, like_count: c.like_count }
        : row));
      toast.error(e instanceof Error ? e.message : "Like failed");
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <section className="mt-10 mb-12">
      <div className="flex items-center gap-3 mb-5">
        <MessageCircle className="w-3.5 h-3.5 text-primary/80" />
        <span className="text-[11px] font-mono uppercase tracking-[0.32em] text-foreground/65">Comments</span>
        <div className="h-px flex-1 bg-gradient-to-r from-white/[0.07] to-transparent" />
        <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/50">
          {comments.length}
        </span>
      </div>

      {/* Compose */}
      {user ? (
        <div className="mb-6 p-4 rounded-2xl border border-white/[0.06] bg-white/[0.015]">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            placeholder="Say something about this reel…"
            rows={2}
            maxLength={1000}
            className="w-full bg-transparent text-[14px] text-white placeholder:text-white/30 resize-none outline-none"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] font-mono text-white/30 tabular-nums">
              {draft.length}/1000
            </span>
            <button
              onClick={() => void submit()}
              disabled={posting || draft.trim().length === 0}
              className={cn(
                "inline-flex items-center gap-1.5 h-8 px-4 rounded-full text-[11px] font-mono uppercase tracking-[0.22em] transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
                "bg-white text-black hover:bg-white/90",
              )}
            >
              {posting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              Post
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-6 p-4 rounded-2xl border border-white/[0.06] bg-white/[0.015] text-center">
          <button
            onClick={() => navigate("/auth")}
            className="text-[12px] text-white/65 hover:text-white"
          >
            Sign in to leave a comment.
          </button>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-8 gap-3 text-white/45">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span className="text-[11px] font-mono uppercase tracking-[0.22em]">Loading comments…</span>
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-10 text-[12px] text-white/45 font-light">
          No comments yet. Be the first.
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {comments.map((c) => (
              <motion.div
                key={c.id}
                layout
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="flex gap-3 p-4 rounded-2xl border border-white/[0.05] hover:border-white/[0.10] hover:bg-white/[0.015] transition-colors"
              >
                <Link to={`/c/${c.author.id}`} className="shrink-0">
                  {c.author.avatar_url ? (
                    <img src={c.author.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-glass-hover border border-white/[0.08] flex items-center justify-center text-[12px] font-mono text-white/55">
                      {(c.author.display_name?.[0] || "?").toUpperCase()}
                    </div>
                  )}
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Link
                      to={`/c/${c.author.id}`}
                      className="text-[12px] text-white font-light hover:underline underline-offset-2 truncate"
                    >
                      {c.author.display_name ?? "Anonymous"}
                    </Link>
                    <span className="text-[10px] font-mono text-white/30">
                      {formatRelative(c.created_at)}
                    </span>
                  </div>
                  <p className="text-[13px] text-white/85 leading-relaxed whitespace-pre-wrap break-words">
                    {c.body}
                  </p>
                  <div className="mt-2 flex items-center gap-3">
                    <button
                      onClick={() => void toggleLike(c)}
                      className={cn(
                        "inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.22em] transition-colors",
                        c.viewer_liked ? "text-rose-300" : "text-white/40 hover:text-white",
                      )}
                    >
                      <Heart className={cn("w-3 h-3", c.viewer_liked && "fill-current")} />
                      {c.like_count > 0 ? c.like_count.toLocaleString() : "Like"}
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {!exhausted && comments.length >= PAGE_SIZE && (
            <button
              onClick={() => void load(comments[comments.length - 1]?.created_at)}
              className="w-full py-3 rounded-2xl border border-white/[0.06] text-[11px] font-mono uppercase tracking-[0.22em] text-white/55 hover:text-white hover:border-white/20 transition-colors"
            >
              Load more
            </button>
          )}
        </div>
      )}
    </section>
  );
});

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (isNaN(t)) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (seconds < 60) return "just now";
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
