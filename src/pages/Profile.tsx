/**
 * Profile — /profile (own) + powers /c/:id (others) via shared component.
 *
 * The most comprehensive identity surface on Small Bridges. Composes:
 *
 *   1. COVER + AVATAR HERO
 *      Editable cover image (owner only), avatar with click-to-upload,
 *      tagline / quote, display-name + bio + location, social link rail,
 *      account-type badge, joined date, Follow/Edit primary CTA.
 *
 *   2. STAT RAIL
 *      4 cards persistent at the bottom of the hero — Followers, Plays,
 *      Reels, Credits (credits only when owner). 30-day delta sparklines.
 *
 *   3. TABS (StudioTabs glass pill)
 *      Overview / Analytics / Reels / Achievements / About / [Settings].
 *      Last tab is owner-only and groups Credits, Security, Danger.
 *
 *   4. ANALYTICS TAB
 *      Recharts area chart for plays + followers over the last 30 days,
 *      top reels by play count, engagement summary.
 *
 *   5. REELS TAB
 *      All published reels grid with pinning (owner) and play / like
 *      counters.
 *
 *   6. ABOUT TAB
 *      Bio, tagline, location, links, member-since, universes, crews.
 *
 * All data flows through a single RPC (`profile_overview`) + one chart
 * RPC (`profile_play_series`). Public-readable so non-owner views work
 * for anonymous + signed-in visitors.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer,
} from "recharts";
import {
  User as UserIcon, Mail, Check, Camera, Edit2, Save, X, Coins,
  Film, Heart, Eye, Wand2, ArrowRight, Crown, Sparkles, Loader2,
  ShieldCheck, LogOut, Building2, Calendar, AlertTriangle, Settings as SettingsIcon,
  Plus, MapPin, Quote, Link2, ImagePlus, UserPlus, UserCheck, Share2,
  Globe, Twitter, Instagram, Youtube, Github, Linkedin, Music2, KeyRound,
  Pin, LayoutGrid, BarChart3, Award, ExternalLink, Flame, TrendingUp,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCredits } from "@/contexts/CreditsContext";
import { supabase } from "@/integrations/supabase/client";
import { useSafeNavigation } from "@/lib/navigation";
import { PageShell } from "@/components/shell";
import { StudioTabs } from "@/components/studio/StudioTabs";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Spinner } from "@/components/ui/Spinner";
import { BuyCreditsModal } from "@/components/credits/BuyCreditsModal";
import { PURCHASING_ENABLED } from "@/lib/native/purchases";
import { TwoFactorCard } from "@/components/security/TwoFactorCard";
import { SessionsCard } from "@/components/security/SessionsCard";
import { UploadReelDialog } from "@/components/publish/UploadReelDialog";
import { PublishWizard } from "@/components/publish/PublishWizard";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ───────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────────

interface ProfileRow {
  id: string;
  email?: string | null;
  display_name?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  cover_url?: string | null;
  bio?: string | null;
  tagline?: string | null;
  location?: string | null;
  external_links?: Record<string, string>;
  account_type?: "personal" | "business" | "enterprise" | "admin" | null;
  created_at?: string;
  credits_balance?: number;
  total_credits_used?: number;
  /** Opt-in flag — true if the user has listed themselves in /find-friends. */
  is_discoverable?: boolean;
}

interface Stats {
  reels: number; plays: number; likes: number; remixes: number; tips: number;
  followers: number; following: number; projects: number;
  followers_30d: number; plays_30d: number;
}

interface ReelLite {
  id: string;
  title: string;
  thumbnail_url: string | null;
  video_url: string;
  play_count: number;
  like_count: number;
  remix_count?: number;
  world_slug?: string | null;
  is_featured?: boolean;
  created_at?: string;
}

interface OverviewPayload {
  profile: ProfileRow;
  stats: Stats;
  recent_reels: ReelLite[];
  top_reels: ReelLite[];
  pinned_reels: ReelLite[];
  is_owner: boolean;
  viewer_following: boolean;
}

interface SeriesPoint { day: string; plays: number; followers: number; }

type TabKey = "overview" | "analytics" | "reels" | "achievements" | "about" | "settings";

const ZERO_STATS: Stats = {
  reels: 0, plays: 0, likes: 0, remixes: 0, tips: 0,
  followers: 0, following: 0, projects: 0,
  followers_30d: 0, plays_30d: 0,
};

// ───────────────────────────────────────────────────────────────────────

