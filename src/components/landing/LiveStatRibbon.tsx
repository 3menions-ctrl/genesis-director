/**
 * LiveStatRibbon — top-of-page ticker showing real production stats.
 *
 * Polls `landing-stats` every 6 seconds. Reads:
 *   • SHOTS RENDERED TODAY  — total completions in last 24h
 *   • LAST                  — sanitized prompt + age ("rendered 2m ago")
 *   • QUEUE                 — current generating projects
 *
 * Degrades gracefully — when the function isn't deployed or the network
 * dips, the ribbon renders its last-known values (or starter defaults) so
 * the page never looks "broken".
 */

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface LandingStats {
  rendered_today: number;
  queue_depth: number;
  last_prompt: string | null;
  last_completed_ms: number | null;
  render_median_sec: number | null;
}

function formatAgo(ms: number | null): string {
  if (!ms || ms < 0) return 'just now';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ago`;
}

export function LiveStatRibbon() {
  const [stats, setStats] = useState<LandingStats | null>(null);
  const [tick, setTick] = useState(0);

  // Poll live stats.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('landing-stats');
        if (cancelled || error || !data) return;
        setStats(data as LandingStats);
      } catch {
        // swallow — keep last-known values
      }
    };
    void load();
    const id = window.setInterval(load, 6000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  // Tick once a second so the "ago" label feels alive even between polls.
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const rendered = stats?.rendered_today ?? 0;
  const queue = stats?.queue_depth ?? 0;
  const lastPrompt = stats?.last_prompt;
  const ago = stats?.last_completed_ms != null
    ? formatAgo(stats.last_completed_ms + tick * 1000)
    : null;

  return (
    <div className="relative z-40 border-y border-white/[0.05] bg-black/30 backdrop-blur-md">
      <div className="max-w-[1480px] mx-auto px-6 py-3 flex items-center gap-4 sm:gap-6 overflow-hidden">
        {/* Pulse beacon */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="relative inline-flex w-1.5 h-1.5">
            <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping" />
            <span className="relative rounded-full w-1.5 h-1.5 bg-emerald-400" />
          </span>
          <span className="text-[9px] font-mono uppercase tracking-[0.32em] text-emerald-300">
            LIVE
          </span>
        </div>

        {/* Stat: rendered today */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <span className="font-mono tabular-nums text-[12px] text-white">
            {rendered.toLocaleString()}
          </span>
          <span className="text-[9px] font-mono uppercase tracking-[0.32em] text-white/40">
            shots rendered today
          </span>
        </div>
        <span className="hidden sm:inline h-3 w-px bg-white/10 shrink-0" />

        {/* Stat: last completion + sanitized prompt */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <Sparkles className="w-3 h-3 text-brand-light shrink-0" />
          <span className="text-[9px] font-mono uppercase tracking-[0.32em] text-white/40 shrink-0">
            Last
          </span>
          <span className="text-[12px] text-white/75 truncate min-w-0">
            {lastPrompt ? (
              <>
                <span className="text-white/95">&ldquo;{lastPrompt}&rdquo;</span>
                {ago && <span className="text-white/35 ml-2">· {ago}</span>}
              </>
            ) : (
              <span className="text-white/45">Standing by — first render of the day…</span>
            )}
          </span>
        </div>

        {/* Stat: queue */}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          <span className="h-3 w-px bg-white/10" />
          <span className="text-[9px] font-mono uppercase tracking-[0.32em] text-white/40">
            Queue
          </span>
          <span className="font-mono tabular-nums text-[12px] text-white">
            {queue.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}

export default LiveStatRibbon;
