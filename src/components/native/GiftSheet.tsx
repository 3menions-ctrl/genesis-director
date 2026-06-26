/**
 * GiftSheet — spend credits to send a gift to a creator. Wraps the real
 * `tip_reel` RPC (90% to the creator, auto-notifies them, bumps tip_credits).
 * Gifting a creator credits their reel; the AI-native top gift "Fund a Scene"
 * frames the spend as sponsoring the creator's next generation.
 *
 * Spend-only safe: gifting SPENDS the user's credits (allowed); it never buys.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveCredits } from '@/hooks/useEffectiveCredits';
import { hapticTap } from '@/lib/native/shell';
import { cn } from '@/lib/utils';

export interface Gift { id: string; emoji: string; name: string; cr: number; tag?: string }
export const GIFTS: Gift[] = [
  { id: 'rose', emoji: '🌹', name: 'Rose', cr: 5 },
  { id: 'hype', emoji: '🔥', name: 'Hype', cr: 20 },
  { id: 'bolt', emoji: '⚡', name: 'Bolt', cr: 50 },
  { id: 'star', emoji: '⭐', name: 'Star', cr: 100 },
  { id: 'rocket', emoji: '🚀', name: 'Rocket', cr: 150 },
  { id: 'crown', emoji: '👑', name: 'Crown', cr: 300 },
  { id: 'diamond', emoji: '💎', name: 'Diamond', cr: 500 },
  { id: 'scene', emoji: '🎬', name: 'Fund a Scene', cr: 1000, tag: 'Sponsors their next film' },
];

export function GiftSheet({ open, onClose, reelId, creatorName, onSent }: {
  open: boolean; onClose: () => void; reelId: string | null; creatorName: string; onSent?: (g: Gift) => void;
}) {
  const effective = useEffectiveCredits();
  const available = effective.available ?? 0;
  const [sending, setSending] = useState<string | null>(null);
  const [burst, setBurst] = useState<Gift | null>(null);

  const send = async (g: Gift) => {
    void hapticTap();
    if (!reelId) { toast.error("This creator has nothing to gift on yet."); return; }
    if (available < g.cr) { toast.error(`Need ${g.cr} credits — you have ${available}.`); return; }
    if (sending) return;
    setSending(g.id);
    try {
      const { data, error } = await supabase.rpc('tip_reel' as never, { p_reel_id: reelId, p_credits: g.cr } as never);
      const res = data as unknown as { error?: string } | null;
      if (error || res?.error) throw new Error(res?.error || error?.message || 'Gift failed');
      setBurst(g);
      window.setTimeout(() => setBurst(null), 1500);
      toast.success(`Sent ${g.emoji} ${g.name} to ${creatorName}`);
      void effective.refresh?.();
      onSent?.(g);
      window.setTimeout(onClose, 650);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Gift failed';
      toast.error(msg === 'insufficient_credits' ? 'Not enough credits.' : msg);
    } finally { setSending(null); }
  };

  return (
    <>
      {/* Full-screen burst on send */}
      <AnimatePresence>
        {burst && (
          <div className="pointer-events-none fixed inset-0 z-[80] overflow-hidden">
            {Array.from({ length: 14 }).map((_, i) => (
              <motion.span key={i}
                initial={{ opacity: 0, y: '85vh', x: `${8 + (i * 6.5) % 84}vw`, scale: 0.6 }}
                animate={{ opacity: [0, 1, 1, 0], y: '-12vh', scale: [0.6, 1.25, 1] }}
                transition={{ duration: 1.5, delay: (i % 7) * 0.06, ease: 'easeOut' }}
                className="absolute text-[40px]">{burst.emoji}</motion.span>
            ))}
          </div>
        )}
      </AnimatePresence>

      {open && (
        <div className="fixed inset-0 z-[70]">
          <div onClick={onClose} className="absolute inset-0 bg-black/60" />
          <div className="absolute inset-x-0 bottom-0 rounded-t-[28px] bg-[#0d0d14]/95 px-5 pt-3 backdrop-blur-2xl shadow-[0_-24px_70px_-24px_rgba(0,0,0,.9),inset_0_1px_0_rgba(255,255,255,.08)]" style={{ paddingBottom: 'calc(var(--safe-bottom,0px) + 18px)' }}>
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
            <div className="mb-1 flex items-center justify-between">
              <span className="font-display text-[16px] font-semibold">Send {creatorName} a gift</span>
              <button onClick={onClose} aria-label="Close" className="text-white/50"><X className="h-5 w-5" /></button>
            </div>
            <div className="mb-4 flex items-center gap-1.5 text-[12px] text-white/45"><Sparkles className="h-3.5 w-3.5 text-[#8fb4ff]" /> {available.toLocaleString()} credits · creators keep 90%</div>

            <div className="grid grid-cols-4 gap-2.5">
              {GIFTS.map((g) => {
                const afford = available >= g.cr;
                const isScene = g.id === 'scene';
                return (
                  <button key={g.id} onClick={() => send(g)} disabled={!!sending}
                    className={cn('relative flex flex-col items-center gap-1 rounded-[16px] px-1 py-3 transition-all active:scale-95',
                      isScene ? 'col-span-4 flex-row justify-center gap-3 bg-gradient-to-r from-[#2f6bff]/25 to-[#7a3bff]/25 ring-1 ring-[#7aa2ff]/40' : 'msg-glass',
                      !afford && 'opacity-45')}>
                    <span className={cn(isScene ? 'text-[30px]' : 'text-[28px]')}>{g.emoji}</span>
                    <span className={cn('flex flex-col', isScene ? 'items-start' : 'items-center')}>
                      <span className="font-display text-[12px] font-semibold leading-tight">{g.name}</span>
                      {g.tag && <span className="text-[10.5px] text-white/55">{g.tag}</span>}
                      <span className="font-mono text-[10.5px] text-[#8fb4ff]">{g.cr} cr</span>
                    </span>
                    {sending === g.id && <span className="absolute inset-0 grid place-items-center rounded-[16px] bg-black/40"><Loader2 className="h-5 w-5 animate-spin" /></span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
