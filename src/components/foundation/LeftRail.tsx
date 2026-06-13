/**
 * LeftRail — adaptive collapsible left-side navigation.
 *
 * Sits at the left edge of every FoundationShell-wrapped surface (so
 * the entire authenticated app sees it). Hidden by default — a single
 * big circular glass handle on the left edge is the only visible
 * affordance. Click the handle and the pane slides in.
 *
 * Behavior:
 *   - Glassmorphic frosted-glass pane (semi-translucent white/grey,
 *     backdrop-blur-2xl, soft inner highlight, accent hairline at
 *     the right edge).
 *   - Vertically centered circular handle with a chevron that points
 *     toward the center of the page when closed and back toward the
 *     edge when open.
 *   - Adaptive: detects the current pathname, identifies which page
 *     group the route belongs to, auto-expands that group's children
 *     so the related pages are visible. Other groups stay collapsed
 *     but are clickable to expand.
 *   - Persists open/closed + per-group expansion state across reloads
 *     (localStorage keys 'smallbridges.leftrail.open' and
 *     'smallbridges.leftrail.expanded').
 *   - Reduced-motion aware: skips the slide animation, just toggles
 *     visibility.
 *   - Mobile-friendly: the pane is a fixed-position overlay; it
 *     doesn't reflow page content.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  ChevronRight,
  Sparkles,
  Film,
  Scissors,
  Layers,
  Globe2,
  GraduationCap,
  Tv,
  Music2,
  ShoppingBag,
  Library as LibraryIcon,
  CalendarDays,
  Users as UsersIcon,
  User as UserIcon,
  Mail,
  Bell,
  CreditCard,
  Briefcase,
  Search as SearchIcon,
  HelpCircle,
  Settings as SettingsIcon,
  Sliders,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE_PREMIUM, TYPE_META } from "@/lib/design-system";

// ─────────────────────────────────────────────────────────────────────────────
// Group catalog
//
// The shape of the left rail. Each group has an id, label, icon, and
// an ordered list of items. Routes are matched in priority order — the
// first group whose items prefix-match the current path is the active
// group. Sub-tab URLs (e.g. /account?tab=messages) are recognized via
// the activePattern hint so the right item highlights even when the
// route shares a parent path.
// ─────────────────────────────────────────────────────────────────────────────
interface RailItem {
  to: string;
  label: string;
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
      { to: "/environments", label: "Environments", Icon: Globe2 },
      { to: "/crossover", label: "Crossover", Icon: Sparkles },
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
      { to: "/market", label: "Market", Icon: ShoppingBag },
    ],
  },
  {
    id: "library",
    label: "Library",
    Icon: LibraryIcon,
    items: [
      { to: "/library", label: "Library", Icon: LibraryIcon },
      { to: "/me/year", label: "Year in Review", Icon: CalendarDays },
    ],
  },
  {
    id: "cast",
    label: "Cast",
    Icon: UsersIcon,
    items: [
      { to: "/cast", label: "Cast", Icon: UsersIcon },
      { to: "/avatars", label: "Avatars", Icon: UserIcon },
    ],
  },
  {
    id: "community",
    label: "Community",
    Icon: UsersIcon,
    items: [
      { to: "/crews", label: "Crews", Icon: UsersIcon },
      { to: "/search", label: "Search", Icon: SearchIcon },
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
        activePattern: (p, s) =>
          p === "/account" && !s.includes("tab="),
      },
      {
        to: "/account?tab=messages",
        label: "Inbox",
        Icon: Mail,
        activePattern: (_p, s) => s.includes("tab=messages"),
      },
      {
        to: "/account?tab=notifications",
        label: "Notifications",
        Icon: Bell,
        activePattern: (_p, s) => s.includes("tab=notifications"),
      },
      {
        to: "/account?tab=credits",
        label: "Credits",
        Icon: CreditCard,
        activePattern: (_p, s) => s.includes("tab=credits"),
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
        Icon: SettingsIcon,
        activePattern: (_p, s) => s.includes("tab=developers"),
      },
      {
        to: "/workspace",
        label: "Workspace",
        Icon: Briefcase,
        activePattern: (p, _s) => p.startsWith("/workspace"),
      },
    ],
  },
  {
    id: "help",
    label: "Help",
    Icon: HelpCircle,
    items: [{ to: "/help", label: "Help Center", Icon: HelpCircle }],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Storage helpers
// ─────────────────────────────────────────────────────────────────────────────
const OPEN_KEY = "smallbridges.leftrail.open";
const EXPANDED_KEY = "smallbridges.leftrail.expanded";

function readOpen(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(OPEN_KEY) === "1";
  } catch {
    return false;
  }
}
function writeOpen(open: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(OPEN_KEY, open ? "1" : "0");
  } catch {
    // ignore
  }
}
function readExpanded(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(EXPANDED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}
function writeExpanded(s: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(EXPANDED_KEY, JSON.stringify(Array.from(s)));
  } catch {
    // ignore
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Active-group detection
// ─────────────────────────────────────────────────────────────────────────────
function useActiveGroupId(): string {
  const location = useLocation();
  return useMemo(() => {
    const path = location.pathname;
    for (const g of GROUPS) {
      for (const item of g.items) {
        if (item.activePattern) {
          if (item.activePattern(path, location.search)) return g.id;
          continue;
        }
        // Use longest prefix match by checking from longest items
        if (path === item.to || path.startsWith(item.to + "/")) return g.id;
        if (item.to === "/library" && path.startsWith("/library")) return g.id;
      }
    }
    // Fallback by broader path prefix
    if (path.startsWith("/studio") || path.startsWith("/create")) return "make";
    if (path.startsWith("/lobby") || path.startsWith("/r/") || path.startsWith("/watch")) return "watch";
    if (path.startsWith("/library") || path.startsWith("/projects") || path.startsWith("/me")) return "library";
    if (path.startsWith("/cast") || path.startsWith("/avatars") || path.startsWith("/mascots")) return "cast";
    if (path.startsWith("/crews") || path.startsWith("/search") || path.startsWith("/creators")) return "community";
    if (path.startsWith("/account") || path.startsWith("/workspace") || path.startsWith("/settings") || path.startsWith("/profile")) return "account";
    if (path.startsWith("/help")) return "help";
    return "make";
  }, [location.pathname, location.search]);
}

function useActiveItem(): { groupId: string; itemTo: string } {
  const location = useLocation();
  const activeGroupId = useActiveGroupId();
  return useMemo(() => {
    const group = GROUPS.find((g) => g.id === activeGroupId);
    if (!group) return { groupId: activeGroupId, itemTo: "" };
    // Score each item's match quality — first by activePattern, then
    // by longest exact/prefix path.
    const path = location.pathname;
    const search = location.search;
    let best: { item: RailItem; score: number } | null = null;
    for (const item of group.items) {
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
      if (score > 0 && (!best || score > best.score)) best = { item, score };
    }
    return { groupId: activeGroupId, itemTo: best?.item.to ?? "" };
  }, [activeGroupId, location.pathname, location.search]);
}

// ─────────────────────────────────────────────────────────────────────────────
// LeftRail component
// ─────────────────────────────────────────────────────────────────────────────
export function LeftRail() {
  const reducedMotion = useReducedMotion();
  const { groupId: activeGroupId, itemTo: activeItemTo } = useActiveItem();

  const [open, setOpen] = useState(readOpen);
  const [expanded, setExpanded] = useState<Set<string>>(readExpanded);

  // Active group is always expanded — merge into the user's preference
  // without mutating it. (When the user navigates to a new group, that
  // group's items become visible without forcing them to click.)
  const effectiveExpanded = useMemo(() => {
    const s = new Set(expanded);
    s.add(activeGroupId);
    return s;
  }, [expanded, activeGroupId]);

  useEffect(() => {
    writeOpen(open);
  }, [open]);
  useEffect(() => {
    writeExpanded(expanded);
  }, [expanded]);

  // Esc closes the rail when it's open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const toggleGroup = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const PANE_WIDTH = 296;

  return (
    <>
      {/* Backdrop — gentle dim when open, click-to-close on mobile. Stays
          translucent so the user can still see the surface they're on.
          On desktop, the backdrop doesn't capture clicks outside the
          tab so the page underneath stays interactive (sm:pointer-
          events-none). On mobile the rail behaves as a true overlay. */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-[hsl(220_30%_2%/0.35)] sm:pointer-events-none sm:bg-transparent"
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Pull handle — fixed at left edge, centered vertically. Moves
          alongside the pane when open so the chevron always sits at
          the right edge of whatever's open. */}
      <motion.button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Collapse navigation" : "Expand navigation"}
        aria-expanded={open}
        initial={false}
        animate={{
          left: open ? PANE_WIDTH - 22 : -22,
        }}
        transition={
          reducedMotion
            ? { duration: 0 }
            : { type: "spring", stiffness: 260, damping: 32 }
        }
        className={cn(
          "fixed top-1/2 -translate-y-1/2 z-50",
          "h-12 w-12 rounded-full",
          "border border-white/[0.16]",
          "bg-gradient-to-br from-white/[0.16] via-white/[0.08] to-white/[0.04]",
          "backdrop-blur-2xl",
          "shadow-[0_20px_60px_-20px_hsl(0_0%_0%/0.75),0_0_0_1px_hsl(var(--accent)/0.10),inset_0_1px_0_hsl(0_0%_100%/0.20)]",
          "transition-shadow hover:shadow-[0_22px_70px_-18px_hsl(0_0%_0%/0.85),0_0_0_1px_hsl(var(--accent)/0.25),inset_0_1px_0_hsl(0_0%_100%/0.28),0_0_36px_-10px_hsl(var(--accent)/0.45)]",
          "inline-flex items-center justify-center",
          "group/handle",
        )}
      >
        {/* The chevron — points right when closed, flips to left when
            open. Animates with a tiny scale-bounce on click for a
            tactile feel. */}
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={
            reducedMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 380, damping: 28 }
          }
          className="inline-flex items-center justify-center"
        >
          {/* offset the chevron slightly to the right of center so the
              tip is visually centered (the chevron icon is asymmetric) */}
          <ChevronRight
            className="h-5 w-5 text-foreground/85 group-hover/handle:text-foreground"
            strokeWidth={1.5}
          />
        </motion.span>
      </motion.button>

      {/* The pane itself */}
      <AnimatePresence>
        {open && (
          <motion.aside
            key="leftrail-pane"
            initial={
              reducedMotion ? { opacity: 0 } : { x: -PANE_WIDTH, opacity: 0.4 }
            }
            animate={{ x: 0, opacity: 1 }}
            exit={
              reducedMotion
                ? { opacity: 0 }
                : { x: -PANE_WIDTH, opacity: 0.4 }
            }
            transition={
              reducedMotion
                ? { duration: 0 }
                : { type: "spring", stiffness: 240, damping: 30 }
            }
            style={{ width: PANE_WIDTH }}
            className={cn(
              "fixed top-0 left-0 z-40 h-[100dvh]",
              "border-r border-white/[0.10]",
              "bg-gradient-to-br from-white/[0.06] via-white/[0.03] to-[hsl(220_30%_4%/0.78)]",
              "backdrop-blur-2xl",
              "shadow-[40px_0_80px_-40px_hsl(0_0%_0%/0.6),inset_-1px_0_0_hsl(var(--accent)/0.08)]",
              "overflow-hidden",
            )}
            aria-label="Navigation"
          >
            {/* Top hairline catch-light */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent"
            />
            {/* Right-edge accent hairline */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-[hsl(var(--accent)/0.25)] to-transparent"
            />

            {/* Pane content */}
            <div className="relative flex h-full flex-col">
              {/* Header */}
              <header className="shrink-0 px-5 pt-6 pb-4">
                <span className={cn(TYPE_META, "text-muted-foreground/55")}>
                  ◆ Navigate
                </span>
                <h2
                  className="mt-2 font-display italic text-[22px] font-light leading-tight tracking-tight text-foreground"
                  style={{ fontFamily: "'Fraunces', serif" }}
                >
                  Small Bridges.
                </h2>
              </header>

              {/* Group list */}
              <nav
                className="flex-1 overflow-y-auto px-3 pb-6 scrollbar-hide"
                aria-label="Pages"
              >
                <ul className="space-y-1">
                  {GROUPS.map((g) => (
                    <li key={g.id}>
                      <GroupNode
                        group={g}
                        active={g.id === activeGroupId}
                        expanded={effectiveExpanded.has(g.id)}
                        activeItemTo={activeItemTo}
                        onToggle={() => toggleGroup(g.id)}
                        onItemClick={() => {
                          // Close pane on mobile after navigation;
                          // keep open on desktop so the user can hop
                          // around the same group.
                          if (typeof window !== "undefined" && window.innerWidth < 640) {
                            setOpen(false);
                          }
                        }}
                      />
                    </li>
                  ))}
                </ul>
              </nav>

              {/* Footer subtle hint */}
              <footer className="shrink-0 px-5 pb-5 pt-3 border-t border-white/[0.05]">
                <p className={cn(TYPE_META, "text-muted-foreground/45 flex items-center gap-2")}>
                  <span>Esc to close</span>
                  <span className="text-muted-foreground/25">·</span>
                  <span>⌘ K to search</span>
                </p>
              </footer>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GroupNode — header + nested item list
// ─────────────────────────────────────────────────────────────────────────────
function GroupNode({
  group,
  active,
  expanded,
  activeItemTo,
  onToggle,
  onItemClick,
}: {
  group: RailGroup;
  active: boolean;
  expanded: boolean;
  activeItemTo: string;
  onToggle: () => void;
  onItemClick: () => void;
}) {
  const Icon = group.Icon;
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className={cn(
          "group/grp w-full flex items-center gap-3 rounded-lg",
          "px-3 h-9 transition-colors",
          active
            ? "bg-[hsl(var(--accent)/0.06)] text-foreground"
            : "text-muted-foreground/80 hover:text-foreground hover:bg-white/[0.03]",
        )}
      >
        <Icon
          className={cn(
            "h-3.5 w-3.5 shrink-0 transition-colors",
            active ? "text-accent" : "text-muted-foreground/65 group-hover/grp:text-foreground/85",
          )}
          strokeWidth={1.5}
        />
        <span className={cn(TYPE_META, "tracking-[0.28em]")}>
          {group.label}
        </span>
        <motion.span
          animate={{ rotate: expanded ? 90 : 0 }}
          transition={{ duration: 0.25, ease: EASE_PREMIUM }}
          className="ml-auto inline-flex items-center justify-center text-muted-foreground/40"
        >
          <ChevronRight className="h-3 w-3" strokeWidth={1.5} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.ul
            key="items"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: EASE_PREMIUM }}
            className="overflow-hidden"
          >
            <div className="pt-1 pb-2 pl-4 pr-1 space-y-0.5">
              {group.items.map((i) => (
                <li key={i.to}>
                  <ItemNode
                    item={i}
                    active={i.to === activeItemTo}
                    onClick={onItemClick}
                  />
                </li>
              ))}
            </div>
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function ItemNode({
  item,
  active,
  onClick,
}: {
  item: RailItem;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.Icon;
  return (
    <Link
      to={item.to}
      onClick={onClick}
      className={cn(
        "group/item flex items-center gap-3 rounded-lg",
        "px-3 h-8 transition-colors",
        active
          ? "bg-[hsl(var(--accent)/0.12)] text-foreground ring-1 ring-inset ring-[hsl(var(--accent)/0.3)]"
          : "text-muted-foreground/80 hover:text-foreground hover:bg-white/[0.03]",
      )}
    >
      <Icon
        className={cn(
          "h-3.5 w-3.5 shrink-0 transition-colors",
          active ? "text-accent" : "text-muted-foreground/50 group-hover/item:text-foreground/85",
        )}
        strokeWidth={1.5}
      />
      <span className="text-[12.5px] tracking-tight font-light">
        {item.label}
      </span>
      {active && (
        <span className="ml-auto inline-block h-1.5 w-1.5 rounded-full bg-accent" />
      )}
    </Link>
  );
}