export default function Profile() {
  // /c/:id passes :id param. /profile uses the signed-in user's id.
  const params = useParams<{ id?: string }>();
  const { user, profile: ownProfile, refreshProfile, signOut } = useAuth();
  // CreditsContext exposes `available` (ledger truth, less holds).
  // Older code path destructured `credits` which never existed → silently
  // fell back to the cached `profiles.credits_balance`. Use `available` so
  // the Profile pill matches the topbar pill and the ledger.
  const { available: credits } = useCredits();
  const { navigate } = useSafeNavigation();

  const viewedId = params.id ?? user?.id ?? "";
  const isOwnRoute = !params.id;

  const [payload, setPayload] = useState<OverviewPayload | null>(null);
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("overview");
  const [followBusy, setFollowBusy] = useState(false);
  const [editingField, setEditingField] = useState<"name" | "bio" | "tagline" | "location" | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"avatar" | "cover" | null>(null);
  const [buyOpen, setBuyOpen] = useState(false);
  // Upload-a-reel flow: upload dialog → creates a project → PublishWizard.
  const [uploadOpen, setUploadOpen] = useState(false);
  const [publishProjectId, setPublishProjectId] = useState<string | null>(null);
  const [editingLinks, setEditingLinks] = useState(false);
  const [linkDraft, setLinkDraft] = useState<Record<string, string>>({});
  const [savingLinks, setSavingLinks] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const isOwner = payload?.is_owner ?? false;
  const p = payload?.profile;

  usePageMeta({
    title: p?.display_name ? `${p.display_name} — Small Bridges` : "Profile — Small Bridges",
    description: p?.tagline ?? p?.bio ?? "Your Small Bridges identity.",
  });

  // ── Load ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!viewedId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [overRes, seriesRes] = await Promise.all([
        supabase.rpc("profile_overview" as never, { p_user_id: viewedId } as never),
        supabase.rpc("profile_play_series" as never, { p_user_id: viewedId } as never),
      ]);
      if (overRes.error) throw overRes.error;
      const ov = overRes.data as unknown as OverviewPayload;
      // Profile-overview RPC predates the is_discoverable column; fetch the
      // flag separately so the owner's "open my door" toggle has truth.
      try {
        const { data: extra } = await supabase
          .from("profiles")
          .select("is_discoverable")
          .eq("id", viewedId)
          .maybeSingle();
        const flag = (extra as { is_discoverable?: boolean } | null)?.is_discoverable ?? false;
        ov.profile = { ...ov.profile, is_discoverable: flag };
      } catch { /* non-fatal */ }
      setPayload(ov);
      const seriesData = seriesRes.data as unknown as { series?: SeriesPoint[] } | null;
      setSeries(seriesData?.series ?? []);
    } catch (e) {
      console.warn("[Profile] overview load failed; rendering stub", e);
      // Best-effort minimal payload so the page still renders.
      // CRITICAL: we used to spread `ownProfile` (the LOGGED-IN viewer's row)
      // onto the fallback. That meant a failed lookup for any *other* user
      // would silently render the viewer's own identity. Now: only spread
      // ownProfile when we're actually on our own profile route.
      const stubProfile: ProfileRow = isOwnRoute
        ? { id: viewedId, ...(ownProfile ?? {}), ...(user ? { email: user.email } : {}) } as ProfileRow
        : { id: viewedId } as ProfileRow;
      setPayload({
        profile: stubProfile,
        stats: ZERO_STATS,
        recent_reels: [], top_reels: [], pinned_reels: [],
        is_owner: isOwnRoute,
        viewer_following: false,
      });
      setSeries([]);
    } finally {
      setLoading(false);
    }
  }, [viewedId, ownProfile, isOwnRoute, user]);

  useEffect(() => { void load(); }, [load]);

  const accountType = (p?.account_type ?? "personal") as "personal" | "business" | "enterprise" | "admin";
  const memberSince = useMemo(() => {
    if (!p?.created_at) return null;
    try { return new Date(p.created_at).toLocaleDateString(undefined, { year: "numeric", month: "long" }); }
    catch { return null; }
  }, [p?.created_at]);

  const displayName = p?.display_name || p?.full_name || (p?.email?.split("@")[0]) || "Creator";
  const initial = (displayName[0] || "?").toUpperCase();

  // ── Follow / unfollow ─────────────────────────────────────────────
  const toggleFollow = async () => {
    if (!user) { navigate("/auth"); return; }
    if (!payload || isOwner) return;
    setFollowBusy(true);
    try {
      const { data, error } = await supabase.rpc("toggle_follow" as never, { p_target: payload.profile.id } as never);
      if (error) throw error;
      const out = data as unknown as { following: boolean };
      setPayload({
        ...payload,
        viewer_following: out.following,
        stats: {
          ...payload.stats,
          followers: Math.max(0, payload.stats.followers + (out.following ? 1 : -1)),
        },
      });
      toast.success(out.following ? "Following" : "Unfollowed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't follow");
    } finally {
      setFollowBusy(false);
    }
  };

  // ── Inline editing (owner only) ───────────────────────────────────
  const startEdit = (field: "name" | "bio" | "tagline" | "location") => {
    setDraft(
      field === "name" ? (p?.display_name ?? p?.full_name ?? "")
      : field === "bio" ? (p?.bio ?? "")
      : field === "tagline" ? (p?.tagline ?? "")
      : (p?.location ?? "")
    );
    setEditingField(field);
  };
  const cancelEdit = () => { setEditingField(null); setDraft(""); };

  const saveEdit = async () => {
    if (!user || !editingField) return;
    setSaving(true);
    try {
      const args: Record<string, string | null> = {
        p_display_name: editingField === "name" ? draft : null,
        p_bio:          editingField === "bio" ? draft : null,
        p_tagline:      editingField === "tagline" ? draft : null,
        p_location:     editingField === "location" ? draft : null,
      };
      const { error } = await supabase.rpc("update_profile_text" as never, args as never);
      if (error) throw error;
      // Optimistic local update.
      setPayload((prev) => prev ? {
        ...prev,
        profile: {
          ...prev.profile,
          ...(editingField === "name"     ? { display_name: draft.trim() || null } : {}),
          ...(editingField === "bio"      ? { bio: draft.trim() || null } : {}),
          ...(editingField === "tagline"  ? { tagline: draft.trim() || null } : {}),
          ...(editingField === "location" ? { location: draft.trim() || null } : {}),
        },
      } : prev);
      await refreshProfile();
      setEditingField(null);
      toast.success("Saved");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Save failed";
      const friendly = msg.includes("too_long") ? "That value is too long" : msg;
      toast.error(friendly);
    } finally {
      setSaving(false);
    }
  };

  // ── Avatar + cover upload (owner only) ────────────────────────────
  const pickImage = async (kind: "avatar" | "cover", file: File) => {
    if (!user) return;
    const maxBytes = kind === "cover" ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      toast.error(`Image must be under ${maxBytes / 1024 / 1024} MB`);
      return;
    }
    setUploading(kind);
    try {
      const bucket = kind === "cover" ? "profile-covers" : "avatars";
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${user.id}/${kind}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: "3600", upsert: false, contentType: file.type || `image/${ext}`,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
      const col = kind === "cover" ? "cover_url" : "avatar_url";
      const { error: setErr } = await supabase.from("profiles").update({ [col]: pub.publicUrl }).eq("id", user.id);
      if (setErr) throw setErr;
      setPayload((prev) => prev ? { ...prev, profile: { ...prev.profile, [col]: pub.publicUrl } } : prev);
      await refreshProfile();
      toast.success(kind === "cover" ? "Cover updated" : "Avatar updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  };

  const onAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (f) void pickImage("avatar", f);
    if (avatarInputRef.current) avatarInputRef.current.value = "";
  };
  const onCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (f) void pickImage("cover", f);
    if (coverInputRef.current) coverInputRef.current.value = "";
  };

  // ── Links editing ─────────────────────────────────────────────────
  const startLinksEdit = () => {
    setLinkDraft({
      website: p?.external_links?.website ?? "",
      twitter: p?.external_links?.twitter ?? "",
      instagram: p?.external_links?.instagram ?? "",
      youtube: p?.external_links?.youtube ?? "",
      tiktok: p?.external_links?.tiktok ?? "",
      github: p?.external_links?.github ?? "",
      linkedin: p?.external_links?.linkedin ?? "",
      spotify: p?.external_links?.spotify ?? "",
      soundcloud: p?.external_links?.soundcloud ?? "",
    });
    setEditingLinks(true);
  };
  const saveLinks = async () => {
    setSavingLinks(true);
    try {
      const cleaned: Record<string, string> = {};
      for (const [k, v] of Object.entries(linkDraft)) {
        if (v && v.trim().length > 0) cleaned[k] = v.trim();
      }
      const { data, error } = await supabase.rpc("update_profile_links" as never, { p_links: cleaned } as never);
      if (error) throw error;
      const out = data as unknown as { links: Record<string, string> };
      setPayload((prev) => prev ? { ...prev, profile: { ...prev.profile, external_links: out.links } } : prev);
      setEditingLinks(false);
      toast.success("Links saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingLinks(false);
    }
  };

  // ── Pin toggle ────────────────────────────────────────────────────
  const togglePin = async (reelId: string) => {
    if (!isOwner) return;
    try {
      const { data, error } = await supabase.rpc("toggle_pin_reel" as never, { p_reel_id: reelId } as never);
      if (error) throw error;
      const out = data as unknown as { pinned: boolean };
      toast.success(out.pinned ? "Pinned to profile" : "Unpinned");
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Pin failed";
      toast.error(msg.includes("max_pinned_reached") ? "You can pin up to 3 reels" : msg);
    }
  };

  // ── Share ─────────────────────────────────────────────────────────
  const sharePage = async () => {
    try {
      const url = `${window.location.origin}/c/${viewedId}`;
      if (navigator.share) {
        await navigator.share({ title: `${displayName} on Small Bridges`, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch { /* user cancelled */ }
  };

  // ── Render ───────────────────────────────────────────────────────
  if (loading && !payload) {
    return <div className="min-h-screen flex items-center justify-center"><Spinner size="lg" tone="muted" /></div>;
  }
  if (!payload) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center px-6 max-w-md mx-auto">
        <div>
          <Sparkles className="w-7 h-7 mx-auto mb-4 text-white/45" />
          <h2 className="font-display font-medium text-[24px] text-white mb-2">Profile not found</h2>
          <p className="text-[12px] text-white/45 mb-6">This account doesn't exist or has been removed.</p>
          <Link to="/lobby" className="pill bg-white text-black hover:bg-white/90">
            Back to Lobby <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    );
  }

  const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
    { key: "overview",     label: "Overview",     icon: LayoutGrid },
    { key: "analytics",    label: "Analytics",    icon: BarChart3 },
    { key: "reels",        label: "Reels",        icon: Wand2 },
    { key: "achievements", label: "Achievements", icon: Award },
    { key: "about",        label: "About",        icon: UserIcon },
    ...(isOwner ? [{ key: "settings" as TabKey, label: "Settings", icon: SettingsIcon }] : []),
  ];

  return (
    <div className="relative min-h-screen flex flex-col">

      {/* ─────────────────────────────────────────────────────────────
          HERO — cover + avatar overlay
      ──────────────────────────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="relative w-full"
      >
        <div className="relative w-full h-[300px] lg:h-[380px] overflow-hidden">
          {p?.cover_url ? (
            <img src={p.cover_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse at 30% 30%, hsla(215,100%,60%,0.22), transparent 60%)," +
                  "radial-gradient(ellipse at 70% 60%, hsla(280,70%,55%,0.18), transparent 60%)," +
                  "linear-gradient(180deg, hsla(220,14%,5%,0.95), hsla(220,14%,3%,1))",
              }} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#040506] via-[#040506]/30 to-transparent" />

          {/* Cover upload — owner only */}
          {isOwner && (
            <>
              <button
                onClick={() => coverInputRef.current?.click()}
                className="absolute top-5 right-5 inline-flex items-center gap-2 h-9 px-3.5 rounded-full bg-black/55 backdrop-blur-md border border-white/[0.10] hover:border-white/30 text-white/85 hover:text-white text-[10px] font-mono uppercase tracking-[0.28em] transition-colors"
              >
                {uploading === "cover" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
                {p?.cover_url ? "Change cover" : "Add cover"}
              </button>
              <input ref={coverInputRef} type="file" accept="image/*" className="sr-only" onChange={onCoverChange} />
            </>
          )}
        </div>

        <PageShell width="wide" pad>
          <div className="relative -mt-20 lg:-mt-24 mb-8 grid grid-cols-1 lg:grid-cols-[auto_1fr_auto] gap-6 lg:gap-8 items-end">

            {/* Avatar — owner can click to upload */}
            <div className="relative shrink-0 group">
              <button
                onClick={() => isOwner && avatarInputRef.current?.click()}
                disabled={!isOwner}
                aria-label="Change avatar"
                className={cn(
                  "relative w-32 h-32 lg:w-40 lg:h-40 rounded-3xl overflow-hidden border-[3px] border-[#040506] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]",
                  isOwner && "focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer",
                )}
              >
                {p?.avatar_url ? (
                  <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[hsl(215_90%_55%/0.55)] to-[hsl(280_70%_45%/0.40)] flex items-center justify-center text-[48px] lg:text-[60px] font-light text-white/95">
                    {initial}
                  </div>
                )}
                {isOwner && (
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    {uploading === "avatar"
                      ? <Loader2 className="w-7 h-7 text-white animate-spin" />
                      : <Camera className="w-7 h-7 text-white" strokeWidth={1.5} />}
                  </div>
                )}
              </button>
              <input ref={avatarInputRef} type="file" accept="image/*" className="sr-only" onChange={onAvatarChange} />
            </div>

            {/* Identity */}
            <div className="min-w-0 lg:pb-2">
              <div className="text-[10px] font-mono uppercase tracking-[0.28em] mb-3 flex items-center gap-2 flex-wrap">
                <AccountBadge type={accountType} />
                {memberSince && <span className="text-white/35">Joined {memberSince}</span>}
                {p?.location && (
                  <span className="inline-flex items-center gap-1 text-white/45">
                    <MapPin className="w-3 h-3" /> {p.location}
                  </span>
                )}
                {isOwner && !p?.location && (
                  <button onClick={() => startEdit("location")} className="inline-flex items-center gap-1 text-white/30 hover:text-white/65">
                    <Plus className="w-3 h-3" /> Add location
                  </button>
                )}
              </div>

              {editingField === "name" ? (
                <InlineEdit value={draft} onChange={setDraft} onSave={saveEdit} onCancel={cancelEdit} saving={saving} large maxLength={60} placeholder="Your display name" />
              ) : (
                <button
                  onClick={() => isOwner && startEdit("name")}
                  disabled={!isOwner}
                  className="group/name font-display font-light text-[36px] lg:text-[56px] leading-[1.0] tracking-[-0.02em] text-white inline-flex items-center gap-3 text-left disabled:cursor-default"
                >
                  {displayName}
                  {isOwner && <Edit2 className="w-4 h-4 text-white/30 opacity-0 group-hover/name:opacity-100 transition-opacity" />}
                </button>
              )}

              {/* Tagline / quote */}
              <div className="mt-3">
                {editingField === "tagline" ? (
                  <InlineEdit value={draft} onChange={setDraft} onSave={saveEdit} onCancel={cancelEdit} saving={saving} maxLength={160} placeholder="A line you live by" />
                ) : p?.tagline ? (
                  <button
                    onClick={() => isOwner && startEdit("tagline")}
                    disabled={!isOwner}
                    className="group/tag inline-flex items-start gap-2 text-left text-[14px] lg:text-[16px] text-white/65 italic max-w-2xl"
                  >
                    <Quote className="w-3.5 h-3.5 shrink-0 mt-1 text-primary/60" />
                    <span>{p.tagline}</span>
                    {isOwner && <Edit2 className="w-3 h-3 text-white/25 opacity-0 group-hover/tag:opacity-100 transition-opacity shrink-0 mt-1.5" />}
                  </button>
                ) : isOwner ? (
                  <button
                    onClick={() => startEdit("tagline")}
                    className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.22em] text-white/35 hover:text-white/65"
                  >
                    <Quote className="w-3 h-3" /> Add a tagline
                  </button>
                ) : null}
              </div>

              {/* Email — owner only */}
              {isOwner && (
                <div className="mt-3 flex items-center gap-2 text-[11px] text-white/50 font-light">
                  <Mail className="w-3 h-3" />
                  <span className="truncate">{p?.email ?? user?.email}</span>
                  {user?.email_confirmed_at && (
                    <span className="inline-flex items-center gap-1 ml-1 text-emerald-300 text-[9px] font-mono uppercase tracking-[0.22em]">
                      <Check className="w-3 h-3" /> Verified
                    </span>
                  )}
                </div>
              )}

              {/* Social link rail */}
              <SocialLinks
                links={p?.external_links ?? {}}
                isOwner={isOwner}
                onEdit={startLinksEdit}
              />
            </div>

            {/* Primary CTA */}
            <div className="flex flex-col gap-2 shrink-0">
              {isOwner ? (
                <>
                  <Link to="/settings" className="pill bg-white text-black hover:bg-white/90">
                    <SettingsIcon className="w-3 h-3" /> Settings
                  </Link>
                  <Link to="/search?tab=people" className="pill border-accent/40 bg-accent/10 hover:bg-accent/20 text-accent border">
                    <UserIcon className="w-3 h-3" /> Find friends
                  </Link>
                  <button onClick={sharePage} className="pill border-white/[0.08] hover:border-white/30 text-white/75 hover:text-white border">
                    <Share2 className="w-3 h-3" /> Share profile
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={toggleFollow}
                    disabled={followBusy}
                    className={cn(
                      "pill",
                      payload.viewer_following
                        ? "border border-white/15 text-white/75 hover:border-rose-300/40 hover:text-rose-200"
                        : "bg-white text-black hover:bg-white/90",
                    )}
                  >
                    {followBusy ? <Loader2 className="w-3 h-3 animate-spin" />
                      : payload.viewer_following ? <UserCheck className="w-3 h-3" />
                      : <UserPlus className="w-3 h-3" />}
                    {payload.viewer_following ? "Following" : "Follow"}
                  </button>
                  <Link to="/search?tab=people" className="pill border-accent/40 bg-accent/10 hover:bg-accent/20 text-accent border">
                    <UserIcon className="w-3 h-3" /> Find friends
                  </Link>
                  <button onClick={sharePage} className="pill border-white/[0.08] hover:border-white/30 text-white/75 hover:text-white border">
                    <Share2 className="w-3 h-3" /> Share
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Bio — full-width under the hero, editable for owner */}
          {(p?.bio || editingField === "bio" || isOwner) && (
            <div className="mb-8 max-w-3xl">
              {editingField === "bio" ? (
                <InlineEdit value={draft} onChange={setDraft} onSave={saveEdit} onCancel={cancelEdit} saving={saving} multiline maxLength={600} placeholder="A few sentences about you, your craft, what you're building." />
              ) : p?.bio ? (
                <button
                  onClick={() => isOwner && startEdit("bio")}
                  disabled={!isOwner}
                  className="group/bio block text-left text-[14px] text-white/70 leading-relaxed whitespace-pre-wrap"
                >
                  {p.bio}
                  {isOwner && <Edit2 className="inline-block ml-2 w-3 h-3 text-white/25 opacity-0 group-hover/bio:opacity-100 transition-opacity" />}
                </button>
              ) : isOwner ? (
                <button
                  onClick={() => startEdit("bio")}
                  className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.22em] text-white/35 hover:text-white/65"
                >
                  <Plus className="w-3 h-3" /> Add a bio
                </button>
              ) : null}
            </div>
          )}

          {/* STAT RAIL */}
          <div className={cn("grid gap-3 mb-10", isOwner ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2 lg:grid-cols-4")}>
            <HeroStat icon={UserIcon} label="Followers" value={payload.stats.followers} delta={payload.stats.followers_30d} accent="primary" />
            <HeroStat icon={Eye}      label="Plays"     value={payload.stats.plays}     delta={payload.stats.plays_30d} />
            <HeroStat icon={Wand2}    label="Reels"     value={payload.stats.reels} />
            {isOwner ? (
              <HeroStat icon={Coins} label="Credits" value={credits ?? (p?.credits_balance ?? 0)} tone="amber" onClick={() => setBuyOpen(true)} />
            ) : (
              <HeroStat icon={Heart} label="Likes" value={payload.stats.likes} />
            )}
          </div>

          {/* TABS */}
          <div className="flex items-center justify-center mb-8 overflow-x-auto">
            <StudioTabs<TabKey>
              items={TABS}
              value={tab}
              onChange={(k) => setTab(k)}
              layoutId="profile-tabs"
            />
          </div>

          <AnimatePresence mode="wait">

            {/* ── OVERVIEW ── */}
            {tab === "overview" && (
              <motion.div
                key="t-overview"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="space-y-6 mb-12"
              >
                {/* Pinned + featured */}
                {(payload.pinned_reels.length > 0 || isOwner) && (
                  <Card>
                    <SectionLabel
                      icon={Pin}
                      label={payload.pinned_reels.length > 0 ? "Pinned reels" : "Pin your best work"}
                    />
                    {payload.pinned_reels.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {payload.pinned_reels.map((r) => (
                          <ReelCard key={r.id} reel={r} isOwner={isOwner} pinned onTogglePin={togglePin} />
                        ))}
                      </div>
                    ) : (
                      <p className="text-[12px] text-white/45">
                        Open any of your reels from the Reels tab and tap the pin icon to feature it here (up to 3).
                      </p>
                    )}
                  </Card>
                )}

                {/* Recent + top stats */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <Card className="lg:col-span-2">
                    <SectionLabel icon={Sparkles} label="Public footprint" />
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                      <SmallStat icon={Wand2} label="Reels"   value={payload.stats.reels} />
                      <SmallStat icon={Eye}   label="Plays"   value={payload.stats.plays} />
                      <SmallStat icon={Heart} label="Likes"   value={payload.stats.likes} />
                      <SmallStat icon={Wand2} label="Remixes" value={payload.stats.remixes} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link to={`/c/${viewedId}`} className="pill bg-white text-black hover:bg-white/90">
                        Public channel <ArrowRight className="w-3 h-3" />
                      </Link>
                      {isOwner && <Link to="/me/year" className="pill border-white/[0.08] hover:border-white/30 text-white/75 hover:text-white border">
                        Year in review <Crown className="w-3 h-3" />
                      </Link>}
                      <Link to="/lobby" className="pill border-white/[0.08] hover:border-white/30 text-white/75 hover:text-white border">Lobby</Link>
                    </div>
                  </Card>

                  <Card>
                    <SectionLabel icon={Sparkles} label="Quick actions" />
                    <div className="space-y-2">
                      {isOwner ? (
                        <>
                          <ActionRow to="/create"       icon={Wand2}     label="Start a new project" hint="Fresh canvas" />
                          <ActionRow to="/projects"     icon={Film}      label="Your library" hint={`${payload.stats.projects} project${payload.stats.projects === 1 ? "" : "s"}`} />
                          <ActionRow to="/messages"     icon={Mail}      label="Messages" hint="DMs + replies" />
                          <ActionRow to="/search?tab=people" icon={UserIcon}  label="Find friends" hint="Opt-in directory" />
                        </>
                      ) : (
                        <>
                          <ActionRow to={`/messages`}   icon={Mail}      label="Send a message" hint="DM the creator" />
                          <ActionRow to="/search?tab=people" icon={UserIcon}  label="Find friends" hint="Other creators like them" />
                          <ActionRow to="/lobby"        icon={Sparkles}  label="Discover more" hint="Browse the Lobby" />
                        </>
                      )}
                    </div>
                  </Card>

                  {isOwner && (
                    <DiscoverabilityCard
                      userId={viewedId!}
                      initial={p?.is_discoverable ?? false}
                      onChanged={(v) =>
                        setPayload((prev) =>
                          prev ? { ...prev, profile: { ...prev.profile, is_discoverable: v } } : prev,
                        )
                      }
                    />
                  )}
                </div>

                {/* Recent reels strip */}
                {payload.recent_reels.length > 0 && (
                  <Card>
                    <SectionLabel icon={Flame} label="Recent reels" />
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {payload.recent_reels.slice(0, 8).map((r) => (
                        <ReelCard key={r.id} reel={r} isOwner={isOwner} onTogglePin={togglePin} />
                      ))}
                    </div>
                  </Card>
                )}
              </motion.div>
            )}

            {/* ── ANALYTICS ── */}
            {tab === "analytics" && (
              <motion.div
                key="t-analytics"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="space-y-6 mb-12"
              >
                <Card>
                  <SectionLabel icon={TrendingUp} label="Last 30 days" />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <BigStat label="Plays (30d)"     value={payload.stats.plays_30d} />
                    <BigStat label="Followers (30d)" value={payload.stats.followers_30d} />
                    <BigStat label="Tips received"   value={payload.stats.tips} tone="amber" />
                  </div>
                  <div className="h-[280px]">
                    {series.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={series} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="play-grad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%"   stopColor="hsl(215 100% 60%)" stopOpacity={0.55} />
                              <stop offset="100%" stopColor="hsl(215 100% 60%)" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="foll-grad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%"   stopColor="hsl(280 80% 65%)" stopOpacity={0.45} />
                              <stop offset="100%" stopColor="hsl(280 80% 65%)" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsla(0,0%,100%,0.05)" />
                          <XAxis
                            dataKey="day"
                            tick={{ fill: "hsla(0,0%,100%,0.4)", fontSize: 10 }}
                            tickFormatter={(v) => new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                            stroke="hsla(0,0%,100%,0.08)"
                          />
                          <YAxis tick={{ fill: "hsla(0,0%,100%,0.4)", fontSize: 10 }} stroke="hsla(0,0%,100%,0.08)" />
                          <ChartTooltip
                            contentStyle={{ background: "hsla(220,14%,5%,0.95)", border: "1px solid hsla(0,0%,100%,0.08)", borderRadius: 12 }}
                            labelStyle={{ color: "hsla(0,0%,100%,0.5)", fontSize: 11 }}
                            itemStyle={{ color: "white", fontSize: 12 }}
                          />
                          <Area type="monotone" dataKey="plays"     stroke="hsl(215 100% 75%)" strokeWidth={1.5} fill="url(#play-grad)" />
                          <Area type="monotone" dataKey="followers" stroke="hsl(280 80% 75%)"  strokeWidth={1.5} fill="url(#foll-grad)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-[12px] text-white/35">
                        Once people start watching, the engagement curve will plot here.
                      </div>
                    )}
                  </div>
                </Card>

                {payload.top_reels.length > 0 && (
                  <Card>
                    <SectionLabel icon={Flame} label="Top performers" />
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {payload.top_reels.map((r) => (
                        <ReelCard key={r.id} reel={r} isOwner={isOwner} onTogglePin={togglePin} />
                      ))}
                    </div>
                  </Card>
                )}
              </motion.div>
            )}

            {/* ── REELS ── */}
            {tab === "reels" && (
              <motion.div
                key="t-reels"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="mb-12"
              >
                <Card>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <SectionLabel icon={Wand2} label={`All published reels · ${payload.stats.reels}`} />
                    {isOwner && (
                      <button
                        onClick={() => setUploadOpen(true)}
                        className="pill bg-white text-black hover:bg-white/90 shrink-0"
                      >
                        <ImagePlus className="w-3.5 h-3.5" /> Upload a reel
                      </button>
                    )}
                  </div>
                  {payload.recent_reels.length === 0 ? (
                    <EmptyHint
                      title={isOwner ? "You haven't published a reel yet." : "No public reels yet."}
                      sub={isOwner ? "Generate one in Studio, or upload your own video to publish it straight here." : "Check back soon — they're just getting started."}
                      cta={isOwner ? { onClick: () => setUploadOpen(true), label: "Upload a video" } : { to: "/lobby", label: "Browse the Lobby" }}
                    />
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {payload.recent_reels.map((r) => (
                        <ReelCard key={r.id} reel={r} isOwner={isOwner} onTogglePin={togglePin} />
                      ))}
                    </div>
                  )}
                </Card>
              </motion.div>
            )}

            {/* ── ACHIEVEMENTS ── */}
            {tab === "achievements" && (
              <motion.div
                key="t-ach"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="mb-12"
              >
                <Card>
                  <SectionLabel icon={Award} label="Achievements" />
                  <AchievementsPreview userId={viewedId} stats={payload.stats} />
                </Card>
              </motion.div>
            )}

            {/* ── ABOUT ── */}
            {tab === "about" && (
              <motion.div
                key="t-about"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12"
              >
                <Card className="lg:col-span-2">
                  <SectionLabel icon={UserIcon} label="About" />
                  <div className="space-y-5">
                    <AboutRow label="Display name" value={displayName} editable={isOwner} onEdit={() => startEdit("name")} />
                    {p?.tagline && <AboutRow label="Tagline" value={p.tagline} editable={isOwner} onEdit={() => startEdit("tagline")} />}
                    {p?.location && <AboutRow label="Location" value={p.location} editable={isOwner} onEdit={() => startEdit("location")} icon={MapPin} />}
                    {p?.bio && (
                      <div>
                        <div className="text-[9px] font-mono uppercase tracking-[0.32em] text-white/40 mb-2">Bio</div>
                        <div className="text-[13px] text-white/75 leading-relaxed whitespace-pre-wrap">{p.bio}</div>
                      </div>
                    )}
                  </div>
                </Card>

                <Card>
                  <SectionLabel icon={Link2} label="Links" />
                  {Object.keys(p?.external_links ?? {}).length === 0 ? (
                    isOwner ? (
                      <button onClick={startLinksEdit} className="pill border-white/[0.08] hover:border-white/30 text-white/75 hover:text-white border">
                        <Plus className="w-3 h-3" /> Add links
                      </button>
                    ) : (
                      <div className="text-[12px] text-white/35 italic">No external links yet.</div>
                    )
                  ) : (
                    <div className="space-y-2">
                      {Object.entries(p?.external_links ?? {}).map(([key, value]) => (
                        <a
                          key={key}
                          href={value}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="group flex items-center gap-3 w-full px-3 py-2.5 rounded-xl border border-white/[0.04] hover:border-white/15 hover:bg-glass transition-colors"
                        >
                          <SocialIcon platform={key} />
                          <div className="min-w-0 flex-1">
                            <div className="text-[12px] text-white capitalize truncate">{key}</div>
                            <div className="text-[10px] text-white/35 font-mono truncate">{value}</div>
                          </div>
                          <ExternalLink className="w-3 h-3 text-white/35 group-hover:text-white" />
                        </a>
                      ))}
                      {isOwner && (
                        <button onClick={startLinksEdit} className="pill border-white/[0.08] hover:border-white/30 text-white/75 hover:text-white border mt-3">
                          <Edit2 className="w-3 h-3" /> Edit links
                        </button>
                      )}
                    </div>
                  )}
                </Card>

                <Card className="lg:col-span-3">
                  <SectionLabel icon={Sparkles} label="Connections" />
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <SmallStat icon={UserIcon} label="Followers" value={payload.stats.followers} />
                    <SmallStat icon={UserIcon} label="Following" value={payload.stats.following} />
                  </div>
                </Card>
              </motion.div>
            )}

            {/* ── SETTINGS (owner-only) ── */}
            {tab === "settings" && isOwner && (
              <motion.div
                key="t-settings"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="space-y-6 mb-12"
              >
                <Card>
                  <SectionLabel icon={Coins} label="Credits & plan" tone="amber" />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <BigStat label="Balance" value={credits ?? (p?.credits_balance ?? 0)} tone="amber" />
                    <BigStat label="Lifetime spent" value={p?.total_credits_used ?? 0} />
                    <BigStat label="Plan" textValue={accountType === "admin" ? "Admin" : accountType[0].toUpperCase() + accountType.slice(1)} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {PURCHASING_ENABLED && (
                    <button onClick={() => setBuyOpen(true)} className="pill bg-amber-300/90 hover:bg-amber-300 text-black"><Plus className="w-3.5 h-3.5" /> Buy credits</button>
                    )}
                    <Link to="/credits"  className="pill border-white/[0.08] hover:border-white/30 text-white/75 hover:text-white border">History</Link>
                    <Link to="/pricing"  className="pill border-white/[0.08] hover:border-white/30 text-white/75 hover:text-white border">View plans</Link>
                  </div>
                </Card>

                <Card>
                  <SectionLabel icon={ShieldCheck} label="Security" tone="emerald" />
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div><TwoFactorCard /></div>
                    <div><SessionsCard /></div>
                  </div>
                  <div className="mt-6">
                    <button
                      onClick={async () => {
                        try {
                          const { error } = await supabase.auth.resetPasswordForEmail(p?.email ?? user?.email ?? "", {
                            redirectTo: `${window.location.origin}/reset-password`,
                          });
                          if (error) throw error;
                          toast.success("Password reset email sent");
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Couldn't send reset email");
                        }
                      }}
                      className="pill border-white/[0.08] hover:border-white/30 text-white/75 hover:text-white border"
                    >
                      <KeyRound className="w-3.5 h-3.5" /> Reset password
                    </button>
                  </div>
                </Card>

                <div className="rounded-3xl border border-rose-400/15 bg-rose-400/[0.02] p-6 lg:p-8">
                  <SectionLabel icon={AlertTriangle} label="Danger zone" tone="rose" />
                  <p className="text-[12px] text-white/55 leading-relaxed mb-5 max-w-xl">
                    These actions are permanent or session-altering. Deactivation has a 30-day
                    reversal window during which signing back in restores your account.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      onClick={async () => { await signOut(); navigate("/auth"); }}
                      className="flex items-center justify-between gap-3 p-4 rounded-2xl border border-white/[0.06] hover:border-white/20 bg-white/[0.015] text-left transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl border border-white/[0.06] flex items-center justify-center text-white/65">
                          <LogOut className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-[13px] text-white">Sign out</div>
                          <div className="text-[10px] text-white/40 font-mono">Ends this session</div>
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-white/35" />
                    </button>
                    <Link
                      to="/settings/deactivate"
                      className="flex items-center justify-between gap-3 p-4 rounded-2xl border border-rose-400/20 hover:border-rose-400/40 bg-rose-400/[0.02] text-left transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl border border-rose-400/20 flex items-center justify-center text-rose-300">
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-[13px] text-rose-200">Deactivate account</div>
                          <div className="text-[10px] text-rose-200/55 font-mono">30-day reversal window</div>
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-rose-300/65" />
                    </Link>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </PageShell>
      </motion.section>

      <BuyCreditsModal open={buyOpen} onOpenChange={setBuyOpen} />

      {/* Upload a reel — upload a finished video, then publish it. */}
      {isOwner && (
        <>
          <UploadReelDialog
            open={uploadOpen}
            onClose={() => setUploadOpen(false)}
            onProjectReady={(projectId) => {
              setUploadOpen(false);
              setPublishProjectId(projectId);
            }}
          />
          <PublishWizard
            open={!!publishProjectId}
            projectId={publishProjectId}
            onClose={() => setPublishProjectId(null)}
            onPublished={() => {
              setPublishProjectId(null);
              setTab("reels");
              void load();
            }}
          />
        </>
      )}

      {/* Links editing modal */}
      {editingLinks && (
        <div className="fixed inset-0 z-[9000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
             onClick={(e) => { if (e.target === e.currentTarget) setEditingLinks(false); }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
            className="relative w-full max-w-lg rounded-3xl border border-white/[0.08] bg-[#080a0d] p-7"
          >
            <button onClick={() => setEditingLinks(false)} className="absolute top-4 right-4 w-9 h-9 rounded-full border border-white/[0.08] hover:border-white/30 text-white/55 hover:text-white flex items-center justify-center">
              <X className="w-4 h-4" />
            </button>
            <h3 className="font-display font-light text-[24px] text-white mb-2">External links</h3>
            <p className="text-[12px] text-white/55 mb-6">Add any of these. Empty fields are removed.</p>
            <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
              {(["website","twitter","instagram","youtube","tiktok","github","linkedin","spotify","soundcloud"] as const).map((k) => (
                <div key={k}>
                  <label className="text-[9px] font-mono uppercase tracking-[0.28em] text-white/45 mb-1.5 block capitalize">{k}</label>
                  <div className="flex items-center gap-2 px-3 h-10 rounded-xl bg-glass border border-white/[0.08] focus-within:border-primary/40 transition-colors">
                    <SocialIcon platform={k} />
                    <input
                      value={linkDraft[k] ?? ""}
                      onChange={(e) => setLinkDraft({ ...linkDraft, [k]: e.target.value })}
                      placeholder={`https://${k === "website" ? "your-site.com" : `${k}.com/yourhandle`}`}
                      className="flex-1 bg-transparent outline-none text-[12px] text-white placeholder:text-white/30 font-mono"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button onClick={() => setEditingLinks(false)} className="pill border-white/[0.08] hover:border-white/30 text-white/65 border">Cancel</button>
              <button onClick={saveLinks} disabled={savingLinks} className="pill bg-white text-black hover:bg-white/90">
                {savingLinks ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Sub-components
// ───────────────────────────────────────────────────────────────────────

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("relative rounded-3xl border border-white/[0.06] bg-white/[0.015] p-6 lg:p-8 overflow-hidden", className)}>
      {children}
    </div>
  );
}

function SectionLabel({
  icon: Icon, label, tone = "blue",
}: { icon: React.ElementType; label: string; tone?: "blue" | "amber" | "rose" | "emerald" }) {
  const colorClass = tone === "amber" ? "text-amber-300"
    : tone === "rose" ? "text-rose-300"
    : tone === "emerald" ? "text-emerald-300"
    : "text-primary/80";
  return (
    <div className="flex items-center gap-3 mb-5">
      <Icon className={cn("w-3.5 h-3.5", colorClass)} />
      <span className="text-[10px] font-mono uppercase tracking-[0.32em] text-foreground/65">{label}</span>
      <div className="h-px flex-1 bg-gradient-to-r from-white/[0.07] to-transparent" />
    </div>
  );
}

function AccountBadge({ type }: { type: "personal" | "business" | "enterprise" | "admin" }) {
  const map = {
    personal:   { label: "Personal",   color: "hsl(215 100% 70%)", bg: "hsla(215,100%,60%,0.12)", border: "hsla(215,100%,60%,0.30)" },
    business:   { label: "Business",   color: "hsl(280 80% 75%)",  bg: "hsla(280,70%,55%,0.12)",  border: "hsla(280,70%,55%,0.30)" },
    enterprise: { label: "Enterprise", color: "hsl(38 90% 70%)",   bg: "hsla(38,90%,55%,0.12)",   border: "hsla(38,90%,55%,0.30)" },
    admin:      { label: "Admin",      color: "hsl(0 90% 75%)",    bg: "hsla(0,80%,60%,0.12)",    border: "hsla(0,80%,60%,0.30)" },
  } as const;
  const m = map[type];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[8.5px] font-mono uppercase tracking-[0.28em] border"
      style={{ color: m.color, backgroundColor: m.bg, borderColor: m.border }}
    >
      {m.label}
    </span>
  );
}

function HeroStat({
  icon: Icon, label, value, delta, tone, accent, onClick,
}: { icon: React.ElementType; label: string; value: number | null; delta?: number; tone?: "amber"; accent?: "primary"; onClick?: () => void }) {
  const valColor = tone === "amber" ? "text-amber-200" : "text-white";
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "group text-left rounded-2xl border border-white/[0.06] bg-glass p-4 transition-colors disabled:cursor-default",
        onClick && "hover:border-white/15",
      )}
    >
      <div className="flex items-center gap-2 mb-2 text-[9px] font-mono uppercase tracking-[0.32em] text-white/45">
        <Icon className={cn("w-3 h-3", tone === "amber" && "text-amber-300", accent === "primary" && "text-primary")} />
        {label}
      </div>
      <div className={cn("text-[26px] font-light tabular-nums leading-tight", valColor)}>
        {value === null ? <span className="text-white/20">—</span> : value.toLocaleString()}
      </div>
      {typeof delta === "number" && delta > 0 && (
        <div className="text-[10px] font-mono text-emerald-300/85 mt-1">+{delta} this month</div>
      )}
    </button>
  );
}

function BigStat({
  label, value, textValue, tone,
}: { label: string; value?: number | null; textValue?: string; tone?: "amber" }) {
  return (
    <div>
      <div className="text-[9px] font-mono uppercase tracking-[0.32em] text-white/40 mb-1.5">{label}</div>
      <div className={cn("text-[28px] font-light tabular-nums leading-tight", tone === "amber" ? "text-amber-200" : "text-white")}>
        {textValue ?? (value === null || value === undefined ? <span className="text-white/20">—</span> : value.toLocaleString())}
      </div>
    </div>
  );
}

function SmallStat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number | null }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-glass p-3">
      <div className="flex items-center gap-2 mb-2 text-[9px] font-mono uppercase tracking-[0.32em] text-white/45">
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <div className="text-[20px] font-light text-white tabular-nums">
        {value === null ? <span className="text-white/20">—</span> : value.toLocaleString()}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DiscoverabilityCard — opt-in toggle for /find-friends listing.
//
// Writes profiles.is_discoverable. The Find Friends directory view filters
// strictly on this flag, so toggling here is the source of truth: nothing
// else is touched.
// ─────────────────────────────────────────────────────────────────────────────
function DiscoverabilityCard({
  userId,
  initial,
  onChanged,
}: {
  userId: string;
  initial: boolean;
  onChanged: (v: boolean) => void;
}) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);

  useEffect(() => setOn(initial), [initial]);

  const handleToggle = async () => {
    const next = !on;
    setBusy(true);
    setOn(next); // optimistic
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_discoverable: next })
        .eq("id", userId);
      if (error) throw error;
      onChanged(next);
      toast.success(next ? "You're now listed in Find Friends." : "You're hidden from Find Friends.");
    } catch (e) {
      setOn(!next);
      toast.error(e instanceof Error ? e.message : "Couldn't update your visibility.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <SectionLabel icon={UserIcon} label="Find Friends listing" />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-white font-light">
            {on ? "Your door is open." : "Your door is closed."}
          </p>
          <p className="mt-1 text-[11px] text-white/55 leading-relaxed">
            {on
              ? "Other directors can find you in the opt-in directory at /find-friends. We only show your display name, avatar, location, bio, and chosen interests."
              : "Turn this on to appear in Find Friends so other directors can discover you by city and shared interests."}
          </p>
          <Link
            to="/search?tab=people"
            className="mt-3 inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.22em] text-accent/85 hover:text-accent"
          >
            See how you'll appear <ArrowRight className="w-2.5 h-2.5" />
          </Link>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          disabled={busy}
          aria-pressed={on}
          aria-label={on ? "Hide me from Find Friends" : "List me in Find Friends"}
          className={cn(
            "shrink-0 relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 disabled:opacity-60",
            on ? "bg-emerald-400/85" : "bg-white/[0.10]",
          )}
        >
          <span
            className={cn(
              "inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300",
              on ? "translate-x-6" : "translate-x-1",
            )}
          />
        </button>
      </div>
    </Card>
  );
}

function ActionRow({ to, icon: Icon, label, hint }: { to: string; icon: React.ElementType; label: string; hint?: string }) {
  return (
    <Link to={to} className="group flex items-center gap-3 w-full px-3 py-3 rounded-xl border border-white/[0.04] hover:border-white/15 hover:bg-glass transition-colors">
      <div className="w-8 h-8 rounded-lg border border-white/[0.06] flex items-center justify-center text-white/65 group-hover:text-white">
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] text-white truncate">{label}</div>
        {hint && <div className="text-[10px] text-white/35 font-mono uppercase tracking-[0.22em] truncate">{hint}</div>}
      </div>
      <ArrowRight className="w-3 h-3 text-white/25 group-hover:text-white transition-colors" />
    </Link>
  );
}

function AboutRow({
  label, value, editable, onEdit, icon: Icon,
}: { label: string; value: string; editable: boolean; onEdit: () => void; icon?: React.ElementType }) {
  return (
    <div>
      <div className="text-[9px] font-mono uppercase tracking-[0.32em] text-white/40 mb-1.5">{label}</div>
      <div className="flex items-center gap-2 text-[13px] text-white/85">
        {Icon && <Icon className="w-3.5 h-3.5 text-white/45 shrink-0" />}
        <span className="flex-1 truncate">{value}</span>
        {editable && (
          <button onClick={onEdit} className="text-white/30 hover:text-white/85 transition-colors">
            <Edit2 className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

function ReelCard({
  reel, isOwner, pinned, onTogglePin,
}: { reel: ReelLite; isOwner: boolean; pinned?: boolean; onTogglePin: (id: string) => void }) {
  return (
    <div className="group relative rounded-2xl border border-white/[0.06] bg-white/[0.015] overflow-hidden hover:border-white/15 transition-colors">
      <Link to={`/watch/${reel.id}`} className="block">
        <div className="relative aspect-video bg-black/40">
          {reel.thumbnail_url ? (
            <img src={reel.thumbnail_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent opacity-60 group-hover:opacity-90 transition-opacity" />
          {(pinned || reel.is_featured) && (
            <div className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono uppercase tracking-[0.28em] bg-black/55 backdrop-blur-md border border-white/[0.10] text-white/85">
              {pinned ? <><Pin className="w-2.5 h-2.5" />Pinned</> : <>Featured</>}
            </div>
          )}
          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[10px] font-mono text-white/75">
            <span className="inline-flex items-center gap-1"><Eye className="w-3 h-3" />{reel.play_count.toLocaleString()}</span>
            <span className="inline-flex items-center gap-1"><Heart className="w-3 h-3" />{reel.like_count.toLocaleString()}</span>
          </div>
        </div>
        <div className="p-3">
          <div className="text-[12px] text-white font-light truncate">{reel.title}</div>
          {reel.world_slug && (
            <div className="text-[10px] text-white/35 font-mono uppercase tracking-[0.22em] mt-1">{reel.world_slug}</div>
          )}
        </div>
      </Link>
      {isOwner && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onTogglePin(reel.id); }}
          className={cn(
            "absolute top-2 right-2 w-8 h-8 rounded-full backdrop-blur-md flex items-center justify-center transition-colors",
            pinned
              ? "bg-primary/20 border border-primary/40 text-primary"
              : "bg-black/55 border border-white/[0.10] text-white/65 hover:text-white opacity-0 group-hover:opacity-100",
          )}
          aria-label={pinned ? "Unpin" : "Pin"}
        >
          <Pin className={cn("w-3.5 h-3.5", pinned && "fill-current")} />
        </button>
      )}
    </div>
  );
}

function EmptyHint({ title, sub, cta }: { title: string; sub: string; cta?: { to: string; label: string } | { onClick: () => void; label: string } }) {
  return (
    <div className="text-center py-12 max-w-md mx-auto">
      <Wand2 className="w-6 h-6 mx-auto mb-3 text-white/45" />
      <h3 className="font-display font-medium text-[18px] text-white mb-1.5">{title}</h3>
      <p className="text-[12px] text-white/45 mb-5 leading-relaxed">{sub}</p>
      {cta && ("onClick" in cta ? (
        <button onClick={cta.onClick} className="pill bg-white text-black hover:bg-white/90">
          {cta.label} <ArrowRight className="w-3 h-3" />
        </button>
      ) : (
        <Link to={cta.to} className="pill bg-white text-black hover:bg-white/90">
          {cta.label} <ArrowRight className="w-3 h-3" />
        </Link>
      ))}
    </div>
  );
}

function SocialLinks({
  links, isOwner, onEdit,
}: { links: Record<string, string>; isOwner: boolean; onEdit: () => void }) {
  const entries = Object.entries(links ?? {});
  if (entries.length === 0 && !isOwner) return null;
  return (
    <div className="mt-5 flex flex-wrap items-center gap-2">
      {entries.map(([k, v]) => (
        <a key={k} href={v} target="_blank" rel="noreferrer noopener"
           className="w-9 h-9 rounded-full bg-glass-hover border border-white/[0.06] hover:border-white/30 flex items-center justify-center text-white/65 hover:text-white transition-colors"
           aria-label={k}>
          <SocialIcon platform={k} />
        </a>
      ))}
      {isOwner && (
        <button
          onClick={onEdit}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-glass-hover border border-white/[0.06] hover:border-white/30 text-white/65 hover:text-white text-[10px] font-mono uppercase tracking-[0.22em] transition-colors"
        >
          {entries.length === 0 ? <><Plus className="w-3 h-3" /> Add links</> : <><Edit2 className="w-3 h-3" /> Edit</>}
        </button>
      )}
    </div>
  );
}

function SocialIcon({ platform }: { platform: string }) {
  const map: Record<string, React.ReactNode> = {
    website:   <Globe className="w-3.5 h-3.5" />,
    twitter:   <Twitter className="w-3.5 h-3.5" />,
    instagram: <Instagram className="w-3.5 h-3.5" />,
    youtube:   <Youtube className="w-3.5 h-3.5" />,
    tiktok:    <Music2 className="w-3.5 h-3.5" />,
    github:    <Github className="w-3.5 h-3.5" />,
    linkedin:  <Linkedin className="w-3.5 h-3.5" />,
    spotify:   <Music2 className="w-3.5 h-3.5" />,
    soundcloud:<Music2 className="w-3.5 h-3.5" />,
  };
  return <>{map[platform] ?? <Link2 className="w-3.5 h-3.5" />}</>;
}

function AchievementsPreview({ userId: _userId, stats }: { userId: string; stats: Stats }) {
  const badges = useMemo(() => ([
    { key: "first_reel",    label: "First reel",       desc: "Publish your first reel",  done: stats.reels >= 1,   icon: Wand2 },
    { key: "10_reels",      label: "Prolific",         desc: "10 published reels",       done: stats.reels >= 10,  icon: Film },
    { key: "100_plays",     label: "Hundred views",    desc: "100 lifetime plays",       done: stats.plays >= 100, icon: Eye },
    { key: "1k_plays",      label: "Thousand views",   desc: "1,000 lifetime plays",     done: stats.plays >= 1000, icon: TrendingUp },
    { key: "10_followers",  label: "Building a base",  desc: "10 followers",             done: stats.followers >= 10, icon: UserIcon },
    { key: "100_followers", label: "Community",        desc: "100 followers",            done: stats.followers >= 100, icon: UserIcon },
    { key: "first_remix",   label: "Remixed",          desc: "A reel of yours was remixed", done: stats.remixes >= 1, icon: Wand2 },
    { key: "tipped",        label: "Supported",        desc: "Received your first tip",  done: stats.tips >= 1,   icon: Coins },
  ]), [stats]);
  const done = badges.filter((b) => b.done).length;
  return (
    <>
      <div className="text-[11px] font-mono uppercase tracking-[0.28em] text-white/55 mb-5">
        {done} / {badges.length} unlocked
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {badges.map((b) => {
          const Icon = b.icon;
          return (
            <div
              key={b.key}
              className={cn(
                "rounded-2xl border p-4 text-center transition-colors",
                b.done
                  ? "border-primary/30 bg-primary/[0.05]"
                  : "border-white/[0.06] bg-white/[0.015] opacity-50 grayscale",
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center",
                b.done ? "bg-primary/15 text-primary" : "bg-glass-hover text-white/45"
              )}>
                <Icon className="w-4 h-4" />
              </div>
              <div className={cn("text-[12px] font-light mb-1", b.done ? "text-white" : "text-white/55")}>
                {b.label}
              </div>
              <div className="text-[9px] text-white/35 font-mono uppercase tracking-[0.22em] leading-tight">
                {b.desc}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function InlineEdit({
  value, onChange, onSave, onCancel, saving, multiline = false, large = false, maxLength, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  multiline?: boolean;
  large?: boolean;
  maxLength?: number;
  placeholder?: string;
}) {
  const sharedProps = {
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
    maxLength,
    placeholder,
    autoFocus: true,
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter" && !multiline) onSave();
    },
    className: cn(
      "flex-1 px-3 py-2 rounded-xl bg-glass-hover border border-white/[0.12] focus:border-primary/50 outline-none text-white placeholder:text-white/30 transition-colors",
      large ? "text-[32px] font-light tracking-tight" : "text-[13px]",
      multiline && "resize-none",
    ),
  };
  return (
    <div className={cn("flex gap-2", multiline ? "flex-col" : "items-center")}>
      {multiline ? <textarea {...sharedProps} rows={4} /> : <input {...sharedProps} />}
      <div className="flex items-center gap-1.5">
        <button onClick={onSave} disabled={saving} className="pill bg-white text-black hover:bg-white/90 disabled:opacity-50">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
        </button>
        <button onClick={onCancel} disabled={saving} className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-white/[0.08] hover:border-white/30 text-white/65 hover:text-white" aria-label="Cancel">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
