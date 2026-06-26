/**
 * FoundationShell — the canonical app shell for spine surfaces.
 *
 * Replaces a sidebar with a single editorial top bar. Navigation is
 * routed through the <CommandCenter/> (Cmd+K). The shell itself owns:
 *
 *   - Brand mark + wordmark (left)
 *   - "Direct anywhere" command trigger (center / right depending on size)
 *   - Credits chip (right)
 *   - Avatar / account button (right, opens Command Center to Account)
 *
 * Glass language matches EditorialCanvas — backdrop blur, hairline
 * border, gradient card fill, mono editorial labels.
 *
 * Mobile: collapses to (logo · command trigger). The trigger opens
 * Command Center which IS the mobile menu.
 *
 * Reduced-motion aware.
 */
import { type ReactNode, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Search, Sparkles, User as UserIcon, Command, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { IS_MOBILE_SHELL } from "@/lib/native";
import { useAuth } from "@/contexts/AuthContext";
import { useEffectiveCredits } from "@/hooks/useEffectiveCredits";
import { openCommandCenter } from "@/components/foundation/CommandCenter";
import { SpineBackdrop } from "@/components/foundation/SpineBackdrop";
import { LeftRail } from "@/components/foundation/LeftRail";
import { useRenderCompleteNotifier } from "@/hooks/useRenderCompleteNotifier";
import { NotificationBell } from "@/components/social/NotificationBell";
import { WelcomeSalutation } from "@/components/foundation/WelcomeSalutation";
import { EASE_PREMIUM, TYPE_META } from "@/lib/design-system";
import { BrandTile } from "@/components/cinema/Logo";

interface Props {
  children: ReactNode;
  /** Hide the LeftRail too (full-bleed surfaces like the Editor). */
  bare?: boolean;
  /** Legacy — no longer renders a top bar anywhere. Kept for back-compat. */
  noHeader?: boolean;
}

export function FoundationShell({ children, bare = false, noHeader }: Props) {
  void noHeader; // no longer rendered; LeftRail + Cmd+K replace it
  const { profile, user } = useAuth();
  // Show the SPENDABLE balance of the active wallet (org pool for business
  // workspaces, else personal available = ledger − holds). Was useCredits().balance,
  // which (a) ignored holds — disagreeing with the studio's `available` display —
  // and (b) showed personal credits even when working in an org workspace.
  const { available: balance } = useEffectiveCredits();
  const location = useLocation();
  const reducedMotion = useReducedMotion();

  // Global render-complete listener: any Foundation surface gets the
  // Slack-grade toast when a film finishes. Hook is a no-op when the
  // user is signed out.
  useRenderCompleteNotifier();

  const triggerCommand = useCallback(() => openCommandCenter(), []);

  // NATIVE APP: never render web chrome (LeftRail, top bar, command center
  // trigger, credits/search/inbox cluster). The native app must only ever show
  // page CONTENT — navigation is the bottom tab bar + native screens. Any web
  // route reached on iOS (Studio, Editor, Account, …) renders content-only.
  if (IS_MOBILE_SHELL) return <main className="relative min-h-[100dvh] text-foreground">{children}</main>;

  // Tab name for the slate breadcrumb in the header chrome.
  const breadcrumb = (() => {
    const p = location.pathname;
    if (p.startsWith("/studio")) return "studio";
    if (p.startsWith("/library") || p.startsWith("/projects")) return "library";
    if (p.startsWith("/r/") || p.startsWith("/reel")) return "reel";
    if (p.startsWith("/account") || p.startsWith("/profile") || p.startsWith("/settings")) return "account";
    if (p === "/" || p === "") return "landing";
    return p.replace(/^\//, "").split("/")[0];
  })();

  // Show the LeftRail on every Foundation surface — but only when the
  // user is signed in. Public/marketing surfaces don't have somewhere
  // to navigate to in this rail. Bare mode (Editor) also skips the
  // rail since the timeline is full-bleed and the rail would overlap
  // tool palettes.
  const showRail = !!user;

  // The LeftRail is now an always-on icon bar, so the shell permanently
  // reserves its width and the page sits beside it. Width is kept in sync
  // with the <aside> in LeftRail.tsx (72px phone / 96px md+).

  if (bare) return (
    <div className="relative min-h-[100dvh] text-foreground">
      <SpineBackdrop />
      <div className="relative z-10">{children}</div>
      {/* Bell — present even on bare surfaces (the Editor) so render-
          done / mention / support reply is always one click away. We
          sit just under the modals (z-100) and the Editor's mid-page
          panels (z-40), so toolbars stay on top while the bell remains
          reachable from the top-right corner. */}
      {user && (
        <div className="fixed top-2 right-3 z-[60] flex items-center gap-2">
          <Link
            to="/search"
            aria-label="Search"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.10] bg-[hsl(220_30%_6%/0.55)] backdrop-blur-xl text-foreground/80 transition-colors hover:border-accent/40 hover:text-foreground"
          >
            <Search className="h-4 w-4" strokeWidth={1.6} />
          </Link>
          <Link
            to="/inbox"
            aria-label="Inbox"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.10] bg-[hsl(220_30%_6%/0.55)] backdrop-blur-xl text-foreground/80 transition-colors hover:border-accent/40 hover:text-foreground"
          >
            <Inbox className="h-4 w-4" strokeWidth={1.6} />
          </Link>
          <NotificationBell />
        </div>
      )}
      {user && <WelcomeSalutation />}
    </div>
  );

  return (
    <div className="relative min-h-[100dvh] text-foreground">
      <SpineBackdrop />
      {showRail && <LeftRail />}
      {/* Content wrapper — always reserves the icon bar's width so the
          page sits beside it (the bar is permanently pinned). Width
          matches the <aside> in LeftRail.tsx. */}
      <div
        className={cn(
          "relative",
          showRail && "pl-[72px] md:pl-[96px]",
        )}
      >
      {false && (
      <motion.header
        initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE_PREMIUM }}
        className={cn(
          "sticky top-0 z-40 w-full",
          "border-b border-border/30",
          "backdrop-blur-2xl",
          "bg-[hsl(220_30%_4%/0.6)]",
        )}
      >
        <div className="mx-auto flex h-14 max-w-[1680px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          {/* ── Brand mark ───────────────────────────────────────────── */}
          <Link
            to="/"
            className="group flex items-center gap-2.5"
            aria-label="Small Bridges — home"
          >
            <BrandTile className="h-7 w-7" />
            <span className="hidden sm:flex items-center gap-2">
              <span className="font-display text-[15px] font-light tracking-tight">
                Small Bridges
              </span>
              <span className={cn(TYPE_META, "text-muted-foreground/40")}>
                · {breadcrumb}
              </span>
            </span>
          </Link>

          {/* ── Command trigger (the heart of the shell) ────────────── */}
          <button
            type="button"
            onClick={triggerCommand}
            aria-label="Open Command Center (Cmd+K)"
            className={cn(
              "group/cmd ml-auto flex h-9 min-w-[200px] items-center gap-2.5 rounded-full",
              "border border-border/40 bg-[hsl(var(--foreground)/0.025)]",
              "px-3 transition-all",
              "hover:border-accent/40 hover:bg-[hsl(var(--accent)/0.06)]",
              "sm:min-w-[280px] md:min-w-[360px]",
            )}
          >
            <Search className="h-3.5 w-3.5 text-muted-foreground/60 group-hover/cmd:text-accent" strokeWidth={1.5} />
            <span className="flex-1 truncate text-left text-[13px] text-muted-foreground/70 group-hover/cmd:text-foreground/90">
              Direct anywhere…
            </span>
            <span
              className={cn(
                "hidden items-center gap-1 sm:flex",
                TYPE_META,
                "text-muted-foreground/45 group-hover/cmd:text-accent/80",
              )}
            >
              <Command className="h-3 w-3" strokeWidth={1.5} />
              <span>K</span>
            </span>
          </button>

          {/* ── Right cluster ───────────────────────────────────────── */}
          <div className="ml-2 flex items-center gap-2">
            {user && (
              <button
                type="button"
                onClick={triggerCommand}
                className={cn(
                  "hidden md:flex items-center gap-1.5 rounded-full",
                  "border border-border/40 bg-[hsl(var(--foreground)/0.02)]",
                  "px-3 h-9 transition-colors",
                  "hover:border-accent/40 hover:bg-[hsl(var(--accent)/0.05)]",
                )}
                aria-label={`Credits: ${balance ?? 0}`}
              >
                <Sparkles className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
                <span className="font-mono text-[12px] tabular-nums text-foreground/85">
                  {(balance ?? 0).toLocaleString()}
                </span>
              </button>
            )}

            {user ? (
              <button
                type="button"
                onClick={triggerCommand}
                aria-label="Account"
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full",
                  "border border-border/40 bg-[hsl(var(--foreground)/0.02)]",
                  "transition-colors hover:border-accent/40 hover:bg-[hsl(var(--accent)/0.05)]",
                )}
              >
                {profile?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatar_url}
                    alt=""
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  <UserIcon className="h-4 w-4 text-muted-foreground/70" strokeWidth={1.5} />
                )}
              </button>
            ) : (
              <Link
                to="/auth"
                className={cn(
                  "rounded-full border border-accent/40 bg-[hsl(var(--accent)/0.08)] px-4 h-9",
                  "inline-flex items-center gap-1.5 text-[13px] text-foreground",
                  "transition-colors hover:bg-[hsl(var(--accent)/0.15)]",
                )}
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </motion.header>
      )}

      <main className="relative z-10">{children}</main>
      </div>
      {/* Top-right cluster — a single Search icon + the NotificationBell.
          Visible on every authenticated Foundation surface; sits above
          page chrome but under modals (z-100) and the LeftRail handle. */}
      {user && (
        <div className="fixed top-3 right-4 z-50 flex items-center gap-2">
          {/* Credit balance — highlighted, accent-glow pill; taps to the ledger. */}
          <Link
            to="/account?tab=credits"
            aria-label={`Credits: ${balance ?? 0}`}
            className="group relative flex h-9 items-center gap-1.5 rounded-full px-3.5 text-white backdrop-blur-xl transition-transform duration-200 hover:-translate-y-px"
            style={{ background: 'hsl(var(--accent) / 0.14)', boxShadow: 'inset 0 0 0 1px hsl(var(--accent) / 0.5), 0 10px 28px -12px hsl(var(--accent) / 0.85)' }}
          >
            <span aria-hidden className="pointer-events-none absolute -inset-1 rounded-full opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-100" style={{ background: 'hsl(var(--accent) / 0.3)' }} />
            <Sparkles className="relative h-3.5 w-3.5" style={{ color: 'hsl(var(--accent))' }} strokeWidth={1.9} />
            <span className="relative font-mono text-[12.5px] font-semibold tabular-nums">{(balance ?? 0).toLocaleString()}</span>
            <span className="relative ml-0.5 font-mono text-[8.5px] uppercase tracking-[0.18em] text-white/55">credits</span>
          </Link>
          <Link
            to="/search"
            aria-label="Search"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.10] bg-[hsl(220_30%_6%/0.55)] backdrop-blur-xl text-foreground/80 transition-colors hover:border-accent/40 hover:text-foreground"
          >
            <Search className="h-4 w-4" strokeWidth={1.6} />
          </Link>
          <Link
            to="/inbox"
            aria-label="Inbox"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.10] bg-[hsl(220_30%_6%/0.55)] backdrop-blur-xl text-foreground/80 transition-colors hover:border-accent/40 hover:text-foreground"
          >
            <Inbox className="h-4 w-4" strokeWidth={1.6} />
          </Link>
          <NotificationBell />
        </div>
      )}
      {user && <WelcomeSalutation />}
    </div>
  );
}
