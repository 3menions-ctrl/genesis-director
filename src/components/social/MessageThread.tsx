/**
 * MessageThread — a full-page (portaled, above the tab bar) DM conversation.
 *
 * Reads via useDirectMessages (realtime), sends via send_direct_message. Read
 * receipts: on mount it marks the other person's messages to me as read
 * (direct_messages.read_at); my own bubbles show ✓ Sent / ✓✓ Read based on the
 * recipient's read_at. Borderless/floating; send is an icon in a translucent
 * container.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, Send, Loader2, MessageCircle, Check, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDirectMessages } from '@/hooks/useSocial';
import { AuroraBackdrop } from '@/components/native/AuroraBackdrop';
import { hapticTap } from '@/lib/native/shell';
import { cn } from '@/lib/utils';

export function MessageThread({ recipientId, name, avatar, onClose }: { recipientId: string; name: string; avatar: string | null; onClose: () => void }) {
  const { user } = useAuth();
  const { messages, messagesLoading, sendMessage } = useDirectMessages(recipientId);
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const list = messages ?? [];

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [list.length]);

  // Read receipts: mark their messages to me as read when the thread opens.
  useEffect(() => {
    if (!user || !recipientId) return;
    (async () => {
      try {
        await supabase.from('direct_messages' as never).update({ read_at: new Date().toISOString() } as never)
          .eq('recipient_id', user.id).eq('sender_id', recipientId).is('read_at', null);
      } catch { /* best-effort */ }
    })();
  }, [user, recipientId, list.length]);

  const send = async () => {
    const body = text.trim();
    if (!body || sendMessage.isPending) return;
    void hapticTap();
    setText('');
    try { await sendMessage.mutateAsync({ recipientId, content: body }); }
    catch (e) { setText(body); toast.error(e instanceof Error ? e.message : 'Could not send'); }
  };

  const lastMineRead = [...list].reverse().find((m) => m.sender_id === user?.id)?.read_at != null;

  return createPortal((
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#0a0a0f] text-white">
      <AuroraBackdrop />

      <div className="relative z-10 flex items-center gap-3 px-4 pb-3" style={{ paddingTop: 'calc(var(--safe-top,0px) + 12px)' }}>
        <button onClick={onClose} aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.06] backdrop-blur-md"><ChevronLeft className="h-5 w-5" /></button>
        {avatar ? <img src={avatar} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-[#9c8bff] to-[#6b3bff] text-[13px] font-bold">{name[0]?.toUpperCase()}</span>}
        <span className="font-display text-[16px] font-semibold">{name}</span>
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto px-4 py-2">
        {messagesLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-white/40" /></div>
        ) : list.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-white/40">
            <MessageCircle className="h-8 w-8" strokeWidth={1.4} /><span className="text-[13px]">Say hello to {name}.</span>
          </div>
        ) : (
          <div className="space-y-2 pb-2">
            {list.map((m) => {
              const mine = m.sender_id === user?.id;
              return (
                <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                  <div className={cn('max-w-[78%] rounded-[20px] px-4 py-2.5 text-[14.5px] leading-snug',
                    mine ? 'rounded-br-md bg-gradient-to-br from-[#2f6bff] to-[#6b3bff] text-white' : 'surface-1 rounded-bl-md text-white/90')}>
                    {m.content}
                  </div>
                </div>
              );
            })}
            {/* iMessage-style receipt under the last of my messages */}
            {list.some((m) => m.sender_id === user?.id) && (
              <div className="flex items-center justify-end gap-1 pr-1 pt-0.5 text-[10px] text-white/45">
                {lastMineRead ? <><CheckCheck className="h-3 w-3 text-[#8fb4ff]" />Read</> : <><Check className="h-3 w-3" />Sent</>}
              </div>
            )}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <div className="relative z-10 flex items-center gap-2 px-4 pt-2" style={{ paddingBottom: 'calc(var(--safe-bottom,0px) + 12px)' }}>
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send(); }} autoFocus
          placeholder={`Message ${name}…`} className="surface-1 h-12 flex-1 rounded-full bg-transparent px-4 text-[15px] text-white outline-none placeholder:text-white/35" />
        <button onClick={send} disabled={!text.trim() || sendMessage.isPending} aria-label="Send"
          className="surface-1 grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-[#8fb4ff] transition-transform active:scale-95 disabled:opacity-40">
          {sendMessage.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-[20px] w-[20px]" />}
        </button>
      </div>
    </div>
  ), document.body);
}
