/**
 * WorldChat — the global Lobby chat room.
 *
 * A single realtime room every signed-in user shares. Twitch/Discord-style:
 * a scrolling message list (avatar · name · time · body) with a composer at the
 * bottom. Auto-scrolls to the newest message unless the user has scrolled up to
 * read history. Matches the Lobby's borderless glass aesthetic.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Send, MessagesSquare, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useWorldChat, type WorldChatMessage } from "@/hooks/useWorldChat";
import { cn } from "@/lib/utils";

const MAX_LEN = 500;

/** Friendly text for the server-side RPC error codes. */
function sendErrorMessage(code: string | undefined): string {
  switch (code) {
    case "rate_limited":
      return "Slow down a moment before sending again.";
    case "account_restricted":
      return "Your account can't post to chat right now.";
    case "auth_required":
      return "Sign in to join the chat.";
    case "empty_message":
      return "Type a message first.";
    default:
      return "Couldn't send — try again.";
  }
}

/** Stable accent per author so names are visually distinguishable. */
function authorHue(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 360;
  return h;
}

function timeLabel(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

function MessageRow({ m, isOwn }: { m: WorldChatMessage; isOwn: boolean }) {
  const name = m.display_name?.trim() || "Director";
  const hue = useMemo(() => authorHue(m.user_id || name), [m.user_id, name]);
  const initial = name.charAt(0).toUpperCase();
  return (
    <div className="group flex gap-2.5 px-1 py-1.5">
      <span
        className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full text-[11px] font-semibold text-white"
        style={{ background: `linear-gradient(135deg, hsl(${hue} 55% 42%), hsl(${(hue + 40) % 360} 55% 30%))` }}
      >
        {m.avatar_url ? (
          <img src={m.avatar_url} alt="" className="h-full w-full object-cover" />
        ) : (
          initial
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span
            className="truncate text-[12.5px] font-semibold"
            style={{ color: isOwn ? "hsl(var(--foreground))" : `hsl(${hue} 70% 72%)` }}
          >
            {name}
            {isOwn && <span className="ml-1 text-[10px] font-normal text-muted-foreground">you</span>}
          </span>
          <span className="shrink-0 font-mono text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100">
            {timeLabel(m.created_at)}
          </span>
        </div>
        <p className="mt-0.5 break-words text-[13px] leading-relaxed text-foreground/90">{m.body}</p>
      </div>
    </div>
  );
}

export function WorldChat({ className }: { className?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { messages, loading, sending, send, canSend, onlineCount } = useWorldChat();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinnedToBottom = useRef(true);

  // Track whether the user is reading history (scrolled up) so realtime
  // messages don't yank them down.
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    pinnedToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && pinnedToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Stamp the user id once it's known so we never read it during render churn.
  const ownId = user?.id ?? null;

  const submit = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    if (!canSend) {
      navigate("/auth?next=/lobby");
      return;
    }
    setDraft("");
    pinnedToBottom.current = true;
    const res = await send(body);
    if (!res.ok) {
      setDraft(body); // restore so the user doesn't lose their text
      toast.error(sendErrorMessage(res.error));
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <div
      data-testid="world-chat"
      className={cn(
        "flex h-[460px] flex-col overflow-hidden rounded-[18px] shadow-[0_20px_48px_-28px_rgba(0,0,0,0.7)]",
        className
      )}
      style={{ background: "linear-gradient(180deg, hsl(0 0% 100% / .04), hsl(0 0% 100% / .012))" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          <MessagesSquare className="h-3.5 w-3.5" />
          World Chat
        </div>
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(160_60%_50%)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[hsl(160_60%_50%)] shadow-[0_0_8px_hsl(160_60%_50%)] animate-pulse" />
          {onlineCount > 0 ? `${onlineCount} online` : "live"}
        </span>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="scrollbar-hide flex-1 overflow-y-auto px-4 pb-2"
      >
        {loading ? (
          <div className="flex h-full items-center justify-center text-muted-foreground/50">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-4 text-center">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-white/[0.05] text-foreground/60">
              <MessagesSquare className="h-5 w-5" />
            </span>
            <p className="mt-3 text-[13px] font-medium text-foreground">Say hello 👋</p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
              Be the first to break the silence — every director in the building sees this.
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {messages.map((m) => (
              <MessageRow key={m.id} m={m} isOwn={!!ownId && m.user_id === ownId} />
            ))}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="px-3 pb-3 pt-2">
        {canSend ? (
          <div className="flex items-end gap-2 rounded-2xl bg-white/[0.04] px-3 py-2 transition-colors focus-within:bg-white/[0.07]">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, MAX_LEN))}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder="Message the lobby…"
              className="scrollbar-hide max-h-24 min-h-[22px] flex-1 resize-none bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!draft.trim() || sending}
              aria-label="Send message"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-[#08090d] transition-transform enabled:hover:-translate-y-px disabled:opacity-40"
            >
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => navigate("/auth?next=/lobby")}
            className="w-full rounded-2xl bg-white/[0.04] px-4 py-3 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
          >
            Sign in to join the conversation →
          </button>
        )}
      </div>
    </div>
  );
}
