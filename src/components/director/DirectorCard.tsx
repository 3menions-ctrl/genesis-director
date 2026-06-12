/**
 * DirectorCard — monthly cinematic recap card for any user.
 *
 * Fetches data from the director-card edge function and renders a
 * polished, screenshot-able panel: stats, top reel, signature style,
 * with a holographic foil treatment that follows the cursor on hover.
 */
import { useEffect, useRef, useState } from "react";
import { Sparkles, Eye, Heart, Users, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { supabase } from "@/integrations/supabase/client";

interface CardData {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  month: string;
  stats: {
    reels: number;
    plays: number;
    likes: number;
    tips_received: number;
    followers: number;
  };
  topReel: {
    id: string;
    title: string | null;
    thumbnail_url: string | null;
    plays: number;
    likes: number;
  } | null;
  signatureStyle: { word: string; count: number } | null;
}

interface Props {
  userId?: string;
  month?: string;
  className?: string;
}

export function DirectorCard({ userId, month, className }: Props) {
  const [data, setData] = useState<CardData | null>(null);
  const [loading, setLoading] = useState(true);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const params = new URLSearchParams();
      if (userId) params.set("userId", userId);
      if (month) params.set("month", month);
      const { data: payload, error } = await supabase.functions.invoke(
        `director-card${params.toString() ? "?" + params.toString() : ""}`,
        {},
      );
      if (!cancelled) {
        if (error) {
          setData(null);
        } else {
          setData(payload as CardData);
        }
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, month]);

  // Holographic foil follows cursor on hover.
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      el.style.setProperty("--foil-x", `${x}%`);
      el.style.setProperty("--foil-y", `${y}%`);
    };
    el.addEventListener("pointermove", onMove);
    return () => el.removeEventListener("pointermove", onMove);
  }, []);

  if (loading) {
    return (
      <div className={"rounded-3xl border border-glass bg-glass p-6 min-h-[280px] " + (className ?? "")}>
        <div className="animate-pulse space-y-3">
          <div className="h-3 w-1/3 bg-white/[0.06] rounded" />
          <div className="h-6 w-2/3 bg-white/[0.08] rounded" />
          <div className="h-4 w-1/4 bg-white/[0.05] rounded" />
        </div>
      </div>
    );
  }
  if (!data) return null;

  const monthLabel = new Date(`${data.month}-01T00:00:00Z`).toLocaleString(undefined, {
    month: "long", year: "numeric", timeZone: "UTC",
  });

  return (
    <div
      ref={cardRef}
      className={
        "relative rounded-3xl border border-glass bg-glass overflow-hidden p-6 "
        + (className ?? "")
      }
      style={{
        // Holographic conic gradient mask
        background:
          "linear-gradient(180deg, hsla(215, 25%, 12%, 1), hsla(215, 25%, 8%, 1))",
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none mix-blend-color-dodge opacity-60"
        style={{
          background:
            "radial-gradient(140px 140px at var(--foil-x, 50%) var(--foil-y, 50%), "
            + "hsla(280, 100%, 75%, 0.35), transparent 70%), "
            + "conic-gradient(from 200deg at var(--foil-x, 30%) var(--foil-y, 70%), "
            + "hsla(0, 100%, 60%, 0.15), hsla(60, 100%, 60%, 0.15), "
            + "hsla(120, 100%, 60%, 0.15), hsla(180, 100%, 60%, 0.15), "
            + "hsla(240, 100%, 60%, 0.15), hsla(300, 100%, 60%, 0.15), "
            + "hsla(0, 100%, 60%, 0.15))",
      }}
      />

      <header className="relative flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {data.avatarUrl ? (
            <img src={data.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover border border-white/15" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-glass-hover" aria-hidden />
          )}
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-foreground/55">Director Card</div>
            <div className="text-base font-semibold text-foreground">
              {data.displayName ?? "Unknown director"}
            </div>
          </div>
        </div>
        <span className="text-[10px] uppercase tracking-[0.18em] text-foreground/45">
          {monthLabel}
        </span>
      </header>

      <div className="relative grid grid-cols-4 gap-3 mb-5">
        <Stat icon={Sparkles} label="Reels"     value={data.stats.reels} />
        <Stat icon={Eye}      label="Plays"     value={data.stats.plays} />
        <Stat icon={Heart}    label="Likes"     value={data.stats.likes} />
        <Stat icon={Users}    label="Followers" value={data.stats.followers} />
      </div>

      {data.topReel && (
        <div className="relative rounded-xl border border-glass-active overflow-hidden mb-5 bg-black/30">
          <div className="aspect-video relative">
            {data.topReel.thumbnail_url && (
              <img
                src={data.topReel.thumbnail_url}
                alt=""
                className="w-full h-full object-cover opacity-90"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
            <div className="absolute bottom-2 left-3 right-3 flex items-end justify-between text-white">
              <div className="text-sm font-medium line-clamp-1">
                {data.topReel.title ?? "Untitled premiere"}
              </div>
              <div className="text-[11px] tabular-nums text-white/80">
                <AnimatedCounter value={data.topReel.plays} /> plays
              </div>
            </div>
          </div>
        </div>
      )}

      {data.signatureStyle && (
        <div className="relative flex items-center gap-2 text-xs text-foreground/65">
          <Coins className="w-3.5 h-3.5 text-primary" aria-hidden />
          <span>
            Signature style:{" "}
            <span className="text-foreground font-medium">{data.signatureStyle.word}</span>
            <span className="text-foreground/45"> (×{data.signatureStyle.count})</span>
          </span>
        </div>
      )}

      <footer className="relative mt-6 flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.18em] text-foreground/40">
          Tip credits this month
        </div>
        <div className="text-sm font-mono tabular-nums text-foreground">
          <AnimatedCounter value={data.stats.tips_received} />
        </div>
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
