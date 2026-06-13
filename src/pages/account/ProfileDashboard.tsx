/**
 * ProfileDashboard — the addictive, full-bleed Profile surface.
 *
 * Architectural intent: everything floats. Only the avatar portrait
 * lives inside a container. Stats, heatmap, achievements, the bio,
 * the CTAs — all of them are pure typography on the canvas. Glass
 * cards have been deliberately removed so the page feels like an
 * editorial spread, not a settings binder.
 *
 * Composition (top → bottom):
 *   - CoverHero        — full-bleed cinematic banner, the portrait is the page
 *   - BioSection       — inline-editable director's note, large italic serif
 *   - StatsGrid        — six floating numbers
 *   - ActivityHeatmap  — floating 12-week grid with floating header
 *   - Achievements     — floating trophies
 *   - RecentReels      — top reels as clean tiles
 *
 * Data: three independent supabase queries (movie_projects,
 * published_reels, profiles_public). Each block degrades
 * independently — one failure can't blank the page.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Film,
  Eye,
  Heart,
  Wand2,
  Flame,
  Sparkles,
  Coins,
  ArrowRight,
  ArrowUpRight,
  Trophy,
  Check,
  Loader2,
  Quote,
  Pencil,
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

const BIO_MAX = 280;

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export default function ProfileDashboard() {
  const { user, profile, refreshProfile } = useAuth();
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
      const { count: totalFilmsCount } = await supabase
        .from("movie_projects")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      next.totalFilms = totalFilmsCount ?? 0;
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

  const displayName =
    profile?.display_name ?? user?.email?.split("@")[0] ?? "Director";

  // ProfileProps may not declare bio (legacy AuthContext type) but the
  // column is present on the table — read defensively.
  const bioInitial = (profile as { bio?: string | null } | null)?.bio ?? "";

  return (
    <div className="relative">
      <CoverHero
        avatarUrl={profile?.avatar_url ?? null}
        displayName={displayName}
        email={user?.email ?? null}
        memberFor={memberFor}
        followerCount={data.followerCount}
        totalFilms={data.totalFilms}
        balance={balance ?? 0}
        userId={user?.id ?? ""}
        reducedMotion={reducedMotion ?? false}
      />

      {/* Everything below is container-less. Just typography on the
          canvas. The cover gradient tails into the page bg seamlessly. */}
      <div className="relative mx-auto w-full max-w-[1180px] px-4 pb-32 sm:px-8 lg:px-12 -mt-12 sm:-mt-16 space-y-24">
        <BioSection
          initial={bioInitial}
          userId={user?.id ?? ""}
          onSaved={refreshProfile}
          reducedMotion={reducedMotion ?? false}
        />
        <StatsRow data={data} loading={loading} reducedMotion={reducedMotion ?? false} />
        <ActivityHeatmap heatmap={data.heatmap} totalMonth={data.filmsThisMonth} streak={data.streakDays} />
        <AchievementsFloat achievements={achievements} />
        {data.recentReels.length > 0 && <RecentReels reels={data.recentReels} />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CoverHero — full-bleed cinematic banner. Container-less buttons.
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
        "h-[clamp(560px,76vh,820px)]",
      )}
    >
      {/* BACKGROUND PHOTO */}
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

      {/* Multi-layer overlays — vignettes + bottom fade */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, hsl(220 30% 4% / 0.55) 0%, hsl(220 30% 4% / 0.15) 28%, hsl(220 30% 4% / 0.20) 60%, hsl(220 30% 4% / 0.72) 85%, hsl(220 30% 4% / 1.00) 100%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to right, hsl(220 30% 4% / 0.55) 0%, transparent 35%, transparent 65%, hsl(220 30% 4% / 0.30) 100%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 opacity-30 mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.92' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.05   0 0 0 0 0.08   0 0 0 0 0.12   0 0 0 0.6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />

      {/* CONTENT — content is constrained but unboxed */}
      <div className="absolute inset-0 mx-auto w-full max-w-[1180px] px-4 sm:px-8 lg:px-12">
        {/* TOP-RIGHT: floating link, no chip */}
        <div className="absolute top-7 right-4 sm:right-8 lg:right-12">
          <FloatingLink to="/account?tab=settings" icon={<Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />}>
            Edit profile
          </FloatingLink>
        </div>

        {/* BOTTOM: identity stack on the left, CTAs on the right.
            The avatar keeps its container (per spec). Everything
            else floats — pure typography. */}
        <div className="absolute bottom-20 sm:bottom-24 left-4 sm:left-8 lg:left-12 right-4 sm:right-8 lg:right-12">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-end gap-5 sm:gap-7 min-w-0">
              {/* CONTAINED: the avatar */}
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

              {/* FLOATING: name & meta — no container */}
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

            {/* FLOATING: CTAs — no containers, just typography */}
            <div className="shrink-0 flex flex-col gap-6 sm:flex-row sm:gap-10 lg:flex-col lg:items-end lg:gap-7 pb-2">
              <BigStat
                label="◆ Credits"
                value={balance.toLocaleString()}
                href="/account?tab=credits"
                accent
              />
              <FloatingLink
                to="/studio"
                icon={<Sparkles className="h-4 w-4" strokeWidth={1.5} />}
                size="lg"
              >
                Direct a new film
              </FloatingLink>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FloatingLink — container-less navigation. Just text + icon + arrow.
// Underline reveals on hover from the left.
// ─────────────────────────────────────────────────────────────────────────────
function FloatingLink({
  to,
  icon,
  children,
  size = "sm",
}: {
  to: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  size?: "sm" | "lg";
}) {
  return (
    <Link
      to={to}
      className={cn(
        "group/fl relative inline-flex items-center gap-2 text-foreground/85 transition-colors",
        "hover:text-foreground",
        size === "sm" ? "text-[13px]" : "text-[15px] font-light tracking-tight",
      )}
    >
      {icon && (
        <span className="text-accent/85 transition-colors group-hover/fl:text-accent">
          {icon}
        </span>
      )}
      <span className="relative">
        {children}
        {/* Underline reveal — origin left → right on hover */}
        <span
          aria-hidden
          className="absolute -bottom-1 left-0 right-0 h-px origin-left scale-x-0 bg-gradient-to-r from-accent via-accent/40 to-transparent transition-transform duration-500 ease-out group-hover/fl:scale-x-100"
        />
      </span>
      <ArrowUpRight
        className={cn(
          "transition-all duration-300",
          size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5",
          "text-foreground/45 group-hover/fl:text-accent group-hover/fl:translate-x-0.5 group-hover/fl:-translate-y-0.5",
        )}
        strokeWidth={1.5}
      />
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BigStat — container-less stat with optional link
// ─────────────────────────────────────────────────────────────────────────────
function BigStat({
  label,
  value,
  href,
  accent,
}: {
  label: string;
  value: string;
  href?: string;
  accent?: boolean;
}) {
  const inner = (
    <div className="text-right lg:text-right">
      <div
        className={cn(
          TYPE_META,
          accent ? "text-accent/85" : "text-foreground/55",
          "tracking-[0.32em]",
        )}
      >
        {label}
      </div>
      <div
        className={cn(
          "mt-1 font-display italic font-light tabular-nums leading-[0.95]",
          "text-[clamp(2.4rem,4vw,3.6rem)]",
          accent ? "text-foreground" : "text-foreground/90",
        )}
        style={{
          fontFamily: "'Fraunces', serif",
          textShadow: "0 4px 20px hsl(0 0% 0% / 0.45)",
        }}
      >
        {value}
      </div>
    </div>
  );
  return href ? (
    <Link to={href} className="group transition-opacity hover:opacity-90">
      {inner}
    </Link>
  ) : (
    inner
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BioSection — inline-editable director's note. Pure typography.
// ─────────────────────────────────────────────────────────────────────────────
function BioSection({
  initial,
  userId,
  onSaved,
  reducedMotion,
}: {
  initial: string;
  userId: string;
  onSaved: () => Promise<void>;
  reducedMotion: boolean;
}) {
  const [value, setValue] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setValue(initial);
  }, [initial]);

  // Auto-resize the textarea as the user types — no jank, no scroll.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta || !editing) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, [value, editing]);

  const enterEdit = () => {
    setEditing(true);
    setTimeout(() => {
      taRef.current?.focus();
      const ta = taRef.current;
      if (ta) {
        ta.setSelectionRange(ta.value.length, ta.value.length);
      }
    }, 50);
  };

  const cancel = () => {
    setValue(initial);
    setEditing(false);
  };

  const save = useCallback(async () => {
    if (!userId) return;
    const next = value.trim().slice(0, BIO_MAX);
    if (next === initial.trim()) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ bio: next })
        .eq("id", userId);
      if (error) throw error;
      setSavedAt(Date.now());
      await onSaved();
      setEditing(false);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[BioSection] save failed", e);
    } finally {
      setSaving(false);
    }
  }, [userId, value, initial, onSaved]);

  // Hide the "Saved ✓" badge after a bit so the page returns to clean
  // typography.
  useEffect(() => {
    if (!savedAt) return;
    const t = window.setTimeout(() => setSavedAt(null), 2400);
    return () => window.clearTimeout(t);
  }, [savedAt]);

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void save();
    }
  };

  const trimmed = value.trim();
  const remaining = BIO_MAX - value.length;

  return (
    <motion.section
      initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: EASE_PREMIUM, delay: 0.1 }}
      className="relative max-w-[820px]"
    >
      <header className="flex items-center justify-between mb-5">
        <div
          className={cn(
            TYPE_META,
            "text-muted-foreground/55 tracking-[0.34em] flex items-center gap-2",
          )}
        >
          <Quote className="h-3 w-3 text-accent/70" strokeWidth={1.5} />
          <span>◆ Director's note</span>
        </div>
        <AnimatePresence mode="wait">
          {saving ? (
            <motion.span
              key="saving"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={cn(TYPE_META, "text-muted-foreground/55 flex items-center gap-1.5")}
            >
              <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />
              Saving
            </motion.span>
          ) : savedAt ? (
            <motion.span
              key="saved"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={cn(TYPE_META, "text-accent flex items-center gap-1.5")}
            >
              <Check className="h-3 w-3" strokeWidth={2} />
              Saved
            </motion.span>
          ) : editing ? (
            <motion.span
              key="counter"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={cn(
                TYPE_META,
                "tabular-nums",
                remaining < 20 ? "text-accent" : "text-muted-foreground/45",
              )}
            >
              {remaining} left
            </motion.span>
          ) : trimmed ? (
            <motion.button
              key="edit"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              type="button"
              onClick={enterEdit}
              className={cn(
                TYPE_META,
                "text-muted-foreground/45 hover:text-accent transition-colors flex items-center gap-1.5",
              )}
            >
              <Pencil className="h-3 w-3" strokeWidth={1.5} />
              Edit
            </motion.button>
          ) : null}
        </AnimatePresence>
      </header>

      {/* Hanging quote — decorative serif glyph anchored just outside */}
      <span
        aria-hidden
        className="absolute -left-2 sm:-left-7 top-12 font-display italic text-[clamp(5rem,9vw,8rem)] leading-none text-accent/15 select-none pointer-events-none"
        style={{ fontFamily: "'Fraunces', serif" }}
      >
        “
      </span>

      {editing ? (
        <div>
          <textarea
            ref={taRef}
            value={value}
            onChange={(e) => setValue(e.target.value.slice(0, BIO_MAX))}
            onKeyDown={onKey}
            placeholder="What kind of films do you make? What world are you building?"
            rows={3}
            className={cn(
              "block w-full resize-none bg-transparent outline-none",
              "font-display italic font-light tracking-tight",
              "text-[clamp(1.4rem,2.4vw,2rem)] leading-[1.32]",
              "text-foreground placeholder:text-foreground/30",
              "border-b border-accent/40 focus:border-accent pb-3",
              "caret-accent",
            )}
            style={{ fontFamily: "'Fraunces', serif" }}
          />
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className={cn(
                "inline-flex items-center gap-2 text-[13px] text-accent",
                "transition-opacity hover:opacity-80 disabled:opacity-40",
              )}
            >
              <Check className="h-3.5 w-3.5" strokeWidth={2} />
              <span>Save</span>
              <span className={cn(TYPE_META, "text-muted-foreground/45")}>
                ⌘ ↵
              </span>
            </button>
            <button
              type="button"
              onClick={cancel}
              className={cn(
                "inline-flex items-center gap-2 text-[13px] text-muted-foreground/70",
                "transition-colors hover:text-foreground",
              )}
            >
              Cancel
              <span className={cn(TYPE_META, "text-muted-foreground/45")}>
                Esc
              </span>
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={enterEdit}
          className={cn(
            "group/bio block w-full text-left",
            "font-display italic font-light tracking-tight",
            "text-[clamp(1.4rem,2.4vw,2rem)] leading-[1.32]",
            "text-foreground/90 transition-colors",
            "hover:text-foreground",
          )}
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          {trimmed ? (
            <span className="relative">
              {trimmed}
              <span aria-hidden className="text-accent/55">.</span>
            </span>
          ) : (
            <span className="text-foreground/30 group-hover/bio:text-foreground/55 transition-colors">
              Write your director's note…
            </span>
          )}
        </button>
      )}
    </motion.section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StatsRow — container-less. Just floating numbers in a grid.
