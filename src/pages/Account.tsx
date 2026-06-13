/**
 * Account — /account
 *
 * Unified surface for everything personal: Profile · Settings · Credits ·
 * Notifications · Workspace. Replaces the scattered /profile, /settings,
 * /credits, /workspace surfaces as the canonical destination.
 *
 * The tabs swap content but each panel delegates to the existing
 * underlying page component (Profile.tsx, Settings.tsx, Credits.tsx).
 * This keeps the working code in place while the visual frame is
 * unified under the foundation.
 *
 * Tab state lives in ?tab= so a deep link from the Command Center
 * (e.g., /account?tab=credits) opens the right section.
 */
import { lazy, Suspense, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  User as UserIcon,
  Sliders,
  CreditCard,
  Bell,
  Briefcase,
  Loader2,
  Mail,
  Code2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FoundationShell } from "@/components/foundation/FoundationShell";
import {
  EditorialCanvas,
  EditorialEyebrow,
  EditorialHeadline,
} from "@/components/foundation/EditorialCanvas";
import { useAuth } from "@/contexts/AuthContext";
import { useLiveRenderTimecode } from "@/hooks/useLiveRenderTimecode";
import { usePageMeta } from "@/hooks/usePageMeta";
import {
  EASE_PREMIUM,
  TYPE_EYEBROW,
  TYPE_META,
  RADIUS,
} from "@/lib/design-system";

// Lazy-load each panel so we only pay for what we render.
const ProfilePanel = lazy(() => import("./Profile"));
const SettingsPanel = lazy(() => import("./Settings"));
const CreditsPanel = lazy(() => import("./Credits"));
const NotificationsPanel = lazy(() => import("./Notifications"));
const MessagesPanel = lazy(() => import("./account/MessagesPanel"));
const DevelopersPanel = lazy(() => import("./account/DevelopersPanel"));

type Tab =
  | "profile"
  | "messages"
  | "notifications"
  | "credits"
  | "settings"
  | "developers"
  | "workspace";

const TABS: Array<{
  id: Tab;
  label: string;
  Icon: typeof UserIcon;
  hint?: string;
}> = [
  { id: "profile",       label: "Profile",       Icon: UserIcon },
  { id: "messages",      label: "Messages",      Icon: Mail },
  { id: "notifications", label: "Notifications", Icon: Bell },
  { id: "credits",       label: "Credits",       Icon: CreditCard },
  { id: "settings",      label: "Settings",      Icon: Sliders },
  { id: "developers",    label: "Developers",    Icon: Code2 },
  { id: "workspace",     label: "Workspace",     Icon: Briefcase, hint: "→ /workspace" },
];

