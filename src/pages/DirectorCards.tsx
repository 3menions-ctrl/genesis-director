/**
 * DirectorCards — /me/year
 *
 * The annual retrospective. A Spotify-Wrapped-style scrollable sequence
 * of cinematic cards summarising your year on Small Bridges. Each card auto-
 * advances on tap or swipe; the final card is a share-able artefact.
 *
 * Aggregates client-side from:
 *   • published_reels (yours this year)
 *   • reel_plays / reel_likes / reel_remixes for totals
 *   • follows (followers gained)
 *   • atom_purchases (sales you made — credits earned)
 *
 * Read-only — never mutates, can be revisited at any time.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Sparkles, Wand2, Heart, Eye, ChevronLeft, ChevronRight,
  Share2, Calendar, Film,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSafeNavigation } from "@/lib/navigation";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Spinner } from "@/components/ui/Spinner";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ReelLite {
  id: string;
  title: string;
  thumbnail_url: string | null;
  play_count: number;
  like_count: number;
  remix_count: number;
  tip_credits: number;
  created_at: string;
  world_slug: string | null;
}

interface YearStats {
  totalReels: number;
  totalPlays: number;
  totalLikes: number;
  totalRemixes: number;
  totalTips: number;
  followersGained: number;
  creditsEarned: number;
  topReel: ReelLite | null;
  topWorld: string | null;
}

export default function DirectorCards() {
  const { user } = useAuth();
  const { navigate } = useSafeNavigation();
  const [stats, setStats] = useState<YearStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [card, setCard] = useState(0);

  const year = new Date().getFullYear();

  usePageMeta({
    title: `Director Card · ${year}`,
    description: "Your year in cinematic AI.",
  });

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const yearStart = new Date(year, 0, 1).toISOString();

      const [reelsRes, followsRes, salesRes] = await Promise.all([
        supabase
          .from("published_reels")
          .select("id, title, thumbnail_url, play_count, like_count, remix_count, tip_credits, created_at, world_slug")
          .eq("creator_id", user.id)
          .gte("created_at", yearStart)
          .order("play_count", { ascending: false }),
        supabase
          .from("follows")
          .select("follower_id", { count: "exact", head: true })
          .eq("followed_id", user.id)
          .gte("created_at", yearStart),
        supabase
          .from("atom_purchases")
          .select("seller_credits")
          .eq("seller_id", user.id)
          .gte("created_at", yearStart),
      ]);

      const reels = (reelsRes.data ?? []) as ReelLite[];
      const totalPlays = reels.reduce((s, r) => s + r.play_count, 0);
      const totalLikes = reels.reduce((s, r) => s + r.like_count, 0);
      const totalRemixes = reels.reduce((s, r) => s + r.remix_count, 0);
      const totalTips = reels.reduce((s, r) => s + r.tip_credits, 0);
      const creditsEarned = (salesRes.data ?? []).reduce(
        (s: number, r: { seller_credits: number }) => s + (r.seller_credits ?? 0),
        0,
      );

      // Top world — by reel count.
      const worldCounts: Record<string, number> = {};
      reels.forEach((r) => {
        if (r.world_slug) worldCounts[r.world_slug] = (worldCounts[r.world_slug] ?? 0) + 1;
      });
      const topWorld = Object.entries(worldCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

      setStats({
        totalReels: reels.length,
        totalPlays,
        totalLikes,
        totalRemixes,
        totalTips,
        followersGained: followsRes.count ?? 0,
        creditsEarned: creditsEarned + Math.floor(totalTips * 0.9),
        topReel: reels[0] ?? null,
        topWorld,
      });
    } catch (e) {
      console.error("[DirectorCards] load failed", e);
    } finally {
      setLoading(false);
    }
  }, [user, year]);

  useEffect(() => { void load(); }, [load]);

  const share = async () => {
    if (!stats) return;
    const text = `My ${year} on Small Bridges: ${stats.totalReels} reels · ${stats.totalPlays.toLocaleString()} plays · ${stats.totalLikes.toLocaleString()} likes.`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${year} Director Card`, text, url: window.location.href });
      } else {
        await navigator.clipboard.writeText(`${text} ${window.location.href}`);
        toast.success("Card copied");
      }
    } catch { /* user dismissed */ }
  };

  const cards = useMemo(() => buildCards(stats, year), [stats, year]);

  if (!user) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 text-center">
        <div className="max-w-md">
          <Film className="w-6 h-6 mx-auto mb-4 text-white/45" />
          <h2 className="font-display font-medium text-[24px] mb-2">Sign in to see your Director Card</h2>
          <button
            onClick={() => navigate("/auth")}
            className="mt-4 inline-flex items-center gap-2 h-10 px-5 rounded-full bg-white text-black text-[11px] font-mono uppercase tracking-[0.22em]"
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 20% 30%, rgba(10,132,255,0.18), transparent 60%), radial-gradient(ellipse at 80% 70%, rgba(255,140,0,0.14), transparent 60%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-overlay"
        style={{ backgroundImage: "url('https://grainy-gradients.vercel.app/noise.svg')" }}
      />

      {loading ? (
        <div className="flex items-center gap-3 text-white/65 relative z-10">
          <Spinner size="md" tone="muted" />
          <span className="text-[12px] font-mono uppercase tracking-[0.22em]">Drafting your card…</span>
        </div>
      ) : !stats ? (
        <div className="text-center max-w-md relative z-10">
          <Sparkles className="w-6 h-6 mx-auto mb-4 text-white/45" />
          <h2 className="font-display font-medium text-[26px] mb-2">No data yet for {year}.</h2>
          <p className="text-white/45 text-[13px] mb-6">Publish a reel first, then come back.</p>
          <Link
            to="/auth?mode=signup"
            className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-white text-black text-[11px] font-mono uppercase tracking-[0.22em]"
          >
            <Wand2 className="w-3.5 h-3.5" />Direct your first reel
          </Link>
        </div>
      ) : (
        <div className="relative z-10 w-full max-w-[480px]">
          {/* Card stack — only the active one is rendered */}
          <div className="aspect-[9/16] rounded-3xl border border-white/[0.10] bg-gradient-to-br from-white/[0.04] to-white/[0.01] backdrop-blur-xl overflow-hidden shadow-[0_60px_120px_-30px_rgba(0,0,0,0.95)] relative">
            <CardBody body={cards[card]} year={year} />
            {/* Progress dots */}
            <div className="absolute top-4 left-4 right-4 flex items-center gap-1.5">
              {cards.map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "flex-1 h-0.5 rounded-full",
                    i < card ? "bg-white" : i === card ? "bg-white" : "bg-white/15",
                  )}
                />
              ))}
            </div>
          </div>

          {/* Controls */}
          <div className="mt-4 flex items-center justify-between">
            <button
              onClick={() => setCard((c) => Math.max(0, c - 1))}
              disabled={card === 0}
              className="w-10 h-10 rounded-full border border-white/[0.10] hover:border-white/30 text-white/65 hover:text-white flex items-center justify-center disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-[10px] font-mono uppercase tracking-[0.32em] text-white/45">
              {card + 1} / {cards.length}
            </div>
            <button
              onClick={() => setCard((c) => Math.min(cards.length - 1, c + 1))}
              disabled={card === cards.length - 1}
              className="w-10 h-10 rounded-full border border-white/[0.10] hover:border-white/30 text-white/65 hover:text-white flex items-center justify-center disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Footer actions — only on last card */}
          {card === cards.length - 1 && (
            <div className="mt-4 flex flex-col items-center gap-2">
              <button
                onClick={share}
                className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-white text-black hover:bg-white/90 text-[11px] font-mono uppercase tracking-[0.22em]"
              >
                <Share2 className="w-3.5 h-3.5" />Share my year
              </button>
              <Link
                to="/lobby"
                className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.22em] text-white/45 hover:text-white"
              >
                Back to the floor
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface CardSpec {
  eyebrow: string;
  title: React.ReactNode;
  body: React.ReactNode;
  accent: string;
}

function buildCards(stats: YearStats | null, year: number): CardSpec[] {
  if (!stats) return [];
  return [
    {
      eyebrow: `${year} Director Card`,
      title: <>Your year, <span className="italic">directed</span>.</>,
      body: <p className="text-white/65 text-[14px] leading-relaxed">A scroll through what you shipped, what played, and what's coming next.</p>,
      accent: "213 100% 60%",
    },
    {
      eyebrow: "Reels published",
      title: <span className="tabular-nums">{stats.totalReels.toLocaleString()}</span>,
      body: <p className="text-white/55 text-[13px]">In one year. {stats.totalReels >= 10 ? "Consistent." : stats.totalReels >= 3 ? "A rhythm." : "First moves."}</p>,
      accent: "213 100% 60%",
    },
    {
      eyebrow: "Total plays",
      title: <span className="tabular-nums">{stats.totalPlays.toLocaleString()}</span>,
      body: <p className="text-white/55 text-[13px]">Sessions that didn't just scroll past.</p>,
      accent: "280 70% 65%",
    },
    {
      eyebrow: "Hearts collected",
      title: <span className="tabular-nums">{stats.totalLikes.toLocaleString()}</span>,
      body: <p className="text-white/55 text-[13px]">Each one a tap of recognition.</p>,
      accent: "350 80% 65%",
    },
    {
      eyebrow: "Remixes spawned",
      title: <span className="tabular-nums">{stats.totalRemixes.toLocaleString()}</span>,
      body: <p className="text-white/55 text-[13px]">Other directors took your work as their starting point.</p>,
      accent: "160 60% 55%",
    },
    {
      eyebrow: "Credits earned",
      title: <span className="tabular-nums">{stats.creditsEarned.toLocaleString()} cr</span>,
      body: <p className="text-white/55 text-[13px]">From tips and atom sales.</p>,
      accent: "38 90% 60%",
    },
    {
      eyebrow: "Followers gained",
      title: <span className="tabular-nums">+{stats.followersGained.toLocaleString()}</span>,
      body: <p className="text-white/55 text-[13px]">A real audience, one director at a time.</p>,
      accent: "200 80% 65%",
    },
    ...(stats.topReel ? [{
      eyebrow: "Your top reel",
      title: <span className="font-display italic font-light">{stats.topReel.title}</span>,
      body: (
        <div className="space-y-3 mt-3">
          {stats.topReel.thumbnail_url && (
            <img src={stats.topReel.thumbnail_url} alt="" className="w-full rounded-xl object-cover aspect-video border border-white/[0.08]" />
          )}
          <div className="flex items-center gap-3 text-[11px] font-mono text-white/55 tabular-nums">
            <span className="inline-flex items-center gap-1"><Eye className="w-3 h-3" />{stats.topReel.play_count.toLocaleString()}</span>
            <span className="inline-flex items-center gap-1"><Heart className="w-3 h-3" />{stats.topReel.like_count.toLocaleString()}</span>
            <span className="inline-flex items-center gap-1"><Wand2 className="w-3 h-3" />{stats.topReel.remix_count.toLocaleString()}</span>
          </div>
        </div>
      ),
      accent: "213 100% 60%",
    }] : []),
    ...(stats.topWorld ? [{
      eyebrow: "Your home world",
      title: <span className="capitalize">{stats.topWorld}</span>,
      body: <p className="text-white/55 text-[13px]">The world you returned to most.</p>,
      accent: "280 70% 65%",
    }] : []),
    {
      eyebrow: `Next year`,
      title: <>What you'll <span className="italic">ship next</span>.</>,
      body: (
        <p className="text-white/65 text-[14px] leading-relaxed">
          The market is open. The crews are forming. The next prompt drops at 9am.
        </p>
      ),
      accent: "38 90% 60%",
    },
  ];
}

function CardBody({ body, year }: { body: CardSpec; year: number }) {
  return (
    <div className="absolute inset-0 flex flex-col p-8 pt-12">
      <div
        aria-hidden
        className="absolute -top-32 -right-20 w-[280px] h-[280px] rounded-full pointer-events-none opacity-70"
        style={{ background: `radial-gradient(circle, hsla(${body.accent} / 0.30), transparent 65%)`, filter: "blur(60px)" }}
      />
      <div className="relative">
        <div className="text-[10px] font-mono uppercase tracking-[0.32em] mb-4" style={{ color: `hsl(${body.accent})` }}>
          {body.eyebrow}
        </div>
        <h2
          className="font-display font-light text-[40px] lg:text-[56px] leading-[1.0] tracking-tight text-white mb-5"
        >
          {body.title}
        </h2>
        <div className="text-white">{body.body}</div>
      </div>
      <div className="mt-auto relative">
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.32em] text-white/35">
          <Calendar className="w-3 h-3" /> {year} · Small Bridges
        </div>
      </div>
    </div>
  );
}

