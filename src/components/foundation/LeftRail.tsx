/**
 * LeftRail — adaptive collapsible left-side navigation.
 *
 * Sits at the left edge of every FoundationShell-wrapped surface (so
 * the entire authenticated app sees it). Hidden by default — a big
 * glass handle on the left edge is the only visible affordance.
 * Click the handle and the pane slides in. While open, the
 * FoundationShell pads its content rightward so the rail never
 * overlaps the page — page adapts to the rail.
 *
 * Behavior:
 *   - Glassmorphic frosted-glass pane (semi-translucent white/grey,
 *     backdrop-blur-2xl, soft inner highlight, accent hairline on
 *     the right edge).
 *   - Vertically centered circular handle with a fully-visible
 *     chevron that points toward the center of the page when closed
 *     and back toward the edge when open.
 *   - Adaptive: detects the current pathname, identifies which page
 *     group the route belongs to, auto-expands that group's children
 *     so the related pages are visible. Other groups stay collapsed
 *     but are clickable to expand.
 *   - Open/closed state lives in left-rail-store (external store) so
 *     FoundationShell can shift the page content in lockstep.
 *   - Per-group expansion state persists in localStorage.
 *   - Reduced-motion aware: skips the slide animation, just toggles
 *     visibility.
 *   - Mobile-friendly: the pane stays an overlay; FoundationShell's
 *     content shift only kicks in at >= md so phones don't squeeze
 *     the page into a useless sliver.
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
import { useLeftRail } from "@/hooks/useLeftRail";
import { LEFT_RAIL_WIDTH } from "@/lib/left-rail-store";
import { openCommandCenter } from "@/components/foundation/CommandCenter";

// Inline SVG grain — kills banding on the gradient backplate and gives
// the glass the same frosted-paper texture EditorialCanvas uses.
const GRAIN_URL =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.92' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.06   0 0 0 0 0.08   0 0 0 0 0.12   0 0 0 0.6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

// ─────────────────────────────────────────────────────────────────────────────
// Group catalog
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
        activePattern: (p, s) => p === "/account" && !s.includes("tab="),
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
// Per-group expansion persistence (separate from open/closed state)
// ─────────────────────────────────────────────────────────────────────────────
const EXPANDED_KEY = "smallbridges.leftrail.expanded";

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
        if (path === item.to || path.startsWith(item.to + "/")) return g.id;
        if (item.to === "/library" && path.startsWith("/library")) return g.id;
      }
    }
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
// LeftRail
// ─────────────────────────────────────────────────────────────────────────────
const HANDLE_SIZE = 56; // bigger, more present
const HANDLE_OFFSET_CLOSED = 14; // fully on-screen, breathing room from edge

export function LeftRail() {
  const reducedMotion = useReducedMotion();
  const { groupId: activeGroupId, itemTo: activeItemTo } = useActiveItem();
  const { open, setOpen, toggle } = useLeftRail();
  const [expanded, setExpanded] = useState<Set<string>>(readExpanded);

  const effectiveExpanded = useMemo(() => {
    const s = new Set(expanded);
    s.add(activeGroupId);
    return s;
  }, [expanded, activeGroupId]);

  useEffect(() => {
    writeExpanded(expanded);
  }, [expanded]);

  // Esc closes the rail while it's open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  const toggleGroup = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Handle position math — fully on-screen at all times.
  // Closed: HANDLE_OFFSET_CLOSED from the left edge.
  // Open: tucked to the right edge of the pane so it always sits at
  // the boundary the user just opened.
  const handleLeft = open
    ? LEFT_RAIL_WIDTH - HANDLE_SIZE / 2
    : HANDLE_OFFSET_CLOSED;

  return (
    <>
      {/* Backdrop — gentle dim on mobile so the page underneath gets
          out of the way. Desktop keeps the page interactive. */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-[hsl(220_30%_2%/0.35)] md:pointer-events-none md:bg-transparent"
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Pull handle — fully on-screen at every state, BIG and unmissable. */}
      <motion.button
        type="button"
        onClick={toggle}
        aria-label={open ? "Collapse navigation" : "Expand navigation"}
        aria-expanded={open}
        initial={false}
        animate={{ left: handleLeft }}
        transition={
          reducedMotion
            ? { duration: 0 }
            : { type: "spring", stiffness: 260, damping: 32 }
        }
        style={{ width: HANDLE_SIZE, height: HANDLE_SIZE }}
        className={cn(
          "fixed top-1/2 -translate-y-1/2 z-50",
          "rounded-full",
          "border border-white/[0.18]",
          "bg-gradient-to-br from-white/[0.18] via-white/[0.10] to-white/[0.05]",
          "backdrop-blur-2xl",
          "shadow-[0_24px_70px_-18px_hsl(0_0%_0%/0.85),0_0_0_1px_hsl(var(--accent)/0.14),inset_0_1px_0_hsl(0_0%_100%/0.24),0_0_40px_-12px_hsl(var(--accent)/0.40)]",
          "transition-shadow",
          "hover:shadow-[0_28px_80px_-16px_hsl(0_0%_0%/0.9),0_0_0_1px_hsl(var(--accent)/0.35),inset_0_1px_0_hsl(0_0%_100%/0.32),0_0_60px_-12px_hsl(var(--accent)/0.7)]",
          "inline-flex items-center justify-center",
          "group/handle",
        )}
      >
        {/* Inner ring — gives the handle a clear visual "edge" */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-1 rounded-full ring-1 ring-inset ring-white/[0.06]"
        />
        {/* Chevron — large, accent-colored on hover, rotates 180° when open */}
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={
            reducedMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 380, damping: 28 }
          }
          className="relative inline-flex items-center justify-center"
        >
          <ChevronRight
            className="h-7 w-7 text-foreground/95 group-hover/handle:text-accent transition-colors"
            strokeWidth={2.2}
          />
        </motion.span>
      </motion.button>

      {/* The pane itself */}
      <AnimatePresence>
        {open && (
          <motion.aside
            key="leftrail-pane"
            initial={
              reducedMotion
                ? { opacity: 0 }
                : { x: -LEFT_RAIL_WIDTH, opacity: 0.4 }
            }
            animate={{ x: 0, opacity: 1 }}
            exit={
              reducedMotion
                ? { opacity: 0 }
                : { x: -LEFT_RAIL_WIDTH, opacity: 0.4 }
            }
            transition={
              reducedMotion
                ? { duration: 0 }
                : { type: "spring", stiffness: 240, damping: 30 }
            }
            style={{ width: LEFT_RAIL_WIDTH }}
            className={cn(
              "fixed top-0 left-0 z-40 h-[100dvh]",
              "border-r border-white/[0.10]",
              "bg-gradient-to-br from-white/[0.07] via-white/[0.03] to-[hsl(220_30%_4%/0.78)]",
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

            {/* Premium texture pass — diagonal glass reflection +
                fractal grain. Both sit beneath the content so they
                read as part of the glass, not a layered effect. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-40 mix-blend-overlay"
              style={{
                background:
                  "linear-gradient(135deg, hsl(0 0% 100% / 0.10) 0%, transparent 30%, transparent 70%, hsl(0 0% 100% / 0.03) 100%)",
              }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.22] mix-blend-overlay"
              style={{ backgroundImage: GRAIN_URL }}
            />

            <div className="relative flex h-full flex-col">
              {/* Header — eyebrow + italic display + "you are here" badge */}
              <header className="shrink-0 px-6 pt-8 pb-5">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inset-0 rounded-full bg-accent/60 animate-ping opacity-60" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
                  </span>
                  <span
                    className={cn(
                      TYPE_META,
                      "text-muted-foreground/60 tracking-[0.32em]",
                    )}
                  >
                    ◆ Navigate
                  </span>
                </div>
                <h2
                  className="mt-3 font-display italic text-[28px] font-light leading-[1.05] tracking-tight"
                  style={{ fontFamily: "'Fraunces', serif" }}
                >
                  <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/65 bg-clip-text text-transparent">
                    Small Bridges.
                  </span>
                </h2>
                <p
                  className={cn(
                    TYPE_META,
                    "mt-2 text-muted-foreground/45 tracking-[0.22em]",
                  )}
                >
                  You are in ·{" "}
                  <span className="text-accent/85">
                    {GROUPS.find((g) => g.id === activeGroupId)?.label ??
                      "Studio"}
                  </span>
                </p>
              </header>

              {/* Decorative hairline above the nav */}
              <div className="mx-6 h-px bg-gradient-to-r from-transparent via-white/[0.10] to-transparent" />

              {/* Group list */}
              <nav
                className="flex-1 overflow-y-auto px-3 pt-3 pb-5 scrollbar-hide"
                aria-label="Pages"
              >
                <ul className="space-y-2">
                  {GROUPS.map((g, gi) => (
                    <li key={g.id}>
                      {gi > 0 && (
                        <div
                          aria-hidden
                          className="mx-3 mb-2 h-px bg-gradient-to-r from-transparent via-white/[0.04] to-transparent"
                        />
                      )}
                      <GroupNode
                        group={g}
                        active={g.id === activeGroupId}
                        expanded={effectiveExpanded.has(g.id)}
                        activeItemTo={activeItemTo}
                        onToggle={() => toggleGroup(g.id)}
                        onItemClick={() => {
                          if (
                            typeof window !== "undefined" &&
                            window.innerWidth < 768
                          ) {
                            setOpen(false);
                          }
                        }}
                      />
                    </li>
                  ))}
                </ul>
              </nav>

              {/* Footer — Cmd+K search button + version pin */}
              <footer className="shrink-0 border-t border-white/[0.06] px-3 pb-4 pt-3">
                <button
                  type="button"
                  onClick={() => openCommandCenter()}
                  className={cn(
                    "group/cmd w-full flex items-center gap-3 rounded-xl",
                    "px-3.5 h-11 transition-all",
                    "border border-white/[0.07] bg-white/[0.02]",
                    "hover:border-accent/40 hover:bg-[hsl(var(--accent)/0.05)]",
                  )}
                >
                  <SearchIcon
                    className="h-4 w-4 text-muted-foreground/65 group-hover/cmd:text-accent transition-colors"
                    strokeWidth={1.5}
                  />
                  <span className="text-[13px] text-muted-foreground/75 group-hover/cmd:text-foreground transition-colors">
                    Search & jump…
                  </span>
                  <span
                    className={cn(
                      "ml-auto flex items-center gap-1 px-1.5 py-0.5 rounded",
                      "bg-white/[0.04] border border-white/[0.06]",
                      "font-mono text-[10px] tabular-nums text-muted-foreground/55",
                    )}
                  >
                    <span>⌘</span>
                    <span>K</span>
                  </span>
                </button>
                <p
                  className={cn(
                    TYPE_META,
                    "mt-3 px-1 text-muted-foreground/35 flex items-center justify-between",
                  )}
                >
                  <span>Small Bridges · v2.0</span>
                  <span className="tabular-nums">Esc · close</span>
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
// GroupNode
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
      <motion.button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        whileHover={{ x: 2 }}
        whileTap={{ scale: 0.99 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className={cn(
          "group/grp relative w-full flex items-center gap-3 rounded-xl",
          "px-4 h-12 overflow-hidden",
          "transition-colors",
          active
            ? "text-foreground"
            : "text-muted-foreground/80 hover:text-foreground",
        )}
      >
        {/* Soft gradient bleed for active groups — a luminous backdrop
            instead of a flat color block. Sits behind the content. */}
        {active && (
          <motion.span
            layoutId="rail-active-group-glow"
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-xl"
            style={{
              background:
                "linear-gradient(90deg, hsl(var(--accent) / 0.16) 0%, hsl(var(--accent) / 0.06) 45%, transparent 100%)",
            }}
            transition={{
              type: "spring",
              stiffness: 380,
              damping: 32,
            }}
          />
        )}
        {/* Hover tint */}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 group-hover/grp:opacity-100",
            "bg-white/[0.04]",
          )}
        />

        {/* Icon chip — active items get a subtle backdrop tint */}
        <span
          className={cn(
            "relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors",
            active
              ? "bg-[hsl(var(--accent)/0.14)] ring-1 ring-inset ring-[hsl(var(--accent)/0.32)]"
              : "bg-white/[0.025]",
          )}
        >
          <Icon
            className={cn(
              "h-4 w-4 transition-colors",
              active
                ? "text-accent"
                : "text-muted-foreground/70 group-hover/grp:text-foreground/95",
            )}
            strokeWidth={1.5}
          />
        </span>

        <span className="relative font-mono text-[12px] uppercase tracking-[0.30em]">
          {group.label}
        </span>

        <motion.span
          animate={{ rotate: expanded ? 90 : 0 }}
          transition={{ duration: 0.25, ease: EASE_PREMIUM }}
          className={cn(
            "relative ml-auto inline-flex items-center justify-center transition-colors",
            active ? "text-accent/85" : "text-muted-foreground/45",
          )}
        >
          <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
        </motion.span>
      </motion.button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.ul
            key="items"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.32, ease: EASE_PREMIUM }}
            className="overflow-hidden"
          >
            <div className="relative pt-1.5 pb-2 pl-3 pr-1 space-y-0.5">
              {/* Indent guide rail — subtle vertical line that pairs
                  the items with their parent group */}
              <div
                aria-hidden
                className="pointer-events-none absolute left-[26px] top-0 bottom-1 w-px bg-gradient-to-b from-transparent via-white/[0.06] to-transparent"
              />
              {group.items.map((i, ii) => (
                <motion.li
                  key={i.to}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    delay: 0.04 + ii * 0.025,
                    duration: 0.32,
                    ease: EASE_PREMIUM,
                  }}
                >
                  <ItemNode
                    item={i}
                    active={i.to === activeItemTo}
                    onClick={onItemClick}
                  />
                </motion.li>
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
        "group/item relative flex items-center gap-3 rounded-lg",
        "pl-5 pr-3 h-11 overflow-hidden",
        "transition-colors duration-300",
        active
          ? "text-foreground"
          : "text-muted-foreground/85 hover:text-foreground",
      )}
    >
      {/* Vertical accent bar — slides between items via layoutId.
          Only renders for the active item so the layoutId pairs and
          framer-motion animates the transition. */}
      {active && (
        <motion.span
          layoutId="rail-active-item-bar"
          className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full bg-accent"
          style={{
            boxShadow:
              "0 0 14px hsl(var(--accent) / 0.55), 0 0 28px hsl(var(--accent) / 0.25)",
          }}
          transition={{
            type: "spring",
            stiffness: 420,
            damping: 32,
          }}
        />
      )}
      {/* Soft accent backdrop for active item */}
      {active && (
        <motion.span
          layoutId="rail-active-item-glow"
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-lg"
          style={{
            background:
              "linear-gradient(90deg, hsl(var(--accent) / 0.14) 0%, hsl(var(--accent) / 0.04) 60%, transparent 100%)",
          }}
          transition={{
            type: "spring",
            stiffness: 380,
            damping: 32,
          }}
        />
      )}
      {/* Hover tint */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 rounded-lg opacity-0 transition-opacity duration-300 group-hover/item:opacity-100",
          "bg-white/[0.03]",
        )}
      />

      <Icon
        className={cn(
          "relative h-4 w-4 shrink-0 transition-colors",
          active
            ? "text-accent"
            : "text-muted-foreground/60 group-hover/item:text-foreground/95",
        )}
        strokeWidth={1.5}
      />
      <span
        className={cn(
          "relative text-[14px] tracking-tight transition-[font-weight] duration-300",
          active ? "font-normal" : "font-light",
        )}
      >
        {item.label}
      </span>
    </Link>
  );
}
