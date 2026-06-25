/**
 * CommandCenter — the primary navigation surface.
 *
 * Glassmorphic Cmd+K menu. Replaces the legacy CommandPalette as the
 * canonical entry point for the spine (Studio · Library · Reel ·
 * Account) plus integrations (Theater · Atlas · Style Packs · Watch
 * Parties · etc.) and quick actions (New film · Sign out · Help).
 *
 * - Cmd+K (or Ctrl+K) toggles open
 * - Esc closes
 * - ↑ / ↓ navigate, Enter selects
 * - Search filters across labels + description + keywords
 * - Sections render in fixed order so muscle memory works
 * - Honors prefers-reduced-motion
 *
 * Glass language: same vocabulary as EditorialCanvas — backdrop blur,
 * inner 1px ring, gradient card fill, accent glow, corner registration
 * brackets.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Search,
  Film,
  Folder,
  User,
  Settings,
  CreditCard,
  Sparkles,
  ArrowRight,
  Wand2,
  Image as ImageIcon,
  Play,
  Compass,
  Bell,
  HelpCircle,
  LogOut,
  Tv,
  Palette,
  Bookmark,
  Scissors,
  Music2,
  Smile,
  GraduationCap,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useSafeNavigation } from "@/lib/navigation";
import { supabase } from "@/integrations/supabase/client";
import {
  EASE_PREMIUM,
  GRAIN_SVG_URL,
  CANVAS_FILL,
  SHADOW_CANVAS,
  RING_INNER,
  TYPE_EYEBROW,
  TYPE_META,
} from "@/lib/design-system";

// ─────────────────────────────────────────────────────────────────────────────
// Item model
//
// Sections mirror the AppShell rail's NAV_GROUPS so the rail and the
// modal feel like one navigation surface, not two parallel ones. Order:
//   Make    — verbs that author something
//   Watch   — surfaces for consuming films
//   Library — the user's own work
//   Cast    — characters / talent
//   Account — identity, billing, system
//   Quick   — verbs/hidden items, surfaced only via search
// ─────────────────────────────────────────────────────────────────────────────
type Section = "Make" | "Watch" | "Library" | "Cast" | "Account" | "Quick";

interface Item {
  id: string;
  label: string;
  description: string;
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  section: Section;
  keywords?: string[];
  hint?: string; // optional keyboard hint like "⌘ ⏎"
  run: (ctx: RunCtx) => void;
  hidden?: boolean; // hidden from list unless searched (easter eggs)
}

interface RunCtx {
  navigate: (path: string) => void;
  signOut: () => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Catalog — the canonical list
// ─────────────────────────────────────────────────────────────────────────────
const CATALOG: Item[] = [
  // ── MAKE — verbs that author something ──────────────────────────────
  {
    id: "studio",
    label: "Studio",
    description: "Direct a new film from a single prompt",
    Icon: Wand2,
    section: "Make",
    keywords: ["studio", "new", "create", "make", "prompt", "film", "video"],
    hint: "⌘ N",
    run: ({ navigate }) => navigate("/studio"),
  },
  {
    id: "editor",
    label: "Editor",
    description: "Trim · stitch · publish",
    Icon: Scissors,
    section: "Make",
    keywords: ["editor", "edit", "trim", "cut", "video editor", "timeline", "stitch"],
    run: ({ navigate }) => navigate("/editor"),
  },
  {
    id: "image-to-video",
    label: "Image → Video",
    description: "Animate an uploaded frame",
    Icon: ImageIcon,
    section: "Make",
    keywords: ["image", "upload", "animate"],
    run: ({ navigate }) => navigate("/studio?mode=image"),
  },
  {
    id: "style-packs",
    label: "Style Packs",
    description: "Saved looks, applied in one click",
    Icon: Palette,
    section: "Make",
    keywords: ["preset", "style", "look"],
    run: ({ navigate }) => navigate("/studio?drawer=style-packs"),
  },

  // ── WATCH — destinations for consuming films ────────────────────────
  {
    id: "lobby",
    label: "Lobby",
    description: "Today's daily sketch + community",
    Icon: Tv,
    section: "Watch",
    keywords: ["lobby", "daily", "sketch", "community", "watch", "live"],
    run: ({ navigate }) => navigate("/lobby"),
  },
  // Theater + Watch Party commands removed: their destinations
  // (/library?mode=theater, /library?open=watch-party) were never
  // implemented — Library ignores the params and renders the default
  // list, so the commands silently dead-ended. Restore them once the
  // theater/watch-party surfaces actually ship.
  {
    id: "music",
    label: "Music",
    description: "Soundtracks, beats, score",
    Icon: Music2,
    section: "Watch",
    keywords: ["music", "score", "soundtrack", "audio"],
    run: ({ navigate }) => navigate("/music"),
  },
  {
    id: "discover",
    label: "Discover",
    description: "Films from the community",
    Icon: Compass,
    section: "Watch",
    keywords: ["explore", "discover", "search", "gallery"],
    run: ({ navigate }) => navigate("/search"),
  },

  // ── LIBRARY — the user's own work ────────────────────────────────────
  {
    id: "library",
    label: "Library",
    description: "Every film you've directed",
    Icon: Folder,
    section: "Library",
    keywords: ["projects", "library", "films", "videos", "work"],
    run: ({ navigate }) => navigate("/library"),
  },
  // Atlas command removed: /library?mode=atlas was never implemented
  // (Library ignores the param). Restore when the 3D star-field ships.
  {
    id: "reel",
    label: "Recent reel",
    description: "Open your most recent film",
    Icon: Play,
    section: "Library",
    keywords: ["watch", "view", "recent", "last"],
    run: ({ navigate }) => navigate("/library?open=recent"),
  },
  {
    id: "media",
    label: "Media",
    description: "Uploads, images, audio",
    Icon: ImageIcon,
    section: "Library",
    keywords: ["media", "library", "uploads", "assets"],
    run: ({ navigate }) => navigate("/media"),
  },
  {
    id: "templates",
    label: "Templates",
    description: "Re-usable blueprints",
    Icon: Layers,
    section: "Library",
    keywords: ["template", "blueprint", "reusable"],
    run: ({ navigate }) => navigate("/templates"),
  },

  // ── CAST — characters and talent ─────────────────────────────────────
  {
    id: "avatars",
    label: "Avatars",
    description: "Cast members you've created",
    Icon: User,
    section: "Cast",
    keywords: ["avatars", "characters", "cast", "actors"],
    run: ({ navigate }) => navigate("/avatars"),
  },
  {
    id: "mascots",
    label: "Mascots",
    description: "Reusable on-brand personas",
    Icon: Smile,
    section: "Cast",
    keywords: ["mascots", "brand", "persona"],
    run: ({ navigate }) => navigate("/mascots"),
  },
  {
    id: "training",
    label: "Training",
    description: "Teach an avatar your style",
    Icon: GraduationCap,
    section: "Cast",
    keywords: ["training", "teach", "fine-tune", "model"],
    run: ({ navigate }) => navigate("/training-video"),
  },

  // ── ACCOUNT — identity, billing, system ─────────────────────────────
  {
    id: "account",
    label: "Account",
    description: "Profile · settings · credits",
    Icon: User,
    section: "Account",
    keywords: ["account", "profile", "settings", "credits", "billing", "workspace"],
    run: ({ navigate }) => navigate("/account"),
  },
  {
    id: "credits",
    label: "Credits",
    description: "Balance and plan",
    Icon: CreditCard,
    section: "Account",
    keywords: ["credits", "balance", "buy", "plan", "billing"],
    run: ({ navigate }) => navigate("/account?tab=credits"),
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Recent activity",
    Icon: Bell,
    section: "Account",
    keywords: ["notifications", "alerts", "bell"],
    run: ({ navigate }) => navigate("/notifications"),
  },
  {
    id: "settings",
    label: "Settings",
    description: "App preferences and integrations",
    Icon: Settings,
    section: "Account",
    keywords: ["settings", "preferences", "appearance"],
    run: ({ navigate }) => navigate("/account?tab=settings"),
  },
  {
    id: "help",
    label: "Help",
    description: "Guides and contact",
    Icon: HelpCircle,
    section: "Account",
    keywords: ["help", "support", "contact"],
    run: ({ navigate }) => navigate("/help"),
  },
  {
    id: "signout",
    label: "Sign out",
    description: "End this session",
    Icon: LogOut,
    section: "Account",
    keywords: ["logout", "sign out", "exit"],
    hint: "⌘ ⇧ Q",
    run: ({ signOut }) => { void signOut(); },
  },

  // ── QUICK — verbs/utilities surfaced via search ─────────────────────
  {
    id: "new-film",
    label: "New film",
    description: "Open the Studio composer",
    Icon: Sparkles,
    section: "Quick",
    keywords: ["new", "create", "+", "start"],
    hint: "⌘ N",
    run: ({ navigate }) => navigate("/studio?new=1"),
  },
  {
    id: "search",
    label: "Search films",
    description: "Find a project by title or prompt",
    Icon: Search,
    section: "Quick",
    keywords: ["search", "find"],
    run: ({ navigate }) => navigate("/search"),
  },

  // ── HIDDEN — only surface via search ────────────────────────────────
  {
    id: "loft",
    label: "The Loft",
    description: "Go to the hidden room",
    Icon: Bookmark,
    section: "Quick",
    keywords: ["loft", "hidden", "easter", "secret"],
    hidden: true,
    run: ({ navigate }) => navigate("/loft"),
  },
];

// Section render order — kept stable so muscle memory works.
const SECTION_ORDER: Section[] = ["Make", "Watch", "Library", "Cast", "Account", "Quick"];

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export const CommandCenter = memo(function CommandCenter() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { navigate } = useSafeNavigation();
  const reducedMotion = useReducedMotion();

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    navigate("/");
  }, [navigate]);

  // ── Global keyboard wiring ────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't fight a typing input.
      const target = e.target as HTMLElement | null;
      const isTyping = !!target && /input|textarea|select/i.test(target.tagName);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
        return;
      }
      // Slash opens it too (Linear-style) — only when not typing, and only as a
      // bare "/" with no modifier. The editor binds ⌘/ (Cmd/Ctrl+Slash) to its
      // Director chat; without this modifier guard, ⌘/ in the editor opened BOTH
      // Director and this global menu (two dialogs). Excluding meta/ctrl here
      // gives each "/" binding one unambiguous owner: bare "/" → CommandCenter,
      // ⌘/ → editor Director.
      if (!open && e.key === "/" && !e.metaKey && !e.ctrlKey && !isTyping) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  // Reset on open, focus the input.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIdx(0);
    // Delay focus until after the modal mounts/animates in.
    const t = window.setTimeout(() => inputRef.current?.focus(), 60);
    return () => window.clearTimeout(t);
  }, [open]);

  // ── Filtering + grouping ─────────────────────────────────────────────
  const flat = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visible = CATALOG.filter((it) => !it.hidden || q.length > 0);
    if (!q) return visible;
    return visible.filter((it) => {
      const hay = [
        it.label,
        it.description,
        it.section,
        ...(it.keywords ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [query]);

  const grouped = useMemo(() => {
    const out = new Map<Section, Item[]>();
    for (const s of SECTION_ORDER) out.set(s, []);
    for (const it of flat) out.get(it.section)?.push(it);
    return out;
  }, [flat]);

  // Keep activeIdx in range when results change.
  useEffect(() => {
    setActiveIdx((i) => Math.min(i, Math.max(0, flat.length - 1)));
  }, [flat.length]);

  // ── Keyboard navigation within the panel ─────────────────────────────
  const onPanelKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, flat.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const it = flat[activeIdx];
        if (it) {
          it.run({ navigate, signOut });
          setOpen(false);
        }
      }
    },
    [flat, activeIdx, navigate, signOut],
  );

  // Keep the active row visible as user navigates.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const row = list.querySelector<HTMLElement>(`[data-cmd-idx="${activeIdx}"]`);
    if (row) row.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  // Not signed in → don't intercept Cmd+K behavior (we still mount, but
  // the catalog is mostly account-flavored; keep available for navigation).
  void user;

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="command-center"
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4"
          initial={{ opacity: reducedMotion ? 1 : 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: EASE_PREMIUM }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          {/* Backdrop */}
          <div
            aria-hidden
            className="absolute inset-0 bg-[hsl(220_60%_4%/0.7)] backdrop-blur-md"
          />

          {/* Panel */}
          <motion.div
            initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 14, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.985 }}
            transition={{ duration: 0.28, ease: EASE_PREMIUM }}
            className={cn(
              "relative w-full max-w-[640px] overflow-hidden rounded-[28px] border border-border/40",
              CANVAS_FILL,
              "backdrop-blur-2xl",
              SHADOW_CANVAS,
            )}
            onKeyDown={onPanelKey}
            role="dialog"
            aria-label="Command Center"
          >
            {/* Grain + inner ring + corner brackets — same vocabulary as EditorialCanvas */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.025] mix-blend-overlay"
              style={{ backgroundImage: GRAIN_SVG_URL }}
            />
            <div
              aria-hidden
              className={cn("pointer-events-none absolute inset-px rounded-[27px]", RING_INNER)}
            />
            <div aria-hidden className="pointer-events-none absolute left-4 top-4 h-3 w-3 border-l border-t border-accent/40" />
            <div aria-hidden className="pointer-events-none absolute right-4 top-4 h-3 w-3 border-r border-t border-accent/40" />
            <div aria-hidden className="pointer-events-none absolute left-4 bottom-4 h-3 w-3 border-l border-b border-accent/40" />
            <div aria-hidden className="pointer-events-none absolute right-4 bottom-4 h-3 w-3 border-r border-b border-accent/40" />

            {/* Header: editorial slate */}
            <div className="relative flex items-center gap-3 border-b border-border/30 px-5 h-[60px]">
              <Search className="h-4 w-4 text-muted-foreground/50" strokeWidth={1.5} />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Direct anywhere…"
                spellCheck={false}
                autoComplete="off"
                className="flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground/40"
              />
              <span className={cn(TYPE_META, "text-muted-foreground/40")}>esc</span>
            </div>

            {/* List */}
            <div ref={listRef} className="max-h-[58vh] overflow-y-auto px-2 py-3">
              {flat.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <p className="font-light text-sm text-muted-foreground/70">
                    Nothing for &ldquo;{query}&rdquo;.
                  </p>
                  <p className="mt-1.5 text-[12px] text-muted-foreground/45">
                    Try &ldquo;new film&rdquo;, &ldquo;library&rdquo;, &ldquo;credits&rdquo;.
                  </p>
                </div>
              ) : (
                SECTION_ORDER.map((sect) => {
                  const items = grouped.get(sect) ?? [];
                  if (items.length === 0) return null;
                  return (
                    <div key={sect} className="mb-3 last:mb-1">
                      <div className={cn("px-3 pb-2 pt-2", TYPE_EYEBROW, "text-muted-foreground/45")}>
                        {sect}
                      </div>
                      <div className="space-y-0.5">
                        {items.map((it) => {
                          const idx = flat.indexOf(it);
                          const active = idx === activeIdx;
                          return (
                            <button
                              key={it.id}
                              data-cmd-idx={idx}
                              onClick={() => {
                                it.run({ navigate, signOut });
                                setOpen(false);
                              }}
                              onMouseEnter={() => setActiveIdx(idx)}
                              className={cn(
                                "group/cmd relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                                active
                                  ? "bg-[hsl(var(--accent)/0.10)] ring-1 ring-inset ring-accent/30"
                                  : "hover:bg-[hsl(var(--foreground)/0.03)]",
                              )}
                            >
                              <div
                                className={cn(
                                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset transition-colors",
                                  active
                                    ? "bg-gradient-to-br from-accent/25 to-accent/5 ring-accent/30"
                                    : "bg-[hsl(var(--foreground)/0.02)] ring-border/40",
                                )}
                              >
                                <it.Icon
                                  className={cn(
                                    "h-4 w-4 transition-colors",
                                    active ? "text-accent" : "text-muted-foreground/65",
                                  )}
                                  strokeWidth={1.5}
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-[14px] text-foreground">
                                    {it.label}
                                  </span>
                                  {it.hint && (
                                    <span className={cn(TYPE_META, "text-muted-foreground/40")}>
                                      {it.hint}
                                    </span>
                                  )}
                                </div>
                                <div className="truncate text-[12px] text-muted-foreground/60">
                                  {it.description}
                                </div>
                              </div>
                              <ArrowRight
                                className={cn(
                                  "h-3.5 w-3.5 transition-all",
                                  active
                                    ? "translate-x-0 text-accent opacity-100"
                                    : "-translate-x-1 text-muted-foreground/30 opacity-0",
                                )}
                                strokeWidth={1.5}
                              />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer: keyboard hints */}
            <div className="flex items-center justify-between gap-4 border-t border-border/30 px-5 py-2.5">
              <div className={cn("flex items-center gap-4", TYPE_META, "text-muted-foreground/45")}>
                <span>↑↓ navigate</span>
                <span>⏎ go</span>
                <span>esc close</span>
              </div>
              <div className={cn("flex items-center gap-2", TYPE_META, "text-muted-foreground/45")}>
                <span className="text-accent/70">◆</span>
                <span>command center</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
});

/**
 * Programmatic opener — for header buttons / mobile nav.
 * Fires a synthetic Cmd+K so the same code path is used.
 */
export function openCommandCenter() {
  if (typeof window === "undefined") return;
  const event = new KeyboardEvent("keydown", {
    key: "k",
    metaKey: true,
    ctrlKey: false,
    bubbles: true,
    cancelable: true,
  });
  window.dispatchEvent(event);
}
