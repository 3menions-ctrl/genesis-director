/**
 * Account — /account
 *
 * Unified personal surface. Sections are reached via the LeftRail
 * (Profile · Inbox · Notifications · Credits · Settings · Developers ·
 * Workspace) — the in-page tab strip has been retired in favor of the
 * persistent global navigation.
 *
 * Each section renders inside an adaptive Hero that morphs eyebrow +
 * headline + subtitle based on which ?tab=X is active. The active
 * panel comes in lazily so the initial bundle stays lean.
 */
import { lazy, Suspense, useMemo } from "react";
import { useSearchParams, Link, Navigate } from "react-router-dom";
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
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FoundationShell } from "@/components/foundation/FoundationShell";
import { GradientBackdrop } from "@/components/foundation/GradientBackdrop";
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

// ─────────────────────────────────────────────────────────────────────────────
// Panels — lazy
// ─────────────────────────────────────────────────────────────────────────────
const ProfileDashboard = lazy(() => import("./account/ProfileDashboard"));
const SettingsPanel = lazy(() => import("./account/SettingsDashboard"));
const CreditsPanel = lazy(() => import("./Credits"));
// Messages + notifications now live at /inbox. The legacy tab values
// just redirect there via the SECTIONS map.
const DevelopersPanel = lazy(() => import("./account/DevelopersPanel"));

type Tab =
  | "profile"
  | "messages"
  | "notifications"
  | "credits"
  | "settings"
  | "developers"
  | "workspace";

// ─────────────────────────────────────────────────────────────────────────────
// Adaptive hero copy per section
// ─────────────────────────────────────────────────────────────────────────────
interface SectionConfig {
  eyebrow: string;
  headline: (displayName: string) => string;
  subtitle: string;
  Icon: typeof UserIcon;
}

const SECTIONS: Record<Tab, SectionConfig> = {
  profile: {
    eyebrow: "Your studio",
    headline: (n) => `Hello, ${n}.`,
    subtitle: "Your numbers, your activity, your achievements — and where every film you direct lands.",
    Icon: UserIcon,
  },
  messages: {
    eyebrow: "Inbox",
    headline: () => "Conversations.",
    subtitle: "Direct messages with creators and crew. Encrypted in transit, mutable only by sender and recipient.",
    Icon: Mail,
  },
  notifications: {
    eyebrow: "Activity",
    headline: () => "What's happening.",
    subtitle: "Every like, comment, follow, and tip routed to one stream — keep the score, miss nothing.",
    Icon: Bell,
  },
  credits: {
    eyebrow: "Treasury",
    headline: () => "Your credits.",
    subtitle: "Balance, plans, transactions, and what every credit bought — full ledger, no surprises.",
    Icon: CreditCard,
  },
  settings: {
    eyebrow: "Preferences",
    headline: () => "Settings.",
    subtitle: "Profile details, privacy, notification cadence, security, sessions, and account controls.",
    Icon: Sliders,
  },
  developers: {
    eyebrow: "Build",
    headline: () => "Developer tools.",
    subtitle: "API keys, webhooks, usage logs, and rate-limit headroom for embedding Small Bridges.",
    Icon: Code2,
  },
  workspace: {
    eyebrow: "Team",
    headline: () => "Workspace.",
    subtitle: "Team, brand kit, billing, integrations, and analytics — deep enough to deserve its own room.",
    Icon: Briefcase,
  },
};

export default function Account() {
  usePageMeta({
    title: "Account — Small Bridges",
    description: "Profile, settings, credits, notifications, workspace.",
  });

  const { user, profile } = useAuth();
  const reducedMotion = useReducedMotion();
  const [params] = useSearchParams();

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

  const section = SECTIONS[tab];
  const liveRenderTimecode = useLiveRenderTimecode();

  const displayName =
    profile?.display_name ?? user?.email?.split("@")[0] ?? "there";

  // ── Profile gets the full-bleed cinematic treatment ─────────────────
  // No breadcrumb chrome, no "Your studio / Hello" hero — the cover
  // photo IS the page. The dashboard owns its own layout edge-to-edge.
  if (tab === "profile") {
    return (
      <FoundationShell noHeader>
        <Suspense fallback={<PanelSkeleton />}>
          <ProfileDashboard />
        </Suspense>
      </FoundationShell>
    );
  }

  return (
    <FoundationShell>
      {/* Credits' molten-orange backdrop renders at the (non-lazy) Account
          level so it's painted the instant you navigate — before the lazy
          CreditsPanel chunk loads. */}
      {tab === "credits" && <GradientBackdrop tone="orange" />}
      <div className="relative z-10 mx-auto w-full max-w-[1280px] px-4 pb-24 pt-10 sm:px-6 lg:px-10">
        <EditorialCanvas
          maxWidth="100%"
          chrome={{
            crumbs: ["Small Bridges", "account", tab],
            timecode:
              liveRenderTimecode ??
              (profile?.email ? profile.email.toUpperCase() : undefined),
          }}
        >
          {/* Adaptive hero — eyebrow + headline + sub morph per section.
              AnimatePresence so the swap feels intentional, not jumpy. */}
          <AnimatePresence mode="wait">
            <motion.header
              key={tab}
              initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={{ duration: 0.35, ease: EASE_PREMIUM }}
              className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between"
            >
              <div className="min-w-0 max-w-2xl">
                <EditorialEyebrow>{section.eyebrow}</EditorialEyebrow>
                <EditorialHeadline className="mt-5" size="lg">
                  {section.headline(displayName)}
                </EditorialHeadline>
                <p className="mt-5 max-w-xl text-[14px] font-light leading-relaxed text-muted-foreground/70">
                  {section.subtitle}
                </p>
              </div>

              {/* Section icon — large, glassy, accent-tinted */}
              <div
                className={cn(
                  "shrink-0 inline-flex h-16 w-16 items-center justify-center rounded-2xl",
                  "bg-gradient-to-br from-[hsl(var(--accent)/0.14)] via-[hsl(var(--accent)/0.05)] to-transparent",
                  "shadow-[0_20px_60px_-24px_hsl(0_0%_0%/0.7),inset_0_1px_0_hsl(0_0%_100%/0.06)]",
                  "self-end md:self-auto",
                )}
              >
                <section.Icon className="h-7 w-7 text-accent" strokeWidth={1.4} />
              </div>
            </motion.header>
          </AnimatePresence>

          {/* Hairline separator between hero and content */}
          <div className="mt-10 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          {/* Active panel — no in-page tabs; LeftRail handles navigation */}
          <div className="mt-8 min-h-[420px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                transition={{ duration: 0.42, ease: EASE_PREMIUM, delay: 0.05 }}
              >
                <Suspense fallback={<PanelSkeleton />}>
                  {(tab === "messages" || tab === "notifications") && <Navigate to={`/inbox?lane=${tab === "messages" ? "people" : "all"}`} replace />}
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
          "transition-colors hover:bg-white/[0.06]",
        )}
      >
        <Briefcase className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
        <span className="text-[13px]">Open Workspace</span>
        <ArrowRight className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
      </Link>
    </div>
  );
}
