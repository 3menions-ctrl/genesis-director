/**
 * PremiereRecapCard — post-show recap shown to the host (and any
 * follower who opens the reel after the premiere ends).
 *
 * Fetches the premiere-recap edge function. Shows peak viewer count,
 * RSVP count, tip credits, top emoji reactions, and the duration.
 * Holographic foil on the host card (reused from DirectorCard) for
 * the shareable moment.
 */
import { useEffect, useRef, useState } from "react";
import { Eye, Heart, Coins, Calendar, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { supabase } from "@/integrations/supabase/client";

interface Recap {
  premiereId: string;
  reelId: string;
  hostId: string;
  title: string | null;
  status: string;
  startedAt: string | null;
  endedAt: string | null;
  peakViewers: number;
  rsvpCount: number;
  tipCredits: number;
  topReactions: { emoji: string; count: number }[];
}

interface Props {
  premiereId: string;
  className?: string;
  onShare?: () => void;
}

export function PremiereRecapCard({ premiereId, className, onShare }: Props) {
  const [data, setData] = useState<Recap | null>(null);
  const [loading, setLoading] = useState(true);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: payload, error } = await supabase.functions.invoke(
        `premiere-recap?premiereId=${premiereId}`,
        {},
      );
      if (!cancelled) {
        setData(error ? null : (payload as Recap));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [premiereId]);

  // Holographic foil tracker.
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      el.style.setProperty("--foil-x", `${((e.clientX - rect.left) / rect.width) * 100}%`);
      el.style.setProperty("--foil-y", `${((e.clientY - rect.top) / rect.height) * 100}%`);
    };
    el.addEventListener("pointermove", onMove);
    return () => el.removeEventListener("pointermove", onMove);
  }, []);

  if (loading) {
    return (
      <div className={"rounded-3xl border border-glass bg-glass p-6 min-h-[200px] " + (className ?? "")}>
        <div className="animate-pulse space-y-3">
          <div className="h-3 w-1/3 bg-white/[0.06] rounded" />
          <div className="h-6 w-2/3 bg-white/[0.08] rounded" />
        </div>
      </div>
    );
  }
  if (!data) return null;

  const durSecs = data.startedAt && data.endedAt
    ? Math.max(0, Math.round((Date.parse(data.endedAt) - Date.parse(data.startedAt)) / 1000))
    : 0;

  return (
    <div
      ref={cardRef}
      className={"relative rounded-3xl border border-glass bg-glass overflow-hidden p-6 " + (className ?? "")}
    >
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none mix-blend-color-dodge opacity-50"
        style={{
          background:
            "radial-gradient(160px 160px at var(--foil-x, 50%) var(--foil-y, 50%), "
            + "hsla(280, 100%, 75%, 0.35), transparent 70%), "
            + "conic-gradient(from 200deg at var(--foil-x, 30%) var(--foil-y, 70%), "
            + "hsla(0, 100%, 60%, 0.12), hsla(60, 100%, 60%, 0.12), "
            + "hsla(120, 100%, 60%, 0.12), hsla(180, 100%, 60%, 0.12), "
            + "hsla(240, 100%, 60%, 0.12), hsla(300, 100%, 60%, 0.12), "
            + "hsla(0, 100%, 60%, 0.12))",
        }}
      />

      <header className="relative flex items-center justify-between mb-6">
        <div>
          <div className="text-[10px] uppercase tracking-[0.24em] text-primary">Premiere recap</div>
          <h3 className="text-lg font-semibold text-foreground mt-0.5">
            {data.title ?? "Premiere"}
          </h3>
        </div>
        {onShare && (
          <Button type="button" size="sm" variant="outline" onClick={onShare}>
            <Share2 className="w-3.5 h-3.5 mr-2" /> Share
          </Button>
        )}
      </header>

      <div className="relative grid grid-cols-3 gap-3">
        <Stat icon={Eye}   label="Peak viewers"    value={data.peakViewers} />
        <Stat icon={Heart} label="RSVPs"           value={data.rsvpCount} />
        <Stat icon={Coins} label="Tips received"   value={data.tipCredits} />
      </div>

      {data.topReactions.length > 0 && (
        <div className="relative mt-5">
          <div className="text-[10px] uppercase tracking-[0.16em] text-foreground/45 mb-2">
            Top reactions
          </div>
          <div className="flex flex-wrap gap-2">
            {data.topReactions.map((r) => (
              <span
                key={r.emoji}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-glass-hover text-sm"
              >
                <span className="text-lg leading-none">{r.emoji}</span>
                <AnimatedCounter value={r.count} className="text-xs tabular-nums text-foreground/70" />
              </span>
            ))}
          </div>
        </div>
      )}

      <footer className="relative mt-6 flex items-center gap-2 text-xs text-foreground/55">
        <Calendar className="w-3 h-3" aria-hidden />
        {data.endedAt
          ? `Ended ${new Date(data.endedAt).toLocaleString()}`
          : "Live"}
        {durSecs > 0 && <span>· {Math.floor(durSecs / 60)}m {durSecs % 60}s</span>}
      </footer>
    </div>
  );
}

function Stat({
  icon: Icon, label, value,
}: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div className="rounded-xl bg-glass-hover p-3">
      <div className="flex items-center gap-1.5 text-foreground/55 text-[10px] uppercase tracking-[0.16em]">
        <Icon className="w-3 h-3" aria-hidden />
        <span>{label}</span>
      </div>
      <div className="text-2xl font-semibold tabular-nums mt-1">
        <AnimatedCounter value={value} />
      </div>
    </div>
  );
}
