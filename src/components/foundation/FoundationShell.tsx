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
import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Search, Sparkles, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useEffectiveCredits } from "@/hooks/useEffectiveCredits";
import { SpineBackdrop } from "@/components/foundation/SpineBackdrop";
import { LeftRail } from "@/components/foundation/LeftRail";
import { useRenderCompleteNotifier } from "@/hooks/useRenderCompleteNotifier";
import { NotificationBell } from "@/components/social/NotificationBell";
import { WelcomeSalutation } from "@/components/foundation/WelcomeSalutation";

interface Props {
  children: ReactNode;
  /** Hide the LeftRail too (full-bleed surfaces like the Editor). */
  bare?: boolean;
  /** Legacy — no longer renders a top bar anywhere. Kept for back-compat. */
  noHeader?: boolean;
}

export function FoundationShell({ children, bare = false, noHeader }: Props) {
  void noHeader; // no longer rendered; LeftRail + Cmd+K replace it
  const { user } = useAuth();
  // Show the SPENDABLE balance of the active wallet (org pool for business
  // workspaces, else personal available = ledger − holds). Was useCredits().balance,
  // which (a) ignored holds — disagreeing with the studio's `available` display —
  // and (b) showed personal credits even when working in an org workspace.
  const { available: balance } = useEffectiveCredits();

  // Global render-complete listener: any Foundation surface gets the
  // Slack-grade toast when a film finishes. Hook is a no-op when the
  // user is signed out.
  useRenderCompleteNotifier();

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
            className="flex h-9 w-9 items-center justify-center rounded-full backdrop-blur-xl text-foreground/80 transition-colors hover:bg-white/[0.06] hover:text-foreground"
          >
            <Search className="h-4 w-4" strokeWidth={1.6} />
          </Link>
          <Link
            to="/inbox"
            aria-label="Inbox"
            className="flex h-9 w-9 items-center justify-center rounded-full backdrop-blur-xl text-foreground/80 transition-colors hover:bg-white/[0.06] hover:text-foreground"
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
            className="group relative flex h-9 items-center gap-1.5 rounded-full px-3.5 text-white backdrop-blur-xl transition-transform duration-200 hover:-translate-y-px hover:bg-white/[0.06]"
          >
            <Sparkles className="relative h-3.5 w-3.5" style={{ color: 'hsl(var(--accent))' }} strokeWidth={1.9} />
            <span className="relative font-mono text-[12.5px] font-semibold tabular-nums">{(balance ?? 0).toLocaleString()}</span>
            <span className="relative ml-0.5 font-mono text-[8.5px] uppercase tracking-[0.18em] text-white/55">credits</span>
          </Link>
          <Link
            to="/search"
            aria-label="Search"
            className="flex h-9 w-9 items-center justify-center rounded-full backdrop-blur-xl text-foreground/80 transition-colors hover:bg-white/[0.06] hover:text-foreground"
          >
            <Search className="h-4 w-4" strokeWidth={1.6} />
          </Link>
          <Link
            to="/inbox"
            aria-label="Inbox"
            className="flex h-9 w-9 items-center justify-center rounded-full backdrop-blur-xl text-foreground/80 transition-colors hover:bg-white/[0.06] hover:text-foreground"
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
