/**
 * ProfileDashboard — the addictive Account / Profile surface.
 *
 * Big animated stats. Activity heatmap. Recent renders. Achievement
 * chips. Built so the director wants to come back and watch the
 * numbers grow. Sits inside Account.tsx as the Profile tab; the
 * legacy Profile.tsx still powers the public /c/:id surface.
 *
 * Data sources (all client-side, all RLS-safe):
 *   - movie_projects        — total films, render activity heatmap
 *   - published_reels       — public counters (plays, likes, remixes)
 *   - profiles_public       — display name, avatar, joined date
 *   - useCredits()          — current balance + lifetime used
 *
 * If any individual query fails, that block degrades gracefully —
 * the page never blanks. Counts animate up from zero on first
 * render for the "watching it tick" satisfaction.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  Film,
  Eye,
  Heart,
  Wand2,
  Flame,
  Sparkles,
  TrendingUp,
  Calendar,
  Coins,
  ArrowRight,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCredits } from "@/contexts/CreditsContext";
import { EASE_PREMIUM, TYPE_META } from "@/lib/design-system";

// ─────────────────────────────────────────────────────────────────────────────
// Data shape
// ─────────────────────────────────────────────────────────────────────────────
interface DashboardData {
  totalFilms: number;
  filmsThisMonth: number;
  totalPlays: number;
  totalLikes: number;
  totalRemixes: number;
  totalTipsCredits: number;
  followerCount: number;
  joinedDate: string | null;
  /** Map of YYYY-MM-DD → render count for the last 84 days */
  heatmap: Record<string, number>;
  /** Current streak — consecutive days with at least one project. */
  streakDays: number;
  recentReels: Array<{
    id: string;
    title: string;
    thumbnail_url: string | null;
    play_count: number;
  }>;
}

