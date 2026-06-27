/**
 * SettingsDashboard — the new comprehensive settings module.
 *
 * Mirrors the visual language of the new ProfileDashboard:
 *   - Editorial header band: avatar + name + completeness meter
 *   - Sticky left rail with 10 modules
 *   - Right content area renders the active module
 *   - Glassmorphic cards inside each module
 *   - Fraunces italic display + mono eyebrows + soft hairlines
 *
 * 10 modules:
 *   1. Identity        — name, handle, email, bio, avatar/cover, links, interests
 *   2. Appearance      — theme, language, timezone, motion, compact, hints
 *   3. Notifications   — email, browser push, quiet hours
 *   4. Privacy         — discoverability, blocklist, DM/follow permissions
 *   5. Creator         — patron tiers + funding goal + Stripe Connect status
 *   6. Playback        — generation defaults, autoplay, volume, captions
 *   7. Billing         — credits, auto-recharge, transactions
 *   8. Security        — password, sessions, 2FA, OAuth (stubs where backend pending)
 *   9. Developers      — API keys + webhooks (links to existing surface)
 *  10. Data & account  — download my data, deactivate, delete
 *
 * Module switching is via the `m` URL search-param so deep links work:
 *   /account?tab=settings&m=privacy
 *
 * The page does NOT manage its own auth — it is rendered inside Account
 * which already requires a logged-in user.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  User as UserIcon,
  Palette,
  Bell,
  Lock,
  Crown,
  PlayCircle,
  CreditCard,
  Shield,
  Code,
  Database,
  ChevronRight,
  Camera,
  Save,
  Loader2,
  Mail,
  AtSign,
  MapPin,
  Globe,
  Sparkles,
  Trash2,
  Download,
  AlertTriangle,
  Check,
  X,
  Plus,
  Pencil,
  Eye,
  EyeOff,
  Languages,
  Clock,
  Smartphone,
  Monitor,
  Volume2,
  PowerOff,
  ShieldCheck,
  KeyRound,
  Wallet,
  Receipt,
  TrendingUp,
  UserX,
  CircleAlert,
  ArrowUpRight,
  Briefcase,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserPreferences } from "@/contexts/UserPreferencesContext";
import { cn } from "@/lib/utils";
import { csvRow } from "@/lib/csvSafe";
import { safeErrorMessage } from "@/lib/safeErrorMessage";
import { TYPE_META } from "@/lib/design-system";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { confirmAsync } from "@/components/ui/global-confirm";
import { usePageMeta } from "@/hooks/usePageMeta";
import { CenterLine } from "@/components/ui/CenterLine";

// Borderless soft-fill button — the standard replacement for `variant="outline"`.
// Pairs with `variant="ghost"`; resting fill + brighter hover, no border/ring.
const SOFT_BUTTON = "hover:bg-white/[0.06] text-foreground";

// ─────────────────────────────────────────────────────────────────────────────
// Module catalog
// ─────────────────────────────────────────────────────────────────────────────
type ModuleId =
  | "identity" | "appearance" | "notifications" | "privacy"
  | "creator"  | "playback"   | "billing"        | "security"
  | "developers" | "data";

interface ModuleDef {
  id: ModuleId;
  label: string;
  eyebrow: string;
  description: string;
  Icon: typeof UserIcon;
}

const MODULES: ModuleDef[] = [
  { id: "identity",       label: "Identity",        eyebrow: "Who you are",        description: "Name, handle, email, avatar, bio.", Icon: UserIcon },
  { id: "appearance",     label: "Appearance",      eyebrow: "How the app looks",  description: "Theme, language, timezone, motion.", Icon: Palette },
  { id: "notifications",  label: "Notifications",   eyebrow: "How we reach you",   description: "Email, browser push, quiet hours.", Icon: Bell },
  { id: "privacy",        label: "Privacy",         eyebrow: "Who sees what",      description: "Discoverability, blocklist, permissions.", Icon: Lock },
  { id: "creator",        label: "Creator",         eyebrow: "Your economy",       description: "Patron tiers, goal, payouts.", Icon: Crown },
  { id: "playback",       label: "Playback",        eyebrow: "Content defaults",   description: "Generation, autoplay, captions.", Icon: PlayCircle },
  { id: "billing",        label: "Billing",         eyebrow: "Credits & invoices", description: "Balance, auto-recharge, history.", Icon: CreditCard },
  { id: "security",       label: "Security",        eyebrow: "Account safety",     description: "Password, sessions, 2FA.", Icon: Shield },
  { id: "developers",     label: "Developers",      eyebrow: "Build on us",        description: "API keys and webhooks.", Icon: Code },
  { id: "data",           label: "Data & account",  eyebrow: "Your data",          description: "Export, deactivate, delete.", Icon: Database },
];

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface ProfileRow {
  id: string;
  email: string | null;
  display_name: string | null;
  full_name: string | null;
  username: string | null;
  role: string | null;
  company: string | null;
  use_case: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  tagline: string | null;
  location: string | null;
  country: string | null;
  interests: string[] | null;
  external_links: Record<string, string> | null;
  preferences: Record<string, unknown> | null;
  notification_settings: Record<string, unknown> | null;
  is_discoverable: boolean | null;
  tracking_opted_out: boolean | null;
  hide_from_leaderboard: boolean | null;
  auto_recharge_enabled: boolean | null;
  account_tier: string | null;
  credits_balance: number | null;
  total_credits_used: number | null;
  total_credits_purchased: number | null;
  verified_at: string | null;
  verified_kind: string | null;
  created_at: string | null;
}

interface PrefsState {
  // Appearance
  theme?: "light" | "dark" | "system";
  compactMode?: boolean;
  showTutorialHints?: boolean;
  reducedMotion?: "system" | "reduce" | "no-preference";
  language?: string;
  timezone?: string;
  // Playback
  autoplayVideos?: boolean;
  defaultVolume?: number;
  defaultPlaybackSpeed?: number;
  captionsDefault?: boolean;
  // Generation
  defaultQualityTier?: "standard" | "pro" | "cinematic";
  defaultGenre?: string;
  defaultEngine?: "wan" | "kling";
  defaultAspectRatio?: "16:9" | "9:16" | "1:1";
  // Privacy
  dmPermission?: "everyone" | "followers" | "nobody";
  followPermission?: "everyone" | "mutual_only";
  defaultReelVisibility?: "public" | "unlisted" | "private";
}

interface NotificationPrefs {
  emailNotifications?: boolean;
  videoComplete?: boolean;
  videoFailed?: boolean;
  lowCredits?: boolean;
  lowCreditsThreshold?: number;
  weeklyDigest?: boolean;
  productUpdates?: boolean;
  tips?: boolean;
  marketing?: boolean;
  quietHoursEnabled?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
}

const DEFAULT_PREFS: Required<PrefsState> = {
  theme: "system",
  compactMode: false,
  showTutorialHints: true,
  reducedMotion: "system",
  language: "en",
  timezone: typeof Intl !== "undefined" ? (Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC") : "UTC",
  autoplayVideos: true,
  defaultVolume: 80,
  defaultPlaybackSpeed: 1,
  captionsDefault: false,
  defaultQualityTier: "standard",
  defaultGenre: "drama",
  defaultEngine: "wan",
  defaultAspectRatio: "16:9",
  dmPermission: "everyone",
  followPermission: "everyone",
  defaultReelVisibility: "public",
};

const DEFAULT_NOTIFS: Required<NotificationPrefs> = {
  emailNotifications: true,
  videoComplete: true,
  videoFailed: true,
  lowCredits: true,
  lowCreditsThreshold: 25,
  weeklyDigest: true,
  productUpdates: false,
  tips: false,
  marketing: false,
  quietHoursEnabled: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "08:00",
};

// ─────────────────────────────────────────────────────────────────────────────
// SettingsDashboard
// ─────────────────────────────────────────────────────────────────────────────
export default function SettingsDashboard() {
  const { user } = useAuth();
  const { refresh: refreshPrefs } = useUserPreferences();
  const [searchParams, setSearchParams] = useSearchParams();
  const reducedMotion = useReducedMotion();

  const activeId = (searchParams.get("m") ?? "identity") as ModuleId;
  const setActive = useCallback((id: ModuleId) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", "settings");
    next.set("m", id);
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  // Imperative mirror of `profile` so patchProfile can merge JSONB columns
  // (preferences / notification_settings) onto the latest value — toggling two
  // switches before the first write returns would otherwise read a stale render
  // snapshot and drop the first change.
  const profileRef = useRef<ProfileRow | null>(null);
  useEffect(() => { profileRef.current = profile; }, [profile]);
  const [loading, setLoading] = useState(true);
  const [savingField, setSavingField] = useState<string | null>(null);
  /** Wall-clock of the most recent successful save. Drives the
   *  "Saved · 3s ago" badge so the user knows their change persisted —
   *  the design pattern across all 10 modules is auto-save (no big
   *  Save button) and without this indicator there is no visible
   *  confirmation that a write succeeded. */
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  usePageMeta({
    title: "Settings · Small Bridges",
    description: "Manage your Small Bridges profile, privacy, notifications, billing, and security.",
  });

  // Load profile
  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      // `profiles` has column-level SELECT revoked from `authenticated`
      // (email, credits_balance, role, suspension_*, … — cross-tenant
      // containment), so a direct select('*') now 403s and the whole
      // Settings page fails to load. get_my_profile() is a SECURITY DEFINER
      // RPC that returns the caller's OWN full row scoped to auth.uid()
      // (same pattern AuthContext uses for the live profile).
      const { data, error } = await supabase
        .rpc("get_my_profile" as never)
        .maybeSingle();
      if (error) throw error;
      setProfile((data as ProfileRow | null) ?? null);
    } catch (e) {
      toast.error(safeErrorMessage(e, "Could not load settings."));
    } finally {
      setLoading(false);
    }
  }, [user?.id]);
  useEffect(() => { void load(); }, [load]);

  // Patch helper — sends a column-level update and updates local state.
  // For the JSONB columns (`preferences`, `notification_settings`) the caller
  // passes only the changed keys; we deep-merge them onto the *latest* value
  // (via profileRef) so rapid successive toggles don't clobber each other.
  const patchProfile = useCallback(async (
    patch: Partial<ProfileRow>,
    fieldKey?: string,
  ): Promise<boolean> => {
    if (!user?.id) return false;
    if (fieldKey) setSavingField(fieldKey);
    const latest = profileRef.current;
    const effective: Partial<ProfileRow> = { ...patch };
    if (patch.preferences) {
      effective.preferences = {
        ...((latest?.preferences as Record<string, unknown>) ?? {}),
        ...(patch.preferences as Record<string, unknown>),
      } as ProfileRow["preferences"];
    }
    if (patch.notification_settings) {
      effective.notification_settings = {
        ...((latest?.notification_settings as Record<string, unknown>) ?? {}),
        ...(patch.notification_settings as Record<string, unknown>),
      } as ProfileRow["notification_settings"];
    }
    try {
      const { error } = await supabase
        .from("profiles" as never)
        .update(effective as never)
        .eq("id", user.id);
      if (error) throw error;
      // Update the ref synchronously so a concurrent patch sees this change.
      if (profileRef.current) profileRef.current = { ...profileRef.current, ...effective } as ProfileRow;
      setProfile((prev) => prev ? { ...prev, ...effective } as ProfileRow : prev);
      // If the patch touched preferences or notification settings,
      // refresh the global UserPreferences cache so consumers re-render.
      if (("preferences" in effective) || ("notification_settings" in effective)) {
        void refreshPrefs();
      }
      setLastSavedAt(Date.now());
      return true;
    } catch (e) {
      toast.error(safeErrorMessage(e, "Save failed."));
      return false;
    } finally {
      if (fieldKey) setSavingField(null);
    }
  }, [user?.id, refreshPrefs]);

  // Completeness — same scoring weights as ProfileDashboard so the
  // signal is consistent across surfaces.
  const completeness = useMemo(() => {
    if (!profile) return { pct: 0, missing: [] as string[] };
    const items: { ok: boolean; label: string; weight: number }[] = [
      { ok: !!profile.avatar_url,                 label: "Profile photo",   weight: 3 },
      { ok: !!profile.cover_url,                  label: "Cover photo",     weight: 2 },
      { ok: !!profile.display_name,               label: "Display name",    weight: 2 },
      { ok: !!profile.username,                   label: "Username",        weight: 3 },
      { ok: (profile.bio ?? "").trim().length >= 20, label: "Bio",          weight: 2 },
      { ok: !!profile.tagline,                    label: "Tagline",         weight: 1 },
      { ok: !!profile.location,                   label: "Location",        weight: 1 },
      { ok: (profile.interests?.length ?? 0) >= 3, label: "Interests",      weight: 2 },
      { ok: Object.values(profile.external_links ?? {}).some(Boolean), label: "External link", weight: 1 },
      { ok: !!profile.verified_at,                label: "Verification",    weight: 1 },
    ];
    const total = items.reduce((s, i) => s + i.weight, 0);
    const earned = items.reduce((s, i) => s + (i.ok ? i.weight : 0), 0);
    return {
      pct: Math.round((earned / Math.max(1, total)) * 100),
      missing: items.filter((i) => !i.ok).map((i) => i.label),
    };
  }, [profile]);

  // ───────────────────────────────────────────────────────────────────────
  // Render
  // ───────────────────────────────────────────────────────────────────────
  if (loading && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Could not load your profile.</p>
      </div>
    );
  }

  const display = profile.display_name?.trim() || profile.full_name?.trim() || "Director";
  const handle = profile.username ?? null;
  const initials = display.charAt(0).toUpperCase();

  return (
    <div className="relative">
      {/* ─── HERO BAND ──────────────────────────────────────────────── */}
      <header className="relative px-4 sm:px-8 lg:px-12 pt-10 pb-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-start gap-5 sm:gap-7">
            <div
              className={cn(
                "relative shrink-0 rounded-full overflow-hidden",
                "h-[88px] w-[88px] sm:h-[110px] sm:w-[110px]",
                "shadow-[0_20px_50px_-15px_hsl(0_0%_0%/0.75)]",
              )}
            >
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={display} className="h-full w-full object-cover" />
              ) : (
                <div
                  className="h-full w-full flex items-center justify-center bg-gradient-to-br from-white/[0.07] to-[hsl(220_30%_8%)] font-display italic text-[44px] text-foreground/90"
                  style={{ fontFamily: "'Fraunces', serif" }}
                >
                  {initials}
                </div>
              )}
              <span
                aria-hidden
                className="absolute -inset-1.5 rounded-full pointer-events-none"
                style={{
                  background: "conic-gradient(from 0deg, transparent 0deg, hsl(var(--accent) / 0.45) 70deg, transparent 160deg)",
                  animation: reducedMotion ? "none" : "spin 9s linear infinite",
                  mask: "radial-gradient(circle, transparent 49%, black 51%)",
                  WebkitMask: "radial-gradient(circle, transparent 49%, black 51%)",
                }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className={cn(TYPE_META, "text-amber-300/85 tracking-[0.36em] inline-flex items-center gap-2")}>
                <Sparkles className="h-3 w-3" strokeWidth={1.8} />◆ Settings
              </div>
              <h1
                className="mt-2 font-display italic font-light leading-[0.98] tracking-tight"
                style={{
                  fontFamily: "'Fraunces', serif",
                  fontSize: "clamp(2.2rem, 4.2vw, 3.6rem)",
                  textShadow: "0 4px 24px hsl(0 0% 0% / 0.55)",
                }}
              >
                <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/65 bg-clip-text text-transparent">
                  {display}.
                </span>
              </h1>
              {handle && (
                <div className={cn(TYPE_META, "mt-2 text-accent/85 tracking-[0.24em]")}>
                  @{handle}
                </div>
              )}

              {/* Completeness meter — same visual as the patron goal meter
                  on the profile page, so the two surfaces feel paired. */}
              <div className="mt-5 max-w-xl">
                <div className="flex items-baseline justify-between mb-2">
                  <span className={cn(TYPE_META, "text-muted-foreground/65 tracking-[0.22em]")}>
                    PROFILE COMPLETENESS
                  </span>
                  <span className={cn(TYPE_META, "text-foreground/85 tabular-nums tracking-[0.22em]")}>
                    <span className="text-foreground font-medium">{completeness.pct}%</span>
                  </span>
                </div>
                <div className="relative h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${completeness.pct}%` }}
                    transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute inset-y-0 left-0"
                    style={{
                      background: "linear-gradient(90deg, hsl(var(--accent)) 0%, hsl(var(--accent)/0.85) 60%, hsl(var(--accent)/0.55) 100%)",
                      boxShadow: "0 0 18px hsl(var(--accent)/0.45)",
                    }}
                  />
                </div>
                {completeness.missing.length > 0 && (
                  <div className="mt-2 text-[11px] text-muted-foreground/65 leading-relaxed">
                    Still missing: <span className="text-foreground/80">{completeness.missing.slice(0, 4).join(" · ")}</span>
                    {completeness.missing.length > 4 && <span> · +{completeness.missing.length - 4} more</span>}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ─── BODY — sticky nav + active module ──────────────────────── */}
      <div className="px-4 sm:px-8 lg:px-12 pb-32">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-10 lg:gap-12">
          {/* Sticky module nav */}
          <aside className="lg:sticky lg:top-16 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-auto scrollbar-hide">
            <nav aria-label="Settings sections" className="space-y-0.5">
              {MODULES.map((m) => (
                <ModuleNavItem
                  key={m.id}
                  module={m}
                  active={m.id === activeId}
                  onClick={() => setActive(m.id)}
                />
              ))}
            </nav>
          </aside>

          {/* Active module */}
          <section className="min-w-0 space-y-6">
            <AutoSaveIndicator saving={!!savingField} lastSavedAt={lastSavedAt} />
            {activeId === "identity"      && <IdentityModule      profile={profile} savingField={savingField} patch={patchProfile} reload={load} />}
            {activeId === "appearance"    && <AppearanceModule    profile={profile} patch={patchProfile} />}
            {activeId === "notifications" && <NotificationsModule profile={profile} patch={patchProfile} />}
            {activeId === "privacy"       && <PrivacyModule       profile={profile} patch={patchProfile} />}
            {activeId === "creator"       && <CreatorModule       profile={profile} onSaved={() => setLastSavedAt(Date.now())} />}
            {activeId === "playback"      && <PlaybackModule      profile={profile} patch={patchProfile} />}
            {activeId === "billing"       && <BillingModule       profile={profile} patch={patchProfile} />}
            {activeId === "security"      && <SecurityModule      profile={profile} />}
            {activeId === "developers"    && <DevelopersModule />}
            {activeId === "data"          && <DataModule          profile={profile} />}
          </section>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ModuleNavItem
// ─────────────────────────────────────────────────────────────────────────────
function ModuleNavItem({
  module: m, active, onClick,
}: {
  module: ModuleDef;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = m.Icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group/m relative w-full text-left flex items-start gap-3 px-3 py-3 rounded-xl transition-colors",
        active
          ? "bg-white/[0.04] text-foreground"
          : "text-muted-foreground/85 hover:text-foreground hover:bg-white/[0.02]",
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0 transition-colors",
          active ? "text-foreground" : "text-muted-foreground/60 group-hover/m:text-foreground/80",
        )}
        strokeWidth={1.6}
      />
      <span className="min-w-0 flex-1">
        <span className="block font-mono text-[11.5px] uppercase tracking-[0.24em] text-foreground/90">
          {m.label}
        </span>
        <span className="block mt-0.5 text-[11px] text-muted-foreground/55 leading-snug">
          {m.eyebrow}
        </span>
      </span>
      {active && <CenterLine />}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared building blocks
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// AutoSaveIndicator — sticky strip at the top of every module.
//
// Settings has no big "Save" button by design — every change is
// auto-persisted column-by-column. But without a visible signal that a
// write succeeded, users (rightly) wonder where the save button is and
// whether their edits stuck. This strip closes that loop:
//
//   • Idle:    "Auto-saves · changes persist as you type"
//   • Saving:  "Saving…" + spinner (when patchProfile is mid-flight)
//   • Saved:   "Saved · {N}s ago" with a green pip (for ~12s after a write)
//
// The "N seconds ago" ticks live so the badge feels alive without
// flicker. It collapses back to the idle state once a window has
// passed.
// ─────────────────────────────────────────────────────────────────────────────
function AutoSaveIndicator({
  saving,
  lastSavedAt,
}: {
  saving: boolean;
  lastSavedAt: number | null;
}) {
  // Re-render once a second so "Saved · N seconds ago" stays current.
  const [, force] = useState(0);
  useEffect(() => {
    if (lastSavedAt === null) return;
    const i = window.setInterval(() => force((x) => x + 1), 1000);
    return () => window.clearInterval(i);
  }, [lastSavedAt]);

  const secondsAgo = lastSavedAt ? Math.max(0, Math.floor((Date.now() - lastSavedAt) / 1000)) : null;
  const recent = secondsAgo !== null && secondsAgo < 15;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "sticky top-0 z-20 -mx-1 px-3.5 py-2 rounded-lg flex items-center justify-between gap-3",
        "backdrop-blur",
        saving
          ? "bg-amber-300/[0.08] text-amber-100"
          : recent
            ? "bg-emerald-300/[0.08] text-emerald-200"
            : "bg-[hsl(var(--background)/0.65)] text-muted-foreground/70",
      )}
    >
      <div className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.24em]">
        {saving ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.8} />
            <span>Saving…</span>
          </>
        ) : recent ? (
          <>
            <span aria-hidden className="relative flex h-1.5 w-1.5">
              <span className="absolute inset-0 rounded-full bg-emerald-400/55 animate-ping opacity-65" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-300" />
            </span>
            <span>Saved · {secondsAgo === 0 ? "just now" : `${secondsAgo}s ago`}</span>
          </>
        ) : (
          <>
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
            <span>Auto-saves · changes persist as you type</span>
          </>
        )}
      </div>
      <span className="text-[10px] font-mono uppercase tracking-[0.20em] text-muted-foreground/45 hidden sm:inline">
        No save button — every field is its own commit.
      </span>
    </div>
  );
}

