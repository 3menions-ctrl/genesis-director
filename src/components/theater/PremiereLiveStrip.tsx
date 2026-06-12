/**
 * PremiereLiveStrip — overlay shown on the Theater page while a premiere
 * is live. Displays an animated "Live" pill, a live viewer count, and
 * a stream of reactions flowing across the bottom of the player.
 *
 * Reactions come from the `premiere_reactions` table; we subscribe via
 * Supabase realtime so new emoji arrive in real time. Sender presence
 * uses the `realtime_presence` channel — every viewer of this premiere
 * is counted, including anonymous ones.
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AnimatedCounter } from "@/components/ui/animated-counter";

interface Props {
  premiereId: string;
  /** Optional: skip presence (heavier RT subscription) on small surfaces. */
  withPresence?: boolean;
}

const FLOAT_COUNT_MAX = 24;

interface Floater {
  id: string;
  emoji: string;
  x: number; // 0-100
  born: number;
}

export function PremiereLiveStrip({ premiereId, withPresence = true }: Props) {
  const [floats, setFloats] = useState<Floater[]>([]);
  const [viewerCount, setViewerCount] = useState(1);

  // Subscribe to new reactions for this premiere.
  useEffect(() => {
    const channel = supabase
      .channel(`premiere-reactions-${premiereId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "premiere_reactions",
          filter: `premiere_id=eq.${premiereId}`,
        },
        (payload) => {
          const row = (payload as unknown as { new?: { id: number; emoji?: string } }).new;
          if (!row?.emoji) return;
          const f: Floater = {
            id: `${row.id}-${Date.now()}`,
            emoji: row.emoji,
            x: 5 + Math.random() * 90,
            born: Date.now(),
          };
          setFloats((arr) => [...arr.slice(-FLOAT_COUNT_MAX + 1), f]);
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [premiereId]);

  // Presence (live viewer count) via Supabase realtime presence channel.
  useEffect(() => {
    if (!withPresence) return;
    const ch = supabase.channel(`premiere-presence-${premiereId}`, {
      config: { presence: { key: crypto.randomUUID() } },
    });
    ch
      .on("presence", { event: "sync" }, () => {
        const state = ch.presenceState();
        const count = Object.keys(state).reduce((sum, k) => sum + state[k].length, 0);
        setViewerCount(Math.max(count, 1));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await ch.track({ at: new Date().toISOString() });
        }
      });
    return () => { void supabase.removeChannel(ch); };
  }, [premiereId, withPresence]);

  // Garbage-collect floaters after 3s so the DOM doesn't grow.
  useEffect(() => {
    const id = setInterval(() => {
      const cutoff = Date.now() - 3000;
      setFloats((arr) => arr.filter((f) => f.born > cutoff));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      {/* Live + viewer count badge */}
      <div className="absolute top-4 left-4 flex items-center gap-3 pointer-events-auto">
        <span className="inline-flex items-center gap-2 rounded-full bg-destructive/90 px-3 py-1 backdrop-blur-md">
          <span aria-hidden className="relative w-2 h-2 rounded-full bg-white">
            <span className="absolute inset-0 rounded-full bg-white animate-ping" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-white">
            Live
          </span>
        </span>

        <span className="inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1 backdrop-blur-md text-white text-xs">
          <Eye className="w-3.5 h-3.5" aria-hidden />
          <AnimatedCounter value={viewerCount} className="font-mono tabular-nums" />
          <span className="text-white/70">watching</span>
        </span>
      </div>

      {/* Floating reactions */}
      <AnimatePresence>
        {floats.map((f) => (
          <motion.span
            key={f.id}
            initial={{ y: 60, opacity: 0, scale: 0.6 }}
            animate={{ y: -160, opacity: [0, 1, 1, 0], scale: [0.6, 1.15, 1, 1] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2.8, ease: "easeOut" }}
            className="absolute bottom-8 select-none text-3xl"
            style={{ left: `${f.x}%` }}
            aria-hidden
          >
            {f.emoji}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}