export default function Account() {
  usePageMeta({
    title: "Account — Small Bridges",
    description: "Profile, settings, credits, notifications, workspace.",
  });

  const { user, profile } = useAuth();
  const reducedMotion = useReducedMotion();
  const [params, setParams] = useSearchParams();

  const tab = useMemo<Tab>(() => {
    const raw = params.get("tab");
    if (
      raw === "messages" ||
      raw === "notifications" ||
      raw === "credits" ||
      raw === "settings" ||
      raw === "developers" ||
      raw === "workspace"
    ) {
      return raw as Tab;
    }
    return "profile";
  }, [params]);

  const setTab = (next: Tab) => {
    const p = new URLSearchParams(params);
    if (next === "profile") p.delete("tab");
    else p.set("tab", next);
    setParams(p, { replace: true });
  };

  const liveRenderTimecode = useLiveRenderTimecode();

  return (
    <FoundationShell>
      <div className="relative mx-auto w-full max-w-[1280px] px-4 pb-24 pt-10 sm:px-6 lg:px-10">
        <EditorialCanvas
          maxWidth="100%"
          chrome={{
            crumbs: ["Small Bridges", "account"],
            timecode:
              liveRenderTimecode ??
              (profile?.email ? profile.email.toUpperCase() : undefined),
          }}
        >
          {/* Header */}
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <EditorialEyebrow>Your account</EditorialEyebrow>
              <EditorialHeadline className="mt-5" size="lg">
                {profile?.display_name
                  ? `Hello, ${profile.display_name}.`
                  : user?.email
                    ? "Welcome back."
                    : "Your account."}
              </EditorialHeadline>
              <p className="mt-5 max-w-xl text-[14px] font-light leading-relaxed text-muted-foreground/70">
                Profile, preferences, credits, notifications, and workspace
                live here. One room, one source of truth.
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 border-b border-border/30 pb-5">
            {TABS.map(({ id, label, Icon, hint }) => {
              const active = tab === id;
              const isExternal = id === "workspace";
              const inner = (
                <>
                  <Icon
                    className={cn(
                      "h-3.5 w-3.5 transition-colors",
                      active ? "text-accent" : "text-muted-foreground/50",
                    )}
                    strokeWidth={1.5}
                  />
                  <span>{label}</span>
                  {hint && (
                    <span className={cn(TYPE_META, "ml-1 text-muted-foreground/35")}>
                      {hint}
                    </span>
                  )}
                  {active && (
                    <motion.span
                      layoutId="account-tab-underline"
                      className="absolute -bottom-[21px] left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent"
                    />
                  )}
                </>
              );
              const cls = cn(
                "relative inline-flex items-center gap-2 pb-4 text-[12px] uppercase tracking-[0.18em] transition-colors",
                active ? "text-foreground" : "text-muted-foreground/60 hover:text-foreground/90",
              );
              return isExternal ? (
                <Link key={id} to="/workspace" className={cls}>
                  {inner}
                </Link>
              ) : (
                <button key={id} onClick={() => setTab(id)} className={cls}>
                  {inner}
                </button>
              );
            })}
          </div>

          {/* Panel */}
          <div className="mt-8 min-h-[420px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: EASE_PREMIUM }}
              >
                <Suspense fallback={<PanelSkeleton />}>
                  {tab === "profile" && <ProfilePanel />}
                  {tab === "messages" && <MessagesPanel />}
                  {tab === "notifications" && <NotificationsPanel />}
                  {tab === "credits" && <CreditsPanel />}
                  {tab === "settings" && <SettingsPanel />}
                  {tab === "developers" && <DevelopersPanel />}
                  {tab === "workspace" && <WorkspaceHint />}
                </Suspense>
              </motion.div>
            </AnimatePresence>
          </div>
        </EditorialCanvas>
      </div>
    </FoundationShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel helpers
// ─────────────────────────────────────────────────────────────────────────────
function PanelSkeleton() {
  return (
    <div className="flex h-[300px] flex-col items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-accent" strokeWidth={1.5} />
      <p className={cn("mt-4", TYPE_EYEBROW, "text-muted-foreground/55")}>
        Loading…
      </p>
    </div>
  );
}

function WorkspaceHint() {
  return (
    <div className="flex h-[300px] flex-col items-center justify-center text-center">
      <Briefcase className="h-10 w-10 text-accent/60 mb-5" strokeWidth={1.2} />
      <p className="font-display italic text-2xl text-foreground/85">
        Workspace lives on its own.
      </p>
      <p className="mt-3 max-w-md text-[13px] text-muted-foreground/65">
        Team, brand kit, billing, integrations, and analytics are deep enough
        to deserve their own room.
      </p>
      <Link
        to="/workspace"
        className={cn(
          "mt-7 inline-flex items-center gap-2 px-5 py-3",
          RADIUS.chip,
          "border border-accent/40 bg-gradient-to-br from-accent/15 to-accent/5",
          "transition-all hover:border-accent/60 hover:from-accent/25",
        )}
      >
        <Briefcase className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
        <span className="text-[13px]">Open Workspace</span>
      </Link>
    </div>
  );
}
