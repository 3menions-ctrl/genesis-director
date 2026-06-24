/**
 * LeftRail — always-on vertical icon bar.
 *
 * A slim, permanently-pinned bar at the left edge of every
 * FoundationShell-wrapped surface. Each destination is a GIANT icon
 * tile with a small label beneath it (VS Code activity bar / Discord
 * lineage). No open/close — the bar is always present and the shell
 * reserves its width so the page sits beside it.
 *
 * Behavior:
 *   - Frosted-glass column, brand mark up top (→ Studio), scrollable
 *     stack of icon tiles in the middle, Sign out pinned at the base.
 *   - Active tile gets an accent-tinted fill + glow that glides
 *     between tiles via a shared layoutId.
 *   - Thin hairlines separate the logical groups (Make / Watch /
 *     Account) without shouting section headers.
 *   - Reduced-motion aware.
 */
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  Sparkles,
  Film,
  Scissors,
  Layers,
  Globe2,
  GraduationCap,
  Tv,
  Music2,
  Library as LibraryIcon,
  User as UserIcon,
  HelpCircle,
  Settings as SettingsIcon,
  Sliders,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { BrandTile } from "@/components/cinema/Logo";
import { SignOutDialog } from "@/components/auth/SignOutDialog";

// ─────────────────────────────────────────────────────────────────────────────
// Group catalog
// ─────────────────────────────────────────────────────────────────────────────
interface RailItem {
  to: string;
  label: string;
  /** Shorter label used under the giant icon when the full name is long. */
  short?: string;
  Icon: typeof Sparkles;
  /** Optional active matcher — defaults to startsWith(to). Use when the
   *  item should highlight on a sub-tab URL (?tab=X). */
  activePattern?: (path: string, search: string) => boolean;
}

interface RailGroup {
  id: string;
  label: string;
  Icon: typeof Sparkles;
  items: RailItem[];
}

