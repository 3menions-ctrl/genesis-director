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
import { Link, useParams } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion, useMotionValue, useTransform } from "framer-motion";
import {
  Film,
  Eye,
  Play,
  BarChart3,
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
  Calendar,
  UserPlus as UserPlusIcon,
  UserCheck,
  Mail as MailIcon,
  Share2,
  X,
  Crown,
  MoreHorizontal,
  Flag,
  Ban,
  BadgeCheck,
  ShieldCheck,
  CircleCheck,
  Sparkle,
  Pin,
  Target,
  Settings as SettingsIcon,
  CreditCard,
  ChevronRight,
  Briefcase,
  Bell,
  Lock,
  Palette,
  Globe,
  Twitter,
  Instagram,
  Youtube,
  Github,
  Linkedin,
  Music2,
  Link2,
  Camera,
  Image as ImageIcon,
  MapPin,
  AtSign,
  Save as SaveIcon,
} from "lucide-react";
import { BrandInquiryDialog } from "@/components/profile/BrandInquiryDialog";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { useCredits } from "@/contexts/CreditsContext";
import { useFileUpload } from "@/hooks/useFileUpload";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useUserPreferences, type UserPrefs } from "@/contexts/UserPreferencesContext";
import { EASE_PREMIUM, TYPE_META } from "@/lib/design-system";
import { usePageTone, pageToneFromUserHue } from "@/lib/page-tone";

// ─────────────────────────────────────────────────────────────────────────────
// Data shape
// ─────────────────────────────────────────────────────────────────────────────
interface DashboardData {
  totalFilms: number;
  filmsThisMonth: number;
  filmsThisYear: number;
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
  pinnedReels: Array<{
    id: string;
    title: string;
    thumbnail_url: string | null;
    video_url: string | null;
  }>;
}

const EMPTY_DASHBOARD: DashboardData = {
  totalFilms: 0,
  filmsThisMonth: 0,
  filmsThisYear: 0,
  totalPlays: 0,
  totalLikes: 0,
  totalRemixes: 0,
  totalTipsCredits: 0,
  followerCount: 0,
  joinedDate: null,
  heatmap: {},
  streakDays: 0,
  recentReels: [],
  pinnedReels: [],
};

const BIO_MAX = 280;

// Shared grain — same SVG fractal noise used in the cover and the
// backdrop so the whole page has one continuous film-stock texture.
const GRAIN_URL =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.92' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.05   0 0 0 0 0.08   0 0 0 0 0.12   0 0 0 0.6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

/**
 * Deterministic 3-hue identity from a userId. Used by both the cover
 * (when there's no avatar) and the ProfileBackdrop (always) so the
 * whole page shares one colour vocabulary tied to the user.
 */
