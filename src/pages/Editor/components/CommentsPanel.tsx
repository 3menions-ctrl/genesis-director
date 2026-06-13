/**
 * CommentsPanel — comments pinned to timecodes for review workflows.
 *
 * Floating bottom-left drawer. Loads from supabase project_comments
 * + subscribes to realtime INSERTs so collaborators see new
 * comments instantly. Composer at the bottom; toggle "pin to
 * timecode" to prefix the message with the current playhead as
 * [mm:ss]. Clicking that timecode in the comment list seeks the
 * editor's playhead back to that frame.
 *
 * Press C to open + focus the composer. Esc closes.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CornerDownLeft,
  Pin,
  Send,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TYPE_META } from "@/lib/design-system";
import { Surface, SurfaceHeader, SurfaceBody } from "./Surface";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { setPlayhead } from "@/lib/editor/store";
import { toast } from "sonner";

interface Props {
  projectId: string;
  open: boolean;
  onClose: () => void;
  playheadSec: number;
}

interface CommentRow {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  reply_to_id: string | null;
}

interface AuthorMeta {
  displayName: string | null;
  avatarUrl: string | null;
}

const TC_PATTERN = /^\[(\d+):(\d{2})\]\s*/;

function fmtTC(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function parseTimecode(content: string): { tcSec: number | null; body: string } {
  const m = content.match(TC_PATTERN);
  if (!m) return { tcSec: null, body: content };
  return {
    tcSec: parseInt(m[1], 10) * 60 + parseInt(m[2], 10),
    body: content.slice(m[0].length),
  };
}

function relativeTime(iso: string): string {
  const d = new Date(iso).getTime();
  const now = Date.now();
  const diff = (now - d) / 1000;
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export function CommentsPanel({ projectId, open, onClose, playheadSec }: Props) {
  const { user, profile } = useAuth();
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [authors, setAuthors] = useState<Record<string, AuthorMeta>>({});
  const [content, setContent] = useState("");
  const [pinTC, setPinTC] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Load + subscribe
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoading(true);
    void supabase
      .from("project_comments")
      .select("id, user_id, content, created_at, reply_to_id")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (cancelled) return;
        setComments((data as CommentRow[]) ?? []);
        setLoading(false);
      });

    const channel = supabase
      .channel(`comments-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "project_comments",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          const row = payload.new as CommentRow;
          setComments((prev) =>
            prev.some((c) => c.id === row.id) ? prev : [...prev, row],
          );
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [projectId]);

  // Hydrate author meta (display_name + avatar_url) for unique authors
  useEffect(() => {
    const need = new Set<string>();
    for (const c of comments) {
      if (!authors[c.user_id]) need.add(c.user_id);
    }
    if (need.size === 0) return;
    void supabase
      .from("profiles_public")
      .select("id, display_name, avatar_url")
      .in("id", Array.from(need))
      .then(({ data }) => {
        if (!data) return;
        const next: Record<string, AuthorMeta> = { ...authors };
        for (const p of data as Array<{
          id: string;
          display_name: string | null;
          avatar_url: string | null;
        }>) {
          next[p.id] = {
            displayName: p.display_name,
            avatarUrl: p.avatar_url,
          };
        }
        setAuthors(next);
      });
    // intentional: authors is updated by this effect, so referencing
    // it in the dep array would loop. We only run on `comments` length
    // change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comments]);

  // C opens the panel + focuses the composer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        if (!open) {
          // The caller (EditorShell) listens for the toggle separately;
          // we still focus the composer if we're already open.
        }
        composerRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Esc closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Scroll to bottom when comments arrive while panel is open
  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [comments.length, open]);

  const post = useCallback(async () => {
    const trimmed = content.trim();
    if (!trimmed || !user) return;
    setSubmitting(true);
    const body =
      pinTC && playheadSec > 0
        ? `[${fmtTC(playheadSec)}] ${trimmed}`
        : trimmed;
    try {
      const { error } = await supabase.from("project_comments").insert({
        project_id: projectId,
        user_id: user.id,
        content: body,
      });
      if (error) throw error;
      setContent("");
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[CommentsPanel] post failed", e);
      toast.error(
        e instanceof Error ? e.message : "Couldn't post the comment",
      );
    } finally {
      setSubmitting(false);
    }
  }, [content, user, pinTC, playheadSec, projectId]);

  // For the avatar of the current user
  const myAvatar = profile?.avatar_url ?? null;
  const myName = profile?.display_name ?? user?.email?.split("@")[0] ?? "You";

  // Memoize parsed comments for rendering
  const rendered = useMemo(
    () =>
      comments.map((c) => ({
        ...c,
        ...parseTimecode(c.content),
      })),
    [comments],
  );

  return (
    <Surface open={open} onClose={onClose} size="sm" blockEscClose>
      <SurfaceHeader
        eyebrow="◆ Comments"
        title={
          comments.length === 0
            ? "Be the first."
            : `${comments.length} ${comments.length === 1 ? "note" : "notes"}.`
        }
        description="Frame-pinned notes for review."
        onClose={onClose}
      />

      <SurfaceBody noPadding className="px-5 py-4" >
        <div
          ref={listRef}
        >
            {loading ? (
              <div className="py-8 text-center">
                <Loader2 className="h-5 w-5 text-accent/65 animate-spin mx-auto" strokeWidth={1.5} />
              </div>
            ) : rendered.length === 0 ? (
              <p className={cn(TYPE_META, "text-muted-foreground/55 px-1 py-4")}>
                No comments yet. Drop a note pinned to the current frame.
              </p>
            ) : (
              <ul className="space-y-4">
                {rendered.map((c) => {
                  const author = authors[c.user_id];
                  const name = author?.displayName ?? "Director";
                  return (
                    <li key={c.id} className="flex gap-3">
                      <Avatar
                        name={name}
                        avatarUrl={author?.avatarUrl ?? null}
                      />
                      <div className="min-w-0 flex-1">
                        <div className={cn(TYPE_META, "text-muted-foreground/65 flex items-center gap-2")}>
                          <span className="text-foreground/85">{name}</span>
                          <span className="text-muted-foreground/35">·</span>
                          <span>{relativeTime(c.created_at)}</span>
                          {c.tcSec !== null && (
                            <>
                              <span className="text-muted-foreground/35">·</span>
                              <button
                                type="button"
                                onClick={() => {
                                  if (c.tcSec !== null) setPlayhead(c.tcSec);
                                }}
                                className="font-mono tabular-nums text-accent hover:text-foreground transition-colors"
                              >
                                @{fmtTC(c.tcSec)}
                              </button>
                            </>
                          )}
                        </div>
                        <p className="mt-1 text-[13.5px] leading-snug text-foreground/90 whitespace-pre-wrap">
                          {c.body}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
        </div>
      </SurfaceBody>

      {/* Composer */}
      <div className="relative shrink-0 px-5 pt-3.5 pb-4">
        <span
          aria-hidden
          className="absolute left-5 right-5 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent"
        />
        <div className="flex items-start gap-3">
              <Avatar name={myName} avatarUrl={myAvatar} />
              <div className="min-w-0 flex-1">
                <textarea
                  ref={composerRef}
                  rows={2}
                  value={content}
                  onChange={(e) => setContent(e.target.value.slice(0, 600))}
                  placeholder="Drop a note for the team…"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      void post();
                    }
                  }}
                  className={cn(
                    "block w-full resize-none bg-transparent outline-none",
                    "text-[13.5px] leading-snug text-foreground placeholder:text-foreground/35",
                    "border-b border-white/[0.06] focus:border-accent/60 pb-1.5",
                    "caret-accent",
                  )}
                />
                <div className="mt-2 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setPinTC((p) => !p)}
                    className={cn(
                      "inline-flex items-center gap-1.5 text-[11px] transition-colors",
                      pinTC ? "text-accent" : "text-muted-foreground/55 hover:text-foreground",
                    )}
                  >
                    <Pin className="h-3 w-3" strokeWidth={1.5} />
                    <span>
                      Pin @ {fmtTC(playheadSec)}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void post()}
                    disabled={submitting || !content.trim() || !user}
                    className={cn(
                      "inline-flex items-center gap-1.5 text-[12.5px] text-accent transition-opacity",
                      "disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-85",
                    )}
                  >
                    {submitting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
                    ) : (
                      <Send className="h-3.5 w-3.5" strokeWidth={1.5} />
                    )}
                    <span>{submitting ? "Posting…" : "Post"}</span>
                    <span className={cn(TYPE_META, "text-muted-foreground/40 font-mono")}>
                      ⌘<CornerDownLeft className="inline h-2.5 w-2.5 ml-0.5" strokeWidth={2} />
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
    </Surface>
  );
}

function Avatar({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl: string | null;
}) {
  return (
    <div className="shrink-0 h-7 w-7 rounded-full overflow-hidden ring-1 ring-white/[0.10] bg-gradient-to-br from-white/[0.05] to-[hsl(220_30%_8%)]">
      {avatarUrl ? (
        <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-[10px] font-display italic text-foreground/85" style={{ fontFamily: "'Fraunces', serif" }}>
          {name.charAt(0).toUpperCase()}
        </div>
      )}
    </div>
  );
}