const GROUPS: RailGroup[] = [
  {
    id: "make",
    label: "Make",
    Icon: Sparkles,
    items: [
      { to: "/studio", label: "Studio", Icon: Film },
      { to: "/editor", label: "Editor", Icon: Scissors },
      { to: "/templates", label: "Templates", Icon: Layers },
      { to: "/environments", label: "Environments", short: "Worlds", Icon: Globe2 },
      { to: "/crossover", label: "Crossover", Icon: Sparkles },
      { to: "/avatars", label: "Avatars", Icon: UserIcon },
      { to: "/training-video", label: "Training", Icon: GraduationCap },
    ],
  },
  {
    id: "watch",
    label: "Watch",
    Icon: Tv,
    items: [
      { to: "/lobby", label: "Lobby", Icon: Tv },
      { to: "/music", label: "Music", Icon: Music2 },
      { to: "/library", label: "Library", Icon: LibraryIcon },
    ],
  },
  {
    id: "account",
    label: "Account",
    Icon: UserIcon,
    items: [
      {
        to: "/account",
        label: "Profile",
        Icon: UserIcon,
        activePattern: (p, s) => p === "/account" && !s.includes("tab="),
      },
      {
        to: "/account?tab=settings",
        label: "Settings",
        Icon: Sliders,
        activePattern: (_p, s) => s.includes("tab=settings"),
      },
      {
        to: "/account?tab=developers",
        label: "Developers",
        short: "Dev",
        Icon: SettingsIcon,
        activePattern: (_p, s) => s.includes("tab=developers"),
      },
      { to: "/help", label: "Help Center", short: "Help", Icon: HelpCircle },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Active-item detection — flat scan across every group's items.
// ─────────────────────────────────────────────────────────────────────────────
function useActiveItemTo(): string {
  const location = useLocation();
  return useMemo(() => {
    const path = location.pathname;
    const search = location.search;
    let best: { to: string; score: number } | null = null;
    for (const g of GROUPS) {
      for (const item of g.items) {
        let score = 0;
        if (item.activePattern) {
          if (item.activePattern(path, search)) score = 1000;
        } else if (path === item.to) {
          score = 500 + item.to.length;
        } else if (path.startsWith(item.to + "/")) {
          score = 200 + item.to.length;
        } else if (item.to !== "/" && path.startsWith(item.to)) {
          score = 100 + item.to.length;
        }
        if (score > 0 && (!best || score > best.score)) best = { to: item.to, score };
      }
    }
    if (!best) {
      // Path aliases that don't map 1:1 to a rail route.
      if (path.startsWith("/create")) return "/studio";
      if (path.startsWith("/projects")) return "/library";
      if (path.startsWith("/watch") || path.startsWith("/r/")) return "/lobby";
      if (path.startsWith("/cast") || path.startsWith("/mascots")) return "/avatars";
      if (path.startsWith("/messages")) return "/inbox";
    }
    return best?.to ?? "";
  }, [location.pathname, location.search]);
}

// The rail remounts on every route change (FoundationShell wraps each page),
// which would reset the tile stack to the top. Persist the scroll offset in a
// module-level var so it survives remounts within the session — the rail stays
// exactly where the user left it.
let savedRailScroll = 0;

// ─────────────────────────────────────────────────────────────────────────────
// LeftRail — always-on vertical icon bar
// ─────────────────────────────────────────────────────────────────────────────
export function LeftRail() {
  const reducedMotion = useReducedMotion();
  const activeTo = useActiveItemTo();
  const { profile } = useAuth();
  void profile; // reserved for future per-account gating

  const navRef = useRef<HTMLElement | null>(null);
  // Restore the saved offset before paint so there's no visible jump to top.
  useLayoutEffect(() => {
    const el = navRef.current;
    if (el) el.scrollTop = savedRailScroll;
  }, []);
  const onNavScroll = useCallback(() => {
    if (navRef.current) savedRailScroll = navRef.current.scrollTop;
  }, []);

  return (
    <aside
      aria-label="Primary navigation"
      className="fixed top-0 left-0 z-40 h-[100dvh] w-[72px] md:w-[96px] flex flex-col"
      style={{
        backgroundColor: "hsl(220 28% 5% / 0.72)",
        backdropFilter: "blur(28px) saturate(1.5)",
        WebkitBackdropFilter: "blur(28px) saturate(1.5)",
        // Borderless: no edge hairline — just a soft depth shadow that fades the
        // rail into the page beside it.
        boxShadow: "28px 0 70px -44px hsl(0 0% 0% / 0.8)",
      }}
    >
      {/* Brand mark → Studio */}
      <Link
        to="/studio"
        aria-label="Small Bridges — Studio"
        className="shrink-0 flex items-center justify-center h-[68px] group/brand"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.05] group-hover/brand:bg-white/[0.1] transition-colors shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <BrandTile className="h-6 w-6" />
        </span>
      </Link>

      {/* Tile stack */}
      <nav
        ref={navRef}
        onScroll={onNavScroll}
        className="flex-1 overflow-y-auto scrollbar-hide px-2 pb-2"
        aria-label="Pages"
      >
        {GROUPS.map((g, gi) => (
          <div key={g.id} className={cn(gi > 0 && "mt-3")}>
            <ul className="space-y-1">
              {g.items.map((item) => (
                <li key={item.to}>
                  <RailTile item={item} active={item.to === activeTo} reducedMotion={!!reducedMotion} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Sign out pinned at the base — borderless, separated by space only. */}
      <div className="shrink-0 px-2 pb-3 pt-2">
        <SignOutDialog>
          <button
            type="button"
            aria-label="Sign out"
            className="group/out relative w-full flex flex-col items-center justify-center gap-1.5 py-2 rounded-2xl text-muted-foreground/55 hover:text-rose-200 transition-colors"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.04] group-hover/out:bg-[hsl(350_80%_55%/0.14)] transition-colors">
              <LogOut className="h-[22px] w-[22px]" strokeWidth={1.7} />
            </span>
            <span className="text-[9.5px] font-medium leading-none tracking-tight">Sign out</span>
          </button>
        </SignOutDialog>
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RailTile — one giant icon + small label beneath
// ─────────────────────────────────────────────────────────────────────────────
function RailTile({
  item,
  active,
  reducedMotion,
}: {
  item: RailItem;
  active: boolean;
  reducedMotion: boolean;
}) {
  const Icon = item.Icon;
  return (
    <Link
      to={item.to}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group/tile relative flex flex-col items-center justify-center gap-1.5 w-full py-2.5 transition-colors",
        active ? "text-foreground" : "text-muted-foreground/65 hover:text-foreground/90",
      )}
    >
      {/* Selection — a clean vertical line at the rail's edge that glides
          between tiles. No fill/bloom; the active icon carries a subtle glow. */}
      {active && (
        <motion.span
          layoutId="rail-active-line"
          aria-hidden
          className="pointer-events-none absolute left-0 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-full bg-white"
          style={{ boxShadow: "0 0 10px -1px rgba(255,255,255,0.4)" }}
          transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 32 }}
        />
      )}
      {/* Icon — borderless, no card. Active icon keeps a subtle soft glow. */}
      <span className="relative flex h-12 w-12 items-center justify-center transition-transform duration-200 group-hover/tile:scale-105">
        <Icon
          className={cn(
            "h-[26px] w-[26px] transition-colors duration-200",
            active ? "text-white" : "text-foreground/70 group-hover/tile:text-foreground",
          )}
          style={active ? { filter: "drop-shadow(0 0 6px rgba(255,255,255,0.4))" } : undefined}
          strokeWidth={active ? 2 : 1.75}
        />
      </span>
      <span className="relative max-w-full px-0.5 text-[10px] font-medium leading-tight text-center tracking-tight">
        {item.short ?? item.label}
      </span>
    </Link>
  );
}