// ─────────────────────────────────────────────────────────────────────────────
function StatsRow({
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
    <section>
      <header className="mb-7">
        <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.34em]")}>
          ◆ The numbers
        </div>
        <h2
          className="mt-2 font-display italic text-[clamp(1.6rem,2.6vw,2.2rem)] font-light leading-tight tracking-tight"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/60 bg-clip-text text-transparent">
            Everything you've built.
          </span>
        </h2>
      </header>

      <ul className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3 lg:grid-cols-6 lg:gap-x-6">
        {stats.map((s, i) => (
          <motion.li
            key={s.label}
            initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.04, duration: 0.45, ease: EASE_PREMIUM }}
          >
            <FloatingStat
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
    </section>
  );
}

function FloatingStat({
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
    <div>
      <div className="flex items-center gap-2">
        <Icon
          className={cn("h-3.5 w-3.5", accent ? "text-accent" : "text-muted-foreground/55")}
          strokeWidth={1.5}
        />
        <span className={cn(TYPE_META, "text-muted-foreground/60 tracking-[0.28em]")}>
          {label}
        </span>
      </div>
      <div
        className={cn(
          "mt-3 font-display italic font-light tracking-tight tabular-nums leading-[0.95]",
          "text-[clamp(2.8rem,4.6vw,3.6rem)]",
          accent ? "text-foreground" : "text-foreground/95",
        )}
        style={{
          fontFamily: "'Fraunces', serif",
          textShadow: accent
            ? "0 2px 24px hsl(var(--accent) / 0.25)"
            : "0 2px 18px hsl(0 0% 0% / 0.4)",
        }}
      >
        {loading ? <span className="text-foreground/30">—</span> : display.toLocaleString()}
      </div>
      <div className={cn(TYPE_META, "mt-2 text-muted-foreground/50 tracking-[0.18em]")}>
        {sub}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ActivityHeatmap — container-less. Header + grid floating.
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
    const cells: Array<{ date: string; count: number }> = [];
    for (let i = 83; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      cells.push({ date: key, count: heatmap[key] ?? 0 });
    }
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
    <section>
      <header className="flex items-end justify-between gap-3 flex-wrap mb-7">
        <div>
          <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.34em]")}>
            ◆ Activity
          </div>
          <h3
            className="mt-2 font-display italic text-[clamp(1.6rem,2.6vw,2.2rem)] font-light tracking-tight"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/60 bg-clip-text text-transparent">
              Last 12 weeks.
            </span>
          </h3>
        </div>
        <div className="flex items-end gap-10">
          <div>
            <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.28em]")}>
              This month
            </div>
            <div
              className="mt-1 font-display italic text-[28px] font-light tabular-nums tracking-tight"
              style={{ fontFamily: "'Fraunces', serif" }}
            >
              {totalMonth}
            </div>
          </div>
          <div>
            <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.28em] flex items-center gap-1 justify-end")}>
              <Flame className="h-3 w-3" strokeWidth={1.5} />
              <span>Streak</span>
            </div>
            <div
              className={cn(
                "mt-1 font-display italic text-[28px] font-light tabular-nums tracking-tight",
                streak >= 7 ? "text-accent" : "text-foreground",
              )}
              style={{ fontFamily: "'Fraunces', serif" }}
            >
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
                    lvl === 0 && "bg-foreground/[0.05]",
                    lvl === 1 && "bg-[hsl(var(--accent)/0.20)]",
                    lvl === 2 && "bg-[hsl(var(--accent)/0.38)]",
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

      <div className="mt-5 flex items-center gap-2">
        <span className={cn(TYPE_META, "text-muted-foreground/45")}>Less</span>
        {[0, 1, 2, 3, 4].map((lvl) => (
          <span
            key={lvl}
            className={cn(
              "h-3 w-3 rounded-[3px]",
              lvl === 0 && "bg-foreground/[0.05]",
              lvl === 1 && "bg-[hsl(var(--accent)/0.20)]",
              lvl === 2 && "bg-[hsl(var(--accent)/0.38)]",
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
// AchievementsFloat — container-less trophies, just icon + text rows.
// ─────────────────────────────────────────────────────────────────────────────
function AchievementsFloat({
  achievements,
}: {
  achievements: Array<{ label: string; sub: string; tier: 1 | 2 | 3 }>;
}) {
  return (
    <section>
      <header className="flex items-end justify-between gap-3 mb-7">
        <div>
          <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.34em]")}>
            ◆ Trophies
          </div>
          <h3
            className="mt-2 font-display italic text-[clamp(1.6rem,2.6vw,2.2rem)] font-light tracking-tight"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/60 bg-clip-text text-transparent">
              Earned.
            </span>
          </h3>
        </div>
        <div className={cn(TYPE_META, "text-accent/85 tabular-nums tracking-[0.28em]")}>
          {achievements.length}/12
        </div>
      </header>

      {achievements.length === 0 ? (
        <div className="py-6">
          <Trophy className="h-5 w-5 text-muted-foreground/55 mb-3" strokeWidth={1.4} />
          <p className={cn(TYPE_META, "text-muted-foreground/55")}>
            No trophies yet — direct your first film to unlock "First Film."
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-5">
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
              className="flex items-center gap-3"
            >
              <Trophy
                className={cn(
                  "h-4 w-4 shrink-0",
                  a.tier === 1 && "text-accent/70",
                  a.tier === 2 && "text-accent",
                  a.tier === 3 && "text-[hsl(45_95%_70%)] drop-shadow-[0_0_10px_hsl(45_95%_55%/0.5)]",
                )}
                strokeWidth={1.5}
              />
              <div className="min-w-0">
                <div className="text-[14px] text-foreground/95">{a.label}</div>
                <div className={cn(TYPE_META, "text-muted-foreground/50 tracking-[0.18em]")}>
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
// RecentReels — clean image tiles. Containers here are the images
// themselves, not surface chrome — they're the content.
// ─────────────────────────────────────────────────────────────────────────────
function RecentReels({
  reels,
}: {
  reels: Array<{ id: string; title: string; thumbnail_url: string | null; play_count: number }>;
}) {
  return (
    <section>
      <header className="flex items-end justify-between mb-7">
        <div>
          <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.34em]")}>
            ◆ Recent films
          </div>
          <h3
            className="mt-2 font-display italic text-[clamp(1.6rem,2.6vw,2.2rem)] font-light tracking-tight"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/60 bg-clip-text text-transparent">
              Top of the reel.
            </span>
          </h3>
        </div>
        <Link
          to="/library"
          className={cn(
            "group/all relative inline-flex items-center gap-1.5 text-[13px] text-accent",
          )}
        >
          <span className="relative">
            All films
            <span
              aria-hidden
              className="absolute -bottom-1 left-0 right-0 h-px origin-left scale-x-0 bg-accent/60 transition-transform duration-500 group-hover/all:scale-x-100"
            />
          </span>
          <ArrowRight className="h-3 w-3 transition-transform group-hover/all:translate-x-0.5" strokeWidth={1.5} />
        </Link>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {reels.map((r) => (
          <Link
            key={r.id}
            to={`/r/${r.id}`}
            className="group/tile relative block overflow-hidden rounded-xl transition-transform hover:-translate-y-0.5"
          >
            <div className="relative aspect-video bg-[hsl(220_30%_8%)]">
              {r.thumbnail_url ? (
                <img
                  src={r.thumbnail_url}
                  alt=""
                  className="h-full w-full object-cover transition-transform duration-[1200ms] group-hover/tile:scale-[1.06]"
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
              <div className="absolute bottom-0 inset-x-0 p-3">
                <div className="font-display italic text-[13.5px] font-light text-foreground truncate">
                  {r.title}
                </div>
                <div className={cn(TYPE_META, "text-muted-foreground/60 flex items-center gap-1 mt-0.5")}>
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