function SectionHeader({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <header className="mb-8">
      <div className={cn(TYPE_META, "text-amber-300/85 tracking-[0.34em] inline-flex items-center gap-2")}>
        <Sparkles className="h-3 w-3" strokeWidth={1.8} />◆ {eyebrow}
      </div>
      <h2
        className="mt-3 font-display italic text-[clamp(1.7rem,2.7vw,2.4rem)] font-light tracking-[-0.01em] leading-[1.04] max-w-3xl"
        style={{ fontFamily: "'Fraunces', serif" }}
      >
        <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/65 bg-clip-text text-transparent">
          {title}
        </span>
      </h2>
      {sub && <p className="mt-3 text-[14px] text-muted-foreground/80 max-w-2xl leading-relaxed">{sub}</p>}
    </header>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "relative rounded-2xl p-6 sm:p-7",
        "shadow-[0_24px_60px_-32px_hsl(0_0%_0%/0.7)]",
        "backdrop-blur-2xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

function FieldRow({
  label, hint, action, children,
}: {
  label: string;
  hint?: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[1fr_minmax(220px,2fr)] gap-3 sm:gap-6 py-4">
      <div className="pt-1.5">
        <div className="text-[13px] font-medium text-foreground/90">{label}</div>
        {hint && <div className="mt-1 text-[12px] text-muted-foreground/65 leading-snug">{hint}</div>}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">{children}</div>
        {action}
      </div>
    </div>
  );
}

function ToggleRow({
  label, hint, checked, onChange, disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3.5">
      <div>
        <div className="text-[13px] font-medium text-foreground/90">{label}</div>
        {hint && <div className="mt-0.5 text-[12px] text-muted-foreground/65 leading-snug">{hint}</div>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// IDENTITY MODULE
// ─────────────────────────────────────────────────────────────────────────────
function IdentityModule({
  profile, savingField, patch, reload,
}: {
  profile: ProfileRow;
  savingField: string | null;
  patch: (p: Partial<ProfileRow>, key?: string) => Promise<boolean>;
  reload: () => Promise<void>;
}) {
  // local edits — saved on blur or explicit Save
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [username, setUsername] = useState(profile.username ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [tagline, setTagline] = useState(profile.tagline ?? "");
  const [location, setLocation] = useState(profile.location ?? "");
  const [country, setCountry] = useState(profile.country ?? "");
  const [role, setRole] = useState(profile.role ?? "");
  const [company, setCompany] = useState(profile.company ?? "");
  const [interestsInput, setInterestsInput] = useState((profile.interests ?? []).join(", "));
  const [links, setLinks] = useState<Record<string, string>>(profile.external_links ?? {});

  const [uploading, setUploading] = useState<"avatar" | "cover" | null>(null);
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");

  // Re-seed the form from the profile, but ONLY after an explicit Refresh —
  // never on the prop changes caused by auto-save patches (that would wipe a
  // field the user is mid-edit on). The inputs use useState initializers, so
  // without this the Refresh button would silently do nothing.
  const pendingResync = useRef(false);
  useEffect(() => {
    if (!pendingResync.current) return;
    pendingResync.current = false;
    setDisplayName(profile.display_name ?? "");
    setFullName(profile.full_name ?? "");
    setUsername(profile.username ?? "");
    setBio(profile.bio ?? "");
    setTagline(profile.tagline ?? "");
    setLocation(profile.location ?? "");
    setCountry(profile.country ?? "");
    setRole(profile.role ?? "");
    setCompany(profile.company ?? "");
    setInterestsInput((profile.interests ?? []).join(", "));
    setLinks(profile.external_links ?? {});
  }, [profile]);
  const handleRefresh = useCallback(async () => {
    pendingResync.current = true;
    await reload();
  }, [reload]);

  // Username availability check (debounced).
  const usernameRef = useRef(username);
  usernameRef.current = username;
  useEffect(() => {
    const u = username.trim().toLowerCase();
    if (!u || u === (profile.username ?? "")) { setUsernameStatus("idle"); return; }
    if (!/^[a-z0-9_]{3,30}$/.test(u)) { setUsernameStatus("invalid"); return; }
    setUsernameStatus("checking");
    const t = window.setTimeout(async () => {
      if (usernameRef.current.trim().toLowerCase() !== u) return;
      const { data } = await supabase
        .from("profiles" as never)
        .select("id")
        .eq("username", u)
        .neq("id", profile.id)
        .maybeSingle();
      setUsernameStatus(data ? "taken" : "available");
    }, 350);
    return () => window.clearTimeout(t);
  }, [username, profile.username, profile.id]);

  const uploadImage = async (kind: "avatar" | "cover", file: File) => {
    if (!file) return;
    setUploading(kind);
    try {
      const bucket = kind === "avatar" ? "avatars" : "profile-covers";
      const path = `${profile.id}/${kind}-${Date.now()}.${(file.name.split(".").pop() ?? "jpg").toLowerCase()}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, { cacheControl: "3600", upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      const url = data?.publicUrl;
      if (!url) throw new Error("No public URL returned");
      const ok = await patch(kind === "avatar" ? { avatar_url: url } : { cover_url: url }, kind);
      if (ok) toast.success(`${kind === "avatar" ? "Avatar" : "Cover"} updated.`);
    } catch (e) {
      toast.error(safeErrorMessage(e, "Upload failed."));
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Identity"
        title="Tell people who you are."
        sub="This is what shows on your public profile, in search, and on every reel you publish."
      />

      {/* Photos */}
      <Card>
        <h3 className="font-mono text-[11px] uppercase tracking-[0.30em] text-muted-foreground/75 mb-5">Photos</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <ImageDropzone
            kind="avatar"
            label="Profile photo"
            hint="Square works best. PNG or JPG up to 5 MB."
            currentUrl={profile.avatar_url}
            uploading={uploading === "avatar" || savingField === "avatar"}
            onPick={(f) => void uploadImage("avatar", f)}
            aspect="aspect-square"
          />
          <ImageDropzone
            kind="cover"
            label="Cover photo"
            hint="Wide / cinematic. 1600×600 or larger."
            currentUrl={profile.cover_url}
            uploading={uploading === "cover" || savingField === "cover"}
            onPick={(f) => void uploadImage("cover", f)}
            aspect="aspect-[16/6]"
          />
        </div>
      </Card>

      {/* Names */}
      <Card>
        <h3 className="font-mono text-[11px] uppercase tracking-[0.30em] text-muted-foreground/75 mb-3">Names</h3>
        <FieldRow label="Display name" hint="Shown above your bio. People search for this.">
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            onBlur={() => displayName !== (profile.display_name ?? "") && void patch({ display_name: displayName.trim() || null }, "display_name")}
            placeholder="Ava Lin"
          />
        </FieldRow>
        <FieldRow label="Full name" hint="Used in legal & payout contexts. Not shown publicly.">
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            onBlur={() => fullName !== (profile.full_name ?? "") && void patch({ full_name: fullName.trim() || null }, "full_name")}
            placeholder="Ava Lin Chen"
          />
        </FieldRow>
        <FieldRow
          label="Username"
          hint="Your @ handle. 3–30 chars, lowercase letters, numbers, underscores. Your profile lives at /c/@username."
        >
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/55" />
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                onBlur={() => {
                  const next = username.trim().toLowerCase();
                  if (next && next !== (profile.username ?? "") && usernameStatus === "available") {
                    void patch({ username: next }, "username");
                  }
                }}
                placeholder="avalin"
                className="pl-9"
              />
            </div>
            <UsernameStatusPip status={usernameStatus} />
          </div>
        </FieldRow>
      </Card>

      {/* About */}
      <Card>
        <h3 className="font-mono text-[11px] uppercase tracking-[0.30em] text-muted-foreground/75 mb-3">About</h3>
        <FieldRow label="Tagline" hint="One-line teaser shown right under your name. Aim for ≤ 80 chars.">
          <Input
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            onBlur={() => tagline !== (profile.tagline ?? "") && void patch({ tagline: tagline.trim() || null }, "tagline")}
            placeholder="Slow cinema · neon nights · queer love stories"
            maxLength={120}
          />
        </FieldRow>
        <FieldRow label="Bio" hint="The longer story. Two short paragraphs max.">
          <Textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            onBlur={() => bio !== (profile.bio ?? "") && void patch({ bio: bio.trim() || null }, "bio")}
            placeholder="I direct short films about people who can't stay still…"
            rows={4}
            maxLength={1000}
          />
        </FieldRow>
        <FieldRow label="Interests" hint="Comma-separated. Used for Find Friends matching. e.g. cinematography, dance, jazz.">
          <Input
            value={interestsInput}
            onChange={(e) => setInterestsInput(e.target.value)}
            onBlur={() => {
              const next = interestsInput.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean).slice(0, 12);
              const cur = profile.interests ?? [];
              if (JSON.stringify(next) !== JSON.stringify(cur)) {
                void patch({ interests: next }, "interests");
              }
            }}
            placeholder="cinema, jazz, slow films"
          />
        </FieldRow>
      </Card>

      {/* Where */}
      <Card>
        <h3 className="font-mono text-[11px] uppercase tracking-[0.30em] text-muted-foreground/75 mb-3">Where</h3>
        <FieldRow label="City" hint="Used for distance-based matches.">
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/55" />
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              onBlur={() => location !== (profile.location ?? "") && void patch({ location: location.trim() || null }, "location")}
              placeholder="Lagos · Berlin · Mexico City"
              className="pl-9"
            />
          </div>
        </FieldRow>
        <FieldRow label="Country" hint="ISO code or full name.">
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/55" />
            <Input
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              onBlur={() => country !== (profile.country ?? "") && void patch({ country: country.trim() || null }, "country")}
              placeholder="NG · DE · MX"
              className="pl-9"
            />
          </div>
        </FieldRow>
      </Card>

      {/* Professional */}
      <Card>
        <h3 className="font-mono text-[11px] uppercase tracking-[0.30em] text-muted-foreground/75 mb-3">Professional</h3>
        <FieldRow label="Role">
          <Input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            onBlur={() => role !== (profile.role ?? "") && void patch({ role: role.trim() || null }, "role")}
            placeholder="Director · Editor · Producer"
          />
        </FieldRow>
        <FieldRow label="Company">
          <Input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            onBlur={() => company !== (profile.company ?? "") && void patch({ company: company.trim() || null }, "company")}
            placeholder="Independent · or your studio"
          />
        </FieldRow>
      </Card>

      {/* Links */}
      <Card>
        <h3 className="font-mono text-[11px] uppercase tracking-[0.30em] text-muted-foreground/75 mb-3">External links</h3>
        <p className="text-[12px] text-muted-foreground/65 mb-4">
          Linked accounts appear under your bio. We do not import data; the links are display-only.
        </p>
        <ExternalLinksEditor
          links={links}
          onChange={(next) => {
            setLinks(next);
            void patch({ external_links: next }, "external_links");
          }}
        />
      </Card>

      {/* Email + reload */}
      <Card>
        <h3 className="font-mono text-[11px] uppercase tracking-[0.30em] text-muted-foreground/75 mb-3">Email</h3>
        <FieldRow label="Login email" hint="Used to sign in and receive critical alerts.">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/55" />
            <Input value={profile.email ?? ""} disabled className="pl-9 opacity-80" />
          </div>
        </FieldRow>
        <p className="text-[11.5px] text-muted-foreground/55 mt-3">
          To change your sign-in email, open <strong>Security → Login email</strong>.
        </p>
        <div className="mt-5 flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => void handleRefresh()} className="text-muted-foreground hover:text-foreground">
            <Loader2 className="h-3 w-3 mr-2" />Refresh
          </Button>
        </div>
      </Card>
    </div>
  );
}

function UsernameStatusPip({ status }: { status: "idle" | "checking" | "available" | "taken" | "invalid" }) {
  if (status === "idle") return <span className="text-[11px] text-muted-foreground/50 font-mono uppercase tracking-[0.18em]">—</span>;
  if (status === "checking") return <span className="text-[11px] text-muted-foreground/65 font-mono uppercase tracking-[0.18em] inline-flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" />Checking</span>;
  if (status === "available") return <span className="text-[11px] text-emerald-300 font-mono uppercase tracking-[0.18em] inline-flex items-center gap-1.5"><Check className="h-3 w-3" />Available</span>;
  if (status === "taken") return <span className="text-[11px] text-rose-300 font-mono uppercase tracking-[0.18em] inline-flex items-center gap-1.5"><X className="h-3 w-3" />Taken</span>;
  return <span className="text-[11px] text-amber-300 font-mono uppercase tracking-[0.18em] inline-flex items-center gap-1.5"><CircleAlert className="h-3 w-3" />Invalid</span>;
}

function ImageDropzone({
  kind, label, hint, currentUrl, uploading, onPick, aspect,
}: {
  kind: "avatar" | "cover";
  label: string;
  hint: string;
  currentUrl: string | null;
  uploading: boolean;
  onPick: (f: File) => void;
  aspect: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-[12px] font-medium text-foreground/90">{label}</span>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-[11px] font-mono uppercase tracking-[0.22em] text-accent/85 hover:text-accent transition-colors"
        >
          {currentUrl ? "Replace" : "Upload"}
        </button>
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          "relative w-full rounded-xl overflow-hidden",
          aspect,
          "bg-white/[0.04] hover:bg-white/[0.07] transition-all",
          kind === "avatar" ? "max-w-[180px]" : "",
        )}
      >
        {currentUrl ? (
          <img src={currentUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] to-transparent" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
        <div className="absolute inset-0 flex items-center justify-center text-white/85">
          {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
        </div>
      </button>
      <p className="mt-2 text-[11px] text-muted-foreground/60 leading-snug">{hint}</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ""; }}
      />
    </div>
  );
}

function ExternalLinksEditor({
  links, onChange,
}: {
  links: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  const PLATFORMS = ["website", "twitter", "instagram", "youtube", "tiktok", "github", "linkedin", "spotify", "soundcloud"] as const;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {PLATFORMS.map((p) => (
        <label key={p} className="flex items-center gap-3">
          <span className="w-24 shrink-0 text-[11.5px] font-mono uppercase tracking-[0.22em] text-muted-foreground/75">
            {p}
          </span>
          <Input
            value={links[p] ?? ""}
            onChange={(e) => onChange({ ...links, [p]: e.target.value })}
            placeholder={p === "website" ? "https://yourname.com" : `https://${p}.com/yourname`}
          />
        </label>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// APPEARANCE MODULE
// ─────────────────────────────────────────────────────────────────────────────
function AppearanceModule({
  profile, patch,
}: {
  profile: ProfileRow;
  patch: (p: Partial<ProfileRow>, key?: string) => Promise<boolean>;
}) {
  const prefs = (profile.preferences ?? {}) as PrefsState;
  const merged = { ...DEFAULT_PREFS, ...prefs };
  const set = (next: Partial<PrefsState>) => void patch({ preferences: next as never }, Object.keys(next)[0]);
  return (
    <div className="space-y-8">
      <SectionHeader eyebrow="Appearance" title="Make the app feel like yours." sub="Theme, language, motion. Applies everywhere you're signed in." />
      <Card>
        <h3 className="font-mono text-[11px] uppercase tracking-[0.30em] text-muted-foreground/75 mb-3">Theme</h3>
        <FieldRow label="Color scheme" hint="System follows your OS setting and switches when it does.">
          <Select value={merged.theme} onValueChange={(v) => set({ theme: v as PrefsState["theme"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="system"><span className="inline-flex items-center gap-2"><Monitor className="h-3.5 w-3.5" />System</span></SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="light">Light</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
        <ToggleRow
          label="Compact mode"
          hint="Tighter spacing, denser type. Good for big libraries."
          checked={!!merged.compactMode}
          onChange={(v) => set({ compactMode: v })}
        />
        <ToggleRow
          label="Show tutorial hints"
          hint="Helpful tooltips and first-run callouts."
          checked={!!merged.showTutorialHints}
          onChange={(v) => set({ showTutorialHints: v })}
        />
      </Card>

      <Card>
        <h3 className="font-mono text-[11px] uppercase tracking-[0.30em] text-muted-foreground/75 mb-3">Motion & accessibility</h3>
        <FieldRow label="Animation" hint="Reduce if motion makes you queasy or you're on a low-power device.">
          <Select value={merged.reducedMotion} onValueChange={(v) => set({ reducedMotion: v as PrefsState["reducedMotion"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="system">Follow system</SelectItem>
              <SelectItem value="no-preference">Always animate</SelectItem>
              <SelectItem value="reduce">Reduce motion</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
      </Card>

      <Card>
        <h3 className="font-mono text-[11px] uppercase tracking-[0.30em] text-muted-foreground/75 mb-3">Region</h3>
        <FieldRow label="Language" hint="The app's interface language.">
          <Select value={merged.language} onValueChange={(v) => set({ language: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="en"><span className="inline-flex items-center gap-2"><Languages className="h-3.5 w-3.5" />English</span></SelectItem>
              <SelectItem value="es">Español</SelectItem>
              <SelectItem value="fr">Français</SelectItem>
              <SelectItem value="de">Deutsch</SelectItem>
              <SelectItem value="pt">Português</SelectItem>
              <SelectItem value="ja">日本語</SelectItem>
              <SelectItem value="ko">한국어</SelectItem>
              <SelectItem value="zh">中文</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Timezone" hint="Used for premiere times, schedules, and quiet hours.">
          <div className="relative">
            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/55" />
            <Input value={merged.timezone} onChange={(e) => set({ timezone: e.target.value })} className="pl-9" />
          </div>
        </FieldRow>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS MODULE
// ─────────────────────────────────────────────────────────────────────────────
function NotificationsModule({
  profile, patch,
}: {
  profile: ProfileRow;
  patch: (p: Partial<ProfileRow>, key?: string) => Promise<boolean>;
}) {
  const ns = (profile.notification_settings ?? {}) as NotificationPrefs;
  const merged = { ...DEFAULT_NOTIFS, ...ns };
  const set = (next: Partial<NotificationPrefs>) => void patch({ notification_settings: next as never });

  const [pushPrefs, setPushPrefs] = useState<Record<string, boolean>>({});
  const [pushReady, setPushReady] = useState(false);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("push_preferences" as never).select("*").eq("user_id", profile.id).maybeSingle();
      if (data) setPushPrefs(data as never);
      setPushReady(true);
    })();
  }, [profile.id]);

  const setPushPref = async (key: string, value: boolean) => {
    setPushPrefs((p) => ({ ...p, [key]: value }));
    await supabase.from("push_preferences" as never).upsert({ user_id: profile.id, [key]: value } as never);
  };

  return (
    <div className="space-y-8">
      <SectionHeader eyebrow="Notifications" title="How we should reach you." sub="Set the channel — email vs. browser push — and which events earn an interruption." />

      <Card>
        <h3 className="font-mono text-[11px] uppercase tracking-[0.30em] text-muted-foreground/75 mb-3">Email</h3>
        <ToggleRow label="Email notifications" hint="Master switch. Off = no email at all (you'll still get billing receipts)." checked={!!merged.emailNotifications} onChange={(v) => set({ emailNotifications: v })} />
        <ToggleRow label="Render completed" checked={!!merged.videoComplete} disabled={!merged.emailNotifications} onChange={(v) => set({ videoComplete: v })} />
        <ToggleRow label="Render failed" checked={!!merged.videoFailed} disabled={!merged.emailNotifications} onChange={(v) => set({ videoFailed: v })} />
        <ToggleRow label="Low credits warning" hint={`We'll email when balance drops below ${merged.lowCreditsThreshold} credits.`} checked={!!merged.lowCredits} disabled={!merged.emailNotifications} onChange={(v) => set({ lowCredits: v })} />
        <FieldRow label="Low credits threshold">
          <Select value={String(merged.lowCreditsThreshold)} onValueChange={(v) => set({ lowCreditsThreshold: Number(v) })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {[5, 10, 25, 50, 100].map((n) => <SelectItem key={n} value={String(n)}>{n} credits</SelectItem>)}
            </SelectContent>
          </Select>
        </FieldRow>
        <ToggleRow label="Weekly digest" hint="One Sunday email with the week's plays + earnings." checked={!!merged.weeklyDigest} disabled={!merged.emailNotifications} onChange={(v) => set({ weeklyDigest: v })} />
        <ToggleRow label="Product updates" hint="New features, model releases." checked={!!merged.productUpdates} disabled={!merged.emailNotifications} onChange={(v) => set({ productUpdates: v })} />
        <ToggleRow label="Tips & tutorials" hint="Short emails to help you get better results." checked={!!merged.tips} disabled={!merged.emailNotifications} onChange={(v) => set({ tips: v })} />
        <ToggleRow label="Promotional / marketing" hint="Discounts and partner offers." checked={!!merged.marketing} disabled={!merged.emailNotifications} onChange={(v) => set({ marketing: v })} />
      </Card>

      <Card>
        <h3 className="font-mono text-[11px] uppercase tracking-[0.30em] text-muted-foreground/75 mb-3">Browser push</h3>
        {!pushReady ? (
          <div className="py-6 flex items-center gap-2 text-muted-foreground/65"><Loader2 className="h-4 w-4 animate-spin" />Loading…</div>
        ) : (
          <>
            <ToggleRow label="Render done" hint="Ping when your video finishes generating." checked={!!pushPrefs.render_complete} onChange={(v) => void setPushPref("render_complete", v)} />
            <ToggleRow label="Premiere starting" hint="Reminder 10 min before a scheduled premiere." checked={!!pushPrefs.premiere_scheduled} onChange={(v) => void setPushPref("premiere_scheduled", v)} />
            <ToggleRow label="Follower milestone" hint="When your follower count hits a round number." checked={!!pushPrefs.follower_milestone} onChange={(v) => void setPushPref("follower_milestone", v)} />
            <ToggleRow label="Watch party starting" checked={!!pushPrefs.watch_party_starting} onChange={(v) => void setPushPref("watch_party_starting", v)} />
            <ToggleRow label="Tip received" hint="When someone tips a reel you posted." checked={!!pushPrefs.tip_received} onChange={(v) => void setPushPref("tip_received", v)} />
          </>
        )}
      </Card>

      <Card>
        <h3 className="font-mono text-[11px] uppercase tracking-[0.30em] text-muted-foreground/75 mb-3">Quiet hours</h3>
        <ToggleRow label="Mute non-critical notifications overnight" hint="Renders and billing still come through." checked={!!merged.quietHoursEnabled} onChange={(v) => set({ quietHoursEnabled: v })} />
        <div className="grid grid-cols-2 gap-4 mt-3">
          <FieldRow label="From">
            <Input type="time" value={merged.quietHoursStart} disabled={!merged.quietHoursEnabled} onChange={(e) => set({ quietHoursStart: e.target.value })} />
          </FieldRow>
          <FieldRow label="To">
            <Input type="time" value={merged.quietHoursEnd} disabled={!merged.quietHoursEnabled} onChange={(e) => set({ quietHoursEnd: e.target.value })} />
          </FieldRow>
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIVACY MODULE
// ─────────────────────────────────────────────────────────────────────────────
function PrivacyModule({
  profile, patch,
}: {
  profile: ProfileRow;
  patch: (p: Partial<ProfileRow>, key?: string) => Promise<boolean>;
}) {
  const prefs = (profile.preferences ?? {}) as PrefsState;
  const merged = { ...DEFAULT_PREFS, ...prefs };
  const set = (next: Partial<PrefsState>) => void patch({ preferences: next as never });

  const [blocked, setBlocked] = useState<Array<{ id: string; display_name: string | null; username: string | null; avatar_url: string | null; created_at: string }>>([]);
  const [loadingBlocked, setLoadingBlocked] = useState(true);

  // Load the user's blocklist directly from user_blocks. (There is no
  // list_my_blocks RPC — calling it just produced a guaranteed-failing request
  // on every load, so query the table directly.)
  useEffect(() => {
    (async () => {
      // Two-step fetch: user_blocks.blocked_id has a FK to auth.users (not
      // public.profiles), so PostgREST can't embed profiles directly — the
      // old `profiles!user_blocks_blocked_id_fkey` embed 400'd (PGRST200).
      // Fetch the rows, then resolve display info from profiles_public.
      const { data: rows } = await supabase
        .from("user_blocks" as never)
        .select("blocked_id, created_at")
        .eq("blocker_id", profile.id);
      if (Array.isArray(rows) && rows.length > 0) {
        const ids = [...new Set(rows.map((r: any) => r.blocked_id))];
        const { data: profs } = await supabase
          .from("profiles_public")
          .select("id, display_name, username, avatar_url")
          .in("id", ids);
        const pmap = new Map((profs || []).map((p: any) => [p.id, p]));
        setBlocked(rows.map((r: any) => {
          const prof = pmap.get(r.blocked_id);
          return {
            id: r.blocked_id,
            display_name: prof?.display_name ?? null,
            username: prof?.username ?? null,
            avatar_url: prof?.avatar_url ?? null,
            created_at: r.created_at,
          };
        }));
      } else {
        setBlocked([]);
      }
      setLoadingBlocked(false);
    })();
  }, [profile.id]);

  const unblock = async (target: string) => {
    const prev = blocked;
    setBlocked((p) => p.filter((b) => b.id !== target));
    // supabase.rpc resolves with { error } rather than throwing, so the old
    // try/catch was dead code and always toasted success (audit D33).
    const { error } = await supabase.rpc("toggle_block" as never, { p_target: target } as never);
    if (error) {
      setBlocked(prev); // rollback the optimistic removal
      toast.error("Could not unblock.");
    } else {
      toast.success("Unblocked.");
    }
  };

  return (
    <div className="space-y-8">
      <SectionHeader eyebrow="Privacy" title="Decide who can see and reach you." sub="Tighter privacy means less reach. You can change any of this any time." />

      <Card>
        <h3 className="font-mono text-[11px] uppercase tracking-[0.30em] text-muted-foreground/75 mb-3">Discoverability</h3>
        <ToggleRow
          label="List me in Find Friends"
          hint="Other users can find you by interests, location, or shared follows. Required to appear in recommendations."
          checked={!!profile.is_discoverable}
          onChange={(v) => void patch({ is_discoverable: v }, "is_discoverable")}
        />
        <ToggleRow
          label="Hide me from leaderboards"
          hint="You'll still earn XP and badges; you just won't appear in public rankings."
          checked={!!profile.hide_from_leaderboard}
          onChange={(v) => void patch({ hide_from_leaderboard: v }, "hide_from_leaderboard")}
        />
        <ToggleRow
          label="Opt out of activity tracking"
          hint="We won't use your activity for personalised recommendations or analytics."
          checked={!!profile.tracking_opted_out}
          onChange={(v) => void patch({ tracking_opted_out: v }, "tracking_opted_out")}
        />
      </Card>

      <Card>
        <h3 className="font-mono text-[11px] uppercase tracking-[0.30em] text-muted-foreground/75 mb-3">Who can message you</h3>
        <FieldRow label="Direct messages" hint="People you've blocked can never DM you, regardless of this setting.">
          <Select value={merged.dmPermission} onValueChange={(v) => set({ dmPermission: v as PrefsState["dmPermission"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="everyone">Anyone</SelectItem>
              <SelectItem value="followers">People I follow</SelectItem>
              <SelectItem value="nobody">No one — DMs disabled</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Who can follow me">
          <Select value={merged.followPermission} onValueChange={(v) => set({ followPermission: v as PrefsState["followPermission"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="everyone">Anyone</SelectItem>
              <SelectItem value="mutual_only">Approve each follow request</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
      </Card>

      <FollowRequestsCard userId={profile.id} />

      <Card>
        <h3 className="font-mono text-[11px] uppercase tracking-[0.30em] text-muted-foreground/75 mb-3">Blocked accounts</h3>
        {loadingBlocked ? (
          <div className="py-6 flex items-center gap-2 text-muted-foreground/65"><Loader2 className="h-4 w-4 animate-spin" />Loading…</div>
        ) : blocked.length === 0 ? (
          <p className="text-[13px] text-muted-foreground/65 py-4">
            You haven't blocked anyone. Use the <span className="text-foreground/85">⋯ menu</span> on a profile to block.
          </p>
        ) : (
          <ul>
            {blocked.map((b) => (
              <li key={b.id} className="py-3 flex items-center gap-3">
                <div className="h-9 w-9 rounded-full overflow-hidden bg-white/[0.06] shrink-0">
                  {b.avatar_url
                    ? <img src={b.avatar_url} alt="" className="h-full w-full object-cover" />
                    : <div className="h-full w-full grid place-items-center text-foreground/80 text-[12px] font-mono">{(b.display_name?.[0] ?? "?").toUpperCase()}</div>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] truncate text-foreground/90">{b.display_name ?? "Unknown"}</div>
                  {b.username && <div className="text-[11px] text-muted-foreground/65 truncate">@{b.username}</div>}
                </div>
                <Button size="sm" variant="ghost" className={SOFT_BUTTON} onClick={() => void unblock(b.id)}>
                  <UserX className="h-3 w-3 mr-1.5" />Unblock
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function FollowRequestsCard({ userId }: { userId: string }) {
  const [reqs, setReqs] = useState<Array<{ id: string; requester: string; display_name: string | null; username: string | null; avatar_url: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.rpc("list_follow_requests" as never);
    setReqs((data as any[]) ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); void userId; }, [load, userId]);
  const accept = async (id: string) => {
    const prev = reqs;
    setReqs((p) => p.filter((r) => r.id !== id));
    const { error } = await supabase.rpc("accept_follow_request" as never, { p_id: id } as never);
    if (error) { setReqs(prev); toast.error("Could not accept the request."); }
    else { toast.success("Request accepted."); }
  };
  const reject = async (id: string) => {
    const prev = reqs;
    setReqs((p) => p.filter((r) => r.id !== id));
    const { error } = await supabase.rpc("reject_follow_request" as never, { p_id: id } as never);
    if (error) { setReqs(prev); toast.error("Could not decline the request."); }
  };
  if (loading) return null;
  if (reqs.length === 0) return null;
  return (
    <Card>
      <h3 className="font-mono text-[11px] uppercase tracking-[0.30em] text-amber-200/85 mb-3 inline-flex items-center gap-2">
        <Bell className="h-3 w-3" />Pending follow requests
      </h3>
      <ul>
        {reqs.map((r) => (
          <li key={r.id} className="py-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-full overflow-hidden bg-white/[0.06] shrink-0">
              {r.avatar_url
                ? <img src={r.avatar_url} alt="" className="h-full w-full object-cover" />
                : <div className="h-full w-full grid place-items-center text-foreground/80 text-[12px] font-mono">{(r.display_name?.[0] ?? "?").toUpperCase()}</div>}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] truncate text-foreground/90">{r.display_name ?? "Anonymous"}</div>
              {r.username && <div className="text-[11px] text-muted-foreground/65 truncate">@{r.username}</div>}
            </div>
            <Button size="sm" variant="ghost" className={SOFT_BUTTON} onClick={() => void reject(r.id)}>Decline</Button>
            <Button size="sm" onClick={() => void accept(r.id)}>Accept</Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATOR MODULE — patron tiers, goal, payout
// ─────────────────────────────────────────────────────────────────────────────
function CreatorModule({ profile, onSaved }: { profile: ProfileRow; onSaved?: () => void }) {
  const [tiers, setTiers] = useState<Array<{ id: string; position: number; name: string; monthly_credits: number; perks: string; accent_hsl: string | null }>>([]);
  const [goal, setGoal] = useState<{ id: string; label: string; target_credits: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingTierId, setEditingTierId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [tiersRes, goalRes] = await Promise.all([
      supabase.from("patron_tiers" as never).select("*").eq("creator_id", profile.id).order("position"),
      supabase.from("patron_goals" as never).select("*").eq("creator_id", profile.id).is("archived_at", null).maybeSingle(),
    ]);
    setTiers((tiersRes.data as any[] ?? []).map((t) => ({
      id: t.id, position: t.position, name: t.name,
      monthly_credits: t.monthly_credits, perks: t.perks ?? "",
      accent_hsl: t.accent_hsl ?? null,
    })));
    setGoal(goalRes.data ? { id: (goalRes.data as any).id, label: (goalRes.data as any).label, target_credits: (goalRes.data as any).target_credits } : null);
    setLoading(false);
  }, [profile.id]);
  useEffect(() => { void load(); }, [load]);

  const addTier = async (opts: { silent?: boolean } = {}): Promise<boolean> => {
    const nextPos = Math.max(-1, ...tiers.map((t) => t.position)) + 1;
    const { data, error } = await supabase
      .from("patron_tiers" as never)
      .insert({ creator_id: profile.id, position: nextPos, name: `Tier ${nextPos + 1}`, monthly_credits: 10, perks: "Exclusive update\nEarly access", accent_hsl: "38 80% 60%" } as never)
      .select()
      .maybeSingle();
    if (error) {
      if (!opts.silent) toast.error(safeErrorMessage(error, "Could not add tier."));
      // eslint-disable-next-line no-console
      console.error("[creator] addTier failed:", error);
      return false;
    }
    if (data) {
      setTiers((p) => [...p, { id: (data as any).id, position: (data as any).position, name: (data as any).name, monthly_credits: (data as any).monthly_credits, perks: (data as any).perks ?? "", accent_hsl: (data as any).accent_hsl ?? null }]);
      setEditingTierId((data as any).id);
      onSaved?.();
      return true;
    }
    return false;
  };
  const updateTier = async (id: string, patch: Partial<{ name: string; monthly_credits: number; perks: string; accent_hsl: string }>) => {
    setTiers((p) => p.map((t) => t.id === id ? { ...t, ...patch } : t));
    const { error } = await supabase.from("patron_tiers" as never).update(patch as never).eq("id", id);
    if (!error) onSaved?.();
  };
  const removeTier = async (id: string) => {
    if (!(await confirmAsync({
      title: "Delete this tier?",
      description: "Active patrons keep their pledges; the tier just disappears from new visitors.",
      confirmLabel: "Delete tier",
      destructive: true,
    }))) return;
    setTiers((p) => p.filter((t) => t.id !== id));
    await supabase.from("patron_tiers" as never).delete().eq("id", id);
    onSaved?.();
    toast.success("Tier removed.");
  };

  const saveGoal = async (label: string, target: number) => {
    if (goal) {
      await supabase.from("patron_goals" as never).update({ label, target_credits: target } as never).eq("id", goal.id);
      setGoal({ ...goal, label, target_credits: target });
    } else {
      const { data } = await supabase.from("patron_goals" as never).insert({ creator_id: profile.id, label, target_credits: target } as never).select().maybeSingle();
      if (data) setGoal({ id: (data as any).id, label, target_credits: target });
    }
    onSaved?.();
    // First-time goal save with no tiers — auto-seed a starter tier so
    // the /patron page actually has something to pledge to. Without at
    // least one tier the page renders empty for visitors regardless of
    // how compelling the goal is. The seeded tier is editable + removable.
    if (tiers.length === 0) {
      const seeded = await addTier({ silent: true });
      toast.success(seeded ? "Goal saved · starter tier added — edit it below." : "Goal saved.");
    } else {
      toast.success("Goal saved.");
    }
  };

  return (
    <div className="space-y-8">
      <SectionHeader eyebrow="Creator" title="Your patron flywheel." sub="Tiers, funding goal, and where the money lands. The tiers you set here appear on your /c/handle/patron page." />

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.30em] text-muted-foreground/75">Funding goal</h3>
          <Link to={`/c/${profile.username ? `@${profile.username}` : profile.id}/patron`} className="text-[11px] font-mono uppercase tracking-[0.22em] text-accent/85 hover:text-accent inline-flex items-center gap-1.5">
            Preview <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
        <PatronGoalEditor initial={goal} onSave={saveGoal} />
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.30em] text-muted-foreground/75">Tiers</h3>
          <Button size="sm" variant="ghost" className={SOFT_BUTTON} onClick={() => void addTier()}>
            <Plus className="h-3 w-3 mr-1.5" />Add tier
          </Button>
        </div>
        {loading ? (
          <div className="py-6 flex items-center gap-2 text-muted-foreground/65"><Loader2 className="h-4 w-4 animate-spin" />Loading…</div>
        ) : tiers.length === 0 ? (
          <div className="py-6 flex flex-col items-start gap-4">
            <div className="space-y-1.5">
              <p className="text-[13px] text-foreground/85">
                You have no tiers yet — patrons can&rsquo;t pledge until you add one.
              </p>
              <p className="text-[12.5px] text-muted-foreground/65 leading-relaxed">
                A <span className="text-foreground/85">tier</span> is a pledge level patrons pick — name, monthly credits, and what they get. Different from the <span className="text-foreground/85">funding goal</span> above, which is the total you&rsquo;re working toward.
              </p>
            </div>
            <Button onClick={() => void addTier()} className="bg-amber-400/15 hover:bg-amber-400/25 text-amber-100">
              <Plus className="h-3.5 w-3.5 mr-1.5" />Create your first tier
            </Button>
          </div>
        ) : (
          <ul className="space-y-3">
            {tiers.map((t) => (
              <PatronTierEditor
                key={t.id}
                tier={t}
                editing={editingTierId === t.id}
                onEdit={() => setEditingTierId(editingTierId === t.id ? null : t.id)}
                onChange={(patch) => void updateTier(t.id, patch)}
                onRemove={() => void removeTier(t.id)}
              />
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h3 className="font-mono text-[11px] uppercase tracking-[0.30em] text-muted-foreground/75 mb-3">Payouts</h3>
        <PayoutAccountBlock creatorId={profile.id} />
      </Card>
    </div>
  );
}

function PayoutAccountBlock({ creatorId }: { creatorId: string }) {
  const [account, setAccount] = useState<{ id?: string; stripe_account_id?: string | null; onboarding_complete?: boolean | null; payouts_enabled?: boolean | null; charges_enabled?: boolean | null; country?: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [earnings, setEarnings] = useState<{ total_cents: number; pending_cents: number }>({ total_cents: 0, pending_cents: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    const [acctRes, ledgerRes] = await Promise.all([
      supabase.from("creator_payout_accounts" as never).select("*").eq("user_id", creatorId).maybeSingle(),
      supabase.from("creator_earnings_ledger" as never).select("usd_cents, status").eq("user_id", creatorId),
    ]);
    setAccount((acctRes.data as any) ?? null);
    const totals = (ledgerRes.data as any[] ?? []).reduce((acc, row) => {
      acc.total_cents += row.usd_cents ?? 0;
      if (row.status === "pending") acc.pending_cents += row.usd_cents ?? 0;
      return acc;
    }, { total_cents: 0, pending_cents: 0 });
    setEarnings(totals);
    setLoading(false);
  }, [creatorId]);
  useEffect(() => { void load(); }, [load]);

  const openOnboarding = async () => {
    setOpening(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-connect-onboard", {
        body: { return_path: "/account?tab=settings&m=creator" },
      });
      if (error) throw error;
      const url = (data as any)?.url;
      if (!url) throw new Error("No onboarding URL returned.");
      window.location.href = url;
    } catch (e) {
      toast.error(safeErrorMessage(e, "Could not start onboarding."));
      setOpening(false);
    }
  };

  if (loading) {
    return <div className="py-6 flex items-center gap-2 text-muted-foreground/65"><Loader2 className="h-4 w-4 animate-spin" />Loading payouts…</div>;
  }

  const status = !account?.stripe_account_id
    ? "none"
    : account.payouts_enabled
      ? "enabled"
      : account.onboarding_complete
        ? "review"
        : "pending";

  return (
    <div className="space-y-5">
      <p className="text-[13px] text-muted-foreground/80 leading-relaxed">
        Patron pledges and tips accrue in your earnings ledger.
        Connect a payout account to withdraw. The <span className="text-amber-200 font-mono">90 / 10</span> split (creator / platform) applies.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <Stat label="Lifetime earned" value={`$${(earnings.total_cents / 100).toFixed(2)}`} accent />
        <Stat label="Pending payout"  value={`$${(earnings.pending_cents / 100).toFixed(2)}`} />
      </div>

      <div className="rounded-xl p-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-[13px] font-medium text-foreground/90 inline-flex items-center gap-2">
            <Wallet className="h-3.5 w-3.5" />Stripe Connect
            {status === "enabled" && <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-full">Payouts enabled</span>}
            {status === "review"  && <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-amber-200 bg-amber-400/10 px-2 py-0.5 rounded-full">Under review</span>}
            {status === "pending" && <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-amber-200 bg-amber-400/10 px-2 py-0.5 rounded-full">Action needed</span>}
            {status === "none"    && <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground/70 bg-white/[0.04] px-2 py-0.5 rounded-full">Not connected</span>}
          </div>
          <p className="mt-1 text-[12px] text-muted-foreground/65 leading-snug">
            {status === "enabled" && "You're set. Payouts arrive on your Stripe schedule."}
            {status === "review"  && "Stripe is reviewing your details. Usually a few hours."}
            {status === "pending" && "Almost there — finish a few more steps with Stripe."}
            {status === "none"    && "You'll be redirected to Stripe to verify your identity. Takes ~5 minutes."}
          </p>
        </div>
        <Button onClick={() => void openOnboarding()} disabled={opening}>
          {opening && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
          {status === "enabled" || status === "review" ? "Manage in Stripe" : "Connect Stripe"}
        </Button>
      </div>
    </div>
  );
}

function PatronGoalEditor({
  initial, onSave,
}: {
  initial: { id: string; label: string; target_credits: number } | null;
  onSave: (label: string, target: number) => Promise<void>;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [target, setTarget] = useState(initial?.target_credits ?? 500);
  useEffect(() => { if (initial) { setLabel(initial.label); setTarget(initial.target_credits); } }, [initial]);
  return (
    <div className="space-y-3">
      <FieldRow label="Goal headline" hint="What the money is going to. Visitors see this verbatim.">
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Funding the spring short — six minutes, hand-shot" />
      </FieldRow>
      <FieldRow label="Target (cr / month)" hint="Once monthly pledges hit this, you've earned the goal.">
        <Input type="number" min={1} value={target} onChange={(e) => setTarget(Number(e.target.value) || 0)} />
      </FieldRow>
      <div className="flex justify-end">
        <Button size="sm" onClick={() => void onSave(label.trim(), Math.max(1, target))} disabled={!label.trim() || target <= 0}>
          <Save className="h-3.5 w-3.5 mr-2" />Save goal
        </Button>
      </div>
    </div>
  );
}

function PatronTierEditor({
  tier, editing, onEdit, onChange, onRemove,
}: {
  tier: { id: string; position: number; name: string; monthly_credits: number; perks: string; accent_hsl: string | null };
  editing: boolean;
  onEdit: () => void;
  onChange: (patch: Partial<{ name: string; monthly_credits: number; perks: string; accent_hsl: string }>) => void;
  onRemove: () => void;
}) {
  return (
    <li className="rounded-xl p-4">
      <div className="flex items-center gap-3">
        <div
          className="h-10 w-10 rounded-full flex items-center justify-center font-mono text-[12px] text-black shrink-0"
          style={{ background: `hsl(${tier.accent_hsl ?? "38 80% 60%"})`, boxShadow: `0 0 18px hsl(${tier.accent_hsl ?? "38 80% 60%"} / 0.45)` }}
        >
          {tier.position + 1}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-medium text-foreground/90 truncate">{tier.name || "Untitled tier"}</div>
          <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground/75">{tier.monthly_credits.toLocaleString()} CR / MONTH</div>
        </div>
        <Button size="sm" variant="ghost" onClick={onEdit}>{editing ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}</Button>
        <Button size="sm" variant="ghost" onClick={onRemove} className="text-rose-300 hover:text-rose-200"><Trash2 className="h-4 w-4" /></Button>
      </div>
      {editing && (
        <div className="mt-4 space-y-3">
          <FieldRow label="Tier name"><Input value={tier.name} onChange={(e) => onChange({ name: e.target.value })} /></FieldRow>
          <FieldRow label="Monthly credits"><Input type="number" min={1} value={tier.monthly_credits} onChange={(e) => onChange({ monthly_credits: Number(e.target.value) || 0 })} /></FieldRow>
          <FieldRow label="Accent (HSL)" hint='Use the form "38 80% 60%". The colored wax-seal on the tier card uses this hue.'>
            <Input value={tier.accent_hsl ?? ""} onChange={(e) => onChange({ accent_hsl: e.target.value })} placeholder="38 80% 60%" />
          </FieldRow>
          <FieldRow label="Perks" hint="One per line. Bullet points appear on the public tier card.">
            <Textarea value={tier.perks} onChange={(e) => onChange({ perks: e.target.value })} rows={5} placeholder="Behind-the-scenes posts&#10;Vote on next short&#10;Director's notes" />
          </FieldRow>
        </div>
      )}
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PLAYBACK MODULE
// ─────────────────────────────────────────────────────────────────────────────
function PlaybackModule({
  profile, patch,
}: {
  profile: ProfileRow;
  patch: (p: Partial<ProfileRow>, key?: string) => Promise<boolean>;
}) {
  const prefs = (profile.preferences ?? {}) as PrefsState;
  const merged = { ...DEFAULT_PREFS, ...prefs };
  const set = (next: Partial<PrefsState>) => void patch({ preferences: next as never });

  return (
    <div className="space-y-8">
      <SectionHeader eyebrow="Playback" title="Defaults for new films & how playback feels." sub="These pre-fill new projects. You can override per project in Studio." />

      <Card>
        <h3 className="font-mono text-[11px] uppercase tracking-[0.30em] text-muted-foreground/75 mb-3">Generation</h3>
        <FieldRow label="Default engine" hint="Wan is free-tier; Kling charges credits per second.">
          <Select value={merged.defaultEngine} onValueChange={(v) => set({ defaultEngine: v as PrefsState["defaultEngine"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="wan">Wan · free tier</SelectItem>
              <SelectItem value="kling">Kling · premium</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Default quality">
          <Select value={merged.defaultQualityTier} onValueChange={(v) => set({ defaultQualityTier: v as PrefsState["defaultQualityTier"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="standard">Standard</SelectItem>
              <SelectItem value="pro">Pro</SelectItem>
              <SelectItem value="cinematic">Cinematic</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Aspect ratio">
          <Select value={merged.defaultAspectRatio} onValueChange={(v) => set({ defaultAspectRatio: v as PrefsState["defaultAspectRatio"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="16:9">16 : 9 — Widescreen</SelectItem>
              <SelectItem value="9:16">9 : 16 — Vertical</SelectItem>
              <SelectItem value="1:1">1 : 1 — Square</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Default genre">
          <Select value={merged.defaultGenre} onValueChange={(v) => set({ defaultGenre: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["drama", "comedy", "thriller", "documentary", "music_video", "experimental", "animation", "horror", "romance"].map((g) =>
                <SelectItem key={g} value={g}>{g.replace("_", " ")}</SelectItem>)}
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Default reel visibility" hint="Choose what the visibility selector starts on. You can always change it before publishing.">
          <Select value={merged.defaultReelVisibility} onValueChange={(v) => set({ defaultReelVisibility: v as PrefsState["defaultReelVisibility"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="public">Public — listed</SelectItem>
              <SelectItem value="unlisted">Unlisted — anyone with the link</SelectItem>
              <SelectItem value="private">Private — only me</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
      </Card>

      <Card>
        <h3 className="font-mono text-[11px] uppercase tracking-[0.30em] text-muted-foreground/75 mb-3">Playback</h3>
        <ToggleRow label="Autoplay videos" hint="Plays as soon as a reel is visible. Off saves battery & data." checked={!!merged.autoplayVideos} onChange={(v) => set({ autoplayVideos: v })} />
        <ToggleRow label="Captions on by default" hint="Turn captions on automatically when available." checked={!!merged.captionsDefault} onChange={(v) => set({ captionsDefault: v })} />
        <FieldRow label="Default volume" hint={`Currently ${merged.defaultVolume}%`}>
          <div className="flex items-center gap-3">
            <Volume2 className="h-3.5 w-3.5 text-muted-foreground/65" />
            <Slider value={[merged.defaultVolume ?? 80]} min={0} max={100} step={5} onValueChange={([v]) => set({ defaultVolume: v })} />
          </div>
        </FieldRow>
        <FieldRow label="Default playback speed">
          <Select value={String(merged.defaultPlaybackSpeed)} onValueChange={(v) => set({ defaultPlaybackSpeed: Number(v) })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {[0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => <SelectItem key={s} value={String(s)}>{s}×</SelectItem>)}
            </SelectContent>
          </Select>
        </FieldRow>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BILLING MODULE
// ─────────────────────────────────────────────────────────────────────────────
function BillingModule({
  profile, patch,
}: {
  profile: ProfileRow;
  patch: (p: Partial<ProfileRow>, key?: string) => Promise<boolean>;
}) {
  const [transactions, setTransactions] = useState<Array<{ id: string; created_at: string; type: string; amount: number; description: string | null }>>([]);
  const [loadingTx, setLoadingTx] = useState(true);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("credit_transactions" as never).select("id, created_at, type:transaction_type, amount, description").eq("user_id", profile.id).order("created_at", { ascending: false }).limit(20);
      setTransactions((data as any[]) ?? []);
      setLoadingTx(false);
    })();
  }, [profile.id]);

  const exportCsv = () => {
    const rows = [["date", "type", "amount", "description"], ...transactions.map((t) => [t.created_at, t.type, String(t.amount), t.description ?? ""])];
    const csv = rows.map((r) => csvRow(r)).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-8">
      <SectionHeader eyebrow="Billing" title="Credits, recharges, and receipts." sub="Track your balance, set up auto-recharge, and export your transaction history." />

      <Card>
        <h3 className="font-mono text-[11px] uppercase tracking-[0.30em] text-muted-foreground/75 mb-5">Balance</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <Stat label="Available" value={(profile.credits_balance ?? 0).toLocaleString()} accent />
          <Stat label="Total purchased" value={(profile.total_credits_purchased ?? 0).toLocaleString()} />
          <Stat label="Total used" value={(profile.total_credits_used ?? 0).toLocaleString()} />
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/account?tab=credits"><Button><Sparkles className="h-3.5 w-3.5 mr-2" />Buy credits</Button></Link>
          <Button variant="ghost" className={SOFT_BUTTON} onClick={exportCsv}><Download className="h-3.5 w-3.5 mr-2" />Export CSV</Button>
        </div>
      </Card>

      <Card>
        <h3 className="font-mono text-[11px] uppercase tracking-[0.30em] text-muted-foreground/75 mb-3">Auto-recharge</h3>
        <ToggleRow
          label="Auto-recharge when balance drops"
          hint="We'll top you up automatically so renders never stop mid-stream. You can pause this any time."
          checked={!!profile.auto_recharge_enabled}
          onChange={(v) => void patch({ auto_recharge_enabled: v }, "auto_recharge_enabled")}
        />
      </Card>

      <Card>
        <h3 className="font-mono text-[11px] uppercase tracking-[0.30em] text-muted-foreground/75 mb-3">Recent activity</h3>
        {loadingTx ? (
          <div className="py-6 flex items-center gap-2 text-muted-foreground/65"><Loader2 className="h-4 w-4 animate-spin" />Loading…</div>
        ) : transactions.length === 0 ? (
          <p className="text-[13px] text-muted-foreground/65 py-4">No transactions yet.</p>
        ) : (
          <ul>
            {transactions.map((t) => (
              <li key={t.id} className="py-3 flex items-center gap-3">
                <Receipt className="h-3.5 w-3.5 text-muted-foreground/55 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] text-foreground/90 truncate">{t.description ?? t.type}</div>
                  <div className="text-[11px] text-muted-foreground/60">{new Date(t.created_at).toLocaleString()}</div>
                </div>
                <div className={cn("text-[13px] font-mono tabular-nums", t.amount > 0 ? "text-emerald-300" : "text-rose-300")}>
                  {t.amount > 0 ? "+" : ""}{t.amount}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl p-4">
      <div className={cn(TYPE_META, "text-muted-foreground/65 tracking-[0.22em]")}>{label}</div>
      <div
        className={cn("mt-2 font-display italic tabular-nums leading-none", accent ? "text-amber-200" : "text-foreground")}
        style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(1.6rem, 2.4vw, 2.2rem)" }}
      >
        {value}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECURITY MODULE — real implementations:
//   - password: supabase.auth.updateUser
//   - 2FA TOTP: supabase.auth.mfa.enroll/verify/unenroll
//   - sessions: current session info + "sign out of other sessions" scope
//   - connected accounts: auth identities + linkIdentity/unlinkIdentity
// ─────────────────────────────────────────────────────────────────────────────
function SecurityModule({ profile }: { profile: ProfileRow }) {
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showMfaDialog, setShowMfaDialog] = useState(false);
  const [factors, setFactors] = useState<Array<{ id: string; factor_type: string; status: string; friendly_name?: string | null; created_at: string }>>([]);
  const [identities, setIdentities] = useState<Array<{ id: string; identity_id?: string; provider: string; created_at?: string; last_sign_in_at?: string | null }>>([]);
  const [session, setSession] = useState<{ created_at?: string; expires_at?: number | null } | null>(null);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [changingEmail, setChangingEmail] = useState(false);

  const submitEmailChange = async () => {
    const trimmed = newEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError("Enter a valid email address.");
      return;
    }
    if (trimmed.toLowerCase() === (profile.email ?? "").toLowerCase()) {
      setEmailError("New email must be different from your current email.");
      return;
    }
    if (!emailPassword) {
      setEmailError("Confirm your password to change your email.");
      return;
    }
    setEmailError("");
    setChangingEmail(true);
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      if (!s) { toast.error("Please sign in again."); return; }
      // The update-user-email function re-checks the password (anti-ATO), so
      // both the new address and the current password are required.
      const { data, error } = await supabase.functions.invoke("update-user-email", {
        body: { newEmail: trimmed, password: emailPassword },
        headers: { Authorization: `Bearer ${s.access_token}` },
      });
      if (error || (data as { error?: string })?.error) {
        setEmailError((data as { error?: string })?.error || "Couldn't change email. Check your password and try again.");
        return;
      }
      toast.success("Confirmation email sent to your new address.");
      setShowEmailDialog(false);
      setNewEmail("");
      setEmailPassword("");
    } catch (e) {
      setEmailError(safeErrorMessage(e, "Couldn't change email. Please try again."));
    } finally {
      setChangingEmail(false);
    }
  };

  const loadSecurity = useCallback(async () => {
    const [factorsRes, userRes, sessionRes] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.getUser(),
      supabase.auth.getSession(),
    ]);
    setFactors(((factorsRes.data?.all ?? []) as any[]).map((f) => ({
      id: f.id, factor_type: f.factor_type, status: f.status,
      friendly_name: f.friendly_name ?? null, created_at: f.created_at,
    })));
    setIdentities((userRes.data?.user?.identities ?? []).map((i: any) => ({
      id: i.id, identity_id: i.identity_id, provider: i.provider,
      created_at: i.created_at, last_sign_in_at: i.last_sign_in_at,
    })));
    if (sessionRes.data?.session) {
      setSession({
        created_at: (sessionRes.data.session as any).created_at,
        expires_at: sessionRes.data.session.expires_at,
      });
    }
  }, []);
  useEffect(() => { void loadSecurity(); }, [loadSecurity]);

  const verifiedFactor = factors.find((f) => f.status === "verified" && f.factor_type === "totp");

  const unenrollTotp = async () => {
    if (!verifiedFactor) return;
    if (!(await confirmAsync({ title: "Disable 2FA?", description: "You'll go back to password-only sign-in.", destructive: true }))) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId: verifiedFactor.id });
    if (error) { toast.error(safeErrorMessage(error, "Could not disable 2FA.")); return; }
    toast.success("2FA disabled.");
    await loadSecurity();
  };

  const unlinkIdentity = async (identity: { identity_id?: string; provider: string }) => {
    if (identities.filter((i) => i.provider !== "email").length === 0 && identity.provider !== "email") {
      toast.error("Add another sign-in method before unlinking your last social account.");
      return;
    }
    if (!(await confirmAsync({ title: `Unlink ${identity.provider}?`, description: `Remove your ${identity.provider} sign-in method from this account?`, destructive: true }))) return;
    const { data: userRes } = await supabase.auth.getUser();
    const fullIdentity = userRes?.user?.identities?.find((i: any) => i.identity_id === identity.identity_id);
    if (!fullIdentity) { toast.error("Could not find identity."); return; }
    const { error } = await supabase.auth.unlinkIdentity(fullIdentity as never);
    if (error) { toast.error(safeErrorMessage(error, "Could not unlink that account.")); return; }
    toast.success(`${identity.provider} unlinked.`);
    await loadSecurity();
  };

  const linkIdentity = async (provider: "google" | "github" | "apple") => {
    const { error } = await supabase.auth.linkIdentity({ provider, options: { redirectTo: `${window.location.origin}/account?tab=settings&m=security` } });
    if (error) toast.error(safeErrorMessage(error, "Could not link that account."));
  };

  return (
    <div className="space-y-8">
      <SectionHeader eyebrow="Security" title="Lock the front door." sub="Strong password, 2FA, every device you're signed in on, and what's linked." />

      <Card>
        <h3 className="font-mono text-[11px] uppercase tracking-[0.30em] text-muted-foreground/75 mb-3">Password</h3>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[13px] font-medium text-foreground/90">Sign-in password</div>
            <p className="mt-1 text-[12px] text-muted-foreground/65 leading-snug">Use a long passphrase. Updates are atomic — nobody gets signed out.</p>
          </div>
          <Button variant="ghost" className={SOFT_BUTTON} onClick={() => setShowPasswordDialog(true)}><KeyRound className="h-3.5 w-3.5 mr-2" />Change password</Button>
        </div>
      </Card>

      <Card>
        <h3 className="font-mono text-[11px] uppercase tracking-[0.30em] text-muted-foreground/75 mb-3">Login email</h3>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[13px] font-medium text-foreground/90">{profile.email ?? "—"}</div>
            <p className="mt-1 text-[12px] text-muted-foreground/65 leading-snug">Used to sign in and receive critical alerts. We'll send a confirmation link to the new address.</p>
          </div>
          <Button variant="ghost" className={SOFT_BUTTON} onClick={() => { setNewEmail(""); setEmailPassword(""); setEmailError(""); setShowEmailDialog(true); }}><KeyRound className="h-3.5 w-3.5 mr-2" />Change email</Button>
        </div>
      </Card>

      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change login email</DialogTitle>
            <DialogDescription>Enter your new email address and confirm your password. You'll receive a confirmation link there — your email changes only after you click it.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              type="email"
              placeholder="new@email.com"
              autoComplete="email"
              value={newEmail}
              onChange={(e) => { setNewEmail(e.target.value); setEmailError(""); }}
            />
            <Input
              type="password"
              placeholder="Current password"
              autoComplete="current-password"
              value={emailPassword}
              onChange={(e) => { setEmailPassword(e.target.value); setEmailError(""); }}
            />
            {emailError && <p className="text-[12px] text-red-400">{emailError}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowEmailDialog(false)} disabled={changingEmail}>Cancel</Button>
            <Button onClick={() => void submitEmailChange()} disabled={changingEmail || !newEmail.trim() || !emailPassword}>
              {changingEmail ? "Sending…" : "Send confirmation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <h3 className="font-mono text-[11px] uppercase tracking-[0.30em] text-muted-foreground/75 mb-3">Two-factor authentication</h3>
        {verifiedFactor ? (
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[13px] font-medium text-emerald-200 inline-flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5" />2FA enabled (TOTP)
              </div>
              <p className="mt-1 text-[12px] text-muted-foreground/65 leading-snug">
                Enrolled {new Date(verifiedFactor.created_at).toLocaleDateString()}.
                {verifiedFactor.friendly_name && <> · {verifiedFactor.friendly_name}</>}
              </p>
            </div>
            <Button variant="ghost" className={SOFT_BUTTON} onClick={() => void unenrollTotp()}>Disable</Button>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[13px] font-medium text-foreground/90">Authenticator app</div>
              <p className="mt-1 text-[12px] text-muted-foreground/65 leading-snug max-w-md">
                Scan a QR code with 1Password, Authy, Google Authenticator, or any TOTP app. You'll be asked for a 6-digit code on every new sign-in.
              </p>
            </div>
            <Button onClick={() => setShowMfaDialog(true)}><ShieldCheck className="h-3.5 w-3.5 mr-2" />Set up 2FA</Button>
          </div>
        )}
      </Card>

      <Card>
        <h3 className="font-mono text-[11px] uppercase tracking-[0.30em] text-muted-foreground/75 mb-3">Current session</h3>
        <ul>
          <li className="py-3 flex items-center gap-3">
            <Smartphone className="h-4 w-4 text-emerald-300 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] text-foreground/90">This device</div>
              <div className="text-[11px] text-muted-foreground/60">
                {session?.expires_at ? `Expires ${new Date(session.expires_at * 1000).toLocaleString()}` : "Active"}
              </div>
            </div>
            <span className="text-[10px] font-mono uppercase tracking-[0.20em] text-emerald-300/85">Current</span>
          </li>
        </ul>
        <div className="mt-5 flex justify-end gap-3">
          <Button
            variant="ghost"
            className={SOFT_BUTTON}
            onClick={async () => {
              // signOut resolves with { error } — don't claim success blindly
              // (this is a security action; a false confirmation is dangerous).
              const { error } = await supabase.auth.signOut({ scope: "others" });
              if (error) { toast.error("Could not sign out other sessions."); return; }
              toast.success("Signed out of all other sessions.");
              await loadSecurity();
            }}
          >
            Sign out of other sessions
          </Button>
          <Button
            variant="ghost"
            className={SOFT_BUTTON}
            onClick={async () => {
              const { error } = await supabase.auth.signOut({ scope: "global" });
              if (error) { toast.error("Could not sign out everywhere."); return; }
              toast.success("Signed out everywhere.");
              window.location.href = "/auth";
            }}
          >
            <PowerOff className="h-3.5 w-3.5 mr-2" />Sign out everywhere
          </Button>
        </div>
      </Card>

      <Card>
        <h3 className="font-mono text-[11px] uppercase tracking-[0.30em] text-muted-foreground/75 mb-3">Connected accounts</h3>
        {identities.length === 0 ? (
          <p className="text-[13px] text-muted-foreground/65 py-2">No social sign-in methods linked yet.</p>
        ) : (
          <ul className="mb-4">
            {identities.map((i) => (
              <li key={i.id ?? i.identity_id ?? i.provider} className="py-3 flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-white/[0.05] grid place-items-center text-foreground/80 text-[11px] font-mono uppercase shrink-0">{i.provider.slice(0, 2)}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] text-foreground/90 capitalize">{i.provider}</div>
                  {i.last_sign_in_at && (
                    <div className="text-[11px] text-muted-foreground/60">Last used {new Date(i.last_sign_in_at).toLocaleDateString()}</div>
                  )}
                </div>
                {i.provider !== "email" && (
                  <Button size="sm" variant="ghost" onClick={() => void unlinkIdentity(i)}>Unlink</Button>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          {(["google", "github", "apple"] as const)
            .filter((p) => !identities.some((i) => i.provider === p))
            .map((p) => (
              <Button key={p} size="sm" variant="ghost" className={SOFT_BUTTON} onClick={() => void linkIdentity(p)}>
                <Plus className="h-3 w-3 mr-1.5" />Link {p}
              </Button>
            ))}
        </div>
      </Card>

      <Card>
        <h3 className="font-mono text-[11px] uppercase tracking-[0.30em] text-muted-foreground/75 mb-3">Account verification</h3>
        {profile.verified_at ? (
          <div className="inline-flex items-center gap-2 text-[12px] text-emerald-200">
            <ShieldCheck className="h-3.5 w-3.5" />Verified · {profile.verified_kind} · since {new Date(profile.verified_at).toLocaleDateString()}
          </div>
        ) : (
          <p className="text-[13px] text-muted-foreground/75">
            Get a verified badge — opens trust, payout, and brand-deal surfaces. Request it from <Link to="/help" className="text-accent hover:text-accent/80">Help → Verification</Link>.
          </p>
        )}
      </Card>

      <PasswordChangeDialog open={showPasswordDialog} onClose={() => setShowPasswordDialog(false)} />
      <MfaEnrollDialog open={showMfaDialog} onClose={() => setShowMfaDialog(false)} onEnrolled={loadSecurity} />
    </div>
  );
}

function MfaEnrollDialog({ open, onClose, onEnrolled }: { open: boolean; onClose: () => void; onEnrolled: () => Promise<void> }) {
  const [step, setStep] = useState<"enroll" | "verify">("enroll");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) { setStep("enroll"); setFactorId(null); setQr(null); setSecret(null); setCode(""); return; }
    (async () => {
      setBusy(true);
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      setBusy(false);
      if (error) { toast.error(safeErrorMessage(error, "Could not start 2FA setup.")); onClose(); return; }
      setFactorId(data.id);
      setQr(data.totp.qr_code);
      setSecret(data.totp.secret);
    })();
  }, [open, onClose]);

  const verify = async () => {
    if (!factorId) return;
    if (!/^\d{6}$/.test(code)) { toast.error("Enter the 6-digit code from your app."); return; }
    setBusy(true);
    const { data: challenge } = await supabase.auth.mfa.challenge({ factorId });
    if (!challenge) { setBusy(false); toast.error("Couldn't start verification."); return; }
    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
    setBusy(false);
    if (error) { toast.error(safeErrorMessage(error, "Could not verify that code.")); return; }
    toast.success("2FA enabled.");
    await onEnrolled();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set up two-factor authentication</DialogTitle>
          <DialogDescription>Scan the QR with your authenticator app, then enter the 6-digit code to confirm.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {busy && !qr ? (
            <div className="py-12 grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : qr ? (
            <>
              <div className="grid place-items-center">
                <div className="rounded-2xl bg-white p-4 inline-block">
                  <img src={qr} alt="2FA QR" className="h-44 w-44" />
                </div>
              </div>
              {secret && (
                <div className="text-center">
                  <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/65 mb-1">Or enter the secret manually</div>
                  <div className="text-[11px] font-mono break-all text-foreground/90">{secret}</div>
                </div>
              )}
              <Input value={code} onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))} placeholder="123 456" maxLength={6} className="text-center font-mono tabular-nums tracking-[0.4em] text-[18px]" />
            </>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={() => void verify()} disabled={busy || code.length !== 6}>{busy && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}Verify & enable</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PasswordChangeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (pw.length < 8) { toast.error("Use at least 8 characters."); return; }
    if (pw !== confirm) { toast.error("Passwords don't match."); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { toast.error(safeErrorMessage(error, "Could not update password.")); return; }
    toast.success("Password updated.");
    onClose();
    setPw(""); setConfirm("");
  };
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>Pick something long and memorable. At least 8 characters.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Input type={show ? "text" : "password"} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password" />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/65 hover:text-foreground">
              {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
          <Input type={show ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm password" />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={busy || !pw}>{busy && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}Update</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DEVELOPERS MODULE
// ─────────────────────────────────────────────────────────────────────────────
function DevelopersModule() {
  return (
    <div className="space-y-8">
      <SectionHeader eyebrow="Developers" title="Build on Small Bridges." sub="API keys, webhooks, and event docs. The full Developers surface lives at its own tab." />
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[13px] font-medium text-foreground/90">Developer console</div>
            <p className="mt-1 text-[12px] text-muted-foreground/65 leading-snug max-w-md">
              Manage API keys, webhook endpoints, and event signatures. We're keeping the full UI on its own tab so this page stays scoped to settings.
            </p>
          </div>
          <Link to="/account?tab=developers"><Button variant="ghost" className={SOFT_BUTTON}><Code className="h-3.5 w-3.5 mr-2" />Open developer console</Button></Link>
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DATA & ACCOUNT MODULE
// ─────────────────────────────────────────────────────────────────────────────
function DataModule({ profile }: { profile: ProfileRow }) {
  const [showDelete, setShowDelete] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  const downloadData = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("export-user-data");
      if (error) throw error;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `smallbridges-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success("Export ready.");
    } catch (e) {
      toast.error(safeErrorMessage(e, "Could not export your data."));
    }
  };

  const deactivate = async () => {
    if (!(await confirmAsync({
      title: "Deactivate your account?",
      description: "Your profile will be hidden but your data stays. You can sign back in to reactivate.",
      confirmLabel: "Deactivate",
      destructive: true,
    }))) return;
    setDeactivating(true);
    const { error } = await supabase.from("profiles" as never).update({ deactivated_at: new Date().toISOString() } as never).eq("id", profile.id);
    setDeactivating(false);
    if (error) { toast.error(safeErrorMessage(error, "Could not deactivate your account.")); return; }
    await supabase.auth.signOut();
    window.location.href = "/auth?deactivated=1";
  };

  return (
    <div className="space-y-8">
      <SectionHeader eyebrow="Data & account" title="What we have on you — and how to walk away." sub="Export everything you've created. Deactivate or delete on your own terms." />

      <Card>
        <h3 className="font-mono text-[11px] uppercase tracking-[0.30em] text-muted-foreground/75 mb-3">Account tier</h3>
        <div className="flex items-baseline gap-3">
          <span className="text-[22px] font-display italic capitalize text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>
            {profile.account_tier ?? "free"}
          </span>
          <Link to="/account?tab=credits" className="text-[11px] font-mono uppercase tracking-[0.22em] text-accent/85 hover:text-accent">
            Compare plans →
          </Link>
        </div>
        <p className="mt-2 text-[12px] text-muted-foreground/65">
          Member since {profile.created_at ? new Date(profile.created_at).toLocaleDateString() : "—"}.
        </p>
      </Card>

      <Card>
        <h3 className="font-mono text-[11px] uppercase tracking-[0.30em] text-muted-foreground/75 mb-3">Export</h3>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[13px] font-medium text-foreground/90">Download my data</div>
            <p className="mt-1 text-[12px] text-muted-foreground/65 leading-snug max-w-md">
              A JSON file with your profile, reels, projects, transactions, and follows. Pulled live, so it's always current.
            </p>
          </div>
          <Button variant="ghost" className={SOFT_BUTTON} onClick={() => void downloadData()}><Download className="h-3.5 w-3.5 mr-2" />Export</Button>
        </div>
      </Card>

      <Card className="bg-rose-500/[0.04]">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.30em] text-rose-200/85 mb-3 inline-flex items-center gap-2">
          <AlertTriangle className="h-3 w-3" />Danger zone
        </h3>
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[13px] font-medium text-foreground/90">Deactivate account</div>
              <p className="mt-1 text-[12px] text-muted-foreground/65 leading-snug max-w-md">
                Hide your profile and pause notifications. Reactivate any time by signing back in.
              </p>
            </div>
            <Button variant="ghost" className={SOFT_BUTTON} onClick={() => void deactivate()} disabled={deactivating}>
              {deactivating && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
              <Briefcase className="h-3.5 w-3.5 mr-2" />Deactivate
            </Button>
          </div>
          <div className="flex items-start justify-between gap-4 pt-5">
            <div>
              <div className="text-[13px] font-medium text-rose-200">Delete account</div>
              <p className="mt-1 text-[12px] text-muted-foreground/65 leading-snug max-w-md">
                Permanent. Reels, projects, and pledges are removed; usernames stay reserved.
              </p>
            </div>
            <Button variant="destructive" onClick={() => setShowDelete(true)}>
              <Trash2 className="h-3.5 w-3.5 mr-2" />Delete forever
            </Button>
          </div>
        </div>
      </Card>

      <DeleteAccountDialog open={showDelete} onClose={() => setShowDelete(false)} />
    </div>
  );
}

function DeleteAccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (confirm !== "DELETE") return;
    setBusy(true);
    try {
      await supabase.functions.invoke("delete-user-account");
      await supabase.auth.signOut();
      window.location.href = "/auth?deleted=1";
    } catch (e) {
      toast.error(safeErrorMessage(e, "Could not delete."));
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete account forever?</DialogTitle>
          <DialogDescription>
            Type <span className="font-mono text-rose-300">DELETE</span> below to confirm. We can't restore once it's gone.
          </DialogDescription>
        </DialogHeader>
        <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="DELETE" />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="destructive" disabled={confirm !== "DELETE" || busy} onClick={() => void submit()}>
            {busy && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}I understand · Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
