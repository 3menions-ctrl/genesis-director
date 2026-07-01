/**
 * WorldChat — the global Lobby chat room.
 *
 * A single realtime room every signed-in user shares. Modern messenger feel:
 * grouped messages (consecutive posts from the same author collapse), gradient
 * avatars, animated entrance, inline image attachments with a full-screen
 * lightbox, and a glassy composer with an image-upload button. Auto-scrolls to
 * the newest message unless the user has scrolled up to read history. Matches
 * the Lobby's borderless glass aesthetic.
 */
import { useMemo, useRef, useState, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { Send, MessagesSquare, Loader2, LogIn, ImagePlus, X, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useWorldChat, type WorldChatMessage } from "@/hooks/useWorldChat";
import { confirmAsync } from "@/components/ui/global-confirm";
import { cn } from "@/lib/utils";

const MAX_LEN = 500;
const GROUP_WINDOW_MS = 5 * 60 * 1000; // collapse consecutive msgs within 5 min

/** Friendly text for the server-side RPC / upload error codes. */
function errMessage(code: string | undefined): string {
  switch (code) {
    case "rate_limited":
      return "Slow down a moment before sending again.";
    case "account_restricted":
      return "Your account can't post to chat right now.";
    case "auth_required":
      return "Sign in to join the chat.";
    case "empty_message":
      return "Type a message or attach an image first.";
    case "too_large":
      return "Image is too large (max 10 MB).";
    case "not_an_image":
      return "That file isn't an image.";
    default:
      return "Couldn't send — try again.";
  }
}

/** Stable accent per author so names/avatars are visually distinguishable. */
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

interface Row extends WorldChatMessage {
  grouped: boolean; // continuation of the previous author's burst
}

function MessageRow({
  m,
  isOwn,
  onOpenImage,
  onDelete,
}: {
  m: Row;
  isOwn: boolean;
  onOpenImage: (url: string) => void;
  onDelete?: () => void;
}) {
  const name = m.display_name?.trim() || "Director";
  const hue = useMemo(() => authorHue(m.user_id || name), [m.user_id, name]);
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className={cn("group relative flex gap-2.5 px-1.5 transition-colors", m.grouped ? "mt-0.5 py-0.5" : "mt-2.5 py-0.5")}>
      {/* gutter: avatar on a new burst, hover-time on continuations */}
      <div className="w-8 shrink-0">
        {m.grouped ? (
          <span className="flex h-full items-start justify-end pr-0.5 pt-0.5 font-mono text-[8.5px] uppercase tracking-[0.06em] text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100">
            {timeLabel(m.created_at)}
          </span>
        ) : (
          <span
            className="grid h-8 w-8 place-items-center overflow-hidden rounded-full text-[11px] font-semibold text-white ring-2 ring-white/10"
            style={{ background: `linear-gradient(135deg, hsl(${hue} 60% 46%), hsl(${(hue + 45) % 360} 58% 32%))` }}
          >
            {m.avatar_url ? <img src={m.avatar_url} alt="" className="h-full w-full object-cover" /> : initial}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        {!m.grouped && (
          <div className="flex items-baseline gap-2">
            <span
              className="truncate text-[12.5px] font-semibold"
              style={{ color: isOwn ? "hsl(var(--foreground))" : `hsl(${hue} 72% 74%)` }}
            >
              {name}
              {isOwn && <span className="ml-1 text-[10px] font-normal text-muted-foreground">you</span>}
            </span>
            <span className="shrink-0 font-mono text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground/55">
              {timeLabel(m.created_at)}
            </span>
          </div>
        )}

        {m.body && (
          <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-foreground/90">
            {m.body}
          </p>
        )}

        {m.image_url && (
          <button
            type="button"
            onClick={() => onOpenImage(m.image_url!)}
            className="mt-1.5 block overflow-hidden rounded-xl ring-1 ring-white/10 transition-transform hover:-translate-y-px hover:ring-white/25"
          >
            <img
              src={m.image_url}
              alt="Shared"
              loading="lazy"
              className="max-h-52 w-auto max-w-full object-cover"
            />
          </button>
        )}
      </div>

      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete message"
          title="Delete message"
          className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-white/[0.06] text-muted-foreground opacity-0 transition-all hover:bg-[hsl(350_90%_70%/0.18)] hover:text-[hsl(350_90%_72%)] focus:opacity-100 group-hover:opacity-100"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

export function WorldChat({ className }: { className?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { messages, loading, sending, send, uploadImage, deleteMessage, canSend, onlineCount } = useWorldChat();
  const [draft, setDraft] = useState("");
  const [pendingImage, setPendingImage] = useState<{ url: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pinnedToBottom = useRef(true);

  const ownId = user?.id ?? null;

  // Group consecutive messages from the same author within a short window.
  const rows: Row[] = useMemo(() => {
    return messages.map((m, i) => {
      const prev = messages[i - 1];
      const grouped =
        !!prev &&
        prev.user_id === m.user_id &&
        prev.user_id != null &&
        new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < GROUP_WINDOW_MS;
      return { ...m, grouped };
    });
  }, [messages]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    pinnedToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 90;
  };

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && pinnedToBottom.current) el.scrollTop = el.scrollHeight;
  }, [rows, pendingImage]);

  const pickImage = () => {
    if (!canSend) {
      navigate("/auth?next=/lobby");
      return;
    }
    fileRef.current?.click();
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setUploading(true);
    const res = await uploadImage(file);
    setUploading(false);
    if (res.error || !res.url) {
      toast.error(errMessage(res.error));
      return;
    }
    setPendingImage({ url: res.url, name: file.name });
  };

  const submit = async () => {
    const body = draft.trim();
    if ((!body && !pendingImage) || sending || uploading) return;
    if (!canSend) {
      navigate("/auth?next=/lobby");
      return;
    }
    const img = pendingImage?.url ?? null;
    setDraft("");
    setPendingImage(null);
    pinnedToBottom.current = true;
    const res = await send(body, img);
    if (!res.ok) {
      setDraft(body); // restore text so it isn't lost
      if (img) setPendingImage(pendingImage);
      toast.error(errMessage(res.error));
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  const handleDelete = async (id: number) => {
    const ok = await confirmAsync({
      title: "Delete message?",
      description: "This removes it from the chat for everyone.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    const res = await deleteMessage(id);
    if (!res.ok) toast.error("Couldn't delete — try again.");
  };

  return (
    <div
      data-testid="world-chat"
      className={cn(
        "flex h-[480px] flex-col overflow-hidden rounded-[20px] ring-1 ring-white/[0.06] shadow-[0_24px_60px_-32px_rgba(0,0,0,0.8)]",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.05] px-5 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-white/[0.06] text-foreground/80">
            <MessagesSquare className="h-3.5 w-3.5" />
          </span>
          <div className="leading-tight">
            <div className="font-display text-[13.5px] font-semibold tracking-[-0.01em] text-foreground">World Chat</div>
            <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground/70">the whole building</div>
          </div>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-[hsl(160_60%_50%/0.1)] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.2em] text-[hsl(160_60%_55%)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[hsl(160_60%_50%)] shadow-[0_0_8px_hsl(160_60%_50%)] animate-pulse" />
          {onlineCount > 0 ? `${onlineCount} online` : "live"}
        </span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} onScroll={onScroll} className="scrollbar-hide flex-1 overflow-y-auto px-3.5 py-2">
        {loading ? (
          <div className="flex h-full items-center justify-center text-muted-foreground/50">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-4 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/[0.05] text-foreground/60">
              <MessagesSquare className="h-5 w-5" />
            </span>
            <p className="mt-3 text-[13px] font-semibold text-foreground">Say hello 👋</p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
              Be the first to break the silence — every director in the building sees this.
            </p>
          </div>
        ) : (
          <div className="flex flex-col pb-1">
            <AnimatePresence initial={false}>
              {rows.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                >
                  <MessageRow
                    m={m}
                    isOwn={!!ownId && m.user_id === ownId}
                    onOpenImage={setLightbox}
                    onDelete={!!ownId && m.user_id === ownId ? () => handleDelete(m.id) : undefined}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="px-3 pb-3 pt-2">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
        {canSend ? (
          <div className="rounded-2xl bg-white/[0.04] px-2 py-2 transition-colors focus-within:bg-white/[0.07]">
            {/* pending image preview */}
            {pendingImage && (
              <div className="mb-2 ml-1 inline-flex items-center gap-2 rounded-xl bg-white/[0.05] p-1 pr-2">
                <img src={pendingImage.url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                <span className="max-w-[120px] truncate text-[11px] text-muted-foreground">{pendingImage.name}</span>
                <button
                  type="button"
                  onClick={() => setPendingImage(null)}
                  className="grid h-5 w-5 place-items-center rounded-full bg-white/[0.08] text-muted-foreground hover:bg-white/[0.16] hover:text-foreground"
                  aria-label="Remove image"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            <div className="flex items-end gap-1.5">
              <button
                type="button"
                onClick={pickImage}
                disabled={uploading}
                aria-label="Attach image"
                title="Attach image"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground disabled:opacity-50"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              </button>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value.slice(0, MAX_LEN))}
                onKeyDown={onKeyDown}
                rows={1}
                placeholder="Message the lobby…"
                className="scrollbar-hide max-h-24 min-h-[24px] flex-1 resize-none self-center bg-transparent py-1 text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void submit()}
                disabled={(!draft.trim() && !pendingImage) || sending || uploading}
                aria-label="Send message"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-[#08090d] transition-transform enabled:hover:-translate-y-px disabled:opacity-40"
              >
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => navigate("/auth?next=/lobby")}
            className="flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
          >
            <LogIn className="h-3.5 w-3.5" />
            Sign in to join the conversation →
          </button>
        )}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightbox(null)}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
          >
            <button
              type="button"
              onClick={() => setLightbox(null)}
              aria-label="Close"
              className="absolute right-5 top-5 grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
            >
              <X className="h-4 w-4" />
            </button>
            <motion.img
              initial={{ scale: 0.96 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.96 }}
              src={lightbox}
              alt="Shared"
              onClick={(e) => e.stopPropagation()}
              className="max-h-[88vh] max-w-[88vw] rounded-2xl object-contain shadow-2xl"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
