/**
 * Messages — the mobile inbox: all DM conversations, newest first, with unread
 * badges. Tap a row to open the full-page thread (read receipts there). Aurora
 * backdrop, borderless/floating.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, MessageCircle, Loader2 } from 'lucide-react';
import { AuroraBackdrop } from '@/components/native/AuroraBackdrop';
import { MessageThread } from '@/components/social/MessageThread';
import { useInbox, type Conversation } from '@/hooks/useInbox';
import { hapticTap } from '@/lib/native/shell';
import { cn } from '@/lib/utils';

function ago(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return `${Math.floor(s / 604800)}w`;
}

export default function Messages() {
  const navigate = useNavigate();
  const { items, loading, reload } = useInbox();
  const [open, setOpen] = useState<Conversation | null>(null);

  return (
    <div className="fixed inset-0 overflow-y-auto text-white">
      <AuroraBackdrop />

      <div className="relative z-10 flex items-center gap-3 px-4 pb-3" style={{ paddingTop: 'calc(var(--safe-top,0px) + 12px)' }}>
        <button onClick={() => navigate(-1)} aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.06] backdrop-blur-md"><ChevronLeft className="h-5 w-5" /></button>
        <h1 className="font-display text-[20px] font-semibold">Messages</h1>
      </div>

      <div className="relative z-10 px-3" style={{ paddingBottom: 'calc(var(--safe-bottom,0px) + var(--tabbar-h,0px) + 24px)' }}>
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-white/40" /></div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-20 text-center text-white/40">
            <MessageCircle className="h-9 w-9" strokeWidth={1.3} />
            <span className="text-[13px]">No messages yet.</span>
            <span className="text-[12px] text-white/30">Open a creator's profile to start a chat.</span>
          </div>
        ) : (
          <ul className="space-y-1">
            {items.map((c) => (
              <li key={c.userId}>
                <button onClick={() => { void hapticTap(); setOpen(c); }} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors active:bg-white/[0.04]">
                  <div className="relative shrink-0">
                    {c.avatar ? <img src={c.avatar} alt="" className="h-[52px] w-[52px] rounded-full object-cover" /> : <span className="grid h-[52px] w-[52px] place-items-center rounded-full bg-gradient-to-br from-[#9c8bff] to-[#6b3bff] text-[17px] font-bold">{(c.name?.[0] ?? '?').toUpperCase()}</span>}
                    {c.unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#2f6bff] px-1 text-[11px] font-bold shadow-[0_0_0_3px_#0a0a0f]">{c.unread}</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={cn('truncate font-display text-[15px]', c.unread > 0 ? 'font-bold text-white' : 'font-semibold text-white/90')}>{c.name ?? 'Anonymous'}</span>
                      <span className="shrink-0 font-mono text-[10.5px] text-white/35">{ago(c.lastAt)}</span>
                    </div>
                    <div className={cn('mt-0.5 truncate text-[13px]', c.unread > 0 ? 'text-white/80' : 'text-white/45')}>{c.mine ? 'You: ' : ''}{c.lastMessage}</div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {open && <MessageThread recipientId={open.userId} name={open.name ?? 'creator'} avatar={open.avatar} onClose={() => { setOpen(null); void reload(); }} />}
    </div>
  );
}
