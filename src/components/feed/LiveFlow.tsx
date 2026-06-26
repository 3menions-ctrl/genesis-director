/**
 * LiveFlow — TikTok-style "flowing" overlays that live INSIDE the immersive video
 * container, containerless:
 *   • useHeartBurst + HeartLayer — tapping like spawns hearts that pop + float up.
 *   • CommentFlow — recent comments stream up over the video as bare text (no box),
 *     advancing like a live chat ticker.
 *
 * Both render over the video with pointer-events-none so swipe/scroll still works.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Heart } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

/* ── Floating hearts ──────────────────────────────────────────────── */
export function useHeartBurst() {
  const [hearts, setHearts] = useState<{ id: number; x: number }[]>([]);
  const idRef = useRef(0);
  const burst = useCallback((n = 3) => {
    for (let k = 0; k < n; k++) {
      const id = ++idRef.current;
      const x = Math.round((k - (n - 1) / 2) * 14 + (id % 7) - 3);
      window.setTimeout(() => {
        setHearts((h) => [...h.slice(-16), { id, x }]);
        window.setTimeout(() => setHearts((h) => h.filter((z) => z.id !== id)), 1450);
      }, k * 70);
    }
  }, []);
  return { hearts, burst };
}

export function HeartLayer({ hearts, bottom }: { hearts: { id: number; x: number }[]; bottom: string }) {
  return (
    <div className="pointer-events-none absolute right-4 z-30 w-16" style={{ bottom }}>
      {hearts.map((h) => (
        <Heart key={h.id} className="absolute bottom-0 h-7 w-7 animate-[heartFloat_1.45s_ease-out_forwards] fill-[#ff3b6b] stroke-[#ff3b6b] drop-shadow-[0_2px_6px_rgba(0,0,0,.5)]" style={{ left: `calc(50% + ${h.x}px)` }} />
      ))}
    </div>
  );
}

/* ── Flowing comments ─────────────────────────────────────────────── */
interface FlowComment { id: string; name: string; text: string }

export function CommentFlow({ reelId, isStatic, bottom }: { reelId: string | null; isStatic: boolean; bottom: string }) {
  const [all, setAll] = useState<FlowComment[]>([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!reelId || isStatic) { setAll([]); setIdx(0); return; }
    let cancel = false;
    (async () => {
      try {
        const { data } = await supabase.rpc('reel_comments_for' as never, { p_reel_id: reelId, p_cursor: null, p_limit: 12 } as never);
        const rows = (data as unknown as { id: string; body: string; author?: { display_name: string | null } }[]) ?? [];
        // oldest → newest so the stream flows forward
        if (!cancel) { setAll(rows.slice().reverse().map((r) => ({ id: r.id, name: r.author?.display_name ?? 'viewer', text: r.body }))); setIdx(0); }
      } catch { if (!cancel) setAll([]); }
    })();
    return () => { cancel = true; };
  }, [reelId, isStatic]);

  // Advance the stream so comments keep flowing (live-chat feel).
  useEffect(() => {
    if (all.length <= 3) return;
    const t = window.setInterval(() => setIdx((i) => (i + 1) % all.length), 2900);
    return () => window.clearInterval(t);
  }, [all.length]);

  if (!all.length) return null;
  const count = Math.min(3, all.length);
  const visible = Array.from({ length: count }, (_, k) => all[(idx + k) % all.length]);

  return (
    <div className="pointer-events-none absolute left-4 z-10 max-w-[66%]" style={{ bottom }}>
      <div className="flex flex-col gap-1 [mask-image:linear-gradient(to_top,black_45%,transparent)]">
        {visible.map((c, k) => (
          <div key={`${c.id}-${idx}-${k}`} className="animate-[commentRise_.55s_ease-out] text-[13px] leading-snug drop-shadow-[0_1px_5px_rgba(0,0,0,.95)]">
            <span className="font-semibold text-[#9fc6ff]">{c.name}</span>{' '}
            <span className="text-white/85">{c.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