function useUserHue(userId: string) {
  return useMemo(() => {
    let h = 0;
    for (let i = 0; i < userId.length; i++) {
      h = (h * 31 + userId.charCodeAt(i)) >>> 0;
    }
    const primary = h % 360;
    const secondary = (primary + 60 + ((h >> 8) % 80)) % 360;
    const tertiary = (primary + 180 + ((h >> 16) % 60)) % 360;
    return { primary, secondary, tertiary };
  }, [userId]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
interface ViewedProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  tagline: string | null;
  location: string | null;
  country: string | null;
  created_at: string | null;
  external_links: Record<string, string>;
  verified_at: string | null;
  verified_kind: "identity" | "domain" | "creator" | "partner" | null;
  featured_reel_id: string | null;
  pinned_collections: Array<{
    id: string;
    name: string;
    cover_url: string | null;
    reel_ids: string[];
  }>;
}
interface FeaturedReel {
  id: string;
  title: string;
  thumbnail_url: string | null;
  video_url: string | null;
}
interface PatronTier {
  id: string;
  position: number;
  name: string;
  monthly_credits: number;
  perks: string;
  accent_hsl: string | null;
}
interface PatronGoal {
  id: string;
  label: string;
  target_credits: number;
  current_credits: number;
}

// Smooth-scroll the inline settings editor into view after it mounts. Pure DOM
// (no hooks) so it can be called from click handlers without affecting render.
function revealProfileSettings(enabled: boolean) {
  if (!enabled || typeof document === "undefined") return;
  setTimeout(() => {
    document.getElementById("profile-settings-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 90);
}

export default function ProfileDashboard() {
  const { user, profile, refreshProfile } = useAuth();
  const { balance } = useCredits();
  const reducedMotion = useReducedMotion();
  const [data, setData] = useState<DashboardData>(EMPTY_DASHBOARD);
  const [loading, setLoading] = useState(true);

  // ── Settings ↔ Viewing mode (owner only) ─────────────────────────────
  // When `settingsMode` is true the page swaps text-renderers for inputs
  // in-place — no separate route, same layout, just editable. Driven by
  // the "Edit profile" button in the cover header and the corner gear.
  const [settingsMode, setSettingsMode] = useState(false);
  // "Analytics" sub-view — owner-only. When on, the public profile body
  // (discovery + gallery + stat rail) is swapped for the private
  // "Yours alone" dashboard. Reached via the "Analytics" link in the
  // cover header; cover + bio stay put so it reads as a sub-page.
  const [analyticsMode, setAnalyticsMode] = useState(false);
  // "What I'm working on" — the most-recently-touched non-completed
  // project. Auto-updates from the editor (movie_projects.updated_at).
  const [currentProject, setCurrentProject] = useState<{
    id: string;
    title: string | null;
    thumbnail_url: string | null;
    updated_at: string;
  } | null>(null);

  // Route param `:id` may be either:
  //   • a UUID (/c/<uuid>) — used directly
  //   • a "@handle" (/c/@miraholloway) — resolved via the resolve_username
  //     RPC to a UUID
  // When no param, we're on the owner's own /account or /profile.
  const { id: routeParam } = useParams<{ id: string }>();
  const [resolvedRouteId, setResolvedRouteId] = useState<string | null>(routeParam ?? null);
  const [resolving, setResolving] = useState<boolean>(false);
  useEffect(() => {
    if (!routeParam) { setResolvedRouteId(null); return; }
    // If it already looks like a UUID, no resolution needed.
    if (/^[0-9a-f-]{36}$/i.test(routeParam)) {
      setResolvedRouteId(routeParam);
      return;
    }
    // Strip a leading @ for the canonical handle form.
    const handle = routeParam.replace(/^@/, "").toLowerCase();
    if (!/^[a-z0-9_]{1,30}$/.test(handle)) {
      setResolvedRouteId(routeParam); // let the page show "not found"
      return;
    }
    let cancelled = false;
    setResolving(true);
    (async () => {
      try {
        const { data, error } = await supabase.rpc("resolve_username" as never, { p_username: handle } as never);
        if (cancelled) return;
        if (error) { setResolvedRouteId(null); return; }
        setResolvedRouteId((data as string | null) ?? null);
      } finally {
        if (!cancelled) setResolving(false);
      }
    })();
    return () => { cancelled = true; };
  }, [routeParam]);

  const routeUserId = resolvedRouteId;
  // When a route param is present we're in visitor mode — only fall back
  // to user.id when there's NO param. While the handle is being resolved
  // viewedUserId stays null so we don't accidentally render the visitor's
  // own profile under someone else's URL.
  const viewedUserId = routeParam ? routeUserId : (user?.id ?? null);
  const isOwner = !routeParam || routeUserId === user?.id;

  // Drive the left rail's tonal palette from the viewed user's hue —
  // so the rail picks up the same identity colors as the cover hero,
  // backdrop, and avatar echo. Falls back to a neutral tone when the
  // user id hasn't resolved yet.
  const profileHue = useUserHue(viewedUserId ?? "");
  usePageTone(viewedUserId ? pageToneFromUserHue(profileHue, viewedUserId) : null);

  const [viewed, setViewed] = useState<ViewedProfile | null>(null);
  const [featuredReel, setFeaturedReel] = useState<FeaturedReel | null>(null);
  const [patronTiers, setPatronTiers] = useState<PatronTier[]>([]);
  const [patronGoal, setPatronGoal] = useState<PatronGoal | null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  const [following, setFollowing] = useState(false);
  const [mutualFollows, setMutualFollows] = useState<{
    total: number;
    sample: Array<{ id: string; display_name: string | null; avatar_url: string | null }>;
  } | null>(null);
  const [similar, setSimilar] = useState<Array<{
    id: string; username: string | null; display_name: string | null;
    avatar_url: string | null; cover_url: string | null; country: string | null;
    tagline: string | null; location: string | null; overlap: number;
  }>>([]);

  // The full filmography — EVERY film this creator has, for the gallery.
  // Decoupled from `data.recentReels` (which stays capped for the highlight
  // picker / featured logic). Works for any viewer: published_reels has a
  // public-read RLS policy; the owner additionally sees their own completed
  // projects that were never formally published.
  const [allFilms, setAllFilms] = useState<Array<{
    id: string; title: string; thumbnail_url: string | null;
    video_url: string | null; play_count: number;
  }>>([]);
  const [filmsLoading, setFilmsLoading] = useState(true);

  // Load the viewed user's identity + public stats + reels via the
  // SECURITY DEFINER RPC. Single round-trip, anon-friendly, and we
  // also pick up `viewer_following` for the follow button so we don't
  // need a separate follows query.
  useEffect(() => {
    if (!viewedUserId) { setViewed(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.rpc(
          "profile_overview" as never,
          { p_user_id: viewedUserId } as never,
        );
        if (cancelled) return;
        if (error) {
          console.warn("[ProfileDashboard] overview rpc error", error);
          return;
        }
        const payload = data as any;
        const p = payload?.profile ?? null;
        if (p) {
          setViewed({
            id: p.id,
            username: p.username ?? null,
            display_name: p.display_name ?? null,
            avatar_url: p.avatar_url ?? null,
            cover_url: p.cover_url ?? null,
            bio: p.bio ?? null,
            tagline: p.tagline ?? null,
            location: p.location ?? null,
            country: p.country ?? null,
            created_at: p.created_at ?? null,
            external_links: (p.external_links ?? {}) as Record<string, string>,
            verified_at: p.verified_at ?? null,
            verified_kind: p.verified_kind ?? null,
            featured_reel_id: p.featured_reel_id ?? null,
            pinned_collections: (p.pinned_collections ?? []) as ViewedProfile["pinned_collections"],
          });
        }
        // Featured reel + tiers + goal all arrive in the same RPC payload.
        const fr = payload?.featured_reel ?? null;
        if (fr) {
          setFeaturedReel({
            id: fr.id, title: fr.title,
            thumbnail_url: fr.thumbnail_url ?? null, video_url: fr.video_url ?? null,
          });
        } else {
          setFeaturedReel(null);
        }
        setPatronTiers(((payload?.patron_tiers ?? []) as any[]).map((t) => ({
          id: t.id, position: t.position, name: t.name,
          monthly_credits: t.monthly_credits, perks: t.perks ?? "",
          accent_hsl: t.accent_hsl ?? null,
        })));
        const g = payload?.patron_goal ?? null;
        setPatronGoal(g ? {
          id: g.id, label: g.label,
          target_credits: Number(g.target_credits ?? 0),
          current_credits: Number(g.current_credits ?? 0),
        } : null);
        // Pick up follow state for visitors. The RPC respects auth.uid().
        if (typeof payload?.viewer_following === "boolean") {
          setFollowing(payload.viewer_following);
        }
        // For visitors, hydrate the public stats + reels straight from the
        // RPC so they appear instantly — no second round-trip needed.
        if (!isOwner) {
          const stats = payload?.stats ?? {};
          const reels = (payload?.recent_reels ?? []) as Array<{
            id: string; title: string; thumbnail_url: string | null; play_count?: number | null;
          }>;
          setData((prev) => ({
            ...prev,
            followerCount: Number(stats.followers ?? prev.followerCount),
            totalFilms: Number(stats.reels ?? prev.totalFilms),
            totalPlays: Number(stats.plays ?? prev.totalPlays),
            totalLikes: Number(stats.likes ?? prev.totalLikes),
            totalRemixes: Number(stats.remixes ?? prev.totalRemixes),
            totalTipsCredits: Number(stats.tips ?? prev.totalTipsCredits),
            joinedDate: p?.created_at ?? prev.joinedDate,
            recentReels: reels.slice(0, 12).map((r) => ({
              id: r.id,
              title: r.title,
              thumbnail_url: r.thumbnail_url,
              play_count: Number(r.play_count ?? 0),
            })),
            pinnedReels: (payload?.pinned_reels ?? []).map((r: any) => ({
              id: r.id,
              title: r.title,
              thumbnail_url: r.thumbnail_url ?? null,
              video_url: r.video_url ?? null,
            })),
          }));
          setLoading(false);
        }
      } catch (e) {
        console.warn("[ProfileDashboard] viewed profile fetch failed", e);
      }
    })();
    return () => { cancelled = true; };
  }, [viewedUserId, isOwner]);

  // Follow state arrives via profile_overview RPC's `viewer_following`
  // field — no separate query needed.

  // Recommended-creators rail at the page bottom. Runs for any visitor
  // (and for the owner — discovery is useful on your own page too).
  useEffect(() => {
    if (!viewedUserId) { setSimilar([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.rpc(
          "profile_similar_creators" as never,
          { p_target: viewedUserId, p_limit: 6 } as never,
        );
        if (cancelled || error) return;
        setSimilar(((data ?? []) as any[]).map((r) => ({
          id: r.id, username: r.username ?? null,
          display_name: r.display_name ?? null, avatar_url: r.avatar_url ?? null,
          cover_url: r.cover_url ?? null, country: r.country ?? null,
          tagline: r.tagline ?? null, location: r.location ?? null,
          overlap: Number(r.overlap ?? 0),
        })));
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [viewedUserId]);

  // Full filmography for the gallery. One query path for everyone —
  // published_reels (public RLS), newest first, generous cap. Falls back
  // to the creator's completed movie_projects when they've shipped work
  // without formally publishing a reel (owner sees private; visitors only
  // public).
  useEffect(() => {
    if (!viewedUserId) { setAllFilms([]); setFilmsLoading(false); return; }
    let cancelled = false;
    setFilmsLoading(true);
    (async () => {
      try {
        const { data: reels } = await supabase
          .from("published_reels")
          .select("id, title, thumbnail_url, video_url, play_count, created_at")
          .eq("creator_id", viewedUserId)
          .eq("is_taken_down", false)
          .order("created_at", { ascending: false })
          .limit(500);
        let films = ((reels ?? []) as Array<{
          id: string; title: string | null; thumbnail_url: string | null;
          video_url: string | null; play_count: number | null;
        }>).map((r) => ({
          id: r.id,
          title: r.title ?? "Untitled",
          thumbnail_url: r.thumbnail_url,
          video_url: r.video_url,
          play_count: r.play_count ?? 0,
        }));

        // Fallback to completed projects when there are no published reels.
        if (films.length === 0) {
          let q = supabase
            .from("movie_projects")
            .select("id, title, thumbnail_url, video_url, updated_at")
            .eq("user_id", viewedUserId)
            .eq("status", "completed")
            .not("video_url", "is", null)
            .order("updated_at", { ascending: false })
            .limit(500);
          if (!isOwner) q = q.eq("is_public", true);
          const { data: proj } = await q;
          films = ((proj ?? []) as Array<{
            id: string; title: string | null; thumbnail_url: string | null; video_url: string | null;
          }>).map((p) => ({
            id: p.id,
            title: p.title ?? "Untitled",
            thumbnail_url: p.thumbnail_url,
            video_url: p.video_url,
            play_count: 0,
          }));
        }
        if (!cancelled) setAllFilms(films);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[ProfileDashboard] all-films query failed", e);
      } finally {
        if (!cancelled) setFilmsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [viewedUserId, isOwner]);

  // Mutual-follows social proof: pull a small sample of users that BOTH
  // the viewer and the target follow. Skipped for owner-on-own and for
  // anon viewers (RPC returns an empty sample in those cases).
  useEffect(() => {
    if (isOwner || !user || !viewedUserId) { setMutualFollows(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.rpc(
          "profile_mutual_follows" as never,
          { p_target: viewedUserId, p_sample: 3 } as never,
        );
        if (cancelled || error) return;
        const payload = data as any;
        setMutualFollows({
          total: Number(payload?.mutual_total ?? 0),
          sample: ((payload?.sample ?? []) as any[]).map((m) => ({
            id: m.id, display_name: m.display_name ?? null, avatar_url: m.avatar_url ?? null,
          })),
        });
      } catch {
        if (!cancelled) setMutualFollows(null);
      }
    })();
    return () => { cancelled = true; };
  }, [isOwner, user, viewedUserId]);

  const toggleFollow = async () => {
    if (isOwner) {
      toast.error("You can't follow yourself.");
      return;
    }
    if (!viewedUserId) {
      toast.error("Profile still loading — try again in a sec.");
      return;
    }
    // Re-check live auth state at click time (the auth-context user can
    // lag behind a session refresh / silent sign-out).
    const { data: sessionData } = await supabase.auth.getSession();
    const liveUser = sessionData?.session?.user ?? null;
    if (!liveUser) {
      toast.error("Sign in to follow.");
      navigate("/auth");
      return;
    }
    if (liveUser.id === viewedUserId) {
      toast.error("You can't follow yourself.");
      return;
    }
    setFollowBusy(true);
    const wasFollowing = following;
    // Optimistic — flip + nudge the count so the page feels instant.
    setFollowing(!wasFollowing);
    setData((prev) => ({
      ...prev,
      followerCount: Math.max(0, prev.followerCount + (wasFollowing ? -1 : 1)),
    }));
    try {
      const { data, error } = await supabase.rpc(
        "toggle_follow" as never,
        { p_target: viewedUserId } as never,
      );
      if (error) {
        // Surface the real error message so we can actually debug.
        // eslint-disable-next-line no-console
        console.error("[toggleFollow] RPC error:", error);
        throw error;
      }
      const next = (data as any)?.following ?? !wasFollowing;
      const pending = (data as any)?.pending === true;
      // If this user has follow-approval enabled, the RPC creates a
      // follow_request instead of a follow. Surface the right state.
      if (pending) {
        setFollowing(wasFollowing);
        setData((prev) => ({
          ...prev,
          followerCount: Math.max(0, prev.followerCount + (wasFollowing ? 1 : -1)),
        }));
        toast.success("Request sent — they'll get a chance to accept.");
      } else {
        if (next !== !wasFollowing) {
          setFollowing(next);
          setData((prev) => ({
            ...prev,
            followerCount: Math.max(0, prev.followerCount + (next ? 1 : -1) - (wasFollowing ? -1 : 1)),
          }));
        }
        toast.success(next ? "Following" : "Unfollowed");
      }
    } catch (e) {
      // Roll back the optimistic flip.
      setFollowing(wasFollowing);
      setData((prev) => ({
        ...prev,
        followerCount: Math.max(0, prev.followerCount + (wasFollowing ? 1 : -1)),
      }));
      const raw = e instanceof Error ? e.message : String(e);
      const friendly =
        /auth.required/i.test(raw)         ? "Sign in to follow."
        : /cannot_follow_self/i.test(raw)  ? "You can't follow yourself."
        : /permission denied/i.test(raw)   ? "Sign-in expired. Please sign in again."
        : raw.length > 0                    ? `Couldn't follow: ${raw.slice(0, 140)}`
        :                                     "Couldn't update follow.";
      toast.error(friendly);
    } finally {
      setFollowBusy(false);
    }
  };

  // ── Current project (owner only) ─────────────────────────────────────
  // Pulls the most-recently-touched non-completed project so the page
  // can show a "What I'm working on" badge that auto-updates whenever the
  // editor saves. Cheap query — one row, indexed on (user_id, updated_at).
  useEffect(() => {
    if (!isOwner || !viewedUserId) { setCurrentProject(null); return; }
    let cancelled = false;
    const fetchCurrent = async () => {
      try {
        const { data, error } = await supabase
          .from("movie_projects")
          .select("id, title, thumbnail_url, updated_at, status")
          .eq("user_id", viewedUserId)
          .neq("status", "completed")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cancelled || error || !data) return;
        const row = data as {
          id: string; title: string | null; thumbnail_url: string | null;
          updated_at: string;
        };
        setCurrentProject({
          id: row.id,
          title: row.title,
          thumbnail_url: row.thumbnail_url,
          updated_at: row.updated_at,
        });
      } catch { /* non-fatal */ }
    };
    void fetchCurrent();
    // Refresh whenever the editor signals a project save so the badge
    // stays current without polling.
    const onEditorSaved = () => { void fetchCurrent(); };
    window.addEventListener("editor:project-saved", onEditorSaved);
    return () => {
      cancelled = true;
      window.removeEventListener("editor:project-saved", onEditorSaved);
    };
  }, [isOwner, viewedUserId]);

  const load = useCallback(async () => {
    if (!viewedUserId) {
      setLoading(false);
      return;
    }
    // Visitors get hydrated entirely by the profile_overview RPC effect
    // above — no need to issue heatmap/published_reels/profiles_public
    // queries here. Skipping prevents a race where load() overwrites
    // the RPC's pre-populated state.
    if (!isOwner) {
      return;
    }
    setLoading(true);
    const next: DashboardData = { ...EMPTY_DASHBOARD };

    // ── Owner-only analytics — heatmap, streak, monthly films. Skipped
    // entirely for public visitors so a stranger never learns when a
    // creator opens the app or how often they're shipping.
    if (isOwner) {
      try {
        const since = new Date();
        since.setDate(since.getDate() - 84);
        const sinceIso = since.toISOString();
        const { data: projects } = await supabase
          .from("movie_projects")
          .select("id, created_at, status")
          .eq("user_id", viewedUserId)
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
          .eq("user_id", viewedUserId);
        next.totalFilms = totalFilmsCount ?? 0;
        const yearStart = new Date();
        yearStart.setMonth(0, 1);
        yearStart.setHours(0, 0, 0, 0);
        const { count: yearCount } = await supabase
          .from("movie_projects")
          .select("id", { count: "exact", head: true })
          .eq("user_id", viewedUserId)
          .gte("created_at", yearStart.toISOString());
        next.filmsThisYear = yearCount ?? 0;
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        next.filmsThisMonth =
          projects?.filter(
            (p) =>
              new Date((p as { created_at: string }).created_at) >= monthStart,
          ).length ?? 0;

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
        console.warn("[ProfileDashboard] owner analytics query failed", e);
      }
    }

    // Public reels — visible to everyone via the `published_reels`
    // table's "Public reels readable" RLS. The page totals (plays /
    // likes / remixes) are aggregates of public reel rows, so they're
    // safe to surface to any visitor.
    try {
      const { data: reels } = await supabase
        .from("published_reels")
        .select(
          "id, title, thumbnail_url, play_count, like_count, remix_count, tip_credits",
        )
        .eq("creator_id", viewedUserId)
        .eq("is_taken_down", false)
        .order("play_count", { ascending: false })
        .limit(24);
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
        // For public visitors who can't see private project counts,
        // surface published-reel count as the "films" number.
        if (!isOwner) {
          next.totalFilms = reels.length;
        }
        next.recentReels = reels.slice(0, 12).map((r) => {
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

    // FALLBACK — when published_reels is empty, also surface completed
    // movie_projects (status='completed' AND is_public=true) so a user
    // who Saved without explicitly publishing still appears on their
    // profile for discovery. Was a major gap: every "Save · mark
    // Complete" project disappeared because the profile only read
    // published_reels.
    if (next.recentReels.length === 0) {
      try {
        // Owner sees their own completed work regardless of is_public —
        // RLS already enforces visibility for non-owners. Filtering on
        // is_public=true would have hidden the owner's own private
        // completed projects from their own profile, which read as
        // "my completed work doesn't show up."
        let q = supabase
          .from("movie_projects")
          .select("id, title, thumbnail_url")
          .eq("user_id", viewedUserId)
          .eq("status", "completed")
          .not("video_url", "is", null)
          .order("updated_at", { ascending: false })
          .limit(12);
        if (!isOwner) q = q.eq("is_public", true);
        const { data: completedProjects } = await q;
        if (completedProjects && completedProjects.length > 0) {
          next.recentReels = completedProjects.map((p) => {
            const row = p as { id: string; title: string | null; thumbnail_url: string | null };
            return {
              id: row.id,
              title: row.title ?? "Untitled",
              thumbnail_url: row.thumbnail_url,
              play_count: 0,
            };
          });
          if (!isOwner) next.totalFilms = next.recentReels.length;
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[ProfileDashboard] completed-projects fallback failed", e);
      }
    }

    // Pinned reels — owner path. We resolve pinned_reel_ids to full
    // rows so the rail can render thumbnails just like Recent Films.
    try {
      const { data: prof } = await supabase
        .from("profiles")
        .select("pinned_reel_ids")
        .eq("id", viewedUserId)
        .maybeSingle();
      const ids = ((prof as { pinned_reel_ids?: string[] } | null)?.pinned_reel_ids ?? []).filter(Boolean);
      if (ids.length > 0) {
        const { data: prs } = await supabase
          .from("published_reels")
          .select("id, title, thumbnail_url, video_url")
          .in("id", ids);
        next.pinnedReels = (prs ?? []).map((r: any) => ({
          id: r.id, title: r.title, thumbnail_url: r.thumbnail_url, video_url: r.video_url,
        }));
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[ProfileDashboard] pinned reels query failed", e);
    }

    try {
      // Followers count via the follows table (works for anon — the
      // "Follows are public" RLS policy allows it). profiles_public does
      // NOT have a follower_count column.
      const { count: followerCount } = await supabase
        .from("follows")
        .select("follower_id", { count: "exact", head: true })
        .eq("followed_id", viewedUserId);
      next.followerCount = followerCount ?? 0;
      // Joined date from profiles (anon-safe via "Public profile read" policy).
      const { data: prof } = await supabase
        .from("profiles")
        .select("created_at")
        .eq("id", viewedUserId)
        .maybeSingle();
      if (prof) {
        next.joinedDate = (prof as { created_at?: string }).created_at ?? null;
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[ProfileDashboard] profile query failed", e);
    }

    setData(next);
    setLoading(false);
  }, [viewedUserId, isOwner]);

  useEffect(() => {
    void load();
  }, [load]);

  // Trigger a re-fetch whenever the owner saves a new avatar or cover via
  // the inline upload overlay so the hero updates without a page reload.
  useEffect(() => {
    const onAssetsChanged = () => {
      void load();
      // Also bump viewedUserId-keyed effects by reading the profile again.
      if (viewedUserId) {
        supabase
          .from("profiles_public" as never)
          .select("id, username, display_name, avatar_url, cover_url, bio, tagline, location, country, interests")
          .eq("id", viewedUserId)
          .maybeSingle()
          .then(({ data }) => {
            if (!data) return;
            setViewed((prev) => ({ ...(prev ?? {} as any), ...(data as any) }));
          });
      }
    };
    window.addEventListener("profile:assets-changed", onAssetsChanged);
    return () => window.removeEventListener("profile:assets-changed", onAssetsChanged);
  }, [load, viewedUserId]);

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

  const displayName = isOwner
    ? (profile?.display_name ?? user?.email?.split("@")[0] ?? "Director")
    : (viewed?.display_name ?? "Director");

  // Avatar / cover / bio: prefer the loaded viewed profile (works for both
  // owner and visitor). Fall back to auth-context profile for the owner so
  // there's no flicker on /account before the view fetch resolves.
  const avatarUrl = (viewed?.avatar_url ?? (isOwner ? profile?.avatar_url : null)) ?? null;
  const coverUrl  = (viewed?.cover_url  ?? (isOwner ? (profile as any)?.cover_url : null)) ?? null;
  const bioInitial = (viewed?.bio ?? (isOwner ? (profile as { bio?: string | null } | null)?.bio : null)) ?? "";
  const tagline   = viewed?.tagline ?? null;
  const location  = viewed?.location ?? null;
  const externalLinks = (viewed?.external_links ?? (isOwner ? ((profile as any)?.external_links ?? {}) : {})) as Record<string, string>;
  // Pinned-reel ids → a "pinned" marker on those tiles in the gallery.
  const pinnedFilmIds = useMemo(() => new Set(data.pinnedReels.map((r) => r.id)), [data.pinnedReels]);

  // OpenGraph + Twitter Card: shared links unfurl with the creator's name,
  // tagline, and full cover photo. Canonical to /c/@handle when set.
  usePageMeta({
    title: displayName ? `${displayName} — Small Bridges` : "Profile — Small Bridges",
    description: tagline ?? bioInitial?.slice(0, 200) ?? undefined,
    ogImage: coverUrl ?? avatarUrl ?? undefined,
    ogType: "profile",
    canonicalPath: viewed?.username
      ? `/c/@${viewed.username}`
      : viewedUserId ? `/c/${viewedUserId}` : undefined,
  });

  return (
    <div className="relative isolate overflow-hidden">
      {/* PROFILE BACKDROP — owns the entire page atmosphere so the
          cover and the dashboard feel like one continuous canvas.
          Sits behind everything; content gets relative + z-10 below. */}
      <ProfileBackdrop
        avatarUrl={avatarUrl}
        userId={viewedUserId ?? ""}
        reducedMotion={reducedMotion ?? false}
      />

      {/* Owner-only corner gear — quiet, always visible to the owner, opens
          settings mode. Doubles as a quick exit when settings mode is on. */}
      {isOwner && (
        <CornerGearButton
          active={settingsMode}
          onClick={() => { setSettingsMode((v) => !v); revealProfileSettings(!settingsMode); }}
        />
      )}

      <CoverHero
        avatarUrl={avatarUrl}
        coverUrl={coverUrl}
        displayName={displayName}
        handle={viewed?.username ?? null}
        email={isOwner ? (user?.email ?? null) : null}
        memberFor={memberFor}
        followerCount={data.followerCount}
        totalFilms={data.totalFilms}
        balance={isOwner ? (balance ?? 0) : 0}
        userId={viewedUserId ?? ""}
        reducedMotion={reducedMotion ?? false}
        isOwner={isOwner}
        location={location}
        tagline={tagline}
        following={following}
        followBusy={followBusy}
        onToggleFollow={toggleFollow}
        verifiedKind={viewed?.verified_kind ?? null}
        featuredVideoUrl={featuredReel?.video_url ?? null}
        patronTiers={patronTiers}
        patronGoal={patronGoal}
        settingsMode={settingsMode}
        onToggleSettings={() => { setSettingsMode((v) => !v); revealProfileSettings(!settingsMode); }}
        analyticsMode={analyticsMode}
        onToggleAnalytics={() => setAnalyticsMode((v) => !v)}
        displayNameValue={isOwner ? (profile?.display_name ?? null) : (viewed?.display_name ?? null)}
        onSaveDisplayName={async (next) => {
          if (!viewedUserId) return;
          const trimmed = next.trim().slice(0, 60);
          const { error } = await supabase
            .from("profiles").update({ display_name: trimmed || null }).eq("id", viewedUserId);
          if (error) throw error;
          await refreshProfile();
        }}
        onSaveTagline={async (next) => {
          if (!viewedUserId) return;
          const trimmed = next.trim().slice(0, 160);
          const { error } = await supabase
            .from("profiles").update({ tagline: trimmed || null }).eq("id", viewedUserId);
          if (error) throw error;
          setViewed((prev) => prev ? { ...prev, tagline: trimmed || null } : prev);
          await refreshProfile();
        }}
        onSaveLocation={async (next) => {
          if (!viewedUserId) return;
          const trimmed = next.trim().slice(0, 80);
          const { error } = await supabase
            .from("profiles").update({ location: trimmed || null }).eq("id", viewedUserId);
          if (error) throw error;
          setViewed((prev) => prev ? { ...prev, location: trimmed || null } : prev);
          await refreshProfile();
        }}
        currentProject={currentProject}
      />

      {/* Everything below is container-less. Just typography on the
          canvas. The cover gradient tails into the backdrop seamlessly.
          Bio sits immediately under the hero (smaller top spacing) so
          the owner's "Write your director's note…" prompt and the
          visitor's bio quote are visible without scrolling. */}
      <div className="relative z-10 mx-auto w-full max-w-[1360px] px-4 pb-32 sm:px-8 lg:px-12 pt-10 sm:pt-14 space-y-14 text-left">
        {/* ─── BIO — directly under the cover, a comfortable reading
            column. The director's note sets the tone before the work. */}
        <div className="space-y-6 max-w-3xl">
          {!isOwner && mutualFollows && mutualFollows.total > 0 && (
            <MutualFollowsLine total={mutualFollows.total} sample={mutualFollows.sample} />
          )}
          <BioSection
            initial={bioInitial}
            userId={viewedUserId ?? ""}
            onSaved={refreshProfile}
            reducedMotion={reducedMotion ?? false}
            isOwner={isOwner}
            forceEditing={settingsMode}
          />
          <SocialLinksRow links={externalLinks} />
        </div>

        {/* Owner-only inline settings editor (edits bio/name/links in context). */}
        {isOwner && settingsMode && viewedUserId && (
          <div id="profile-settings-panel" className="scroll-mt-24">
            <ErrorBoundary
              fallback={
                <div className="rounded-2xl bg-white/[0.03] p-6 text-center shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
                  <p className="text-[14px] text-foreground/85">The inline editor hit a snag.</p>
                  <Link to="/account?tab=settings" className="mt-3 inline-flex items-center gap-2 text-[12px] font-mono uppercase tracking-[0.22em] text-accent hover:text-foreground">
                    Open full settings <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              }
            >
              <ProfileSettingsPanel
                userId={viewedUserId}
                initialProfile={{
                  display_name: profile?.display_name ?? null,
                  tagline: viewed?.tagline ?? null,
                  location: viewed?.location ?? null,
                  external_links: externalLinks,
                  preferences: (profile as any)?.preferences ?? {},
                }}
                onClose={() => setSettingsMode(false)}
                onSaved={refreshProfile}
              />
            </ErrorBoundary>
          </div>
        )}

        {/* PUBLIC BODY — hidden when the owner is in the Analytics sub-view. */}
        {!analyticsMode && (
        <>
        {/* ─── Discovery — suggested creators to follow, surfaced ABOVE
            the gallery so the "who else to follow" nudge lands before the
            films. ──────────────────────────────────────────────────── */}
        {similar.length > 0 && (
          <RecommendedCreatorsRail rows={similar} displayName={displayName} />
        )}

        {/* ─── THE WORK + ANALYTICS — the film gallery is the wide centre
            column below the bio; the stat cards + at-a-glance analytics
            live in a sticky, beautifully-contained rail to its right. ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-10 lg:gap-14 items-start">
          <FilmsGallery
            films={allFilms}
            loading={filmsLoading}
            pinnedIds={pinnedFilmIds}
            isOwner={isOwner}
          />

          <aside className="space-y-5 lg:sticky lg:top-6">
            <ProofStatsCard
              plays={data.totalPlays}
              remixes={data.totalRemixes}
              followers={data.followerCount}
              films={Math.max(data.totalFilms, allFilms.length)}
              reducedMotion={reducedMotion ?? false}
            />
            <AtAGlanceCard
              isOwner={isOwner}
              joinedDate={data.joinedDate}
              totalFilms={Math.max(data.totalFilms, allFilms.length)}
              followerCount={data.followerCount}
              totalPlays={data.totalPlays}
              totalLikes={data.totalLikes}
              country={viewed?.country ?? null}
              location={location}
              interests={((viewed as any)?.interests ?? []) as string[]}
              verifiedKind={viewed?.verified_kind ?? null}
              hasPatronTiers={patronTiers.length > 0}
              ownerHasGoal={!!patronGoal}
              creatorName={displayName}
            />
          </aside>
        </div>

        {/* ─── Highlights collections (secondary curation). ────────── */}
        <PinnedCollectionsRail
          collections={viewed?.pinned_collections ?? []}
          isOwner={isOwner}
        />
        </>
        )}

        {/* ─── ANALYTICS sub-view — the owner's private "Yours alone"
            dashboard, shown only when the Analytics link is active. ──── */}
        {isOwner && analyticsMode && (
          <div className="space-y-6">
            <button
              type="button"
              onClick={() => setAnalyticsMode(false)}
              className="group/back inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.28em] text-muted-foreground/70 hover:text-foreground transition-colors"
            >
              <ChevronRight className="h-3.5 w-3.5 rotate-180 transition-transform group-hover/back:-translate-x-0.5" strokeWidth={1.6} />
              Back to profile
            </button>
          <DirectorToolsBand>
            <CompletenessMeter
              hasAvatar={!!avatarUrl}
              hasCover={!!coverUrl}
              hasBio={(bioInitial ?? "").trim().length >= 20}
              hasTagline={!!tagline && tagline.trim().length > 0}
              hasLocation={!!location && location.trim().length > 0}
              hasLinks={Object.values(externalLinks).filter(Boolean).length > 0}
              hasInterests={(viewed?.country !== null) && ((viewed as any)?.interests?.length ?? 0) >= 2}
              hasPinned={data.pinnedReels.length > 0}
              hasFeaturedReel={!!featuredReel}
              hasVerified={!!viewed?.verified_at}
            />
            <StatsRow data={data} loading={loading} reducedMotion={reducedMotion ?? false} />
            {/* Activity + trophies sit side by side — an organized two-up
                row so the heatmap and achievements read as a pair. */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
              <ActivityHeatmap heatmap={data.heatmap} totalMonth={data.filmsThisMonth} streak={data.streakDays} />
              <AchievementsFloat achievements={achievements} />
            </div>
            {data.recentReels.length > 0 && (
              <DirectorReelMaker
                userId={viewedUserId ?? ""}
                reels={data.recentReels}
                currentFeaturedReelId={viewed?.featured_reel_id ?? null}
              />
            )}
            <YearInReviewTeaser filmsThisYear={data.filmsThisYear} totalPlays={data.totalPlays} />
          </DirectorToolsBand>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AtAGlanceCard — sticky-side panel on the identity band. One small card
// with the meta the hero doesn't already cover (joined-date, top
// interests, total plays for the visitor; balance + earnings for owner).
// Also surfaces a quick "Support" CTA when the creator has patron tiers
// so visitors can jump straight to the conversion event below the fold.
// ─────────────────────────────────────────────────────────────────────────────
function AtAGlanceCard({
  isOwner, joinedDate, totalFilms, followerCount, totalPlays, totalLikes,
  country, location, interests, verifiedKind, hasPatronTiers, ownerHasGoal, creatorName,
}: {
  isOwner: boolean;
  joinedDate: string | null;
  totalFilms: number;
  followerCount: number;
  totalPlays: number;
  totalLikes: number;
  country: string | null;
  location: string | null;
  interests: string[];
  verifiedKind: "identity" | "domain" | "creator" | "partner" | null;
  hasPatronTiers: boolean;
  ownerHasGoal: boolean;
  creatorName: string;
}) {
  const joined = useMemo(() => {
    if (!joinedDate) return null;
    return new Date(joinedDate).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }, [joinedDate]);

  const stats = useMemo(() => {
    const list: Array<{ key: string; label: string; value: string; tone?: string }> = [];
    if (joined) list.push({ key: "joined", label: "Member since", value: joined });
    if (location) list.push({ key: "loc", label: "Based in", value: location });
    list.push({ key: "films", label: totalFilms === 1 ? "Public film" : "Public films", value: totalFilms.toLocaleString() });
    list.push({ key: "fol",  label: "Followers", value: followerCount.toLocaleString(), tone: "accent" });
    if (totalPlays > 0) list.push({ key: "plays", label: "Lifetime plays", value: totalPlays.toLocaleString() });
    if (totalLikes > 0 && totalLikes >= 5) list.push({ key: "likes", label: "Likes earned", value: totalLikes.toLocaleString() });
    return list;
  }, [joined, location, totalFilms, followerCount, totalPlays, totalLikes]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl ring-1 ring-inset ring-white/[0.06] bg-white/[0.015] backdrop-blur p-5">
        <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.32em] mb-4 inline-flex items-center gap-2")}>
          ◆ At a glance
        </div>
        <dl className="space-y-3.5">
          {stats.map((s) => (
            <div key={s.key} className="flex items-baseline justify-between gap-3 min-w-0">
              <dt className={cn(TYPE_META, "text-muted-foreground/65 tracking-[0.20em] truncate")}>{s.label}</dt>
              <dd
                className={cn(
                  "text-[14px] font-light tabular-nums truncate text-right",
                  s.tone === "accent" ? "text-accent" : "text-foreground/95",
                )}
                style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic" }}
              >
                {s.value}
              </dd>
            </div>
          ))}
        </dl>

        {interests.length > 0 && (
          <>
            <div className={cn(TYPE_META, "mt-5 mb-3 text-muted-foreground/55 tracking-[0.20em]")}>
              Interests
            </div>
            <div className="flex flex-wrap gap-1.5">
              {interests.slice(0, 5).map((tag) => (
                <span
                  key={tag}
                  className="inline-block h-6 px-2.5 rounded-full bg-white/[0.04] text-[10px] font-mono uppercase tracking-[0.14em] text-foreground/75"
                >
                  {tag}
                </span>
              ))}
            </div>
          </>
        )}

        {verifiedKind && (
          <div className="mt-5 pt-4 border-t border-white/[0.05] inline-flex items-center gap-2 text-[11px] text-emerald-200/85">
            <ShieldCheck className="h-3 w-3" strokeWidth={1.8} />
            <span className="font-mono uppercase tracking-[0.20em]">Verified {verifiedKind}</span>
          </div>
        )}

        {/* Owner-only quick links — Inbox, Credits and Settings now live
            here on the profile (they were pulled off the left rail). Sits
            below the verified tab: "I've claimed this profile, now what do
            I want to do?". Visitors never see this. */}
        {isOwner && (
          <div className={cn("pt-4 mt-4 border-t border-white/[0.05] flex flex-col gap-3", verifiedKind ? "" : "border-t-0 pt-0 mt-0")}>
            <Link
              to="/inbox"
              className="group/setlink flex items-center gap-2.5 text-[11px] font-mono uppercase tracking-[0.22em] text-muted-foreground/75 hover:text-foreground transition-colors"
            >
              <MailIcon className="h-3.5 w-3.5 text-muted-foreground/65 group-hover/setlink:text-accent transition-colors" strokeWidth={1.6} />
              <span>Inbox</span>
              <ChevronRight className="ml-auto h-3 w-3 opacity-50 group-hover/setlink:opacity-100 group-hover/setlink:translate-x-0.5 transition-all" />
            </Link>
            <Link
              to="/account?tab=credits"
              className="group/setlink flex items-center gap-2.5 text-[11px] font-mono uppercase tracking-[0.22em] text-muted-foreground/75 hover:text-foreground transition-colors"
            >
              <CreditCard className="h-3.5 w-3.5 text-muted-foreground/65 group-hover/setlink:text-accent transition-colors" strokeWidth={1.6} />
              <span>Credits</span>
              <ChevronRight className="ml-auto h-3 w-3 opacity-50 group-hover/setlink:opacity-100 group-hover/setlink:translate-x-0.5 transition-all" />
            </Link>
            <Link
              to="/account?tab=settings"
              className="group/setlink flex items-center gap-2.5 text-[11px] font-mono uppercase tracking-[0.22em] text-muted-foreground/75 hover:text-foreground transition-colors"
            >
              <SettingsIcon className="h-3.5 w-3.5 text-muted-foreground/65 group-hover/setlink:text-accent transition-colors" strokeWidth={1.6} />
              <span>Profile settings</span>
              <ChevronRight className="ml-auto h-3 w-3 opacity-50 group-hover/setlink:opacity-100 group-hover/setlink:translate-x-0.5 transition-all" />
            </Link>
          </div>
        )}
      </div>

      {/* Patron CTA intentionally removed from here. The single entry
          point is the "Patron" pill in the floating CoverHero links
          above; duplicating it here was creating visual noise. */}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FilmsGallery — the creator's FULL filmography in a beautiful poster
// grid. Every film, newest first. Each tile is a 16:9 poster with a
// hover-lift, a play glyph, the title, and view count. Pinned films wear
// an accent dot. This is the lead surface of the left column.
// ─────────────────────────────────────────────────────────────────────────────
function FilmsGallery({
  films, loading, pinnedIds, isOwner,
}: {
  films: Array<{ id: string; title: string; thumbnail_url: string | null; video_url: string | null; play_count: number }>;
  loading: boolean;
  pinnedIds: Set<string>;
  isOwner: boolean;
}) {
  return (
    <section>
      <header className="flex items-baseline justify-between gap-6 mb-7 flex-wrap">
        <div>
          <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.34em] inline-flex items-center gap-2")}>
            <Film className="h-3 w-3 text-accent/85" strokeWidth={1.6} />
            ◆ Filmography
          </div>
          <h3
            className="mt-2 font-display italic text-[clamp(1.6rem,2.6vw,2.2rem)] font-light tracking-tight"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/65 bg-clip-text text-transparent">
              Every film.
            </span>
          </h3>
        </div>
        {films.length > 0 && (
          <span className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.24em] tabular-nums")}>
            {films.length} {films.length === 1 ? "film" : "films"}
          </span>
        )}
      </header>

      {loading ? (
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-video rounded-2xl bg-white/[0.03] ring-1 ring-inset ring-white/[0.05] animate-pulse" />
          ))}
        </div>
      ) : films.length === 0 ? (
        <div className="rounded-2xl ring-1 ring-inset ring-white/[0.06] bg-white/[0.015] py-16 px-6 text-center">
          <Film className="h-7 w-7 mx-auto text-muted-foreground/45" strokeWidth={1.3} />
          <div className="mt-4 font-display italic text-[20px] text-foreground/90" style={{ fontFamily: "'Fraunces', serif" }}>
            {isOwner ? "No films yet." : "No public films yet."}
          </div>
          <p className="mt-2 text-[13px] text-muted-foreground/65 max-w-sm mx-auto">
            {isOwner
              ? "Direct your first film in the Studio and it'll line up here."
              : "When this director publishes, their work will fill this gallery."}
          </p>
          {isOwner && (
            <Link
              to="/studio"
              className="mt-5 inline-flex items-center gap-2 h-10 px-5 rounded-full bg-accent/90 hover:bg-accent text-black text-[11px] font-mono uppercase tracking-[0.22em] transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" /> Direct a film
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
          {films.map((f) => (
            <GalleryTile key={f.id} film={f} pinned={pinnedIds.has(f.id)} />
          ))}
        </div>
      )}
    </section>
  );
}

function GalleryTile({
  film, pinned,
}: {
  film: { id: string; title: string; thumbnail_url: string | null; play_count: number };
  pinned: boolean;
}) {
  return (
    <Link
      to={`/r/${film.id}`}
      className="group/tile relative block aspect-video rounded-2xl overflow-hidden ring-1 ring-inset ring-white/[0.06] hover:ring-accent/45 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_60px_-24px_hsl(0_0%_0%/0.8)]"
    >
      {film.thumbnail_url ? (
        <img
          src={film.thumbnail_url}
          alt={film.title}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover group-hover/tile:scale-[1.05] transition-transform duration-700"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] to-transparent flex items-center justify-center">
          <Film className="h-7 w-7 text-white/25" strokeWidth={1.3} />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />

      {/* Hover play glyph. */}
      <div className="absolute inset-0 grid place-items-center opacity-0 group-hover/tile:opacity-100 transition-opacity duration-300">
        <span className="grid place-items-center h-12 w-12 rounded-full bg-accent/90 text-black ring-1 ring-inset ring-white/30 backdrop-blur shadow-[0_8px_30px_hsl(var(--accent)/0.45)]">
          <Play className="h-5 w-5 translate-x-[1px]" strokeWidth={2} fill="currentColor" />
        </span>
      </div>

      {pinned && (
        <span
          aria-hidden
          title="Pinned"
          className="absolute top-3 left-3 h-2 w-2 rounded-full bg-accent shadow-[0_0_12px_hsl(var(--accent)/0.8)]"
        />
      )}

      <div className="absolute inset-x-0 bottom-0 p-3.5">
        <div
          className="text-[14px] leading-snug font-light text-white line-clamp-2"
          style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic" }}
        >
          {film.title || "Untitled"}
        </div>
        {film.play_count > 0 && (
          <div className={cn(TYPE_META, "text-white/65 mt-1.5 inline-flex items-center gap-1 tracking-[0.16em]")}>
            <Eye className="h-2.5 w-2.5" strokeWidth={1.5} />
            {film.play_count.toLocaleString()}
          </div>
        )}
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ProofStatsCard — a compact, beautifully-contained read of the numbers
// that matter (films · views · remixes · followers) for the right rail.
// Replaces the old full-width "What people did" number wall — same data,
// now a card that sits alongside the gallery.
// ─────────────────────────────────────────────────────────────────────────────
function ProofStatsCard({
  plays, remixes, followers, films, reducedMotion,
}: {
  plays: number; remixes: number; followers: number; films: number; reducedMotion: boolean;
}) {
  const rows: Array<{ key: string; label: string; value: number; Icon: typeof Eye; accent?: boolean }> = [
    { key: "films", label: "Films", value: films, Icon: Film },
    { key: "plays", label: "Views", value: plays, Icon: Eye, accent: true },
    { key: "remix", label: "Remixes", value: remixes, Icon: Wand2 },
    { key: "fol", label: "Followers", value: followers, Icon: UserCheck },
  ];
  return (
    <div className="rounded-2xl ring-1 ring-inset ring-white/[0.06] bg-white/[0.015] backdrop-blur p-5">
      <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.32em] mb-4 inline-flex items-center gap-2")}>
        ◆ The proof
      </div>
      <div className="grid grid-cols-2 gap-3.5">
        {rows.map((r) => (
          <ProofStatCell key={r.key} {...r} reducedMotion={reducedMotion} />
        ))}
      </div>
    </div>
  );
}

function ProofStatCell({
  label, value, Icon, accent, reducedMotion,
}: {
  label: string; value: number; Icon: typeof Eye; accent?: boolean; reducedMotion: boolean;
}) {
  const display = useAnimatedNumber(value, reducedMotion);
  return (
    <div className="rounded-xl bg-white/[0.02] ring-1 ring-inset ring-white/[0.05] px-3.5 py-3">
      <div className={cn("inline-flex items-center gap-1.5", TYPE_META, "tracking-[0.18em]", accent ? "text-accent/85" : "text-muted-foreground/55")}>
        <Icon className="h-3 w-3" strokeWidth={1.6} />
        {label}
      </div>
      <div
        className={cn(
          "mt-1.5 font-display italic font-light tracking-tight tabular-nums leading-none text-[clamp(1.5rem,2.4vw,1.9rem)]",
          accent ? "text-foreground" : "text-foreground/90",
        )}
        style={{ fontFamily: "'Fraunces', serif" }}
      >
        {display.toLocaleString()}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FilmsSection — YouTube-watch-page layout. A single featured reel sits
// big on the LEFT (the "now playing" frame), with a compact "All films"
// stack on the RIGHT — like YouTube's Up Next sidebar.
//
// Featured is whichever exists first:
//   1. The first pinned reel (creator's own choice)
//   2. The most-played recent reel (organic top pick)
//
// Everything else cascades into the sidebar.
// Mobile: stacks vertically with the featured first.
// ─────────────────────────────────────────────────────────────────────────────
function FilmsSection({
  pinned, recent, isOwner, onUnpin,
}: {
  pinned: Array<{ id: string; title: string; thumbnail_url: string | null; video_url: string | null }>;
  recent: Array<{ id: string; title: string; thumbnail_url: string | null; play_count: number }>;
  isOwner: boolean;
  onUnpin: (reelId: string) => Promise<void> | void;
}) {
  // Normalise both lists into one shape so the sidebar can show pinned + recent
  // without duplicating. play_count is optional (pinned doesn't carry it).
  type Tile = { id: string; title: string; thumbnail_url: string | null; play_count?: number; isPinned: boolean };
  const pinnedTiles: Tile[] = pinned.map((r) => ({ id: r.id, title: r.title, thumbnail_url: r.thumbnail_url, isPinned: true }));
  const recentTiles: Tile[] = recent.map((r) => ({ id: r.id, title: r.title, thumbnail_url: r.thumbnail_url, play_count: r.play_count, isPinned: false }));
  // Dedup: a recent reel that's also pinned should only appear once (as pinned).
  const pinnedIds = new Set(pinnedTiles.map((t) => t.id));
  const merged: Tile[] = [...pinnedTiles, ...recentTiles.filter((r) => !pinnedIds.has(r.id))];
  if (merged.length === 0) return null;
  const featured = merged[0];
  const upNext = merged.slice(1);

  return (
    <section>
      <header className="flex items-baseline justify-between gap-6 mb-7 flex-wrap">
        <div>
          <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.34em] inline-flex items-center gap-2")}>
            <Film className="h-3 w-3 text-accent/85" strokeWidth={1.6} />
            ◆ Films
          </div>
          <h3
            className="mt-2 font-display italic text-[clamp(1.6rem,2.6vw,2.2rem)] font-light tracking-tight"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/65 bg-clip-text text-transparent">
              The reel.
            </span>
          </h3>
        </div>
        {merged.length > 6 && (
          <Link
            to="/library"
            className="group/all inline-flex items-center gap-1.5 text-[12px] text-accent"
          >
            <span className="relative">
              All films
              <span aria-hidden className="absolute -bottom-1 left-0 right-0 h-px origin-left scale-x-0 bg-accent/60 transition-transform duration-500 group-hover/all:scale-x-100" />
            </span>
            <ArrowRight className="h-3 w-3 transition-transform group-hover/all:translate-x-0.5" strokeWidth={1.5} />
          </Link>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1.85fr_1fr] gap-6 lg:gap-8 items-start">
        {/* ── Left: the featured tile (big, cinematic). ───────────── */}
        <FeaturedFilmTile
          tile={featured}
          isOwner={isOwner}
          onUnpin={onUnpin}
        />

        {/* ── Right: "Up next" stack — YouTube-style scrollable list. ── */}
        {upNext.length > 0 ? (
          <div className="lg:max-h-[640px] lg:overflow-y-auto pr-1 lg:pr-2 -mr-1 lg:-mr-2 scrollbar-thin">
            <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.32em] mb-3 inline-flex items-center gap-2")}>
              ◇ Up next
            </div>
            <ul className="space-y-2.5">
              {upNext.map((t) => (
                <li key={t.id}>
                  <UpNextRow tile={t} isOwner={isOwner} onUnpin={onUnpin} />
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="lg:hidden" />
        )}
      </div>
    </section>
  );
}

// Big "now playing" tile on the left.
function FeaturedFilmTile({
  tile, isOwner, onUnpin,
}: {
  tile: { id: string; title: string; thumbnail_url: string | null; play_count?: number; isPinned: boolean };
  isOwner: boolean;
  onUnpin: (reelId: string) => Promise<void> | void;
}) {
  return (
    <div className="relative group/featured">
      <Link
        to={`/r/${tile.id}`}
        className="block relative aspect-video rounded-2xl overflow-hidden ring-1 ring-inset ring-white/[0.06] hover:ring-accent/40 transition-all"
      >
        {tile.thumbnail_url ? (
          <img
            src={tile.thumbnail_url}
            alt=""
            className="absolute inset-0 w-full h-full object-cover group-hover/featured:scale-[1.02] transition-transform duration-700"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] to-transparent flex items-center justify-center">
            <Film className="h-8 w-8 text-white/30" strokeWidth={1.3} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
        {tile.isPinned && (
          <span aria-hidden className="absolute top-4 left-4 h-2 w-2 rounded-full bg-accent shadow-[0_0_14px_hsl(var(--accent)/0.75)]" />
        )}
        <div className="absolute bottom-0 inset-x-0 p-5">
          <div className={cn(TYPE_META, "text-accent/85 mb-1.5 tracking-[0.32em]")}>
            {tile.isPinned ? "◆ Pinned" : "◆ Featured"}
          </div>
          <div
            className="text-[clamp(1.2rem,1.8vw,1.6rem)] font-light text-white"
            style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic" }}
          >
            {tile.title || "Untitled"}
          </div>
          {typeof tile.play_count === "number" && (
            <div className={cn(TYPE_META, "text-white/65 mt-1.5 inline-flex items-center gap-1 tracking-[0.18em]")}>
              <Eye className="h-2.5 w-2.5" strokeWidth={1.5} />
              {tile.play_count.toLocaleString()}
            </div>
          )}
        </div>
      </Link>
      {isOwner && tile.isPinned && (
        <button
          type="button"
          onClick={() => void onUnpin(tile.id)}
          title="Unpin"
          className="absolute top-4 right-4 inline-flex items-center gap-1 h-8 px-3 rounded-full bg-black/55 hover:bg-rose-500/85 backdrop-blur ring-1 ring-inset ring-white/15 hover:ring-rose-300/65 text-white/85 hover:text-white text-[10px] font-mono uppercase tracking-[0.22em] transition-colors opacity-0 group-hover/featured:opacity-100"
        >
          <X className="h-3 w-3" />Unpin
        </button>
      )}
    </div>
  );
}

// Compact row in the "Up next" sidebar.
function UpNextRow({
  tile, isOwner, onUnpin,
}: {
  tile: { id: string; title: string; thumbnail_url: string | null; play_count?: number; isPinned: boolean };
  isOwner: boolean;
  onUnpin: (reelId: string) => Promise<void> | void;
}) {
  return (
    <div className="relative group/row">
      <Link
        to={`/r/${tile.id}`}
        className="grid grid-cols-[160px_1fr] gap-3 items-start rounded-xl p-1.5 hover:bg-white/[0.025] transition-colors"
      >
        <div className="relative aspect-video rounded-lg overflow-hidden ring-1 ring-inset ring-white/[0.05] bg-black/40">
          {tile.thumbnail_url ? (
            <img src={tile.thumbnail_url} alt="" className="absolute inset-0 w-full h-full object-cover group-hover/row:scale-[1.03] transition-transform duration-500" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Film className="h-4 w-4 text-white/30" strokeWidth={1.3} />
            </div>
          )}
          {tile.isPinned && (
            <span aria-hidden className="absolute top-1.5 left-1.5 h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_hsl(var(--accent)/0.65)]" />
          )}
        </div>
        <div className="min-w-0 pt-0.5">
          <div className="text-[13px] text-foreground font-light line-clamp-2 leading-snug" style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic" }}>
            {tile.title || "Untitled"}
          </div>
          {typeof tile.play_count === "number" && (
            <div className={cn(TYPE_META, "text-muted-foreground/60 mt-1 inline-flex items-center gap-1 tracking-[0.16em]")}>
              <Eye className="h-2.5 w-2.5" strokeWidth={1.5} />
              {tile.play_count.toLocaleString()}
            </div>
          )}
        </div>
      </Link>
      {isOwner && tile.isPinned && (
        <button
          type="button"
          onClick={() => void onUnpin(tile.id)}
          title="Unpin"
          className="absolute top-2 right-2 inline-flex items-center justify-center h-6 w-6 rounded-full bg-black/45 hover:bg-rose-500/80 text-white/85 hover:text-white transition-colors opacity-0 group-hover/row:opacity-100"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DirectorToolsBand — owner-only wrapper that visually steps the
// analytics/settings cluster down a level from the public-facing content
// above. Same canvas, smaller eyebrow, denser spacing.
// ─────────────────────────────────────────────────────────────────────────────
function DirectorToolsBand({ children }: { children: React.ReactNode }) {
  return (
    <section className="relative text-left rounded-3xl ring-1 ring-inset ring-white/[0.06] bg-gradient-to-b from-white/[0.02] to-white/[0.005] backdrop-blur-sm p-6 sm:p-8 lg:p-10">
      <header className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className={cn(TYPE_META, "text-accent/70 tracking-[0.34em] inline-flex items-center gap-2")}>
            <Lock className="h-3 w-3" strokeWidth={1.7} />
            ◆ Director tools
          </div>
          <h3
            className="mt-2 font-display italic text-[clamp(1.6rem,2.4vw,2.1rem)] font-light tracking-tight text-foreground/90"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            Yours alone.
          </h3>
          <p className="mt-1.5 text-[12.5px] text-muted-foreground/65 max-w-xl">
            Analytics, achievements, your channel trailer picker — private to you, never shown to visitors.
          </p>
        </div>
        <span className={cn(TYPE_META, "text-muted-foreground/45 tracking-[0.24em] inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] ring-1 ring-inset ring-white/[0.06] px-3 h-7")}>
          <Lock className="h-2.5 w-2.5" strokeWidth={1.7} /> Private
        </span>
      </header>
      <div className="space-y-6">{children}</div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// YearInReviewTeaser — floating section that leads into the full
// cinematic /me/year retrospective. Lives on the Profile page (not in
// the LeftRail) so it shows up in context with everything else this
// director has built.
// ─────────────────────────────────────────────────────────────────────────────
function YearInReviewTeaser({
  filmsThisYear,
  totalPlays,
}: {
  filmsThisYear: number;
  totalPlays: number;
}) {
  // Pull the year from a known absolute reference. Date.now() is
  // available inside React renders; only workflow scripts forbid it.
  const year = new Date().getFullYear();

  return (
    <section className="relative overflow-hidden rounded-2xl ring-1 ring-inset ring-accent/20 bg-gradient-to-br from-accent/[0.07] via-white/[0.02] to-transparent backdrop-blur p-6 sm:p-8">
      <div aria-hidden className="pointer-events-none absolute -top-1/3 -right-10 h-64 w-64 rounded-full bg-accent/15 blur-3xl" />
      <header className="relative mb-7">
        <div
          className={cn(
            TYPE_META,
            "text-muted-foreground/55 tracking-[0.34em] flex items-center gap-2",
          )}
        >
          <Calendar className="h-3 w-3 text-accent/70" strokeWidth={1.5} />
          <span>◆ Your year</span>
        </div>
        <h3
          className="mt-2 font-display italic font-light tracking-tight leading-[0.95]"
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: "clamp(2.2rem, 4vw, 3.4rem)",
          }}
        >
          <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/60 bg-clip-text text-transparent">
            {year}.
          </span>
        </h3>
      </header>

      <div className="relative grid grid-cols-1 lg:grid-cols-[1.4fr_auto] gap-10 items-end">
        <p
          className="max-w-xl text-[clamp(1.05rem,1.5vw,1.25rem)] leading-[1.5] font-light text-foreground/75 italic font-display"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          Your year on Small Bridges, told in cinematic cards.
          {filmsThisYear > 0 ? (
            <>
              {" "}
              <span className="text-accent not-italic font-mono text-[14px] tabular-nums tracking-[0.05em]">
                {filmsThisYear}
              </span>{" "}
              {filmsThisYear === 1 ? "film" : "films"} this year,
              {totalPlays > 0 && (
                <>
                  {" "}reaching{" "}
                  <span className="text-accent not-italic font-mono text-[14px] tabular-nums tracking-[0.05em]">
                    {totalPlays.toLocaleString()}
                  </span>{" "}plays
                </>
              )} — every streak, every highlight, every moment that
              mattered.
            </>
          ) : (
            <> Direct your first film to start writing the chapter.</>
          )}
        </p>

        <Link
          to="/me/year"
          className="group/year inline-flex items-center gap-2 text-[14px] text-accent shrink-0"
        >
          <span className="relative">
            Open your year in review
            <span
              aria-hidden
              className="absolute -bottom-1 left-0 right-0 h-px origin-left scale-x-0 bg-gradient-to-r from-accent via-accent to-accent/40 transition-transform duration-500 ease-out group-hover/year:scale-x-100"
            />
          </span>
          <ArrowUpRight
            className="h-3.5 w-3.5 transition-transform group-hover/year:translate-x-0.5 group-hover/year:-translate-y-0.5"
            strokeWidth={1.5}
          />
        </Link>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ProfileBackdrop — the page-wide atmosphere. Lives behind everything
// (z-0 inside this dashboard's isolation) and stitches the cover and
// the dashboard sections together with shared colour, grain, and a
// persistent soft echo of the user's avatar.
//
// Layers (top → bottom):
//   1. Hue-tinted vertical wash that runs the full page height
//   2. Soft echo of the avatar at very low opacity carried down the
//      page (or procedural mesh when there's no avatar)
//   3. Accent halo bleeding into the area where the cover ends
//   4. Two off-canvas ambient blooms (secondary + tertiary hues)
//   5. Subtle vertical light beam down the middle column
//   6. Continuous fractal grain
// ─────────────────────────────────────────────────────────────────────────────
function ProfileBackdrop({
  avatarUrl,
  userId,
  reducedMotion,
}: {
  avatarUrl: string | null;
  userId: string;
  reducedMotion: boolean;
}) {
  const hue = useUserHue(userId);
  void reducedMotion; // backdrop is static — no motion to gate

  return (
    <div
      aria-hidden
      // FIXED — extends to the full viewport so the rail (which sits
      // on top at z-40) can be overlaid ON the page background, not
      // stop at the rail's left edge. Page content is still bounded
      // by FoundationShell's `md:pl-[320px]` shift so it doesn't
      // overlap the rail.
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {/* 1. Hue-tinted base wash — full page. Slides from the
            primary hue through the secondary into the canvas grey.
            Opacity capped so the SpineBackdrop's deep navy still
            reads beneath. */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, hsl(${hue.primary} 38% 7%) 0%, hsl(${hue.primary} 28% 5%) 38%, hsl(${hue.secondary} 24% 4%) 72%, hsl(220 30% 3%) 100%)`,
          opacity: 0.75,
        }}
      />

      {/* 2. Avatar echo — the same portrait carried down the page at
            very low opacity. The cover handles the dramatic top; the
            backdrop carries a softer trail through the rest of the
            scroll so the page never loses its subject. */}
      {avatarUrl && (
        <div
          className="absolute inset-x-0 top-0"
          style={{
            height: "180vh",
            backgroundImage: `url(${avatarUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center top",
            filter: "blur(180px) saturate(1.35) brightness(0.45)",
            opacity: 0.28,
          }}
        />
      )}

      {/* 3. Accent halo — anchored at the seam between cover and
            dashboard. Where the cover's photo dissolves, this halo
            picks up to keep the energy alive. */}
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          top: "55vh",
          width: "140vw",
          height: "90vh",
          background: `radial-gradient(50% 60% at 50% 30%, hsl(${hue.primary} 75% 50% / 0.20) 0%, hsl(${hue.primary} 65% 40% / 0.07) 40%, transparent 70%)`,
          filter: "blur(50px)",
        }}
      />

      {/* 4a. Side bloom — secondary hue, left mid-page */}
      <div
        className="absolute"
        style={{
          top: "100vh",
          left: "-15vw",
          width: "65vw",
          height: "55vh",
          background: `radial-gradient(circle, hsl(${hue.secondary} 70% 50% / 0.16) 0%, transparent 60%)`,
          filter: "blur(90px)",
        }}
      />

      {/* 4b. Side bloom — tertiary hue, right lower-page */}
      <div
        className="absolute"
        style={{
          top: "160vh",
          right: "-15vw",
          width: "65vw",
          height: "55vh",
          background: `radial-gradient(circle, hsl(${hue.tertiary} 65% 45% / 0.13) 0%, transparent 60%)`,
          filter: "blur(90px)",
        }}
      />

      {/* 5. Vertical light beam down the middle — gives the page a
            subtle "stage spot" feel that ties the cover portrait to
            the dashboard sections beneath. Very subtle (~4%). */}
      <div
        className="absolute inset-y-0 left-1/2 -translate-x-1/2"
        style={{
          width: "44vw",
          background: `linear-gradient(180deg, transparent 0%, hsl(${hue.primary} 65% 55% / 0.05) 22%, hsl(${hue.primary} 65% 55% / 0.04) 78%, transparent 100%)`,
          filter: "blur(80px)",
        }}
      />

      {/* 6. Continuous grain — same SVG as the cover so the texture
            reads as one unbroken film stock all the way down. */}
      <div
        className="absolute inset-0 opacity-[0.07] mix-blend-overlay"
        style={{ backgroundImage: GRAIN_URL }}
      />

      {/* 7. Bottom vignette — lets the page end naturally on the
            SpineBackdrop's deep canvas without a hard cut. */}
      <div
        className="absolute bottom-0 inset-x-0"
        style={{
          height: "30vh",
          background:
            "linear-gradient(to bottom, transparent 0%, hsl(220 30% 3% / 0.85) 100%)",
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CoverHero — full-bleed cinematic banner. Container-less buttons.
// ─────────────────────────────────────────────────────────────────────────────
function CoverHero({
  avatarUrl,
  coverUrl,
  displayName,
  handle,
  email,
  memberFor,
  followerCount,
  totalFilms,
  balance,
  userId,
  reducedMotion,
  isOwner,
  location,
  tagline,
  following,
  followBusy,
  onToggleFollow,
  verifiedKind,
  featuredVideoUrl,
  patronTiers,
  patronGoal,
  settingsMode,
  onToggleSettings,
  analyticsMode,
  onToggleAnalytics,
  displayNameValue,
  onSaveDisplayName,
  onSaveTagline,
  onSaveLocation,
  currentProject,
}: {
  avatarUrl: string | null;
  /** Real cover image URL (takes precedence over the blurred-avatar fallback). */
  coverUrl: string | null;
  displayName: string;
  /** Vanity handle (no @). Used for the canonical share URL when set. */
  handle: string | null;
  email: string | null;
  memberFor: string | null;
  followerCount: number;
  totalFilms: number;
  balance: number;
  userId: string;
  reducedMotion: boolean;
  isOwner: boolean;
  location: string | null;
  tagline: string | null;
  following: boolean;
  followBusy: boolean;
  onToggleFollow: () => void;
  /** Verified badge kind — drives the glyph + tooltip after the name. */
  verifiedKind: "identity" | "domain" | "creator" | "partner" | null;
  /** If set, an autoplaying muted loop plays in the hero background instead
   *  of the static cover image — channel-trailer pattern. */
  featuredVideoUrl: string | null;
  /** Patron tiers + goal — passed through to the floating Patron pill so
   *  it can open the Patron Hub modal directly without re-fetching. */
  patronTiers: PatronTier[];
  patronGoal: PatronGoal | null;
  /** When true, the owner is editing — swap text→inputs for name/tagline/
   *  location in place. The dashboard wraps this surface in a single
   *  "Edit profile" ↔ "Done" header button. */
  settingsMode?: boolean;
  /** Toggle settings mode. The dashboard owns the state; we just emit. */
  onToggleSettings?: () => void;
  /** When true, the owner is in the Analytics sub-view. */
  analyticsMode?: boolean;
  /** Toggle the Analytics sub-view. */
  onToggleAnalytics?: () => void;
  /** Raw display_name straight from the profile row (vs the fallback the
   *  hero uses for rendering when empty). Drives the inline input. */
  displayNameValue?: string | null;
  /** Optimistic save callbacks — write, then refresh the parent. */
  onSaveDisplayName?: (next: string) => Promise<void>;
  onSaveTagline?: (next: string) => Promise<void>;
  onSaveLocation?: (next: string) => Promise<void>;
  /** "What I'm working on" badge — auto-updates from the editor. */
  currentProject?: {
    id: string;
    title: string | null;
    thumbnail_url: string | null;
    updated_at: string;
  } | null;
}) {
  // Use the real cover image for the hero background when set; fall back
  // to the blurred-avatar treatment so older profiles still look
  // intentional rather than blank.
  const heroBg = coverUrl ?? avatarUrl;
  const hue = useUserHue(userId);
  // Procedural fallback (no avatar) — same 3 hues the backdrop uses,
  // so the cover and the page beneath share one identity.
  const procedural = useMemo(
    () =>
      `radial-gradient(80% 70% at 15% 30%, hsl(${hue.primary} 70% 55% / 0.7) 0%, transparent 60%), radial-gradient(70% 70% at 80% 70%, hsl(${hue.secondary} 65% 45% / 0.55) 0%, transparent 65%), radial-gradient(100% 80% at 50% 50%, hsl(${hue.tertiary} 55% 35% / 0.45) 0%, transparent 70%), hsl(220 30% 6%)`,
    [hue],
  );

  return (
    <motion.section
      initial={reducedMotion ? { opacity: 1 } : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: EASE_PREMIUM }}
      className={cn(
        "relative z-10 w-full overflow-hidden",
        // Hero height: a large cinematic cover band — the photo is the
        // headline now that the films lead the body. Tall enough to read
        // as a true banner while the portrait + name anchor the lower-left.
        "h-[clamp(460px,62vh,680px)]",
      )}
    >
      {/* BACKGROUND PHOTO */}
      {/* Featured-video layer — channel-trailer pattern. Takes precedence
          over the static cover when set. Autoplays muted + looping so the
          three-second visit-decision window has motion in it. */}
      {featuredVideoUrl ? (
        <video
          src={featuredVideoUrl}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: "brightness(0.78) saturate(1.04)" }}
        />
      ) : (
        <div
          aria-hidden
          className="absolute inset-0"
          style={
            heroBg
              ? {
                  backgroundImage: `url(${heroBg})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center 30%",
                  transform: "scale(1.15)",
                  // When we have a real cover_url, render it sharply (with a
                  // gentle darken). When falling back to the avatar, keep
                  // the heavy blur so the face becomes texture, not a giant
                  // portrait staring at the visitor.
                  filter: coverUrl
                    ? "brightness(0.78) saturate(1.04)"
                    : "blur(48px) brightness(0.55) saturate(1.1)",
                }
              : { background: procedural }
          }
        />
      )}
      {heroBg && !reducedMotion && (
        <motion.div
          aria-hidden
          className="absolute inset-0"
          initial={{ scale: 1.02 }}
          animate={{ scale: 1.10 }}
          transition={{
            duration: 32,
            ease: "linear",
            repeat: Infinity,
            repeatType: "mirror",
          }}
          style={{
            backgroundImage: `url(${heroBg})`,
            backgroundSize: "cover",
            backgroundPosition: "center 30%",
            filter: coverUrl
              ? "brightness(0.78) saturate(1.04)"
              : "blur(48px) brightness(0.55) saturate(1.1)",
          }}
        />
      )}

      {/* Multi-layer overlays — vignettes + dissolve to backdrop.
          Bottom stops fade to TRANSPARENT (not solid canvas) so the
          backdrop's hue-tinted ambient layer emerges below the cover
          instead of an abrupt cut to black. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, hsl(220 30% 4% / 0.55) 0%, hsl(220 30% 4% / 0.15) 28%, hsl(220 30% 4% / 0.18) 55%, hsl(220 30% 4% / 0.45) 82%, hsl(220 30% 4% / 0.0) 100%)",
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
        style={{ backgroundImage: GRAIN_URL }}
      />

      {/* CONTENT — content is constrained but unboxed */}
      <div className="absolute inset-0 mx-auto w-full max-w-[1180px] px-4 sm:px-8 lg:px-12">
        {/* TOP-LEFT: owner-only cover-image swap affordance. Just a quiet
            chip that turns visible on hover. */}
        {isOwner && (
          <div className="absolute top-7 left-4 sm:left-8 lg:left-12 group/cover">
            <InlineUploadOverlay kind="cover" userId={userId} chip />
          </div>
        )}

        {/* TOP-RIGHT: floating links. Owner = Find friends + Edit profile;
            visitor = Follow + Message + Share. Container-less typography. */}
        {/* Sits below the global fixed top-right cluster (credits · search ·
            inbox · bell) so the two control groups never overlap. */}
        <div className="absolute top-[4.25rem] right-4 sm:right-8 lg:right-12 flex items-center gap-6">
          {isOwner ? (
            <>
              <PatronButton
                creatorId={userId}
                creatorName={displayName}
                tiers={patronTiers}
                goal={patronGoal}
                handle={handle}
              />
              {/* The primary mode toggle. "Edit profile" → enters settings
                  mode where every text renderer swaps to an input in-place.
                  "Done" returns to viewing. */}
              {onToggleSettings && (
                <button
                  type="button"
                  onClick={onToggleSettings}
                  className={cn(
                    "group/edit inline-flex items-center gap-2 transition-colors",
                    "text-[11px] font-mono uppercase tracking-[0.32em]",
                    settingsMode
                      ? "text-accent hover:text-accent/85"
                      : "text-foreground/85 hover:text-foreground",
                  )}
                >
                  {settingsMode ? (
                    <Check className="h-3.5 w-3.5" strokeWidth={1.6} />
                  ) : (
                    <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
                  )}
                  {settingsMode ? "Done" : "Edit profile"}
                </button>
              )}
              {/* Analytics sub-view toggle — swaps the public body for the
                  private "Yours alone" dashboard. */}
              {onToggleAnalytics && (
                <button
                  type="button"
                  onClick={onToggleAnalytics}
                  className={cn(
                    "group/analytics inline-flex items-center gap-2 transition-colors",
                    "text-[11px] font-mono uppercase tracking-[0.32em]",
                    analyticsMode
                      ? "text-accent hover:text-accent/85"
                      : "text-foreground/85 hover:text-foreground",
                  )}
                >
                  {analyticsMode ? (
                    <Check className="h-3.5 w-3.5" strokeWidth={1.6} />
                  ) : (
                    <BarChart3 className="h-3.5 w-3.5" strokeWidth={1.5} />
                  )}
                  {analyticsMode ? "Done" : "Analytics"}
                </button>
              )}
              <FloatingLink to="/account?tab=settings" icon={<SettingsIcon className="h-3.5 w-3.5" strokeWidth={1.5} />}>
                Account
              </FloatingLink>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onToggleFollow}
                disabled={followBusy}
                className={cn(
                  "group inline-flex items-center gap-2 transition-colors",
                  "text-[11px] font-mono uppercase tracking-[0.32em]",
                  "disabled:opacity-50",
                  following
                    ? "text-emerald-200 hover:text-emerald-100"
                    : "text-white/85 hover:text-white",
                )}
              >
                {following ? (
                  <UserCheck className="h-3.5 w-3.5" strokeWidth={1.5} />
                ) : (
                  <UserPlusIcon className="h-3.5 w-3.5" strokeWidth={1.5} />
                )}
                {following ? "Following" : "Follow"}
              </button>
              <FloatingLink to={`/inbox?lane=people&dm=${userId}`} icon={<MailIcon className="h-3.5 w-3.5" strokeWidth={1.5} />}>
                Message
              </FloatingLink>
              <BrandInquiryLink recipientId={userId} recipientName={displayName} />
              <PatronButton
                creatorId={userId}
                creatorName={displayName}
                tiers={patronTiers}
                goal={patronGoal}
                handle={handle}
              />
              <button
                type="button"
                onClick={() => {
                  const slug = handle ? `@${handle}` : userId;
                  const url = `${window.location.origin}/c/${slug}`;
                  if (navigator.share) navigator.share({ url, title: displayName }).catch(() => {});
                  else { navigator.clipboard.writeText(url); toast.success("Link copied"); }
                }}
                className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.32em] text-white/70 hover:text-white transition-colors"
              >
                <Share2 className="h-3.5 w-3.5" strokeWidth={1.5} />Share
              </button>
              <SafetyMenu targetId={userId} targetName={displayName} />
            </>
          )}
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
                  "relative shrink-0 group/avatar",
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
                {isOwner && <InlineUploadOverlay kind="avatar" userId={userId} />}
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
                  {/* Owner-only — "What I'm working on" badge.
                      Auto-updates from the editor; quiet but unmistakable. */}
                  {isOwner && currentProject && (
                    <CurrentProjectBadge project={currentProject} />
                  )}
                </div>
                {isOwner && settingsMode && onSaveDisplayName ? (
                  <InlineHeroTextInput
                    initial={displayNameValue ?? displayName}
                    placeholder="Your director name"
                    maxLength={60}
                    onSave={async (v) => {
                      try { await onSaveDisplayName(v); toast.success("Name saved"); }
                      catch (e) { toast.error(e instanceof Error ? e.message : "Save failed"); throw e; }
                    }}
                  />
                ) : (
                  <h1
                    className="mt-3 font-display italic font-light leading-[0.95] tracking-tight flex items-baseline gap-3 flex-wrap"
                    style={{
                      fontFamily: "'Fraunces', serif",
                      fontSize: "clamp(2.8rem, 7vw, 6rem)",
                      textShadow: "0 6px 30px hsl(0 0% 0% / 0.55)",
                    }}
                  >
                    <span className="bg-gradient-to-b from-white via-white/95 to-white/65 bg-clip-text text-transparent">
                      {displayName}.
                    </span>
                    {verifiedKind && <VerifiedBadge kind={verifiedKind} />}
                  </h1>
                )}
                {handle && (
                  <div className={cn(TYPE_META, "mt-2 text-accent/85 tracking-[0.24em]")}>
                    @{handle}
                  </div>
                )}
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

            {/* FLOATING: right-side rail. Owner = credits + direct CTA.
                Visitor = the creator's public meta (location, tagline). */}
            <div className="shrink-0 flex flex-col gap-6 sm:flex-row sm:gap-10 lg:flex-col lg:items-end lg:gap-7 pb-2">
              {isOwner ? (
                <>
                  {settingsMode && onSaveTagline && onSaveLocation ? (
                    <div className="w-full max-w-sm space-y-3">
                      <InlineMicroInput
                        label="Tagline"
                        initial={tagline ?? ""}
                        placeholder="A line you live by"
                        maxLength={160}
                        italic
                        align="right"
                        onSave={async (v) => {
                          try { await onSaveTagline(v); toast.success("Tagline saved"); }
                          catch (e) { toast.error(e instanceof Error ? e.message : "Save failed"); throw e; }
                        }}
                      />
                      <InlineMicroInput
                        label="Location"
                        initial={location ?? ""}
                        placeholder="Brooklyn, NY"
                        maxLength={80}
                        align="right"
                        onSave={async (v) => {
                          try { await onSaveLocation(v); toast.success("Location saved"); }
                          catch (e) { toast.error(e instanceof Error ? e.message : "Save failed"); throw e; }
                        }}
                      />
                    </div>
                  ) : (
                    <>
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
                    </>
                  )}
                </>
              ) : (
                <div className="text-right space-y-3 max-w-xs">
                  {tagline && (
                    <p
                      className="font-display italic text-[clamp(1.1rem,1.6vw,1.4rem)] text-foreground/90 leading-snug"
                      style={{ fontFamily: "'Fraunces', serif" }}
                    >
                      “{tagline}”
                    </p>
                  )}
                  {location && (
                    <div className={cn(TYPE_META, "text-foreground/70 tracking-[0.20em] inline-flex items-center gap-1.5 justify-end")}>
                      <span>◇</span><span>{location}</span>
                    </div>
                  )}
                </div>
              )}
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
  isOwner = true,
  forceEditing = false,
}: {
  initial: string;
  userId: string;
  onSaved: () => Promise<void>;
  reducedMotion: boolean;
  /** When false, BioSection renders the bio read-only — no edit UI. */
  isOwner?: boolean;
  /** When true and isOwner, render in editing mode unconditionally —
   *  used by the parent "Edit profile" toggle so every editor opens at
   *  once instead of needing per-field clicks. */
  forceEditing?: boolean;
}) {
  const [value, setValue] = useState(initial);
  const [editingLocal, setEditingLocal] = useState(false);
  const editing = forceEditing || editingLocal;
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
    setEditingLocal(true);
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
    setEditingLocal(false);
  };

  const save = useCallback(async () => {
    if (!userId) return;
    const next = value.trim().slice(0, BIO_MAX);
    if (next === initial.trim()) {
      setEditingLocal(false);
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
      setEditingLocal(false);
      toast.success("Bio saved");
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[BioSection] save failed", e);
      toast.error(e instanceof Error ? e.message : "Couldn't save bio");
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
          ) : isOwner && trimmed ? (
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
      ) : !isOwner ? (
        // Public visitors get a non-interactive bio render — no edit
        // affordance, no hover state, and we hide the entire block when
        // the viewed user has no bio set.
        trimmed ? (
          <div
            className={cn(
              "font-display italic font-light tracking-tight",
              "text-[clamp(1.4rem,2.4vw,2rem)] leading-[1.32]",
              "text-foreground/90",
            )}
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            <span className="relative">
              {trimmed}
              <span aria-hidden className="text-accent/55">.</span>
            </span>
          </div>
        ) : null
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
    <section className="rounded-2xl ring-1 ring-inset ring-white/[0.07] bg-white/[0.025] backdrop-blur p-6 sm:p-7">
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

      <ul className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
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
    <div
      className={cn(
        "h-full rounded-xl ring-1 ring-inset px-4 py-4 transition-colors",
        accent
          ? "bg-accent/[0.06] ring-accent/25"
          : "bg-white/[0.02] ring-white/[0.06] hover:ring-white/[0.12]",
      )}
    >
      <div className="flex items-center gap-2">
        <Icon
          className={cn("h-3.5 w-3.5", accent ? "text-accent" : "text-muted-foreground/55")}
          strokeWidth={1.5}
        />
        <span className={cn(TYPE_META, "text-muted-foreground/60 tracking-[0.24em] truncate")}>
          {label}
        </span>
      </div>
      <div
        className={cn(
          "mt-2.5 font-display italic font-light tracking-tight tabular-nums leading-[0.95]",
          "text-[clamp(2.1rem,3.4vw,2.8rem)]",
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
      <div className={cn(TYPE_META, "mt-1.5 text-muted-foreground/50 tracking-[0.16em] truncate")}>
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
    <section className="h-full rounded-2xl ring-1 ring-inset ring-white/[0.07] bg-white/[0.025] backdrop-blur p-6 sm:p-7">
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
    <section className="h-full rounded-2xl ring-1 ring-inset ring-white/[0.07] bg-white/[0.025] backdrop-blur p-6 sm:p-7">
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
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
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
  bare = false,
}: {
  reels: Array<{ id: string; title: string; thumbnail_url: string | null; play_count: number }>;
  /** When true, just the grid. Used inside FilmsSection so the outer
   *  "◆ Films / The reel." heading isn't duplicated. */
  bare?: boolean;
}) {
  const Grid = (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
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
  );
  if (bare) return Grid;
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
      {Grid}
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

// ─────────────────────────────────────────────────────────────────────────────
// DirectorReelMaker — owner-only block: pick a published reel as the
// channel trailer, OR auto-pick the top-played one. Plays in the hero.
// (The "AI stitch into a sizzle" path will dispatch to an edge function
// here in the next pass — for now the affordance is reel-selection.)
// ─────────────────────────────────────────────────────────────────────────────
function DirectorReelMaker({
  userId, reels, currentFeaturedReelId,
}: {
  userId: string;
  reels: Array<{ id: string; title: string; thumbnail_url: string | null; play_count: number }>;
  currentFeaturedReelId: string | null;
}) {
  const [busy, setBusy] = useState(false);

  const setFeatured = async (reelId: string | null) => {
    setBusy(true);
    try {
      const { error } = await supabase.from("profiles").update({ featured_reel_id: reelId }).eq("id", userId);
      if (error) throw error;
      toast.success(reelId ? "Channel trailer set." : "Channel trailer cleared.");
      window.dispatchEvent(new CustomEvent("profile:assets-changed"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setBusy(false);
    }
  };

  const autoPickTop = async () => {
    const top = [...reels].sort((a, b) => b.play_count - a.play_count)[0];
    if (!top) return;
    await setFeatured(top.id);
  };

  return (
    <section className="rounded-2xl ring-1 ring-inset ring-white/[0.07] bg-white/[0.025] backdrop-blur p-6 sm:p-7">
      <header className="mb-6">
        <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.34em] inline-flex items-center gap-2")}>
          <Sparkles className="h-3 w-3 text-accent/85" strokeWidth={1.6} />
          ◆ Channel trailer
        </div>
        <h3
          className="mt-2 font-display italic text-[clamp(1.6rem,2.6vw,2.2rem)] font-light tracking-tight"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/65 bg-clip-text text-transparent">
            What plays in your hero.
          </span>
        </h3>
        <p className="mt-2 text-[13px] text-muted-foreground/70 max-w-xl">
          Pick a reel to autoplay (muted, looping) in the cover. Channel-trailer pattern — converts
          visitors at a higher rate than a static image.
        </p>
      </header>

      <div className="flex flex-wrap gap-2 mb-5">
        <button
          type="button"
          onClick={autoPickTop}
          disabled={busy}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-full bg-accent/15 hover:bg-accent/25 text-accent ring-1 ring-inset ring-accent/40 text-[11px] font-mono uppercase tracking-[0.22em] transition-colors disabled:opacity-50"
        >
          <Sparkles className="h-3 w-3" strokeWidth={1.6} />
          Auto-pick top reel
        </button>
        {currentFeaturedReelId && (
          <button
            type="button"
            onClick={() => setFeatured(null)}
            disabled={busy}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-full bg-white/[0.03] hover:bg-white/[0.08] text-muted-foreground/85 hover:text-foreground text-[11px] font-mono uppercase tracking-[0.22em] transition-colors disabled:opacity-50"
          >
            Clear trailer
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {reels.map((r) => {
          const active = r.id === currentFeaturedReelId;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => setFeatured(active ? null : r.id)}
              disabled={busy}
              className={cn(
                "group relative aspect-video rounded-xl overflow-hidden ring-1 ring-inset transition-all text-left",
                active ? "ring-accent shadow-[0_0_0_3px_hsl(var(--accent)/0.20)]" : "ring-white/[0.06] hover:ring-white/30",
              )}
            >
              {r.thumbnail_url ? (
                <img src={r.thumbnail_url} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] to-transparent" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
              <div className="absolute bottom-2 left-2 right-2">
                <div className="text-[11px] text-white truncate" style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic" }}>
                  {r.title || "Untitled"}
                </div>
              </div>
              {active && (
                <div className="absolute top-2 right-2 inline-flex items-center gap-1 h-6 px-2 rounded-full bg-accent text-black text-[9.5px] font-mono uppercase tracking-[0.18em]">
                  Trailer
                </div>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VerifiedBadge — small glyph after the display name. Kind drives the
// glyph + tooltip so visitors learn what the verification means.
// ─────────────────────────────────────────────────────────────────────────────
function VerifiedBadge({ kind }: { kind: "identity" | "domain" | "creator" | "partner" }) {
  const meta = {
    identity: { Icon: BadgeCheck,   tone: "text-sky-300",     label: "Verified identity" },
    domain:   { Icon: ShieldCheck,  tone: "text-emerald-300", label: "Verified domain" },
    creator:  { Icon: CircleCheck,  tone: "text-accent",      label: "Verified creator" },
    partner:  { Icon: Sparkle,      tone: "text-amber-300",   label: "Verified partner" },
  }[kind];
  const { Icon, tone, label } = meta;
  return (
    <span
      title={label}
      className={cn("relative inline-flex items-center", tone)}
      style={{ fontSize: "0.5em", transform: "translateY(-0.35em)" }}
    >
      <Icon className="h-[1.4em] w-[1.4em]" strokeWidth={1.6} />
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CompletenessMeter — owner-only "75% complete" widget. Lists the next
// few high-impact missing pieces with deep-links to the right surface.
// Bound to the same fields the data shows correlate with follow rate.
// ─────────────────────────────────────────────────────────────────────────────
function CompletenessMeter({
  hasAvatar, hasCover, hasBio, hasTagline, hasLocation,
  hasLinks, hasInterests, hasPinned, hasFeaturedReel, hasVerified,
}: {
  hasAvatar: boolean; hasCover: boolean; hasBio: boolean; hasTagline: boolean;
  hasLocation: boolean; hasLinks: boolean; hasInterests: boolean;
  hasPinned: boolean; hasFeaturedReel: boolean; hasVerified: boolean;
}) {
  const items = useMemo(() => [
    { key: "avatar",   done: hasAvatar,        label: "Add a profile photo",     to: "/account?tab=settings", weight: 3 },
    { key: "cover",    done: hasCover,         label: "Set a cover image",       to: "/account?tab=overview", weight: 2 },
    { key: "bio",      done: hasBio,           label: "Write a 1-3 line bio",    to: "/account?tab=overview", weight: 3 },
    { key: "tagline",  done: hasTagline,       label: "Add a tagline",           to: "/account?tab=settings", weight: 2 },
    { key: "location", done: hasLocation,      label: "Add your location",       to: "/account?tab=settings", weight: 2 },
    { key: "links",    done: hasLinks,         label: "Connect a social link",   to: "/account?tab=settings", weight: 2 },
    { key: "tags",     done: hasInterests,     label: "Pick 3 interests",        to: "/account?tab=settings", weight: 2 },
    { key: "pinned",   done: hasPinned,        label: "Pin a reel",              to: "/library",              weight: 2 },
    { key: "trailer",  done: hasFeaturedReel,  label: "Set a channel trailer",   to: "/library",              weight: 3 },
    { key: "verify",   done: hasVerified,      label: "Verify your account",     to: "/account?tab=security", weight: 2 },
  ], [hasAvatar, hasCover, hasBio, hasTagline, hasLocation, hasLinks, hasInterests, hasPinned, hasFeaturedReel, hasVerified]);
  const totalWeight = items.reduce((s, i) => s + i.weight, 0);
  const earned = items.reduce((s, i) => s + (i.done ? i.weight : 0), 0);
  const pct = Math.round((earned / totalWeight) * 100);
  const missing = items.filter((i) => !i.done).slice(0, 4);
  if (pct === 100) return null;
  return (
    <section className="rounded-2xl ring-1 ring-inset ring-white/[0.07] bg-white/[0.025] backdrop-blur p-6 sm:p-7">
      <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.34em] mb-3 inline-flex items-center gap-2")}>
        <Target className="h-3 w-3 text-accent/80" strokeWidth={1.6} />
        ◆ Profile completeness · <span className="tabular-nums text-accent/85">{pct}%</span>
      </div>
      <div className="relative h-1.5 rounded-full bg-white/[0.05] overflow-hidden mb-5">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-accent/70 via-accent/85 to-accent"
        />
      </div>
      {missing.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {missing.map((m) => (
            <Link
              key={m.key}
              to={m.to}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[10px] font-mono uppercase tracking-[0.22em] bg-white/[0.04] hover:bg-accent/15 text-foreground/75 hover:text-accent transition-colors"
            >
              {m.label}<ArrowRight className="h-2.5 w-2.5" />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PatronTiersBlock — slim inline summary. Shows just the goal meter +
// a single "Become a patron" CTA. The tier picker AND the user's
// existing pledges live in `PatronHubDialog`, which opens from this CTA
// so visitors can compare tiers and review their pledges in one place.
// ─────────────────────────────────────────────────────────────────────────────
function PatronTiersBlock({
  tiers, goal, creatorId, creatorName, isOwner, handle,
}: {
  tiers: PatronTier[];
  goal: PatronGoal | null;
  creatorId: string;
  creatorName: string;
  isOwner: boolean;
  handle: string | null;
}) {
  if (tiers.length === 0 && !goal) return null;
  const goalPct = goal ? Math.min(100, Math.round((goal.current_credits / goal.target_credits) * 100)) : 0;
  const tierRange = tiers.length > 0
    ? `${Math.min(...tiers.map((t) => t.monthly_credits)).toLocaleString()}–${Math.max(...tiers.map((t) => t.monthly_credits)).toLocaleString()}`
    : null;
  void creatorName;
  const patronSlug = handle ? `@${handle}` : creatorId;

  return (
    <section id="patron-block" className="relative scroll-mt-16">
      {/* Section header — one heading, not three. The goal label IS the
          headline when there is one; otherwise the simple CTA. */}
      <header className="mb-8">
        <div className={cn(TYPE_META, "text-amber-300/85 tracking-[0.34em] inline-flex items-center gap-2")}>
          <Crown className="h-3 w-3" strokeWidth={1.8} />
          ◆ Patron
        </div>
        <h3
          className="mt-3 font-display italic text-[clamp(1.8rem,3vw,2.6rem)] font-light tracking-[-0.01em] leading-[1.02] max-w-3xl"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/65 bg-clip-text text-transparent">
            {goal ? goal.label : "Become a patron."}
          </span>
        </h3>

        {goal && isOwner && (
          // Goal progress is PRIVATE — only the creator themselves can
          // see the live total + percent funded. Visitors get the goal
          // headline above; that's it.
          <div className="mt-6 max-w-2xl rounded-2xl p-5 bg-white/[0.015] ring-1 ring-inset ring-white/[0.06]"
               style={{ backgroundImage: "linear-gradient(180deg, hsla(38 80% 60% / 0.05) 0%, transparent 100%)" }}>
            <div className="flex items-baseline justify-between mb-3">
              <div className="inline-flex items-baseline gap-2">
                <span className="text-[26px] font-light tabular-nums text-amber-200" style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic" }}>
                  {(goal.current_credits ?? 0).toLocaleString()}
                </span>
                <span className={cn(TYPE_META, "text-muted-foreground/65 tracking-[0.22em]")}>
                  / {goal.target_credits.toLocaleString()} CR · MONTH
                </span>
              </div>
              <span className={cn(TYPE_META, "text-amber-200/85 tabular-nums tracking-[0.22em]")}>
                {goalPct}% FUNDED
              </span>
            </div>
            <div className="relative h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${goalPct}%` }}
                transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-y-0 left-0"
                style={{
                  background: "linear-gradient(90deg, hsl(38 80% 50%) 0%, hsl(45 95% 65%) 60%, hsl(45 100% 70%) 100%)",
                  boxShadow: "0 0 24px hsl(38 80% 60% / 0.45)",
                }}
              />
            </div>
          </div>
        )}
      </header>

      {/* Tier summary + explicit CTA to the full Patron page. */}
      {tiers.length > 0 && (
        <div className="flex flex-wrap items-center gap-4">
          <Link
            to={`/c/${patronSlug}/patron`}
            className="group/cta relative inline-flex items-center gap-2.5 h-11 px-5 rounded-full overflow-hidden text-[11px] font-mono uppercase tracking-[0.26em] text-black"
            style={{
              background: "linear-gradient(180deg, hsl(45 95% 65%) 0%, hsl(38 90% 55%) 100%)",
              boxShadow: "0 12px 32px -10px hsla(45 90% 55% / 0.55)",
            }}
          >
            <span aria-hidden className="absolute inset-0 -translate-x-full group-hover/cta:translate-x-full transition-transform duration-700 ease-out"
                  style={{ background: "linear-gradient(120deg, transparent 30%, hsla(0 0% 100% / 0.35) 50%, transparent 70%)" }} />
            <Crown className="h-3.5 w-3.5 relative" strokeWidth={2} />
            <span className="relative">{isOwner ? "Manage tiers" : "Open patron page"}</span>
          </Link>
          <div className={cn(TYPE_META, "text-muted-foreground/70 tracking-[0.22em]")}>
            {tiers.length} {tiers.length === 1 ? "tier" : "tiers"} {tierRange && `· ${tierRange} CR / MONTH`}
          </div>
        </div>
      )}
    </section>
  );
}

function TierCard({
  tier, index, isPopular, busy, disabled, isOwner, onPledge,
}: {
  tier: PatronTier;
  index: number;
  isPopular: boolean;
  busy: boolean;
  disabled: boolean;
  isOwner: boolean;
  onPledge: (e?: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const accent = tier.accent_hsl ?? "38 80% 60%";
  const reducedMotion = useReducedMotion();
  // Split perks on newlines OR bullet markers so multi-line copy reads as
  // a clean list rather than a paragraph blob.
  const perksLines = (tier.perks ?? "")
    .split(/\r?\n|[·•]/)
    .map((s) => s.trim())
    .filter(Boolean);

  // ── Mouse-tracked tilt + glow position. Mouse position over the
  // card becomes (a) a 3D rotation and (b) a moving glare hotspot
  // that follows the cursor. Pure visual, no layout impact.
  const cardRef = useRef<HTMLDivElement | null>(null);
  const mvX = useMotionValue(0.5);
  const mvY = useMotionValue(0.5);
  const rotX = useTransform(mvY, [0, 1], reducedMotion ? [0, 0] : [4.5, -4.5]);
  const rotY = useTransform(mvX, [0, 1], reducedMotion ? [0, 0] : [-6, 6]);
  const glareX = useTransform(mvX, [0, 1], ["0%", "100%"]);
  const glareY = useTransform(mvY, [0, 1], ["0%", "100%"]);
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reducedMotion) return;
    const r = cardRef.current?.getBoundingClientRect();
    if (!r) return;
    mvX.set((e.clientX - r.left) / r.width);
    mvY.set((e.clientY - r.top) / r.height);
  };
  const onLeave = () => { mvX.set(0.5); mvY.set(0.5); };

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: Math.min(index, 4) * 0.07, ease: [0.22, 1, 0.36, 1] }}
      className="group/tier relative"
      style={{ perspective: 1200 }}
    >
      <motion.div
        ref={cardRef}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        style={{
          rotateX: rotX,
          rotateY: rotY,
          transformStyle: "preserve-3d",
        }}
        whileHover={{ y: -4 }}
        transition={{ type: "spring", stiffness: 120, damping: 18 }}
        className={cn(
          "relative h-full rounded-3xl overflow-hidden",
          // True glass: layered translucency + backdrop blur
          "bg-[linear-gradient(180deg,hsla(0_0%_100%_/_0.04)_0%,hsla(0_0%_100%_/_0.01)_100%)]",
          "backdrop-blur-2xl",
          "ring-1 ring-inset transition-shadow duration-500",
          isPopular
            ? "ring-[hsl(45_95%_60%/0.45)] shadow-[0_30px_80px_-20px_hsla(45_95%_55%/0.45)]"
            : "ring-white/[0.08] group-hover/tier:ring-white/25",
        )}
      >
        {/* Accent hue wash — top half */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-40 opacity-95 pointer-events-none"
          style={{
            background:
              `radial-gradient(110% 100% at 50% 0%, hsla(${accent} / 0.32) 0%, hsla(${accent} / 0.10) 35%, transparent 70%)`,
          }}
        />
        {/* Mouse-tracked glare — moves with the cursor */}
        <motion.div
          aria-hidden
          className="absolute inset-0 opacity-60 pointer-events-none mix-blend-overlay"
          style={{
            background: `radial-gradient(220px 220px at ${glareX} ${glareY}, hsla(0 0% 100% / 0.28), transparent 60%)`,
          }}
        />
        {/* Animated edge sweep on the popular tier */}
        {isPopular && !reducedMotion && (
          <motion.div
            aria-hidden
            className="absolute inset-0 rounded-3xl pointer-events-none"
            style={{
              background:
                "conic-gradient(from 0deg, transparent 0%, hsla(45 100% 70% / 0.55) 10%, transparent 25%, transparent 100%)",
              padding: 1,
              WebkitMask: "linear-gradient(black, black) content-box, linear-gradient(black, black)",
              WebkitMaskComposite: "xor" as any,
              maskComposite: "exclude" as any,
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 7, repeat: Infinity, ease: "linear" }}
          />
        )}
        {/* Quiet grain — keeps the glass from looking too plastic */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.06] mix-blend-overlay pointer-events-none"
          style={{ backgroundImage: GRAIN_URL }}
        />

        {/* Most-popular flag — shimmering */}
        {isPopular && (
          <div className="absolute top-4 right-4 z-10">
            <motion.div
              className="relative inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[10px] font-mono uppercase tracking-[0.20em] text-black overflow-hidden"
              style={{ background: "linear-gradient(180deg, hsl(45 100% 75%) 0%, hsl(38 95% 55%) 100%)" }}
              animate={reducedMotion ? undefined : { y: [0, -1.5, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <Sparkles className="h-3 w-3 relative" strokeWidth={2} />
              <span className="relative">Most popular</span>
              {!reducedMotion && (
                <motion.span
                  aria-hidden
                  className="absolute inset-0"
                  style={{ background: "linear-gradient(120deg, transparent 30%, hsla(0 0% 100% / 0.55) 50%, transparent 70%)" }}
                  animate={{ x: ["-100%", "200%"] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "linear", repeatDelay: 1.6 }}
                />
              )}
            </motion.div>
          </div>
        )}

        {/* ── Wax-seal + name + price — centered axis. Perks below stay
            left-aligned because checklists read better that way. ──── */}
        <div className="relative px-6 pt-5 text-center" style={{ transform: "translateZ(20px)" }}>
          {/* Wax-seal centered on its own line */}
          <motion.div
            className="inline-flex items-center justify-center h-12 w-12 rounded-full font-display italic text-[18px] text-black relative overflow-hidden"
            style={{
              background: `radial-gradient(80% 80% at 30% 30%, hsla(${accent} / 0.98) 0%, hsla(${accent} / 0.75) 70%, hsla(${accent} / 0.55) 100%)`,
              fontFamily: "'Fraunces', serif",
              boxShadow: `inset 0 1px 0 hsla(0 0% 100% / 0.45), 0 8px 28px -8px hsla(${accent} / 0.65)`,
            }}
            animate={reducedMotion ? undefined : { scale: [1, 1.03, 1] }}
            transition={{ duration: 4 + index * 0.4, repeat: Infinity, ease: "easeInOut" }}
          >
            <span className="relative">{tier.position + 1}</span>
            {/* Conic gradient halo behind the seal */}
            {!reducedMotion && (
              <motion.span
                aria-hidden
                className="absolute -inset-1 rounded-full pointer-events-none"
                style={{
                  background: `conic-gradient(from 0deg, transparent 0%, hsla(${accent} / 0.55) 20%, transparent 50%, transparent 100%)`,
                  mask: "radial-gradient(circle, transparent 56%, black 60%)",
                  WebkitMask: "radial-gradient(circle, transparent 56%, black 60%)",
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 6 + index, repeat: Infinity, ease: "linear" }}
              />
            )}
          </motion.div>
          <h4
            className="mt-3 font-display italic text-[22px] leading-tight tracking-[-0.015em] text-foreground"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            {tier.name}
          </h4>

          {/* Price — centered count-up + glow */}
          <div className="mt-3 inline-flex items-baseline justify-center gap-2">
            <span
              className="font-display italic font-light tabular-nums leading-none"
              style={{
                color: `hsl(${accent})`,
                fontFamily: "'Fraunces', serif",
                fontSize: "clamp(2.2rem, 2.8vw, 2.8rem)",
                textShadow: `0 4px 32px hsla(${accent} / 0.40)`,
              }}
            >
              <AnimatedCounter value={tier.monthly_credits} duration={1.0 + index * 0.15} />
            </span>
            <span className={cn(TYPE_META, "text-muted-foreground/65 tracking-[0.20em] pb-1.5")}>
              CR / MONTH
            </span>
          </div>

          {/* Hairline divider before perks */}
          {perksLines.length > 0 && (
            <div aria-hidden className="mt-5 mx-auto h-px w-20" style={{ background: `linear-gradient(90deg, transparent, hsla(${accent} / 0.45), transparent)` }} />
          )}

          {/* Perks — stagger reveal, left-aligned inside a centered column */}
          {perksLines.length > 0 && (
            <ul className="mt-4 space-y-2.5 max-w-sm mx-auto text-left">
              {perksLines.map((line, j) => (
                <motion.li
                  key={j}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.25 + j * 0.06 }}
                  className="flex items-start gap-3 text-[13.5px] text-foreground/90 leading-snug"
                >
                  <span
                    className="mt-0.5 inline-flex items-center justify-center h-5 w-5 rounded-full shrink-0"
                    style={{
                      background: `hsla(${accent} / 0.18)`,
                      boxShadow: `inset 0 0 0 1px hsla(${accent} / 0.50)`,
                    }}
                  >
                    <Check className="h-3 w-3" strokeWidth={2.6} style={{ color: `hsl(${accent})` }} />
                  </span>
                  <span>{line}</span>
                </motion.li>
              ))}
            </ul>
          )}
        </div>

        {/* CTA */}
        <div className="relative px-6 pb-6 mt-5" style={{ transform: "translateZ(15px)" }}>
          {isOwner ? (
            <div className={cn(TYPE_META, "text-center text-muted-foreground/55 tracking-[0.22em] py-3 rounded-full bg-white/[0.02] ring-1 ring-inset ring-white/[0.04]")}>
              Your tier
            </div>
          ) : (
            <button
              type="button"
              onClick={(e) => onPledge(e)}
              disabled={disabled || busy}
              className={cn(
                "group/cta relative w-full inline-flex items-center justify-center gap-2 h-12 rounded-full overflow-hidden",
                "text-[12px] font-mono uppercase tracking-[0.26em] text-black transition-all",
                "disabled:opacity-60 disabled:cursor-not-allowed",
              )}
              style={{
                background: `linear-gradient(180deg, hsl(${accent}) 0%, hsl(${accent}) 55%, hsla(${accent} / 0.85) 100%)`,
                boxShadow: `0 14px 40px -10px hsla(${accent} / 0.55), inset 0 1px 0 hsla(0 0% 100% / 0.35)`,
              }}
            >
              {/* Continuous shimmer sweep — always present, faster on hover */}
              <motion.span
                aria-hidden
                className="absolute inset-0 pointer-events-none"
                style={{ background: "linear-gradient(120deg, transparent 30%, hsla(0 0% 100% / 0.40) 50%, transparent 70%)" }}
                animate={reducedMotion ? undefined : { x: ["-100%", "200%"] }}
                transition={{ duration: 3.4, repeat: Infinity, ease: "linear", repeatDelay: 0.6 }}
              />
              <span className="relative inline-flex items-center gap-2.5">
                <Crown className="h-3.5 w-3.5" strokeWidth={2} />
                {busy ? "Pledging…" : `Pledge ${tier.monthly_credits} cr / month`}
              </span>
            </button>
          )}
          <div className={cn(TYPE_META, "mt-3 text-center text-muted-foreground/50 tracking-[0.22em]")}>
            Cancel anytime
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PatronHubDialog — tabbed dialog opened by the "Become a patron" CTA.
//   Tab 1: "Choose a tier" — full tier picker (same TierCard component
//          as before, in a vertical stack so users can compare side-by-
//          side without horizontal scroll on phones).
//   Tab 2: "Your pledges" — every active patron_subscription this viewer
//          has, with monthly amount, renewal date, and cancel.
// Tabs deep-link via the URL hash so the share/copy URL preserves state.
// ─────────────────────────────────────────────────────────────────────────────
interface ActivePledge {
  id: string;
  creator_id: string;
  monthly_credits: number;
  renewal_due_at: string;
  creator: {
    display_name: string | null;
    avatar_url: string | null;
    username: string | null;
    tagline: string | null;
  } | null;
}

function PatronHubDialog({
  open, onClose, creatorId, creatorName, tiers, goal,
}: {
  open: boolean;
  onClose: () => void;
  creatorId: string;
  creatorName: string;
  tiers: PatronTier[];
  goal: PatronGoal | null;
}) {
  const reducedMotion = useReducedMotion();
  const [tab, setTab] = useState<"tiers" | "yours">("tiers");
  const [busyTierId, setBusyTierId] = useState<string | null>(null);
  const [pledges, setPledges] = useState<ActivePledge[] | null>(null);
  const [loadingPledges, setLoadingPledges] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  // Confetti burst — fires the moment a pledge succeeds.
  const [burst, setBurst] = useState<{ key: number; x: number; y: number } | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  // Each open / tab switch — make sure the body starts at scrollTop 0 so
  // the first card is immediately visible (otherwise the first thing the
  // user sees is whatever was scrolled into view last time).
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      bodyRef.current?.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    }, 30);
    return () => window.clearTimeout(id);
  }, [open, tab]);

  // Load "Your pledges" lazily the first time the tab is opened.
  useEffect(() => {
    if (!open) return;
    if (tab !== "yours") return;
    if (pledges !== null) return;
    let cancelled = false;
    setLoadingPledges(true);
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { if (!cancelled) { setPledges([]); setLoadingPledges(false); } return; }
        const { data: rows } = await supabase
          .from("patron_subscriptions")
          .select("id, creator_id, monthly_credits, renewal_due_at, cancelled_at")
          .eq("patron_id", user.id)
          .is("cancelled_at", null)
          .order("started_at", { ascending: false });
        const subs = ((rows ?? []) as Array<{
          id: string; creator_id: string; monthly_credits: number; renewal_due_at: string; cancelled_at: string | null;
        }>);
        if (subs.length === 0) { if (!cancelled) { setPledges([]); setLoadingPledges(false); } return; }
        const ids = subs.map((s) => s.creator_id);
        const { data: profs } = await supabase
          .from("profiles_public" as never)
          .select("id, display_name, avatar_url, username, tagline")
          .in("id", ids);
        const byId = new Map<string, ActivePledge["creator"]>(
          ((profs ?? []) as Array<{ id: string; display_name: string | null; avatar_url: string | null; username: string | null; tagline: string | null }>)
            .map((p) => [p.id, { display_name: p.display_name, avatar_url: p.avatar_url, username: p.username, tagline: p.tagline }]),
        );
        if (cancelled) return;
        setPledges(subs.map((s) => ({
          id: s.id, creator_id: s.creator_id,
          monthly_credits: s.monthly_credits, renewal_due_at: s.renewal_due_at,
          creator: byId.get(s.creator_id) ?? null,
        })));
      } catch (e) {
        if (!cancelled) setPledges([]);
      } finally {
        if (!cancelled) setLoadingPledges(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, tab, pledges]);

  // Reset on close so the next open is fresh data.
  useEffect(() => { if (!open) { setTab("tiers"); setPledges(null); } }, [open]);

  const popularIdx = tiers.length >= 3 ? Math.floor(tiers.length / 2) : -1;
  const goalPct = goal ? Math.min(100, Math.round((goal.current_credits / goal.target_credits) * 100)) : 0;

  const pledge = async (tier: PatronTier, originEvent?: React.MouseEvent<HTMLButtonElement>) => {
    setBusyTierId(tier.id);
    // Anchor the confetti to the actual button origin so the burst feels
    // like the click sparked it.
    const rect = originEvent?.currentTarget.getBoundingClientRect();
    try {
      const { data, error } = await supabase.rpc(
        "pledge_patron_tier" as never,
        { p_creator_id: creatorId, p_tier_id: tier.id } as never,
      );
      if (error) throw error;
      const ok = (data as any)?.success === true;
      if (!ok) {
        const reason = (data as any)?.reason ?? "unknown_error";
        toast.error(humaniseError(String(reason)));
      } else {
        toast.success(`Pledged ${tier.monthly_credits} cr/mo to ${creatorName}.`);
        if (rect && !reducedMotion) {
          setBurst({
            key: Date.now(),
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          });
        }
        setPledges(null); // force refetch the pledges tab
        // Slight delay so the confetti registers before switching tabs.
        window.setTimeout(() => setTab("yours"), 900);
      }
    } catch (e) {
      toast.error(humaniseError(e instanceof Error ? e.message : "Pledge failed"));
    } finally {
      setBusyTierId(null);
    }
  };

  const cancel = async (sub: ActivePledge) => {
    setCancellingId(sub.id);
    setPledges((prev) => (prev ?? []).filter((p) => p.id !== sub.id));
    try {
      const { error } = await supabase.rpc("cancel_patron" as never, { p_creator_id: sub.creator_id } as never);
      if (error) throw error;
      toast.success(`Cancelled pledge to ${sub.creator?.display_name ?? "creator"}.`);
    } catch (e) {
      // roll back
      setPledges((prev) => prev ? [sub, ...prev] : [sub]);
      toast.error(e instanceof Error ? e.message : "Couldn't cancel");
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={cn(
          "max-w-2xl w-[min(95vw,640px)] p-0 overflow-hidden border-0 outline-none",
          "bg-transparent shadow-none",
          // Maximise vertical room so the first tier card lands in view
          "max-h-[92vh]",
        )}
      >
        {/* Cinematic frame — ring + glow + glass */}
        <div className="relative rounded-2xl overflow-hidden ring-1 ring-inset ring-white/[0.08] shadow-[0_40px_120px_-20px_hsla(45_90%_50%/0.25),0_30px_80px_-30px_hsla(0_0%_0%/0.8)] flex flex-col max-h-[92vh]">
          {/* ── Animated backdrop ─────────────────────────────────── */}
          <PatronHubBackdrop reducedMotion={reducedMotion ?? false} />

          {/* Content layer — sits above the backdrop */}
          <div className="relative z-10 backdrop-blur-[2px]">
            {/* Header — centered + COMPACT so the first tier card lands
                in view immediately. Everything stacks on the centerline. */}
            <div className="relative px-6 pt-6 pb-5 text-center shrink-0">
              <div className={cn(TYPE_META, "text-amber-300/90 tracking-[0.36em] inline-flex items-center justify-center gap-2 mb-2")}>
                <Crown className="h-3 w-3" strokeWidth={1.8} />
                ◆ Patron
              </div>
              <DialogTitle asChild>
                <h2
                  className="font-display italic text-[clamp(1.5rem,2.2vw,1.9rem)] leading-[1.05] tracking-[-0.01em] text-foreground"
                  style={{ fontFamily: "'Fraunces', serif", fontWeight: 350 }}
                >
                  <span className="bg-gradient-to-b from-white via-white/95 to-white/70 bg-clip-text text-transparent">
                    {creatorName.replace(/\.$/, "")}.
                  </span>
                </h2>
              </DialogTitle>
              <DialogDescription className="text-[12px] text-muted-foreground/75 mt-1.5 max-w-md mx-auto leading-snug">
                {goal ? goal.label : "Pledge monthly credits. 90% goes straight to the creator."}
              </DialogDescription>

              {/* Goal meter — cinematic, centered, tight */}
              {goal && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  className="mt-4 max-w-md mx-auto"
                >
                  <div className="flex items-baseline justify-between mb-2">
                    <div className="inline-flex items-baseline gap-1.5">
                      <span
                        className="font-light tabular-nums text-amber-200"
                        style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic", fontSize: "clamp(1.2rem,1.8vw,1.5rem)" }}
                      >
                        <AnimatedCounter value={goal.current_credits} />
                      </span>
                      <span className={cn(TYPE_META, "text-muted-foreground/65 tracking-[0.18em] text-[10px]")}>
                        / {goal.target_credits.toLocaleString()} CR·MO
                      </span>
                    </div>
                    <span className={cn(TYPE_META, "text-amber-200/90 tracking-[0.20em] tabular-nums inline-flex items-baseline gap-1 text-[10px]")}>
                      <AnimatedCounter value={goalPct} />%
                      <span className="text-muted-foreground/55">FUNDED</span>
                    </span>
                  </div>
                  <div className="relative h-1.5 rounded-full bg-white/[0.05] overflow-hidden ring-1 ring-inset ring-white/[0.04]">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${goalPct}%` }}
                      transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
                      className="absolute inset-y-0 left-0"
                      style={{
                        background: "linear-gradient(90deg, hsl(38 80% 50%) 0%, hsl(45 95% 65%) 60%, hsl(45 100% 75%) 100%)",
                        boxShadow: "0 0 28px hsla(45 95% 60% / 0.55), inset 0 1px 0 hsla(0 0% 100% / 0.25)",
                      }}
                    />
                    {/* Shimmer sweep on top of the fill */}
                    {!reducedMotion && goalPct > 0 && (
                      <motion.div
                        aria-hidden
                        className="absolute inset-y-0 left-0 w-[30%] pointer-events-none"
                        style={{
                          background: "linear-gradient(90deg, transparent 0%, hsla(0 0% 100% / 0.45) 50%, transparent 100%)",
                          mixBlendMode: "overlay",
                        }}
                        animate={{ x: ["-30%", "330%"] }}
                        transition={{ duration: 3.2, repeat: Infinity, ease: "linear", repeatDelay: 1.2 }}
                      />
                    )}
                  </div>
                </motion.div>
              )}
            </div>

            {/* Tabs — centered */}
            <div className="px-6 border-b border-white/[0.06] flex items-center justify-center gap-2 shrink-0">
              <PatronTab id="tiers" label="Choose a tier" active={tab === "tiers"} onClick={() => setTab("tiers")} />
              <PatronTab id="yours" label="Your pledges"  active={tab === "yours"} onClick={() => setTab("yours")} />
            </div>

            {/* Body — fills remaining vertical space; scrolls when content
                overflows. Using flex-1 + min-h-0 so the body honours the
                modal's max-h-[92vh] cap without collapsing.  */}
            <div ref={bodyRef} className="flex-1 min-h-0 overflow-y-auto px-6 py-6 scrollbar-thin">
              <AnimatePresence mode="wait">
                {tab === "tiers" ? (
                  <motion.div
                    key="tiers"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {tiers.length === 0 ? (
                      <div className="py-12 text-center text-muted-foreground/65 text-[13px]">
                        This creator hasn't set up patron tiers yet.
                      </div>
                    ) : (
                      <div className="space-y-5 max-w-xl mx-auto">
                        {tiers.map((t, i) => (
                          <TierCard
                            key={t.id}
                            tier={t}
                            index={i}
                            isPopular={i === popularIdx}
                            busy={busyTierId === t.id}
                            disabled={false}
                            onPledge={(e) => pledge(t, e)}
                            isOwner={false}
                          />
                        ))}
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="yours"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <YoursPledgesPanel
                      pledges={pledges}
                      loading={loadingPledges}
                      cancellingId={cancellingId}
                      onCancel={cancel}
                      onClose={onClose}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer — trust band (compact) */}
            <div className="px-6 pb-4 pt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 shrink-0 border-t border-white/[0.04]">
              <TrustChip label="Cancel anytime" />
              <span className="text-muted-foreground/30">·</span>
              <TrustChip label="90% to creator" />
              <span className="text-muted-foreground/30">·</span>
              <TrustChip label="Secure ledger" />
            </div>
          </div>
        </div>
      </DialogContent>

      {/* Confetti burst — portal-styled but lives inside Dialog scope so it
          unmounts with the dialog. */}
      <ConfettiBurst burst={burst} />
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PatronHubBackdrop — animated mesh-gradient background with drifting
// hue orbs + grain. Pure visual layer; lives behind the content.
// ─────────────────────────────────────────────────────────────────────────────
function PatronHubBackdrop({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden>
      <div className="absolute inset-0 bg-[hsl(220_30%_5%)]" />
      {/* mesh — three radial wells */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(80% 60% at 18% 22%, hsla(38 90% 50% / 0.30) 0%, transparent 60%)," +
            "radial-gradient(70% 60% at 82% 28%, hsla(295 80% 55% / 0.22) 0%, transparent 62%)," +
            "radial-gradient(90% 70% at 50% 95%, hsla(195 90% 50% / 0.18) 0%, transparent 65%)",
        }}
      />
      {/* drifting orbs */}
      {!reducedMotion && (
        <>
          <motion.div
            className="absolute"
            style={{
              top: "8%", left: "4%", width: 360, height: 360, borderRadius: "50%",
              background: "radial-gradient(circle, hsla(45 95% 60% / 0.30), transparent 70%)",
              filter: "blur(70px)",
            }}
            animate={{ x: [0, 50, -20, 0], y: [0, -30, 25, 0] }}
            transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute"
            style={{
              top: "20%", right: "5%", width: 320, height: 320, borderRadius: "50%",
              background: "radial-gradient(circle, hsla(290 75% 55% / 0.30), transparent 70%)",
              filter: "blur(80px)",
            }}
            animate={{ x: [0, -40, 25, 0], y: [0, 35, -20, 0] }}
            transition={{ duration: 26, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
          />
          <motion.div
            className="absolute"
            style={{
              bottom: "-10%", left: "30%", width: 460, height: 460, borderRadius: "50%",
              background: "radial-gradient(circle, hsla(195 80% 55% / 0.25), transparent 70%)",
              filter: "blur(90px)",
            }}
            animate={{ x: [0, 30, -50, 0], y: [0, -20, 15, 0] }}
            transition={{ duration: 28, repeat: Infinity, ease: "easeInOut", delay: 3 }}
          />
        </>
      )}
      {/* grain — same SVG noise used elsewhere on the page */}
      <div
        className="absolute inset-0 opacity-[0.07] mix-blend-overlay"
        style={{ backgroundImage: GRAIN_URL }}
      />
      {/* vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 100% at 50% 50%, transparent 40%, hsla(220 30% 4% / 0.60) 100%)",
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AnimatedCounter — count-up integer animation (with easing).
// ─────────────────────────────────────────────────────────────────────────────
function AnimatedCounter({ value, duration = 1.4 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (reducedMotion) { setDisplay(value); return; }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / (duration * 1000));
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(value * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reducedMotion]);
  return <>{display.toLocaleString()}</>;
}

function TrustChip({ label }: { label: string }) {
  return (
    <span className={cn(TYPE_META, "text-muted-foreground/65 tracking-[0.20em] inline-flex items-center gap-1.5")}>
      <Check className="h-3 w-3 text-emerald-300/80" strokeWidth={2.2} />
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ConfettiBurst — fires from the pledge button's centre. Mounts at body
// position so it can render above the modal backdrop.
// ─────────────────────────────────────────────────────────────────────────────
function ConfettiBurst({ burst }: { burst: { key: number; x: number; y: number } | null }) {
  if (!burst) return null;
  const N = 18;
  const colors = ["hsl(45 95% 65%)", "hsl(38 95% 60%)", "hsl(290 80% 65%)", "hsl(195 80% 60%)", "hsl(0 0% 100%)"];
  return (
    <div className="fixed inset-0 z-[200] pointer-events-none" aria-hidden>
      {Array.from({ length: N }).map((_, i) => {
        const angle = (Math.PI * 2 * i) / N + (i % 3) * 0.1;
        const distance = 110 + (i % 5) * 16;
        const dx = Math.cos(angle) * distance;
        const dy = Math.sin(angle) * distance;
        const color = colors[i % colors.length];
        return (
          <motion.span
            key={`${burst.key}-${i}`}
            className="absolute h-1.5 w-1.5 rounded-full"
            style={{ left: burst.x, top: burst.y, background: color, boxShadow: `0 0 12px ${color}` }}
            initial={{ x: 0, y: 0, scale: 0.4, opacity: 1 }}
            animate={{ x: dx, y: dy, scale: 1.1, opacity: 0 }}
            transition={{ duration: 0.85 + (i % 4) * 0.08, ease: [0.16, 1, 0.36, 1] }}
          />
        );
      })}
    </div>
  );
}

function PatronTab({
  id, label, active, onClick,
}: { id: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-selected={active}
      role="tab"
      className={cn(
        "relative inline-flex items-center h-11 px-4 text-[11px] font-mono uppercase tracking-[0.22em] transition-colors",
        active ? "text-amber-200" : "text-muted-foreground/60 hover:text-foreground",
      )}
    >
      {label}
      {active && (
        <motion.span
          layoutId="patron-tab-underline"
          className="absolute inset-x-2 -bottom-px h-px bg-amber-300"
        />
      )}
    </button>
  );
}

function YoursPledgesPanel({
  pledges, loading, cancellingId, onCancel, onClose,
}: {
  pledges: ActivePledge[] | null;
  loading: boolean;
  cancellingId: string | null;
  onCancel: (sub: ActivePledge) => Promise<void> | void;
  onClose: () => void;
}) {
  if (loading) {
    return (
      <div className="py-12 flex items-center justify-center gap-3 text-muted-foreground/65">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-[12px] font-mono uppercase tracking-[0.22em]">Loading your pledges…</span>
      </div>
    );
  }
  if (!pledges || pledges.length === 0) {
    return (
      <div className="py-12 text-center max-w-md mx-auto">
        <Crown className="h-7 w-7 mx-auto text-muted-foreground/55" strokeWidth={1.4} />
        <div className="mt-5 font-display italic text-[20px] text-foreground/95" style={{ fontFamily: "'Fraunces', serif" }}>
          No active pledges yet.
        </div>
        <p className="mt-2.5 text-[12.5px] text-muted-foreground/70">
          Choose a tier above to start supporting this creator.
        </p>
      </div>
    );
  }
  const total = pledges.reduce((s, x) => s + x.monthly_credits, 0);
  return (
    <div>
      <div className="mb-5 text-[12.5px] text-muted-foreground/75">
        Active pledges to{" "}
        <span className="text-amber-200 font-mono tabular-nums">{pledges.length}</span>{" "}
        {pledges.length === 1 ? "creator" : "creators"} · {" "}
        <span className="text-amber-200 font-mono tabular-nums">{total.toLocaleString()}</span>{" "}
        cr / month total.
      </div>
      <ul className="divide-y divide-white/[0.04] border-y border-white/[0.04]">
        {pledges.map((p) => {
          const slug = p.creator?.username ? `@${p.creator.username}` : p.creator_id;
          const renew = new Date(p.renewal_due_at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
          return (
            <li key={p.id} className="py-4 flex items-center gap-4">
              <Link to={`/c/${slug}`} onClick={onClose} className="shrink-0 w-10 h-10 rounded-full overflow-hidden ring-1 ring-inset ring-white/[0.08] bg-glass-hover">
                {p.creator?.avatar_url ? (
                  <img src={p.creator.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-foreground/70 text-[12px] font-mono">
                    {(p.creator?.display_name?.[0] ?? "?").toUpperCase()}
                  </div>
                )}
              </Link>
              <div className="flex-1 min-w-0">
                <Link to={`/c/${slug}`} onClick={onClose} className="block text-[14px] text-foreground font-light truncate hover:text-accent transition-colors">
                  {p.creator?.display_name ?? "Anonymous"}
                </Link>
                {p.creator?.tagline && (
                  <div className="text-[11.5px] text-muted-foreground/60 italic truncate" style={{ fontFamily: "'Fraunces', serif" }}>
                    {p.creator.tagline}
                  </div>
                )}
              </div>
              <div className="hidden sm:block text-right min-w-[110px]">
                <div className="text-[15px] text-amber-200 font-light tabular-nums" style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic" }}>
                  {p.monthly_credits.toLocaleString()} cr
                </div>
                <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.18em]")}>
                  Renews {renew}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void onCancel(p)}
                disabled={cancellingId === p.id}
                className="shrink-0 inline-flex items-center justify-center h-8 px-3 rounded-full text-[10px] font-mono uppercase tracking-[0.22em] text-rose-200/75 hover:text-rose-100 hover:bg-rose-500/10 ring-1 ring-inset ring-rose-300/20 hover:ring-rose-300/45 transition-colors disabled:opacity-50"
              >
                {cancellingId === p.id ? "Cancelling…" : "Cancel"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function humaniseError(msg: string): string {
  return msg
    .replace(/auth[_ ]required/i, "Sign in to pledge.")
    .replace(/insufficient_credits/i, "Not enough credits. Buy a top-up first.")
    .replace(/cannot_pledge_self/i, "You can't pledge to yourself.")
    .replace(/cannot_block_self/i, "You can't block yourself.")
    .replace(/creator_not_found/i, "That creator no longer exists.")
    .replace(/tier_not_found/i, "That tier no longer exists.")
    .replace(/invalid_credits/i, "Pledge must be 1–10,000 credits.")
    .replace(/_/g, " ");
}

// ─────────────────────────────────────────────────────────────────────────────
// PinnedCollectionsRail — multi-category highlights groups. Owner can
// reorder + edit; visitors browse. Renders nothing when empty.
// ─────────────────────────────────────────────────────────────────────────────
function PinnedCollectionsRail({
  collections, isOwner,
}: {
  collections: Array<{ id: string; name: string; cover_url: string | null; reel_ids: string[] }>;
  isOwner: boolean;
}) {
  // Hide for visitors when there's nothing meaningful — single empty
  // collection reads as filler. Owners still see the empty state so
  // they can add their first highlight.
  const meaningful = collections.filter((c) => c.reel_ids.length >= 1);
  if (!isOwner && (meaningful.length === 0 || (meaningful.length === 1 && meaningful[0].reel_ids.length <= 1))) {
    return null;
  }
  if (collections.length === 0 && !isOwner) return null;
  return (
    <section>
      <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.34em] mb-5 inline-flex items-center gap-2")}>
        <Pin className="h-3 w-3 text-accent/80" strokeWidth={1.6} />
        ◆ Highlights
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
        {collections.map((c) => (
          <div
            key={c.id}
            className="shrink-0 w-[240px] rounded-2xl overflow-hidden ring-1 ring-inset ring-white/[0.06] hover:ring-white/20 transition-all bg-white/[0.015] cursor-pointer"
          >
            <div className="relative aspect-video bg-black/40">
              {c.cover_url ? (
                <img src={c.cover_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.06] to-transparent" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
              <div className="absolute bottom-3 left-3 right-3">
                <div className="text-[14px] text-white font-light truncate" style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic" }}>
                  {c.name}
                </div>
                <div className={cn(TYPE_META, "text-white/55 mt-0.5 tracking-[0.18em]")}>
                  {c.reel_ids.length} {c.reel_ids.length === 1 ? "reel" : "reels"}
                </div>
              </div>
            </div>
          </div>
        ))}
        {isOwner && (
          <button
            type="button"
            onClick={() => toast.info("Highlights editor — coming next pass.")}
            className="shrink-0 w-[240px] aspect-video rounded-2xl ring-1 ring-dashed ring-white/15 hover:ring-white/30 text-muted-foreground/60 hover:text-foreground transition-all flex items-center justify-center text-[11px] font-mono uppercase tracking-[0.22em]"
          >
            + New highlight
          </button>
        )}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RecommendedCreatorsRail — "Similar to {displayName}" — bottom of the
// page. Renders other opt-in creators with overlapping interests.
// ─────────────────────────────────────────────────────────────────────────────
function RecommendedCreatorsRail({
  rows, displayName,
}: {
  rows: Array<{
    id: string; username: string | null; display_name: string | null;
    avatar_url: string | null; cover_url: string | null; country: string | null;
    tagline: string | null; location: string | null; overlap: number;
  }>;
  displayName: string;
}) {
  if (rows.length === 0) return null;
  return (
    <section>
      <header className="mb-7">
        <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.34em]")}>
          ◆ Discover
        </div>
        <h3
          className="mt-2 font-display italic text-[clamp(1.6rem,2.6vw,2.2rem)] font-light tracking-tight"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/65 bg-clip-text text-transparent">
            Similar to {displayName.replace(/\.$/, "")}.
          </span>
        </h3>
      </header>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {rows.map((r) => (
          <Link
            key={r.id}
            to={`/c/${r.username ? `@${r.username}` : r.id}`}
            className="group relative aspect-square rounded-2xl overflow-hidden ring-1 ring-inset ring-white/[0.06] hover:ring-white/30 transition-all"
          >
            {r.cover_url ? (
              <img src={r.cover_url} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.06] to-transparent" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />

            {/* Avatar — sits above the cover so every card has a face. */}
            <div className="absolute bottom-[58px] left-2.5">
              <div
                className="w-11 h-11 rounded-full overflow-hidden ring-[3px] ring-[hsl(220_28%_5%)] bg-glass-hover"
                style={{ boxShadow: "0 0 0 1px hsla(0 0% 100% / 0.10), 0 8px 16px -4px hsla(0 0% 0% / 0.6)" }}
              >
                {r.avatar_url ? (
                  <img src={r.avatar_url} alt={r.display_name ?? ""} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/90 font-mono text-[12px] bg-gradient-to-br from-white/[0.10] to-white/[0.02]">
                    {(r.display_name?.[0] ?? "?").toUpperCase()}
                  </div>
                )}
              </div>
            </div>

            <div className="absolute bottom-2.5 left-2.5 right-2.5">
              <div className="text-[14px] text-white font-light truncate italic" style={{ fontFamily: "'Fraunces', serif" }}>
                {(r.display_name ?? "—").trim().split(/\s+/)[0]}
              </div>
              {r.country && (
                <div className={cn(TYPE_META, "text-white/65 tracking-[0.18em]")}>{r.country}</div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SafetyMenu — the three-dot menu on visitor profiles. Houses Block + Report.
// Render-tier UI; the heavy lifting (toggle_block RPC, user_reports insert)
// happens server-side with RLS gating who can read/write what.
// ─────────────────────────────────────────────────────────────────────────────
const REPORT_REASONS = [
  "Impersonation",
  "Harassment",
  "Spam or scam",
  "Hate speech",
  "Sexual content",
  "Violence or harm",
  "Other",
];

function SafetyMenu({ targetId, targetName }: { targetId: string; targetName: string }) {
  const [open, setOpen] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState<string>(REPORT_REASONS[0]);
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // Probe block state once.
  useEffect(() => {
    let cancelled = false;
    supabase.rpc("viewer_blocks" as never, { p_target: targetId } as never).then(({ data }) => {
      if (!cancelled) setBlocked(!!data);
    });
    return () => { cancelled = true; };
  }, [targetId]);

  // Outside click + Esc close.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggleBlock = async () => {
    setOpen(false);
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("toggle_block" as never, { p_target: targetId } as never);
      if (error) throw error;
      const next = !!(data as any)?.blocked;
      setBlocked(next);
      toast.success(next ? `Blocked ${targetName}.` : `Unblocked ${targetName}.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't update block";
      toast.error(msg.replace(/_/g, " "));
    } finally {
      setBusy(false);
    }
  };

  const submitReport = async () => {
    if (!reason) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("user_reports").insert({
        reporter_id: (await supabase.auth.getUser()).data.user?.id,
        reported_id: targetId,
        reason,
        detail: detail.trim() || null,
      });
      if (error) throw error;
      toast.success("Report submitted. Our team will review it.");
      setReportOpen(false);
      setDetail("");
      setReason(REPORT_REASONS[0]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't submit report");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="More actions"
        className="inline-flex items-center justify-center h-7 w-7 rounded-full text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors"
      >
        <MoreHorizontal className="h-4 w-4" strokeWidth={1.6} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="absolute right-0 mt-2 w-52 z-50 rounded-2xl overflow-hidden bg-[hsl(220_28%_8%/0.95)] backdrop-blur-2xl ring-1 ring-inset ring-white/[0.08] shadow-[0_18px_60px_rgba(0,0,0,0.55)]"
          >
            <button
              type="button"
              disabled={busy}
              onClick={toggleBlock}
              className={cn(
                "w-full inline-flex items-center gap-3 h-11 px-4 text-[12px] font-mono uppercase tracking-[0.18em] text-left",
                "text-rose-200/85 hover:text-rose-100 hover:bg-rose-500/10 transition-colors disabled:opacity-50",
              )}
            >
              <Ban className="h-3.5 w-3.5" strokeWidth={1.5} />
              {blocked ? "Unblock" : "Block"}
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setReportOpen(true); }}
              className="w-full inline-flex items-center gap-3 h-11 px-4 text-[12px] font-mono uppercase tracking-[0.18em] text-foreground/85 hover:text-foreground hover:bg-white/[0.06] transition-colors"
            >
              <Flag className="h-3.5 w-3.5" strokeWidth={1.5} />
              Report
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={reportOpen} onOpenChange={(o) => !o && setReportOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display italic text-[22px] text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>
              Report {targetName}
            </DialogTitle>
            <DialogDescription className="text-[12px] text-muted-foreground/85 mt-1">
              Tell us what's going on. Reports are confidential — the reported user doesn't see your name.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-5 space-y-4">
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/70 mb-2">
                Reason
              </label>
              <div className="flex flex-wrap gap-1.5">
                {REPORT_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReason(r)}
                    className={cn(
                      "h-8 px-3 rounded-full text-[11px] font-mono uppercase tracking-[0.16em] transition-colors",
                      reason === r ? "bg-rose-400/85 text-black" : "bg-white/[0.04] text-foreground/80 hover:bg-white/[0.08]",
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/70 mb-2">
                Detail <span className="text-muted-foreground/45">(optional)</span>
              </label>
              <textarea
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Anything we should know?"
                className="w-full px-3 py-2 rounded-md bg-white/[0.04] border border-white/[0.06] text-foreground text-[13px] leading-relaxed resize-none focus:outline-none focus:border-rose-300/55"
              />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <button
              type="button"
              onClick={() => setReportOpen(false)}
              className="h-10 px-5 rounded-full text-[11px] font-mono uppercase tracking-[0.22em] text-muted-foreground/80 hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitReport}
              disabled={busy}
              className="h-10 px-5 rounded-full bg-rose-400/90 hover:bg-rose-400 text-black text-[11px] font-mono uppercase tracking-[0.22em] disabled:opacity-50"
            >
              {busy ? "Submitting…" : "Submit report"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MutualFollowsLine — "Followed by Kenji and 3 others you follow." Quiet,
// inline social proof. Avatar stack + sentence form. Hidden when the
// viewer isn't signed in or has no mutuals with the creator.
// ─────────────────────────────────────────────────────────────────────────────
function MutualFollowsLine({
  total,
  sample,
}: {
  total: number;
  sample: Array<{ id: string; display_name: string | null; avatar_url: string | null }>;
}) {
  if (total === 0 || sample.length === 0) return null;
  const names = sample
    .map((s) => (s.display_name ?? "").trim().split(/\s+/)[0] ?? "Someone")
    .filter(Boolean);
  let sentence: string;
  if (total === 1) sentence = `Followed by ${names[0]}.`;
  else if (total === 2) sentence = `Followed by ${names[0]} and ${names[1]}.`;
  else if (total === sample.length) {
    sentence = `Followed by ${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}.`;
  } else {
    sentence = `Followed by ${names.join(", ")} and ${total - names.length} ${total - names.length === 1 ? "other" : "others"} you follow.`;
  }
  return (
    <section className="-mt-6 flex items-center gap-3">
      <div className="flex -space-x-2">
        {sample.slice(0, 3).map((m, i) => (
          <Link
            key={m.id}
            to={`/c/${m.id}`}
            className="relative h-7 w-7 rounded-full overflow-hidden ring-2 ring-[hsl(220_28%_5%)] bg-glass-hover hover:z-10 transition-transform hover:scale-110"
            style={{ zIndex: sample.length - i }}
            title={m.display_name ?? "Anonymous"}
          >
            {m.avatar_url ? (
              <img src={m.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-[10px] font-mono text-foreground/70">
                {(m.display_name?.[0] ?? "?").toUpperCase()}
              </div>
            )}
          </Link>
        ))}
      </div>
      <p className="text-[12.5px] text-muted-foreground/85 leading-snug">
        {sentence}
      </p>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// InlineUploadOverlay — owner-only hover-to-upload control for the cover
// image and avatar. Uses the existing `useFileUpload` hook against the
// `profile-covers` and `avatars` buckets, writes the resulting URL back
// to profiles, and broadcasts a window event so the page rehydrates the
// new asset without a full reload.
// ─────────────────────────────────────────────────────────────────────────────
function InlineUploadOverlay({
  kind,
  userId,
  chip,
}: {
  kind: "avatar" | "cover";
  userId: string;
  /** If true, render as a small floating chip (cover style). Else, the
   *  absolute-cover circle style (avatar style). */
  chip?: boolean;
}) {
  const isAvatar = kind === "avatar";
  const upload = useFileUpload({
    bucket: isAvatar ? "avatars" : "profile-covers",
    maxSizeMB: isAvatar ? 5 : 10,
    allowedTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    signed: false,
  });
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const result = await upload.uploadFile(file);
    if (!result?.url) return;
    try {
      const column = isAvatar ? "avatar_url" : "cover_url";
      const { error } = await supabase.from("profiles").update({ [column]: result.url }).eq("id", userId);
      if (error) throw error;
      toast.success(isAvatar ? "Avatar updated" : "Cover updated");
      // Cheapest "refresh viewed" trigger: bounce a custom event the page listens for.
      window.dispatchEvent(new CustomEvent("profile:assets-changed"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save image");
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFile}
      />
      {chip ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={upload.isUploading}
          className={cn(
            "inline-flex items-center gap-2 h-9 px-4 rounded-full",
            "bg-black/55 backdrop-blur ring-1 ring-inset ring-white/15",
            "text-white/85 hover:text-white hover:bg-black/70",
            "text-[11px] font-mono uppercase tracking-[0.22em] transition-colors",
            "opacity-0 hover:opacity-100 focus:opacity-100 group-hover/cover:opacity-100",
            upload.isUploading && "opacity-100",
          )}
        >
          <Pencil className="h-3 w-3" strokeWidth={1.6} />
          {upload.isUploading ? `Uploading… ${upload.progress}%` : "Change cover"}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={upload.isUploading}
          className={cn(
            "absolute inset-0 rounded-full flex items-center justify-center",
            "bg-black/55 backdrop-blur-[1px]",
            "opacity-0 group-hover/avatar:opacity-100 focus:opacity-100 transition-opacity",
            "text-white/95 text-[10px] font-mono uppercase tracking-[0.22em]",
            upload.isUploading && "opacity-100",
          )}
        >
          <span className="inline-flex items-center gap-1.5">
            <Pencil className="h-3 w-3" strokeWidth={1.6} />
            {upload.isUploading ? `${upload.progress}%` : "Change"}
          </span>
        </button>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PatronButton — opens a confirmation dialog and pledges monthly credits
// to the creator via the SECURITY DEFINER `pledge_patron` RPC. Renders
// as a "Become a patron" floating link with a crown icon — same visual
// language as Follow / Message / Share.
// ─────────────────────────────────────────────────────────────────────────────
function BrandInquiryLink({ recipientId, recipientName }: { recipientId: string; recipientName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 h-8 px-3 rounded-full bg-white/[0.04] hover:bg-white/[0.08] ring-1 ring-inset ring-white/[0.10] hover:ring-white/[0.25] text-[11px] font-mono uppercase tracking-[0.32em] text-foreground/85 hover:text-foreground transition-all"
      >
        <Briefcase className="h-3.5 w-3.5" strokeWidth={1.5} />
        Pitch a deal
      </button>
      <BrandInquiryDialog open={open} onClose={() => setOpen(false)} recipientId={recipientId} recipientName={recipientName} />
    </>
  );
}

function PatronButton({
  creatorId, creatorName, tiers, goal, handle,
}: {
  creatorId: string;
  creatorName: string;
  tiers: PatronTier[];
  goal: PatronGoal | null;
  /** Vanity handle for the URL (canonical /c/@handle/patron). */
  handle: string | null;
}) {
  const slug = handle ? `@${handle}` : creatorId;
  void creatorName; void tiers; void goal;
  return (
    <Link
      to={`/c/${slug}/patron`}
      className="inline-flex items-center gap-2 h-8 px-3 rounded-full bg-amber-400/12 hover:bg-amber-400/22 ring-1 ring-inset ring-amber-300/35 hover:ring-amber-300/65 text-[11px] font-mono uppercase tracking-[0.32em] text-amber-100 hover:text-amber-50 transition-all shadow-[0_0_18px_-6px_hsla(45_95%_60%/0.55)]"
    >
      <Crown className="h-3.5 w-3.5" strokeWidth={1.5} />
      Patron
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PinnedReels — the creator's hand-picked highlight rail. Bigger tiles,
// cinematic styling, hover-play preview for the owner. Public visitors
// see the same lineup minus the "Unpin" affordance.
// ─────────────────────────────────────────────────────────────────────────────
function PinnedReels({
  reels,
  isOwner,
  onUnpin,
  bare = false,
}: {
  reels: Array<{ id: string; title: string; thumbnail_url: string | null; video_url: string | null }>;
  isOwner: boolean;
  onUnpin: (reelId: string) => Promise<void> | void;
  /** When true, render only the grid with no internal heading / pinned-pill.
   *  Used when nested inside FilmsSection so the outer header isn't duplicated. */
  bare?: boolean;
}) {
  const Grid = (
    <div className={cn(
      "grid gap-4",
      reels.length === 1 ? "grid-cols-1 max-w-3xl"
        : reels.length === 2 ? "grid-cols-1 sm:grid-cols-2"
        : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    )}>
      {reels.map((r) => (
        <div key={r.id} className="relative group/pin">
          <Link
            to={`/r/${r.id}`}
            className="block relative aspect-video rounded-2xl overflow-hidden ring-1 ring-inset ring-white/[0.06] hover:ring-accent/35 transition-all"
          >
            {r.thumbnail_url ? (
              <img
                src={r.thumbnail_url}
                alt=""
                className="absolute inset-0 w-full h-full object-cover group-hover/pin:scale-105 transition-transform duration-700"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] to-transparent flex items-center justify-center">
                <Film className="h-6 w-6 text-white/30" strokeWidth={1.3} />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
            {/* Small accent pip (no "PINNED" word — context handles that) */}
            {!bare && (
              <span aria-hidden className="absolute top-3 left-3 h-2 w-2 rounded-full bg-accent shadow-[0_0_12px_hsl(var(--accent)/0.65)]" />
            )}
            <div className="absolute bottom-0 inset-x-0 p-4">
              <div className="text-[16px] font-light text-white truncate" style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic" }}>
                {r.title || "Untitled"}
              </div>
            </div>
          </Link>
          {isOwner && (
            <button
              type="button"
              onClick={() => void onUnpin(r.id)}
              title="Unpin"
              className="absolute top-3 right-3 inline-flex items-center gap-1 h-8 px-3 rounded-full bg-black/55 hover:bg-rose-500/85 backdrop-blur ring-1 ring-inset ring-white/15 hover:ring-rose-300/65 text-white/85 hover:text-white text-[10px] font-mono uppercase tracking-[0.22em] transition-colors opacity-0 group-hover/pin:opacity-100"
            >
              <X className="h-3 w-3" />Unpin
            </button>
          )}
        </div>
      ))}
    </div>
  );
  if (bare) return Grid;
  return (
    <section>
      <header className="flex items-end justify-between mb-7">
        <div>
          <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.34em] inline-flex items-center gap-2")}>
            <Sparkles className="h-3 w-3 text-accent/85" strokeWidth={1.6} />
            ◆ Pinned
          </div>
          <h3
            className="mt-2 font-display italic text-[clamp(1.6rem,2.6vw,2.2rem)] font-light tracking-tight"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/65 bg-clip-text text-transparent">
              {isOwner ? "Your pinned films." : "Their pinned films."}
            </span>
          </h3>
        </div>
      </header>
      {Grid}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SocialLinksRow — surfaces the creator's external links (website +
// social handles) as a quiet typographic rail. Hides itself when there
// are no links. Same design thesis as the rest of the page: container-
// less, mono caps, accent hover.
// ─────────────────────────────────────────────────────────────────────────────
const LINK_META: Record<string, { label: string; format?: (url: string) => string }> = {
  website:   { label: "Website",   format: (u) => u.replace(/^https?:\/\//, "").replace(/\/$/, "") },
  twitter:   { label: "Twitter",   format: (u) => "@" + (u.match(/twitter\.com\/([^/?#]+)/i)?.[1] ?? u) },
  x:         { label: "X",         format: (u) => "@" + (u.match(/x\.com\/([^/?#]+)/i)?.[1] ?? u) },
  instagram: { label: "Instagram", format: (u) => "@" + (u.match(/instagram\.com\/([^/?#]+)/i)?.[1] ?? u) },
  youtube:   { label: "YouTube",   format: (u) => u.match(/youtube\.com\/(@[^/?#]+)/i)?.[1] ?? "YouTube" },
  tiktok:    { label: "TikTok",    format: (u) => u.match(/tiktok\.com\/(@[^/?#]+)/i)?.[1] ?? "TikTok" },
  github:    { label: "GitHub",    format: (u) => u.match(/github\.com\/([^/?#]+)/i)?.[1] ?? "GitHub" },
};

function SocialLinksRow({ links }: { links: Record<string, string> }) {
  const entries = useMemo(() => {
    return Object.entries(links ?? {})
      .filter(([, url]) => typeof url === "string" && url.trim().length > 0)
      .map(([key, url]) => {
        const meta = LINK_META[key] ?? { label: key };
        const display = meta.format ? meta.format(url) : url;
        return { key, url, label: meta.label, display };
      });
  }, [links]);

  if (entries.length === 0) return null;

  return (
    <section>
      <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.34em] mb-4")}>
        ◆ Where to find them
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {entries.map((e) => (
          <a
            key={e.key}
            href={e.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-baseline gap-2 text-[13px] text-foreground/80 hover:text-accent transition-colors"
          >
            <span className={cn(TYPE_META, "text-foreground/40 group-hover:text-accent/85")}>
              {e.label}
            </span>
            <span className="font-light tracking-tight">{e.display}</span>
            <ArrowUpRight className="h-3 w-3 text-foreground/30 group-hover:text-accent transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" strokeWidth={1.5} />
          </a>
        ))}
      </div>
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// NEW: Settings ↔ Viewing mode primitives, highlight reel picker,
// stats panel, current-project badge, and the inline settings panel.
// All owner-only. Match the existing luxe Fraunces-italic-heading +
// accent-glow design language; monospace meta labels; thick accent rings
// on active inputs; soft accent halos around the focused element.
// ═════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// CornerGearButton — quiet floating gear in the top-right that's only
// visible to the owner. Doubles as a quick exit from settings mode.
// ─────────────────────────────────────────────────────────────────────────────
function CornerGearButton({
  active,
  onClick,
}: {
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={active ? "Exit profile settings" : "Open profile settings"}
      title={active ? "Done — exit settings" : "Edit profile"}
      className={cn(
        "fixed top-4 right-4 z-[9000]",
        "h-11 w-11 rounded-full",
        "backdrop-blur-xl",
        "ring-1 ring-inset transition-all",
        active
          ? "bg-accent/15 ring-accent/55 text-accent shadow-[0_0_28px_-6px_hsl(var(--accent)/0.85)]"
          : "bg-black/40 ring-white/[0.12] text-foreground/70 hover:text-foreground hover:bg-black/55 hover:ring-white/30",
        "flex items-center justify-center",
      )}
    >
      <SettingsIcon
        className={cn(
          "h-4 w-4 transition-transform duration-500",
          active && "rotate-90",
        )}
        strokeWidth={1.6}
      />
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CurrentProjectBadge — auto-updating "What I'm working on" chip in the
// hero's eyebrow row. Links to the editor for the project. Updates via the
// `editor:project-saved` window event so it stays current without polling.
// ─────────────────────────────────────────────────────────────────────────────
function CurrentProjectBadge({
  project,
}: {
  project: { id: string; title: string | null; thumbnail_url: string | null; updated_at: string };
}) {
  const relativeWhen = useMemo(() => {
    try {
      const t = new Date(project.updated_at).getTime();
      const mins = Math.max(1, Math.round((Date.now() - t) / 60000));
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.round(mins / 60);
      if (hrs < 24) return `${hrs}h ago`;
      const days = Math.round(hrs / 24);
      return `${days}d ago`;
    } catch { return ""; }
  }, [project.updated_at]);
  return (
    <Link
      to={`/editor/${project.id}`}
      className={cn(
        "group/cp ml-2 inline-flex items-center gap-2 h-6 pl-1 pr-3 rounded-full",
        "bg-accent/10 hover:bg-accent/20 ring-1 ring-inset ring-accent/30 hover:ring-accent/55",
        "transition-all shadow-[0_0_14px_-6px_hsl(var(--accent)/0.55)]",
      )}
      title={`In progress · ${project.title ?? "Untitled"}`}
    >
      <span className="relative h-4 w-4 rounded-full overflow-hidden ring-1 ring-inset ring-accent/45 bg-black/40">
        {project.thumbnail_url ? (
          <img src={project.thumbnail_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <Wand2 className="absolute inset-0 m-auto h-2.5 w-2.5 text-accent" strokeWidth={1.6} />
        )}
      </span>
      <span className="text-[10px] font-mono uppercase tracking-[0.28em] text-accent/95">
        Now directing
      </span>
      <span className="text-[10px] font-mono uppercase tracking-[0.20em] text-accent/55 max-w-[140px] truncate">
        {project.title?.trim() || "Untitled"}
      </span>
      <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-accent/40 tabular-nums">
        {relativeWhen}
      </span>
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// InlineHeroTextInput — the display-italic XL serif input that replaces
// the <h1> name when settings mode is on. Thick accent ring, soft glow
// underneath, save-on-blur + ⌘↵ shortcut.
// ─────────────────────────────────────────────────────────────────────────────
function InlineHeroTextInput({
  initial,
  placeholder,
  maxLength,
  onSave,
}: {
  initial: string;
  placeholder?: string;
  maxLength?: number;
  onSave: (value: string) => Promise<void>;
}) {
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setValue(initial); }, [initial]);
  const commit = useCallback(async () => {
    if (value.trim() === initial.trim()) return;
    setSaving(true);
    try { await onSave(value); } catch { setValue(initial); } finally { setSaving(false); }
  }, [value, initial, onSave]);
  return (
    <div className="relative mt-3 max-w-[18ch]">
      <input
        value={value}
        onChange={(e) => setValue(maxLength ? e.target.value.slice(0, maxLength) : e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === "Escape") { setValue(initial); (e.target as HTMLInputElement).blur(); }
          if (e.key === "Enter") { (e.target as HTMLInputElement).blur(); }
        }}
        placeholder={placeholder}
        disabled={saving}
        className={cn(
          "block w-full bg-transparent outline-none",
          "font-display italic font-light leading-[0.95] tracking-tight",
          "text-white placeholder:text-white/30",
          "border-b-2 border-accent/55 focus:border-accent pb-2",
          "caret-accent",
          "transition-all",
          "focus:[box-shadow:0_8px_42px_-12px_hsl(var(--accent)/0.85)]",
        )}
        style={{
          fontFamily: "'Fraunces', serif",
          fontSize: "clamp(2.8rem, 7vw, 6rem)",
          textShadow: "0 6px 30px hsl(0 0% 0% / 0.55)",
        }}
        autoFocus
      />
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute -bottom-2 left-0 right-0 h-[2px]",
          "bg-gradient-to-r from-accent via-accent/55 to-transparent",
          "opacity-70 transition-opacity",
          saving && "animate-pulse",
        )}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// InlineMicroInput — small monospace-label + serif italic value for the
// right-rail tagline/location editors that ride in the cover hero.
// ─────────────────────────────────────────────────────────────────────────────
function InlineMicroInput({
  label,
  initial,
  placeholder,
  maxLength,
  italic = false,
  align = "left",
  onSave,
}: {
  label: string;
  initial: string;
  placeholder?: string;
  maxLength?: number;
  italic?: boolean;
  align?: "left" | "right";
  onSave: (value: string) => Promise<void>;
}) {
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setValue(initial); }, [initial]);
  const commit = useCallback(async () => {
    if (value.trim() === initial.trim()) return;
    setSaving(true);
    try { await onSave(value); } catch { setValue(initial); } finally { setSaving(false); }
  }, [value, initial, onSave]);
  return (
    <label className={cn("block", align === "right" && "text-right")}>
      <div className={cn(TYPE_META, "text-foreground/45 tracking-[0.32em] mb-1.5")}>{label}</div>
      <input
        value={value}
        onChange={(e) => setValue(maxLength ? e.target.value.slice(0, maxLength) : e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === "Escape") { setValue(initial); (e.target as HTMLInputElement).blur(); }
          if (e.key === "Enter") { (e.target as HTMLInputElement).blur(); }
        }}
        placeholder={placeholder}
        disabled={saving}
        className={cn(
          "block w-full bg-transparent outline-none",
          italic ? "font-display italic font-light text-[clamp(1.1rem,1.6vw,1.4rem)] leading-snug" : "text-[14px] font-light",
          "text-foreground/95 placeholder:text-foreground/30",
          "border-b border-accent/45 focus:border-accent pb-1.5",
          "caret-accent",
          "transition-all focus:[box-shadow:0_8px_28px_-12px_hsl(var(--accent)/0.7)]",
          align === "right" && "text-right",
        )}
        style={italic ? { fontFamily: "'Fraunces', serif" } : undefined}
      />
    </label>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StatsPanel — the three numbers that matter to a creator (plays,
// remixes, followers), rendered as Fraunces-italic display digits with
// monospace meta labels. Sits right below the identity band so visitors
// see proof above the films. Animated count-up; restrained luxury.
// ─────────────────────────────────────────────────────────────────────────────
function StatsPanel({
  plays, remixes, followers, reducedMotion,
}: {
  plays: number;
  remixes: number;
  followers: number;
  reducedMotion: boolean;
}) {
  return (
    // The proof block is the one surface that hugs the RIGHT edge — the
    // numbers read as a creator's receipts pinned to the side rather than
    // centered prose. Capped + ml-auto so it sits in the right ~half.
    <section className="text-right">
      <div className="lg:max-w-[640px] lg:ml-auto">
        <header className="mb-7">
          <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.34em] inline-flex items-center gap-2")}>
            <TrendingUpIcon />
            ◆ The proof
          </div>
          <h3
            className="mt-2 font-display italic text-[clamp(1.6rem,2.6vw,2.2rem)] font-light tracking-tight"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/60 bg-clip-text text-transparent">
              What people did.
            </span>
          </h3>
        </header>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-10">
          <BigCreatorStat label="Views" value={plays} accent reducedMotion={reducedMotion} />
          <BigCreatorStat label="Remixes" value={remixes} reducedMotion={reducedMotion} />
          <BigCreatorStat label="Followers" value={followers} reducedMotion={reducedMotion} />
        </div>
      </div>
    </section>
  );
}

function TrendingUpIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3 text-accent/85" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="3 17 9 11 13 15 21 7" />
      <polyline points="14 7 21 7 21 14" />
    </svg>
  );
}

function BigCreatorStat({
  label, value, accent, reducedMotion,
}: { label: string; value: number; accent?: boolean; reducedMotion: boolean }) {
  const display = useAnimatedNumber(value, reducedMotion);
  return (
    <div>
      <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.32em] mb-3")}>
        ◇ {label}
      </div>
      <div
        className={cn(
          "font-display italic font-light tracking-tight tabular-nums leading-[0.92]",
          "text-[clamp(3.2rem,6vw,5rem)]",
          accent ? "text-foreground" : "text-foreground/95",
        )}
        style={{
          fontFamily: "'Fraunces', serif",
          textShadow: accent
            ? "0 4px 30px hsl(var(--accent) / 0.35)"
            : "0 4px 22px hsl(0 0% 0% / 0.4)",
        }}
      >
        {display.toLocaleString()}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HighlightReelPicker — owner can pin up to 4 reels above the films grid.
// Public visitors see the same lineup read-only. In settingsMode the
// candidate list flips into a multi-select with checkboxes; otherwise
// it just renders the pinned reels as a row.
// ─────────────────────────────────────────────────────────────────────────────
const MAX_HIGHLIGHTS = 4;

function HighlightReelPicker({
  pinned, candidates, isOwner, settingsMode, onChange,
}: {
  pinned: Array<{ id: string; title: string; thumbnail_url: string | null; video_url: string | null }>;
  candidates: Array<{ id: string; title: string; thumbnail_url: string | null; play_count: number }>;
  isOwner: boolean;
  settingsMode: boolean;
  onChange: (nextIds: string[]) => Promise<void>;
}) {
  const pinnedIds = useMemo(() => new Set(pinned.map((p) => p.id)), [pinned]);
  const [pending, setPending] = useState<string[]>(() => pinned.map((p) => p.id));
  useEffect(() => { setPending(pinned.map((p) => p.id)); }, [pinned]);

  // Non-owner view, or owner not in settings mode: render the strip.
  if (!isOwner || !settingsMode) {
    if (pinned.length === 0) return null;
    return (
      <section>
        <header className="flex items-baseline justify-between gap-6 mb-5">
          <div>
            <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.34em] inline-flex items-center gap-2")}>
              <Pin className="h-3 w-3 text-accent/85" strokeWidth={1.6} />
              ◆ Highlight reel
            </div>
            <h3
              className="mt-1 font-display italic text-[clamp(1.3rem,2vw,1.7rem)] font-light tracking-tight"
              style={{ fontFamily: "'Fraunces', serif" }}
            >
              <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/60 bg-clip-text text-transparent">
                {isOwner ? "Your hand-picked four." : "Hand-picked."}
              </span>
            </h3>
          </div>
        </header>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {pinned.slice(0, MAX_HIGHLIGHTS).map((r) => (
            <Link
              key={r.id}
              to={`/r/${r.id}`}
              className="group/h relative block aspect-video rounded-xl overflow-hidden ring-1 ring-inset ring-white/[0.06] hover:ring-accent/40 transition-all"
            >
              {r.thumbnail_url ? (
                <img src={r.thumbnail_url} alt="" className="absolute inset-0 w-full h-full object-cover group-hover/h:scale-[1.04] transition-transform duration-700" />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] to-transparent flex items-center justify-center">
                  <Film className="h-6 w-6 text-white/30" strokeWidth={1.3} />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
              <span aria-hidden className="absolute top-2.5 left-2.5 h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_12px_hsl(var(--accent)/0.85)]" />
              <div className="absolute bottom-0 inset-x-0 p-3">
                <div
                  className="text-[13px] font-light text-white truncate"
                  style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic" }}
                >
                  {r.title || "Untitled"}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    );
  }

  // Owner + settings mode: multi-select picker. Up to MAX_HIGHLIGHTS.
  const merged = useMemo(() => {
    const byId = new Map<string, { id: string; title: string; thumbnail_url: string | null; play_count?: number }>();
    pinned.forEach((p) => byId.set(p.id, { id: p.id, title: p.title, thumbnail_url: p.thumbnail_url }));
    candidates.forEach((c) => { if (!byId.has(c.id)) byId.set(c.id, c); });
    return Array.from(byId.values());
  }, [pinned, candidates]);
  const toggle = (id: string) => {
    setPending((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_HIGHLIGHTS) {
        toast.error(`Pin up to ${MAX_HIGHLIGHTS} highlights — unpick one first.`);
        return prev;
      }
      return [...prev, id];
    });
  };
  const dirty = useMemo(() => {
    const a = pending.slice().sort().join(",");
    const b = pinned.map((p) => p.id).slice().sort().join(",");
    return a !== b;
  }, [pending, pinned]);
  const save = async () => {
    if (!dirty) return;
    await onChange(pending);
  };

  return (
    <section>
      <header className="flex items-baseline justify-between gap-6 mb-5">
        <div>
          <div className={cn(TYPE_META, "text-accent tracking-[0.34em] inline-flex items-center gap-2")}>
            <Pin className="h-3 w-3" strokeWidth={1.6} />
            ◆ Highlight reel — pick up to {MAX_HIGHLIGHTS}
          </div>
          <h3
            className="mt-1 font-display italic text-[clamp(1.3rem,2vw,1.7rem)] font-light tracking-tight"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/60 bg-clip-text text-transparent">
              The four you want above the fold.
            </span>
          </h3>
        </div>
        <div className="flex items-center gap-3">
          <span className={cn(TYPE_META, "text-foreground/55 tabular-nums tracking-[0.28em]")}>
            {pending.length}/{MAX_HIGHLIGHTS}
          </span>
          <button
            type="button"
            onClick={() => void save()}
            disabled={!dirty}
            className={cn(
              "inline-flex items-center gap-2 h-9 px-4 rounded-full text-[11px] font-mono uppercase tracking-[0.28em] transition-all",
              dirty
                ? "bg-accent text-black hover:bg-accent/85 shadow-[0_0_22px_-6px_hsl(var(--accent)/0.85)]"
                : "bg-white/[0.04] text-foreground/30 cursor-not-allowed",
            )}
          >
            <SaveIcon className="h-3.5 w-3.5" strokeWidth={1.6} />
            Save highlights
          </button>
        </div>
      </header>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {merged.length === 0 ? (
          <div className={cn(TYPE_META, "text-foreground/45")}>
            Publish a reel first — then come back to highlight your best four.
          </div>
        ) : merged.map((r) => {
          const on = pending.includes(r.id);
          const wasPinned = pinnedIds.has(r.id);
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => toggle(r.id)}
              aria-pressed={on}
              className={cn(
                "group/p relative block aspect-video rounded-xl overflow-hidden ring-1 ring-inset transition-all text-left",
                on
                  ? "ring-accent/85 shadow-[0_0_24px_-6px_hsl(var(--accent)/0.85)]"
                  : "ring-white/[0.06] hover:ring-white/30",
              )}
            >
              {r.thumbnail_url ? (
                <img src={r.thumbnail_url} alt="" className={cn("absolute inset-0 w-full h-full object-cover transition-transform duration-700", on && "scale-[1.02]")} />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] to-transparent flex items-center justify-center">
                  <Film className="h-6 w-6 text-white/30" strokeWidth={1.3} />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
              <div
                aria-hidden
                className={cn(
                  "absolute top-2.5 right-2.5 h-6 w-6 rounded-full flex items-center justify-center transition-all",
                  on ? "bg-accent text-black ring-2 ring-accent/55" : "bg-black/55 text-white/55 ring-1 ring-inset ring-white/30",
                )}
              >
                {on ? <Check className="h-3.5 w-3.5" strokeWidth={2.4} /> : <Plus className="h-3 w-3" strokeWidth={2} />}
              </div>
              {wasPinned && (
                <span aria-hidden className="absolute top-2.5 left-2.5 h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_hsl(var(--accent)/0.7)]" />
              )}
              <div className="absolute bottom-0 inset-x-0 p-3">
                <div
                  className="text-[13px] font-light text-white truncate"
                  style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic" }}
                >
                  {r.title || "Untitled"}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// Plus icon stand-in (lucide is already imported but Plus isn't).
function Plus({ className, strokeWidth = 1.6 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ProfileSettingsPanel — the single inline settings surface for the
// owner. Sits between the identity band and the films section when
// settingsMode is on. Covers every field the brief listed: pronouns,
// external links, privacy (DM permission, mutual-follow gate), theme
// accent, default editor preferences (aspect ratio, engine/LUT proxy,
// reel visibility), notifications link. Uses optimistic writes with
// rollback on error; toasts on success.
// ─────────────────────────────────────────────────────────────────────────────
const LINK_FIELDS: Array<{ key: string; label: string; placeholder: string; Icon: React.ElementType }> = [
  { key: "website",    label: "Website",   placeholder: "https://your-site.com", Icon: Globe },
  { key: "twitter",    label: "Twitter",   placeholder: "https://twitter.com/handle", Icon: Twitter },
  { key: "instagram",  label: "Instagram", placeholder: "https://instagram.com/handle", Icon: Instagram },
  { key: "youtube",    label: "YouTube",   placeholder: "https://youtube.com/@handle", Icon: Youtube },
  { key: "tiktok",     label: "TikTok",    placeholder: "https://tiktok.com/@handle", Icon: Music2 },
  { key: "github",     label: "GitHub",    placeholder: "https://github.com/handle", Icon: Github },
  { key: "linkedin",   label: "LinkedIn",  placeholder: "https://linkedin.com/in/handle", Icon: Linkedin },
  { key: "spotify",    label: "Spotify",   placeholder: "https://open.spotify.com/...", Icon: Music2 },
  { key: "soundcloud", label: "SoundCloud", placeholder: "https://soundcloud.com/handle", Icon: Music2 },
];

const ACCENT_PRESETS: Array<{ key: string; label: string; hsl: string }> = [
  { key: "blue",   label: "Cinema Blue",  hsl: "215 100% 60%" },
  { key: "violet", label: "Velvet",       hsl: "275 80% 65%" },
  { key: "amber",  label: "Gold Print",   hsl: "38 92% 60%" },
  { key: "emerald",label: "Soundstage",   hsl: "162 70% 50%" },
  { key: "rose",   label: "Red Carpet",   hsl: "350 88% 62%" },
  { key: "cyan",   label: "Magic Hour",   hsl: "188 88% 60%" },
];

const PRONOUN_PRESETS = ["she/her", "he/him", "they/them", "she/they", "he/they", "any pronouns"];

function ProfileSettingsPanel({
  userId,
  initialProfile,
  onClose,
  onSaved,
}: {
  userId: string;
  initialProfile: {
    display_name: string | null;
    tagline: string | null;
    location: string | null;
    external_links: Record<string, string>;
    preferences: Record<string, unknown>;
  };
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { prefs, setPrefs } = useUserPreferences();

  // External links (lives in profiles.external_links, JSONB)
  const [links, setLinks] = useState<Record<string, string>>(() => ({ ...initialProfile.external_links }));
  const [savingLinks, setSavingLinks] = useState(false);

  // Pronouns, theme accent — stashed in profiles.preferences so we don't
  // need a migration. The UserPreferencesContext is the canonical writer
  // for everything inside `preferences`, so we go through it for the
  // editor defaults / privacy / notifications. Pronouns + accent aren't
  // first-class on the UserPrefs shape so we patch the raw row directly.
  const [pronouns, setPronouns] = useState<string>(() => {
    const p = (initialProfile.preferences as { pronouns?: string } | null)?.pronouns;
    return p ?? "";
  });
  const [accent, setAccent] = useState<string>(() => {
    const a = (initialProfile.preferences as { themeAccent?: string } | null)?.themeAccent;
    return a ?? "blue";
  });

  const saveLinks = useCallback(async () => {
    setSavingLinks(true);
    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(links)) {
      if (v && v.trim().length > 0) cleaned[k] = v.trim();
    }
    const prev = initialProfile.external_links;
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ external_links: cleaned as never })
        .eq("id", userId);
      if (error) throw error;
      toast.success("Links saved");
      await onSaved();
    } catch (e) {
      setLinks(prev);
      toast.error(e instanceof Error ? e.message : "Couldn't save links");
    } finally {
      setSavingLinks(false);
    }
  }, [links, initialProfile.external_links, userId, onSaved]);

  const savePronouns = useCallback(async (next: string) => {
    const prev = pronouns;
    setPronouns(next);
    try {
      const merged = {
        ...((initialProfile.preferences as Record<string, unknown>) ?? {}),
        pronouns: next || null,
      };
      const { error } = await supabase
        .from("profiles")
        .update({ preferences: merged as never })
        .eq("id", userId);
      if (error) throw error;
      toast.success("Pronouns saved");
    } catch (e) {
      setPronouns(prev);
      toast.error(e instanceof Error ? e.message : "Couldn't save pronouns");
    }
  }, [pronouns, initialProfile.preferences, userId]);

  const saveAccent = useCallback(async (next: string) => {
    const prev = accent;
    setAccent(next);
    try {
      const merged = {
        ...((initialProfile.preferences as Record<string, unknown>) ?? {}),
        themeAccent: next,
      };
      const { error } = await supabase
        .from("profiles")
        .update({ preferences: merged as never })
        .eq("id", userId);
      if (error) throw error;
      toast.success("Accent saved");
    } catch (e) {
      setAccent(prev);
      toast.error(e instanceof Error ? e.message : "Couldn't save accent");
    }
  }, [accent, initialProfile.preferences, userId]);

  const setPref = useCallback(async <K extends keyof UserPrefs>(key: K, value: UserPrefs[K]) => {
    const prev = prefs[key];
    try {
      await setPrefs({ [key]: value } as Partial<UserPrefs>);
      toast.success("Saved");
    } catch (e) {
      // setPrefs already updated local state; surface the error
      toast.error(e instanceof Error ? e.message : "Couldn't save");
      // Revert via a second write
      try { await setPrefs({ [key]: prev } as Partial<UserPrefs>); } catch { /* swallow */ }
    }
  }, [prefs, setPrefs]);

  const accentMeta = ACCENT_PRESETS.find((a) => a.key === accent) ?? ACCENT_PRESETS[0];

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.4, ease: EASE_PREMIUM }}
      className="relative rounded-3xl ring-1 ring-inset ring-accent/25 bg-gradient-to-br from-accent/[0.04] via-white/[0.015] to-transparent p-6 sm:p-9"
      style={{
        boxShadow: "0 30px 80px -28px hsl(var(--accent) / 0.55), inset 0 1px 0 hsl(0 0% 100% / 0.06)",
      }}
    >
      {/* Header */}
      <header className="flex items-baseline justify-between gap-6 mb-7 flex-wrap">
        <div>
          <div className={cn(TYPE_META, "text-accent tracking-[0.34em] inline-flex items-center gap-2")}>
            <SettingsIcon className="h-3 w-3" strokeWidth={1.6} />
            ◆ Settings mode
          </div>
          <h3
            className="mt-1 font-display italic text-[clamp(1.6rem,2.6vw,2.2rem)] font-light tracking-tight"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/60 bg-clip-text text-transparent">
              Shape how the world sees you.
            </span>
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className={cn(
            "inline-flex items-center gap-2 h-9 px-4 rounded-full",
            "bg-accent/15 hover:bg-accent/25 ring-1 ring-inset ring-accent/40",
            "text-[11px] font-mono uppercase tracking-[0.28em] text-accent transition-colors",
          )}
        >
          <Check className="h-3.5 w-3.5" strokeWidth={1.8} />
          Done
        </button>
      </header>

      {/* Identity rail — pronouns + accent + asset uploaders */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <SettingsBlock label="Pronouns" icon={AtSign}>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {PRONOUN_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => void savePronouns(p)}
                  className={cn(
                    "h-8 px-3 rounded-full text-[11px] font-mono uppercase tracking-[0.22em] transition-all ring-1 ring-inset",
                    pronouns === p
                      ? "bg-accent/20 ring-accent/55 text-accent shadow-[0_0_16px_-6px_hsl(var(--accent)/0.75)]"
                      : "bg-white/[0.03] ring-white/[0.08] text-foreground/70 hover:text-foreground hover:ring-white/30",
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
            <SettingsInput
              value={pronouns}
              onChange={setPronouns}
              onCommit={() => void savePronouns(pronouns)}
              placeholder="or write your own"
            />
          </div>
        </SettingsBlock>

        <SettingsBlock label="Theme accent" icon={Palette}>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {ACCENT_PRESETS.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => void saveAccent(a.key)}
                  className={cn(
                    "group/a relative h-12 rounded-xl ring-1 ring-inset transition-all overflow-hidden",
                    a.key === accent
                      ? "ring-accent/85 shadow-[0_0_22px_-4px_hsl(var(--accent)/0.85)]"
                      : "ring-white/[0.08] hover:ring-white/30",
                  )}
                  style={{
                    background: `radial-gradient(circle at 30% 40%, hsl(${a.hsl} / 0.85), hsl(${a.hsl} / 0.30) 70%)`,
                  }}
                  title={a.label}
                >
                  {a.key === accent && (
                    <Check className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.65)]" strokeWidth={2.4} />
                  )}
                </button>
              ))}
            </div>
            <div className={cn(TYPE_META, "text-foreground/45")}>
              Live preview · {accentMeta.label}
            </div>
          </div>
        </SettingsBlock>

        <SettingsBlock label="Assets" icon={Camera}>
          <div className="space-y-3">
            <AssetUploadRow kind="avatar" userId={userId} label="Avatar" Icon={Camera} />
            <AssetUploadRow kind="cover"  userId={userId} label="Header image" Icon={ImageIcon} />
          </div>
        </SettingsBlock>
      </div>

      {/* External links */}
      <div className="mb-8">
        <SettingsBlock label="Where to find you" icon={Link2}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {LINK_FIELDS.map(({ key, label, placeholder, Icon }) => (
              <label key={key} className="block">
                <div className={cn(TYPE_META, "text-foreground/55 mb-1.5 tracking-[0.28em] inline-flex items-center gap-1.5")}>
                  <Icon className="h-3 w-3 text-accent/70" strokeWidth={1.6} />
                  {label}
                </div>
                <input
                  value={links[key] ?? ""}
                  onChange={(e) => setLinks({ ...links, [key]: e.target.value })}
                  placeholder={placeholder}
                  className={cn(
                    "block w-full h-10 px-3 rounded-xl",
                    "bg-white/[0.03] ring-1 ring-inset ring-white/[0.08] focus:ring-accent/55",
                    "text-[13px] text-foreground placeholder:text-foreground/30 font-mono",
                    "outline-none transition-all focus:[box-shadow:0_8px_28px_-12px_hsl(var(--accent)/0.7)]",
                  )}
                />
              </label>
            ))}
          </div>
          <div className="mt-5 flex items-center justify-end">
            <button
              type="button"
              onClick={() => void saveLinks()}
              disabled={savingLinks}
              className={cn(
                "inline-flex items-center gap-2 h-9 px-4 rounded-full",
                "bg-accent text-black hover:bg-accent/85 disabled:opacity-60",
                "text-[11px] font-mono uppercase tracking-[0.28em] transition-colors",
                "shadow-[0_0_22px_-6px_hsl(var(--accent)/0.85)]",
              )}
            >
              {savingLinks ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SaveIcon className="h-3.5 w-3.5" strokeWidth={1.6} />}
              Save links
            </button>
          </div>
        </SettingsBlock>
      </div>

      {/* Privacy */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <SettingsBlock label="Followers" icon={Lock}>
          <SettingsRadioRow
            value={prefs.followPermission}
            onChange={(v) => void setPref("followPermission", v as UserPrefs["followPermission"])}
            options={[
              { value: "everyone", label: "Open — anyone can follow" },
              { value: "mutual_only", label: "Mutual-follow gate" },
            ]}
          />
        </SettingsBlock>
        <SettingsBlock label="Direct messages" icon={Lock}>
          <SettingsRadioRow
            value={prefs.dmPermission}
            onChange={(v) => void setPref("dmPermission", v as UserPrefs["dmPermission"])}
            options={[
              { value: "everyone", label: "Anyone" },
              { value: "followers", label: "Followers only" },
              { value: "nobody", label: "Nobody — closed" },
            ]}
          />
        </SettingsBlock>
        <SettingsBlock label="Notifications" icon={Bell}>
          <p className="text-[12px] text-foreground/65 leading-relaxed mb-3">
            Email, push, and digest cadence live in the dedicated settings hub.
          </p>
          <Link
            to="/account?tab=settings#notifications"
            className={cn(
              "inline-flex items-center gap-2 h-9 px-4 rounded-full",
              "bg-white/[0.04] hover:bg-white/[0.08] ring-1 ring-inset ring-white/[0.10] hover:ring-white/30",
              "text-[11px] font-mono uppercase tracking-[0.28em] text-foreground/85 hover:text-foreground transition-all",
            )}
          >
            <Bell className="h-3.5 w-3.5" strokeWidth={1.6} />
            Notification settings
            <ArrowUpRight className="h-3 w-3" strokeWidth={1.6} />
          </Link>
        </SettingsBlock>
      </div>

      {/* Editor defaults */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SettingsBlock label="Default aspect ratio" icon={Film}>
          <SettingsPills
            value={prefs.defaultAspectRatio}
            onChange={(v) => void setPref("defaultAspectRatio", v as UserPrefs["defaultAspectRatio"])}
            options={[
              { value: "16:9", label: "16:9 — landscape" },
              { value: "9:16", label: "9:16 — portrait" },
              { value: "1:1",  label: "1:1 — square" },
            ]}
          />
        </SettingsBlock>
        <SettingsBlock label="Default LUT / look" icon={Palette}>
          <SettingsPills
            value={prefs.defaultQualityTier}
            onChange={(v) => void setPref("defaultQualityTier", v as UserPrefs["defaultQualityTier"])}
            options={[
              { value: "standard", label: "Standard" },
              { value: "pro", label: "Pro" },
              { value: "cinematic", label: "Cinematic" },
            ]}
          />
        </SettingsBlock>
        <SettingsBlock label="New reel visibility" icon={Globe}>
          <SettingsPills
            value={prefs.defaultReelVisibility}
            onChange={(v) => void setPref("defaultReelVisibility", v as UserPrefs["defaultReelVisibility"])}
            options={[
              { value: "public", label: "Public" },
              { value: "unlisted", label: "Unlisted" },
              { value: "private", label: "Private" },
            ]}
          />
        </SettingsBlock>
      </div>
    </motion.section>
  );
}

function SettingsBlock({
  label, icon: Icon, children,
}: { label: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className={cn(TYPE_META, "text-foreground/55 tracking-[0.32em] inline-flex items-center gap-2")}>
        <Icon className="h-3 w-3 text-accent/85" strokeWidth={1.6} />
        ◇ {label}
      </div>
      <div>{children}</div>
    </div>
  );
}

function SettingsInput({
  value, onChange, onCommit, placeholder,
}: { value: string; onChange: (v: string) => void; onCommit: () => void; placeholder?: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") (e.target as HTMLInputElement).blur();
      }}
      placeholder={placeholder}
      className={cn(
        "block w-full h-10 px-3 rounded-xl",
        "bg-white/[0.03] ring-1 ring-inset ring-white/[0.08] focus:ring-accent/55",
        "text-[13px] text-foreground placeholder:text-foreground/30 font-mono",
        "outline-none transition-all focus:[box-shadow:0_8px_28px_-12px_hsl(var(--accent)/0.7)]",
      )}
    />
  );
}

function SettingsRadioRow({
  value, onChange, options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="space-y-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "group/r flex items-center w-full text-left gap-3 h-10 px-3 rounded-xl transition-all",
            "ring-1 ring-inset",
            o.value === value
              ? "bg-accent/15 ring-accent/55 text-accent shadow-[0_0_18px_-6px_hsl(var(--accent)/0.75)]"
              : "bg-white/[0.02] ring-white/[0.06] text-foreground/75 hover:text-foreground hover:ring-white/25",
          )}
        >
          <span
            aria-hidden
            className={cn(
              "inline-block h-3 w-3 rounded-full ring-1 ring-inset transition-all",
              o.value === value
                ? "bg-accent ring-accent shadow-[0_0_8px_hsl(var(--accent)/0.85)]"
                : "bg-transparent ring-foreground/45",
            )}
          />
          <span className="text-[13px] font-light">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

function SettingsPills({
  value, onChange, options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "h-9 px-3.5 rounded-full text-[11px] font-mono uppercase tracking-[0.24em] transition-all ring-1 ring-inset",
            o.value === value
              ? "bg-accent/20 ring-accent/55 text-accent shadow-[0_0_18px_-6px_hsl(var(--accent)/0.85)]"
              : "bg-white/[0.03] ring-white/[0.08] text-foreground/70 hover:text-foreground hover:ring-white/30",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function AssetUploadRow({
  kind, userId, label, Icon,
}: {
  kind: "avatar" | "cover";
  userId: string;
  label: string;
  Icon: React.ElementType;
}) {
  const upload = useFileUpload({
    bucket: kind === "avatar" ? "avatars" : "profile-covers",
    maxSizeMB: kind === "avatar" ? 5 : 10,
    allowedTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    signed: false,
  });
  const inputRef = useRef<HTMLInputElement | null>(null);
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const result = await upload.uploadFile(file);
    if (!result?.url) return;
    try {
      const column = kind === "avatar" ? "avatar_url" : "cover_url";
      const { error } = await supabase.from("profiles").update({ [column]: result.url }).eq("id", userId);
      if (error) throw error;
      toast.success(kind === "avatar" ? "Avatar updated" : "Header updated");
      window.dispatchEvent(new CustomEvent("profile:assets-changed"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save image");
    }
  };
  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      disabled={upload.isUploading}
      className={cn(
        "group/au flex items-center gap-3 w-full h-12 px-4 rounded-xl text-left",
        "bg-white/[0.03] ring-1 ring-inset ring-white/[0.08] hover:ring-accent/45 transition-all",
        "shadow-[0_0_0_-6px_hsl(var(--accent)/0.0)] hover:shadow-[0_0_20px_-6px_hsl(var(--accent)/0.55)]",
      )}
    >
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleFile} />
      <div className="h-8 w-8 rounded-full bg-accent/10 ring-1 ring-inset ring-accent/30 flex items-center justify-center text-accent">
        <Icon className="h-4 w-4" strokeWidth={1.5} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-foreground font-light">{label}</div>
        <div className={cn(TYPE_META, "text-foreground/45")}>
          {upload.isUploading ? `Uploading ${upload.progress}%` : "Click to replace"}
        </div>
      </div>
      <ArrowUpRight className="h-3.5 w-3.5 text-foreground/40 group-hover/au:text-accent transition-colors" strokeWidth={1.5} />
    </button>
  );
}