const EMPTY_DASHBOARD: DashboardData = {
  totalFilms: 0,
  filmsThisMonth: 0,
  totalPlays: 0,
  totalLikes: 0,
  totalRemixes: 0,
  totalTipsCredits: 0,
  followerCount: 0,
  joinedDate: null,
  heatmap: {},
  streakDays: 0,
  recentReels: [],
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export default function ProfileDashboard() {
  const { user, profile } = useAuth();
  const { balance } = useCredits();
  const reducedMotion = useReducedMotion();
  const [data, setData] = useState<DashboardData>(EMPTY_DASHBOARD);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const next: DashboardData = { ...EMPTY_DASHBOARD };

    try {
      // ── Render heatmap from movie_projects.created_at (last 84 days) ──
      const since = new Date();
      since.setDate(since.getDate() - 84);
      const sinceIso = since.toISOString();
      const { data: projects } = await supabase
        .from("movie_projects")
        .select("id, created_at, status")
        .eq("user_id", user.id)
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false });
      next.heatmap = {};
      if (projects) {
        for (const p of projects) {
          const day = (p as { created_at: string }).created_at.slice(0, 10);
          next.heatmap[day] = (next.heatmap[day] ?? 0) + 1;
        }
      }
      // Total films lifetime — separate count query.
      const { count: totalFilmsCount } = await supabase
        .from("movie_projects")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      next.totalFilms = totalFilmsCount ?? 0;
      // This month
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      next.filmsThisMonth =
        projects?.filter(
          (p) =>
            new Date((p as { created_at: string }).created_at) >= monthStart,
        ).length ?? 0;

      // Streak — walk backwards from today until we hit a gap day.
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let streak = 0;
      for (let i = 0; i < 84; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        if (next.heatmap[key] && next.heatmap[key] > 0) streak++;
        else break;
      }
      next.streakDays = streak;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[ProfileDashboard] projects query failed", e);
    }

    try {
      // ── Published reels: plays / likes / remixes / tips ──
      const { data: reels } = await supabase
        .from("published_reels")
        .select(
          "id, title, thumbnail_url, play_count, like_count, remix_count, tip_credits",
        )
        .eq("creator_id", user.id)
        .eq("is_taken_down", false)
        .order("play_count", { ascending: false })
        .limit(8);
      if (reels) {
        for (const r of reels) {
          const row = r as {
            play_count?: number | null;
            like_count?: number | null;
            remix_count?: number | null;
            tip_credits?: number | null;
          };
          next.totalPlays += row.play_count ?? 0;
          next.totalLikes += row.like_count ?? 0;
          next.totalRemixes += row.remix_count ?? 0;
          next.totalTipsCredits += row.tip_credits ?? 0;
        }
        next.recentReels = reels.slice(0, 4).map((r) => {
          const row = r as {
            id: string;
            title: string;
            thumbnail_url: string | null;
            play_count: number;
          };
          return {
            id: row.id,
            title: row.title,
            thumbnail_url: row.thumbnail_url,
            play_count: row.play_count ?? 0,
          };
        });
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[ProfileDashboard] reels query failed", e);
    }

    try {
      // ── Follower count + joined date from profiles_public ──
      const { data: pub } = await supabase
        .from("profiles_public")
        .select("follower_count, created_at")
        .eq("id", user.id)
        .maybeSingle();
      if (pub) {
        const row = pub as { follower_count?: number | null; created_at?: string };
        next.followerCount = row.follower_count ?? 0;
        next.joinedDate = row.created_at ?? null;
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[ProfileDashboard] profile query failed", e);
    }

    setData(next);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Achievements ────────────────────────────────────────────────────
  const achievements = useMemo(() => {
    const list: Array<{ label: string; sub: string; tier: 1 | 2 | 3 }> = [];
    if (data.totalFilms >= 1) list.push({ label: "First Film", sub: "Directed your first reel", tier: 1 });
    if (data.totalFilms >= 10) list.push({ label: "Ten Down", sub: "Directed 10 films", tier: 1 });
    if (data.totalFilms >= 50) list.push({ label: "Half a Century", sub: "Directed 50 films", tier: 2 });
    if (data.totalFilms >= 100) list.push({ label: "Centenary", sub: "Directed 100 films", tier: 3 });
    if (data.totalPlays >= 100) list.push({ label: "First Audience", sub: "100 lifetime plays", tier: 1 });
    if (data.totalPlays >= 1_000) list.push({ label: "Standing Ovation", sub: "1,000 lifetime plays", tier: 2 });
    if (data.totalPlays >= 10_000) list.push({ label: "Cult Following", sub: "10,000 lifetime plays", tier: 3 });
    if (data.totalLikes >= 100) list.push({ label: "Loved", sub: "100 lifetime likes", tier: 1 });
    if (data.totalRemixes >= 5) list.push({ label: "Remixable", sub: "5 lifetime remixes", tier: 1 });
    if (data.totalTipsCredits >= 100) list.push({ label: "Audience Favourite", sub: "100 credits in tips", tier: 2 });
    if (data.streakDays >= 7) list.push({ label: "Week-Long Streak", sub: "7-day directing streak", tier: 2 });
    if (data.streakDays >= 30) list.push({ label: "Iron Director", sub: "30-day streak", tier: 3 });
    if (data.followerCount >= 10) list.push({ label: "First Followers", sub: "10 followers", tier: 1 });
    return list.slice(0, 8);
  }, [data]);

  const memberFor = useMemo(() => {
    if (!data.joinedDate) return null;
    const join = new Date(data.joinedDate);
    const now = new Date();
    const months =
      (now.getFullYear() - join.getFullYear()) * 12 +
      (now.getMonth() - join.getMonth());
    if (months < 1) return "this month";
    if (months < 12) return `${months} mo`;
    const y = Math.floor(months / 12);
    return `${y}y ${months % 12}m`;
  }, [data.joinedDate]);

  return (
    <div className="relative">
      {/* COVER — full-bleed cinematic banner. The portrait IS the page. */}
      <CoverHero
        avatarUrl={profile?.avatar_url ?? null}
        displayName={profile?.display_name ?? user?.email?.split("@")[0] ?? "Director"}
        email={user?.email ?? null}
        memberFor={memberFor}
        followerCount={data.followerCount}
        totalFilms={data.totalFilms}
        balance={balance ?? 0}
        userId={user?.id ?? ""}
        reducedMotion={reducedMotion ?? false}
      />

      {/* DASHBOARD — constrained content cascades below the cover */}
      <div className="relative mx-auto w-full max-w-[1280px] px-4 pb-24 sm:px-6 lg:px-10 space-y-10 -mt-16 sm:-mt-20">
        {/* STATS GRID — big numbers, animated counters. Sits over the
            tail of the cover gradient so it reads as part of the
            composition, not a separate section. */}
        <StatsGrid data={data} loading={loading} reducedMotion={reducedMotion ?? false} />

        {/* TWO-COLUMN: Heatmap + Achievements */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6">
          <ActivityHeatmap heatmap={data.heatmap} totalMonth={data.filmsThisMonth} streak={data.streakDays} />
          <AchievementsCard achievements={achievements} />
        </div>

        {/* RECENT REELS */}
        {data.recentReels.length > 0 && (
          <RecentReels reels={data.recentReels} />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CoverHero — full-bleed cinematic banner. The director's portrait is
// the page. The avatar fills the background (blurred + cover-scaled),
// crisp foreground content rides the bottom-left, the name is
// massive italic Fraunces, the gradient masks any awkward crops.
// ─────────────────────────────────────────────────────────────────────────────
function CoverHero({
  avatarUrl,
  displayName,
  email,
  memberFor,
  followerCount,
  totalFilms,
  balance,
  userId,
  reducedMotion,
}: {
  avatarUrl: string | null;
  displayName: string;
  email: string | null;
  memberFor: string | null;
  followerCount: number;
  totalFilms: number;
  balance: number;
  userId: string;
  reducedMotion: boolean;
}) {
  // Deterministic procedural gradient when no avatar — same input ID
  // produces the same colors so the cover doesn't shimmer between
  // visits. Three angles, three hues, layered radial gradients.
  const procedural = useMemo(() => {
    let h = 0;
    for (let i = 0; i < userId.length; i++) {
      h = (h * 31 + userId.charCodeAt(i)) >>> 0;
    }
    const hue1 = h % 360;
    const hue2 = (hue1 + 60 + ((h >> 8) % 80)) % 360;
    const hue3 = (hue1 + 180 + ((h >> 16) % 60)) % 360;
    return `radial-gradient(80% 70% at 15% 30%, hsl(${hue1} 70% 55% / 0.7) 0%, transparent 60%), radial-gradient(70% 70% at 80% 70%, hsl(${hue2} 65% 45% / 0.55) 0%, transparent 65%), radial-gradient(100% 80% at 50% 50%, hsl(${hue3} 55% 35% / 0.45) 0%, transparent 70%), hsl(220 30% 6%)`;
  }, [userId]);

  return (
    <motion.section
      initial={reducedMotion ? { opacity: 1 } : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: EASE_PREMIUM }}
      className={cn(
        "relative w-full overflow-hidden",
        "h-[clamp(520px,72vh,780px)]",
      )}
    >
      {/* BACKGROUND PHOTO — avatar zoomed and blurred to cover.
          When no avatar, a deterministic mesh gradient stands in. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={
          avatarUrl
            ? {
                backgroundImage: `url(${avatarUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center 30%",
                transform: "scale(1.15)",
                filter: "blur(48px) brightness(0.55) saturate(1.1)",
              }
            : { background: procedural }
        }
      />
      {/* Ken-burns slow zoom — adds life without distracting */}
      {avatarUrl && !reducedMotion && (
        <motion.div
          aria-hidden
          className="absolute inset-0"
          initial={{ scale: 1.02 }}
          animate={{ scale: 1.18 }}
          transition={{
            duration: 32,
            ease: "linear",
            repeat: Infinity,
            repeatType: "mirror",
          }}
          style={{
            backgroundImage: `url(${avatarUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center 30%",
            filter: "blur(48px) brightness(0.55) saturate(1.1)",
          }}
        />
      )}

      {/* Multi-layer gradient overlays — top vignette, side
          vignette, bottom fade-to-canvas so the dashboard reads as
          one continuous composition with the cover. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, hsl(220 30% 4% / 0.55) 0%, hsl(220 30% 4% / 0.15) 28%, hsl(220 30% 4% / 0.20) 60%, hsl(220 30% 4% / 0.70) 85%, hsl(220 30% 4% / 0.98) 100%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to right, hsl(220 30% 4% / 0.65) 0%, transparent 35%, transparent 65%, hsl(220 30% 4% / 0.35) 100%)",
        }}
      />
      {/* Subtle film grain on top of the photo for premium texture */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-30 mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.92' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.05   0 0 0 0 0.08   0 0 0 0 0.12   0 0 0 0.6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />

      {/* CONTENT — content lives in a constrained container even though
          the cover itself is full-bleed, so text never crowds the
          viewport edge. */}
      <div className="absolute inset-0 mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-10">
        {/* TOP-RIGHT — share + edit chips */}
        <div className="absolute top-6 right-4 sm:right-6 lg:right-10 flex items-center gap-2">
          <Link
            to="/account?tab=settings"
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-4 h-9",
              "border border-white/[0.12] bg-white/[0.04] backdrop-blur-md",
              "text-[12.5px] text-foreground/90 transition-all",
              "hover:border-accent/40 hover:bg-[hsl(var(--accent)/0.10)]",
            )}
          >
            <Sparkles className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
            <span>Edit profile</span>
          </Link>
        </div>

        {/* BOTTOM-LEFT — the entire identity stack */}
        <div className="absolute bottom-24 sm:bottom-28 left-4 sm:left-6 lg:left-10 right-4 sm:right-6 lg:right-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-end gap-5 sm:gap-7 min-w-0">
              {/* CRISP PORTRAIT — sits in front of the blurred bg so the
                  same image reads twice: huge & atmospheric, then
                  intimate & sharp. */}
              <div
                className={cn(
                  "relative shrink-0",
                  "h-[120px] w-[120px] sm:h-[150px] sm:w-[150px] lg:h-[180px] lg:w-[180px]",
                  "rounded-full overflow-hidden",
                  "border-[3px] border-white/[0.18]",
                  "bg-gradient-to-br from-white/[0.06] to-[hsl(220_30%_8%)]",
                  "shadow-[0_30px_80px_-20px_hsl(0_0%_0%/0.85),inset_0_2px_0_hsl(0_0%_100%/0.08)]",
                )}
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div
                    className="h-full w-full flex items-center justify-center font-display italic text-[clamp(3.5rem,5vw,5rem)] text-foreground/90"
                    style={{ fontFamily: "'Fraunces', serif" }}
                  >
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                {/* Rotating accent ring */}
                <span
                  aria-hidden
                  className="absolute -inset-2 rounded-full pointer-events-none"
                  style={{
                    background:
                      "conic-gradient(from 0deg, transparent 0deg, hsl(var(--accent) / 0.55) 70deg, transparent 160deg)",
                    animation: reducedMotion ? "none" : "spin 8s linear infinite",
                    mask: "radial-gradient(circle, transparent 49%, black 51%)",
                    WebkitMask: "radial-gradient(circle, transparent 49%, black 51%)",
                  }}
                />
              </div>

              {/* NAME + META */}
              <div className="min-w-0 pb-2">
                <div
                  className={cn(
                    TYPE_META,
                    "text-foreground/65 tracking-[0.34em] flex items-center gap-2.5",
                  )}
                >
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inset-0 rounded-full bg-accent/60 animate-ping opacity-60" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
                  </span>
                  <span>◆ Director · Live</span>
                </div>
                <h1
                  className="mt-3 font-display italic font-light leading-[0.95] tracking-tight"
                  style={{
                    fontFamily: "'Fraunces', serif",
                    fontSize: "clamp(2.8rem, 7vw, 6rem)",
                    textShadow: "0 6px 30px hsl(0 0% 0% / 0.55)",
                  }}
                >
                  <span className="bg-gradient-to-b from-white via-white/95 to-white/65 bg-clip-text text-transparent">
                    {displayName}.
                  </span>
                </h1>
                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
                  <span className={cn(TYPE_META, "text-foreground/65")}>
                    {totalFilms.toLocaleString()} {totalFilms === 1 ? "film" : "films"}
                  </span>
                  <span className="text-foreground/20">·</span>
                  <span className={cn(TYPE_META, "text-accent")}>
                    {followerCount.toLocaleString()} followers
                  </span>
                  {memberFor && (
                    <>
                      <span className="text-foreground/20">·</span>
                      <span className={cn(TYPE_META, "text-foreground/65")}>
                        member {memberFor}
                      </span>
                    </>
                  )}
                  {email && (
                    <>
                      <span className="text-foreground/20">·</span>
                      <span className={cn(TYPE_META, "text-foreground/55")}>
                        {email}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT CLUSTER — credits chip + jump to studio */}
            <div className="shrink-0 flex flex-col sm:flex-row lg:flex-col gap-2.5 lg:items-end">
              <Link
                to="/account?tab=credits"
                className={cn(
                  "group/credits inline-flex items-center gap-3 rounded-2xl px-5 py-3.5",
                  "border border-accent/40 bg-gradient-to-br from-[hsl(var(--accent)/0.18)] via-[hsl(var(--accent)/0.06)] to-transparent",
                  "backdrop-blur-md transition-all",
                  "hover:border-accent/60 hover:from-[hsl(var(--accent)/0.26)]",
                )}
              >
                <Coins className="h-5 w-5 text-accent" strokeWidth={1.5} />
                <div className="leading-tight">
                  <div className={cn(TYPE_META, "text-accent/85")}>Credits</div>
                  <div className="font-mono text-[20px] tabular-nums text-foreground tracking-tight">
                    {balance.toLocaleString()}
                  </div>
                </div>
                <ArrowRight
                  className="h-4 w-4 text-accent/70 transition-transform group-hover/credits:translate-x-0.5"
                  strokeWidth={1.5}
                />
              </Link>
              <Link
                to="/studio"
                className={cn(
                  "group/studio inline-flex items-center gap-2 rounded-2xl px-5 py-3.5",
                  "border border-white/[0.10] bg-white/[0.04] backdrop-blur-md",
                  "transition-all",
                  "hover:border-white/[0.20] hover:bg-white/[0.07]",
                )}
              >
                <Sparkles className="h-4 w-4 text-foreground/80" strokeWidth={1.5} />
                <span className="text-[13.5px] text-foreground/95">Direct a new film</span>
                <ArrowRight
                  className="h-4 w-4 text-foreground/55 transition-transform group-hover/studio:translate-x-0.5"
                  strokeWidth={1.5}
                />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats grid
// ─────────────────────────────────────────────────────────────────────────────
function StatsGrid({
  data,
  loading,
  reducedMotion,
}: {
  data: DashboardData;
  loading: boolean;
  reducedMotion: boolean;
}) {
  const stats: Array<{
    label: string;
    value: number;
    sub: string;
    Icon: typeof Film;
    accent?: boolean;
  }> = [
    { label: "Films directed", value: data.totalFilms, sub: `${data.filmsThisMonth} this month`, Icon: Film, accent: true },
    { label: "Lifetime plays", value: data.totalPlays, sub: "Audiences served", Icon: Eye },
    { label: "Lifetime likes", value: data.totalLikes, sub: "Standing ovations", Icon: Heart },
    { label: "Remixes", value: data.totalRemixes, sub: "Films others cloned", Icon: Wand2 },
    { label: "Streak", value: data.streakDays, sub: data.streakDays === 0 ? "Direct today to start" : "Days in a row", Icon: Flame, accent: data.streakDays >= 7 },
    { label: "Tips received", value: data.totalTipsCredits, sub: "Credits earned", Icon: Coins },
  ];

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {stats.map((s, i) => (
        <motion.li
          key={s.label}
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 + i * 0.04, duration: 0.4, ease: EASE_PREMIUM }}
        >
          <StatCard
            label={s.label}
            value={s.value}
            sub={s.sub}
            Icon={s.Icon}
            accent={s.accent}
            loading={loading}
            reducedMotion={reducedMotion}
          />
        </motion.li>
      ))}
    </ul>
  );
}

function StatCard({
  label,
  value,
  sub,
  Icon,
  accent,
  loading,
  reducedMotion,
}: {
  label: string;
  value: number;
  sub: string;
  Icon: typeof Film;
  accent?: boolean;
  loading: boolean;
  reducedMotion: boolean;
}) {
  const display = useAnimatedNumber(value, reducedMotion);
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl",
        "border border-white/[0.07]",
        "bg-gradient-to-br from-white/[0.04] via-white/[0.02] to-transparent",
        "backdrop-blur-xl",
        "p-4 sm:p-5",
        accent && "border-accent/30 bg-gradient-to-br from-[hsl(var(--accent)/0.08)] via-white/[0.02] to-transparent",
      )}
    >
      <div className="flex items-center gap-2">
        <Icon
          className={cn(
            "h-3.5 w-3.5",
            accent ? "text-accent" : "text-muted-foreground/55",
          )}
          strokeWidth={1.5}
        />
        <span className={cn(TYPE_META, "text-muted-foreground/65")}>
          {label}
        </span>
      </div>
      <div
        className={cn(
          "mt-2 font-display italic font-light tracking-tight tabular-nums leading-[1.02]",
          "text-[clamp(1.6rem,2.5vw,2rem)]",
          accent ? "text-foreground" : "text-foreground/95",
        )}
        style={{ fontFamily: "'Fraunces', serif" }}
      >
        {loading ? <span className="text-muted-foreground/35">—</span> : display.toLocaleString()}
      </div>
      <div className={cn(TYPE_META, "mt-1 text-muted-foreground/50")}>
        {sub}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Activity heatmap (last 12 weeks, GitHub-style)
// ─────────────────────────────────────────────────────────────────────────────
function ActivityHeatmap({
  heatmap,
  totalMonth,
  streak,
}: {
  heatmap: Record<string, number>;
  totalMonth: number;
  streak: number;
}) {
  const weeks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // 12 weeks * 7 days = 84 cells. Last column is "this week".
    const cells: Array<{ date: string; count: number }> = [];
    for (let i = 83; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      cells.push({ date: key, count: heatmap[key] ?? 0 });
    }
    // Reshape to 12 columns of 7
    const cols: Array<Array<{ date: string; count: number }>> = [];
    for (let c = 0; c < 12; c++) {
      cols.push(cells.slice(c * 7, (c + 1) * 7));
    }
    return cols;
  }, [heatmap]);

  const maxCount = useMemo(() => {
    let m = 0;
    for (const v of Object.values(heatmap)) if (v > m) m = v;
    return m;
  }, [heatmap]);

  const intensity = (count: number) => {
    if (count <= 0) return 0;
    if (maxCount <= 1) return 1;
    return Math.min(4, Math.ceil((count / maxCount) * 4));
  };

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-3xl",
        "border border-white/[0.07] bg-gradient-to-br from-white/[0.04] via-white/[0.02] to-transparent backdrop-blur-xl",
        "p-6 sm:p-7",
      )}
    >
      <header className="flex items-baseline justify-between gap-3 flex-wrap mb-5">
        <div>
          <div className={cn(TYPE_META, "text-muted-foreground/55")}>
            ◆ Activity
          </div>
          <h3
            className="mt-1 font-display italic text-[22px] font-light tracking-tight text-foreground"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            Last 12 weeks.
          </h3>
        </div>
        <div className="flex items-center gap-4 text-right">
          <div>
            <div className={cn(TYPE_META, "text-muted-foreground/55")}>
              This month
            </div>
            <div className="font-mono text-[18px] tabular-nums text-foreground tracking-tight">
              {totalMonth}
            </div>
          </div>
          <div>
            <div className={cn(TYPE_META, "text-muted-foreground/55 flex items-center gap-1 justify-end")}>
              <Flame className="h-3 w-3" strokeWidth={1.5} />
              <span>Streak</span>
            </div>
            <div className={cn("font-mono text-[18px] tabular-nums tracking-tight", streak >= 7 ? "text-accent" : "text-foreground")}>
              {streak}
            </div>
          </div>
        </div>
      </header>

      <div className="flex items-end gap-1.5 overflow-hidden">
        {weeks.map((col, ci) => (
          <div key={ci} className="flex flex-col gap-1.5">
            {col.map((cell) => {
              const lvl = intensity(cell.count);
              return (
                <div
                  key={cell.date}
                  className={cn(
                    "h-3 w-3 rounded-[3px] transition-colors",
                    lvl === 0 && "bg-white/[0.03]",
                    lvl === 1 && "bg-[hsl(var(--accent)/0.18)]",
                    lvl === 2 && "bg-[hsl(var(--accent)/0.36)]",
                    lvl === 3 && "bg-[hsl(var(--accent)/0.65)]",
                    lvl === 4 && "bg-accent shadow-[0_0_12px_hsl(var(--accent)/0.6)]",
                  )}
                  title={`${cell.date} — ${cell.count} render${cell.count === 1 ? "" : "s"}`}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-5 flex items-center gap-2">
        <span className={cn(TYPE_META, "text-muted-foreground/45")}>Less</span>
        {[0, 1, 2, 3, 4].map((lvl) => (
          <span
            key={lvl}
            className={cn(
              "h-3 w-3 rounded-[3px]",
              lvl === 0 && "bg-white/[0.03]",
              lvl === 1 && "bg-[hsl(var(--accent)/0.18)]",
              lvl === 2 && "bg-[hsl(var(--accent)/0.36)]",
              lvl === 3 && "bg-[hsl(var(--accent)/0.65)]",
              lvl === 4 && "bg-accent",
            )}
          />
        ))}
        <span className={cn(TYPE_META, "text-muted-foreground/45")}>More</span>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Achievements card
// ─────────────────────────────────────────────────────────────────────────────
function AchievementsCard({
  achievements,
}: {
  achievements: Array<{ label: string; sub: string; tier: 1 | 2 | 3 }>;
}) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-3xl",
        "border border-white/[0.07] bg-gradient-to-br from-white/[0.04] via-white/[0.02] to-transparent backdrop-blur-xl",
        "p-6 sm:p-7",
      )}
    >
      <header className="flex items-baseline justify-between gap-3 mb-5">
        <div>
          <div className={cn(TYPE_META, "text-muted-foreground/55")}>
            ◆ Trophies
          </div>
          <h3
            className="mt-1 font-display italic text-[22px] font-light tracking-tight text-foreground"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            Earned.
          </h3>
        </div>
        <div className={cn(TYPE_META, "text-accent/85 tabular-nums")}>
          {achievements.length}/12
        </div>
      </header>

      {achievements.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/40 p-6 text-center">
          <Trophy className="mx-auto h-5 w-5 text-muted-foreground/55" strokeWidth={1.4} />
          <p className={cn(TYPE_META, "mt-3 text-muted-foreground/60")}>
            No trophies yet — direct your first film to unlock "First Film."
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-2.5">
          {achievements.map((a, i) => (
            <motion.li
              key={a.label}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                delay: 0.05 + i * 0.04,
                duration: 0.32,
                ease: EASE_PREMIUM,
              }}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3.5 py-2.5",
                "border border-white/[0.06] bg-white/[0.02]",
              )}
            >
              <span
                className={cn(
                  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                  a.tier === 1 && "bg-[hsl(var(--accent)/0.10)] ring-1 ring-inset ring-[hsl(var(--accent)/0.25)]",
                  a.tier === 2 && "bg-[hsl(var(--accent)/0.16)] ring-1 ring-inset ring-[hsl(var(--accent)/0.40)]",
                  a.tier === 3 && "bg-[hsl(45_95%_55%/0.18)] ring-1 ring-inset ring-[hsl(45_95%_55%/0.45)]",
                )}
              >
                <Trophy
                  className={cn(
                    "h-3.5 w-3.5",
                    a.tier === 3 ? "text-[hsl(45_95%_75%)]" : "text-accent",
                  )}
                  strokeWidth={1.5}
                />
              </span>
              <div className="min-w-0">
                <div className="text-[13px] text-foreground/95">{a.label}</div>
                <div className={cn(TYPE_META, "text-muted-foreground/55")}>
                  {a.sub}
                </div>
              </div>
            </motion.li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Recent reels
// ─────────────────────────────────────────────────────────────────────────────
function RecentReels({
  reels,
}: {
  reels: Array<{ id: string; title: string; thumbnail_url: string | null; play_count: number }>;
}) {
  return (
    <section className="space-y-4">
      <header className="flex items-baseline justify-between">
        <div>
          <div className={cn(TYPE_META, "text-muted-foreground/55")}>
            ◆ Recent Films
          </div>
          <h3
            className="mt-1 font-display italic text-[22px] font-light tracking-tight text-foreground"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            Top of the reel.
          </h3>
        </div>
        <Link
          to="/library"
          className={cn(
            "inline-flex items-center gap-1.5 text-[12.5px] text-accent hover:text-foreground transition-colors",
          )}
        >
          <span>All films</span>
          <ArrowRight className="h-3 w-3" strokeWidth={1.5} />
        </Link>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {reels.map((r) => (
          <Link
            key={r.id}
            to={`/r/${r.id}`}
            className={cn(
              "group relative overflow-hidden rounded-xl",
              "border border-white/[0.07] bg-[hsl(220_30%_8%)]",
              "transition-all hover:border-accent/40",
            )}
          >
            <div className="relative aspect-video">
              {r.thumbnail_url ? (
                <img
                  src={r.thumbnail_url}
                  alt=""
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.05]"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center">
                  <Film className="h-6 w-6 text-muted-foreground/30" strokeWidth={1.2} />
                </div>
              )}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[hsl(220_30%_4%/0.92)] via-transparent to-transparent"
              />
              <div className="absolute bottom-0 inset-x-0 p-2.5">
                <div className="font-display italic text-[13px] font-light text-foreground truncate">
                  {r.title}
                </div>
                <div className={cn(TYPE_META, "text-muted-foreground/60 flex items-center gap-1")}>
                  <Eye className="h-2.5 w-2.5" strokeWidth={1.5} />
                  {r.play_count.toLocaleString()}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function useAnimatedNumber(target: number, reducedMotion: boolean) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (reducedMotion) {
      setDisplay(target);
      return;
    }
    if (target === 0) {
      setDisplay(0);
      return;
    }
    const duration = 900;
    const start = performance.now();
    const from = 0;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (target - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, reducedMotion]);
  return display;
}
