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
    <div className="space-y-8">
      {/* HERO — avatar, display name, key meta */}
      <Hero
        avatarUrl={profile?.avatar_url ?? null}
        displayName={profile?.display_name ?? user?.email?.split("@")[0] ?? "Director"}
        email={user?.email ?? null}
        memberFor={memberFor}
        followerCount={data.followerCount}
        balance={balance ?? 0}
        reducedMotion={reducedMotion ?? false}
      />

      {/* STATS GRID — big numbers, animated counters */}
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
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero
// ─────────────────────────────────────────────────────────────────────────────
function Hero({
  avatarUrl,
  displayName,
  email,
  memberFor,
  followerCount,
  balance,
  reducedMotion,
}: {
  avatarUrl: string | null;
  displayName: string;
  email: string | null;
  memberFor: string | null;
  followerCount: number;
  balance: number;
  reducedMotion: boolean;
}) {
  return (
    <motion.section
      initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE_PREMIUM }}
      className={cn(
        "relative overflow-hidden rounded-3xl",
        "border border-white/[0.07]",
        "bg-gradient-to-br from-white/[0.05] via-white/[0.02] to-[hsl(220_30%_4%/0.85)]",
        "backdrop-blur-xl",
        "shadow-[0_30px_80px_-40px_hsl(0_0%_0%/0.7),inset_0_1px_0_hsl(0_0%_100%/0.06)]",
      )}
    >
      {/* Accent halo */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-[20%] opacity-50"
        style={{
          background:
            "radial-gradient(50% 50% at 20% 40%, hsl(var(--accent) / 0.20) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />
      {/* Top hairline */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
      />

      <div className="relative px-7 py-7 sm:px-9 sm:py-9 flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-center gap-5 sm:gap-6">
          {/* Avatar */}
          <div
            className={cn(
              "relative shrink-0 h-[88px] w-[88px] sm:h-[104px] sm:w-[104px]",
              "rounded-full overflow-hidden",
              "border-2 border-white/[0.10]",
              "bg-gradient-to-br from-white/[0.06] to-[hsl(220_30%_8%)]",
              "shadow-[0_24px_60px_-20px_hsl(0_0%_0%/0.6),inset_0_1px_0_hsl(0_0%_100%/0.06)]",
            )}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center font-display italic text-[40px] text-foreground/85">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            {/* Pulse ring */}
            <span
              aria-hidden
              className="absolute -inset-1.5 rounded-full pointer-events-none"
              style={{
                background:
                  "conic-gradient(from 0deg, transparent 0deg, hsl(var(--accent) / 0.5) 90deg, transparent 180deg)",
                animation: reducedMotion
                  ? "none"
                  : "spin 6s linear infinite",
                mask: "radial-gradient(circle, transparent 47%, black 49%)",
                WebkitMask: "radial-gradient(circle, transparent 47%, black 49%)",
              }}
            />
          </div>

          {/* Name + meta */}
          <div className="min-w-0">
            <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.32em]")}>
              ◆ Director
            </div>
            <h1
              className="mt-2 font-display italic font-light leading-[1.02] tracking-tight text-[clamp(2rem,4vw,2.8rem)]"
              style={{ fontFamily: "'Fraunces', serif" }}
            >
              <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/65 bg-clip-text text-transparent">
                {displayName}.
              </span>
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              {email && (
                <span className={cn(TYPE_META, "text-muted-foreground/60")}>
                  {email}
                </span>
              )}
              {memberFor && (
                <>
                  <span className="text-muted-foreground/25">·</span>
                  <span className={cn(TYPE_META, "text-muted-foreground/60")}>
                    member {memberFor}
                  </span>
                </>
              )}
              <span className="text-muted-foreground/25">·</span>
              <span className={cn(TYPE_META, "text-accent")}>
                {followerCount.toLocaleString()} followers
              </span>
            </div>
          </div>
        </div>

        {/* Right cluster — credits chip */}
        <div className="lg:self-center shrink-0">
          <Link
            to="/account?tab=credits"
            className={cn(
              "inline-flex items-center gap-3 rounded-2xl px-5 py-3.5",
              "border border-accent/30 bg-gradient-to-br from-accent/15 to-accent/5",
              "transition-all hover:border-accent/55 hover:from-accent/22",
            )}
          >
            <Coins className="h-5 w-5 text-accent" strokeWidth={1.5} />
            <div className="leading-tight">
              <div className={cn(TYPE_META, "text-accent/85")}>
                Credits
              </div>
              <div className="font-mono text-[20px] tabular-nums text-foreground tracking-tight">
                {balance.toLocaleString()}
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-accent/70 transition-transform group-hover:translate-x-0.5" strokeWidth={1.5} />
          </Link>
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
