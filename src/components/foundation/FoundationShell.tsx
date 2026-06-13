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
import { Search, Sparkles, User as UserIcon, Command } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useCredits } from "@/contexts/CreditsContext";
import { openCommandCenter } from "@/components/foundation/CommandCenter";
import { SpineBackdrop } from "@/components/foundation/SpineBackdrop";
import { LeftRail } from "@/components/foundation/LeftRail";
import { useRenderCompleteNotifier } from "@/hooks/useRenderCompleteNotifier";
import { EASE_PREMIUM, TYPE_META } from "@/lib/design-system";
import logoImage from "@/assets/small-bridges-logo.webp";

interface Props {
  children: ReactNode;
  /** Hide the top bar entirely (full-bleed surfaces). */
  bare?: boolean;
}

export function FoundationShell({ children, bare = false }: Props) {
  const { profile, user } = useAuth();
  const { balance } = useCredits();
  const location = useLocation();
  const reducedMotion = useReducedMotion();

  // Global render-complete listener: any Foundation surface gets the
  // Slack-grade toast when a film finishes. Hook is a no-op when the
  // user is signed out.
  useRenderCompleteNotifier();

  const triggerCommand = useCallback(() => openCommandCenter(), []);

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

  if (bare) return (
    <div className="relative min-h-[100dvh] text-foreground">
      <SpineBackdrop />
      <div className="relative z-10">{children}</div>
    </div>
  );

  return (
    <div className="relative min-h-[100dvh] text-foreground">
      <SpineBackdrop />
      {showRail && <LeftRail />}
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
            <img
              src={logoImage}
              alt=""
              className="h-7 w-7 rounded-md ring-1 ring-inset ring-border/30 transition-shadow group-hover:ring-accent/40"
            />
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

      <main className="relative z-10">{children}</main>
    </div>
  );
}
