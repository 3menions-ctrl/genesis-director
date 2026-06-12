/**
 * AdminPalette — Cmd+K command palette for the admin shell.
 *
 * Keystone of the consolidated admin: rather than scrolling a 45-item left
 * rail, the operator hits ⌘K and lands directly on the right user, project,
 * org, or hub view. Search hits `admin_search_entities` (RPC) for entity
 * matches, then layers in a static list of hub destinations and actions.
 *
 * Behavior:
 *   • ⌘K / Ctrl+K toggles open from anywhere inside /admin
 *   • Type to search across users / projects / orgs (200ms debounce)
 *   • ↑/↓ to navigate, Enter to activate, Esc to close
 *   • Recents are remembered across reloads (localStorage)
 *   • Closes on selection; deep-link supported via React Router navigate
 *
 * Visuals: 640px translucent glass card centered above a heavy backdrop,
 * brand rail on the leading edge, mono eyebrow, premium accent on focused
 * row. Stays calm — no aggressive animation, no glitter.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, Users, FolderKanban, Building2, ArrowRight, Activity,
  Sparkles, ShieldCheck, Clock as ClockIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type ResultKind = "user" | "project" | "org" | "hub" | "action";
interface PaletteResult {
  kind: ResultKind;
  id: string;
  label: string;
  sub?: string;
  avatar?: string | null;
  thumbnail?: string | null;
  to?: string;
  perform?: () => void | Promise<void>;
}

const HUB_DESTINATIONS: PaletteResult[] = [
  { kind: "hub", id: "hub:dashboard",  label: "Dashboard",  sub: "Pulse · daily action cards",    to: "/admin" },
  { kind: "hub", id: "hub:people",     label: "People",     sub: "Users · sessions · roles · GDPR · abuse", to: "/admin/people" },
  { kind: "hub", id: "hub:production", label: "Production", sub: "Projects · queue · providers · edge logs", to: "/admin/production-hub" },
  { kind: "hub", id: "hub:money",      label: "Money",      sub: "Subscriptions · refunds · coupons · ledger", to: "/admin/money" },
  { kind: "hub", id: "hub:growth",     label: "Growth",     sub: "Analytics · experiments · flags · announcements", to: "/admin/growth" },
  { kind: "hub", id: "hub:system",     label: "System",     sub: "API keys · webhooks · secrets · backups", to: "/admin/system" },
];

const ACTION_DESTINATIONS: PaletteResult[] = [
  { kind: "action", id: "act:audit",   label: "Open audit log",      sub: "Every admin action, signed", to: "/admin/audit" },
  { kind: "action", id: "act:edge",    label: "Open edge logs",      sub: "Last 1k function invocations", to: "/admin/edge-logs" },
  { kind: "action", id: "act:queue",   label: "Open render queue",   sub: "In-flight + failed jobs", to: "/admin/queue" },
  { kind: "action", id: "act:flags",   label: "Toggle feature flags", sub: "Per-cohort rollout controls", to: "/admin/feature-flags" },
  { kind: "action", id: "act:roles",   label: "Manage admin roles",   sub: "Grant or revoke admin scope", to: "/admin/roles" },
];

const RECENT_KEY = "admin.palette.recents.v1";

function useRecents() {
  const [recents, setRecents] = useState<PaletteResult[]>(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as PaletteResult[];
    } catch { return []; }
  });
  const push = useCallback((r: PaletteResult) => {
    setRecents((prev) => {
      const without = prev.filter((p) => p.id !== r.id);
      const next = [r, ...without].slice(0, 8);
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);
  return { recents, push };
}

function entityIcon(k: ResultKind) {
  switch (k) {
    case "user":    return Users;
    case "project": return FolderKanban;
    case "org":     return Building2;
    case "hub":     return Sparkles;
    case "action":  return Activity;
  }
}

function entityRoute(r: PaletteResult): string {
  if (r.to) return r.to;
  switch (r.kind) {
    case "user":    return `/admin/users/${r.id}`;
    case "project": return `/admin/projects/${r.id}`;
    case "org":     return `/admin/orgs/${r.id}`;
    default:        return "/admin";
  }
}

export function AdminPalette() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PaletteResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(0);
  const { recents, push: pushRecent } = useRecents();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Global Cmd+K binding.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Focus the input every time the palette opens.
  useEffect(() => {
    if (open) {
      setQ("");
      setCursor(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Debounced entity search.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc("admin_search_entities" as never, {
          p_query: q, p_limit: 6,
        } as never);
        if (cancelled) return;
        if (error) throw error;
        const bundle = data as unknown as { users?: PaletteResult[]; projects?: PaletteResult[]; orgs?: PaletteResult[] };
        const flat: PaletteResult[] = [
          ...(bundle?.users ?? []),
          ...(bundle?.projects ?? []),
          ...(bundle?.orgs ?? []),
        ];
        setResults(flat);
      } catch (e) {
        if (!cancelled) console.warn("[AdminPalette] search failed", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 180);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q, open]);

  // Compose the visible list — entity results merged with hub/action items
  // when query is empty or matches their labels.
  const visible = useMemo<PaletteResult[]>(() => {
    const ql = q.trim().toLowerCase();
    const hubs = ql
      ? HUB_DESTINATIONS.filter((h) => h.label.toLowerCase().includes(ql) || h.sub?.toLowerCase().includes(ql))
      : HUB_DESTINATIONS;
    const actions = ql
      ? ACTION_DESTINATIONS.filter((a) => a.label.toLowerCase().includes(ql) || a.sub?.toLowerCase().includes(ql))
      : ACTION_DESTINATIONS;
    return [...results, ...hubs, ...actions];
  }, [results, q]);

  // Keep cursor in range as visible items shrink.
  useEffect(() => {
    if (cursor >= visible.length) setCursor(Math.max(0, visible.length - 1));
  }, [visible.length, cursor]);

  const activate = useCallback((r: PaletteResult) => {
    pushRecent({ ...r });
    setOpen(false);
    if (r.perform) {
      void r.perform();
    } else {
      navigate(entityRoute(r));
    }
  }, [navigate, pushRecent]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, visible.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = visible[cursor];
      if (r) activate(r);
    }
  };

  // Keep the focused row scrolled into view.
  useEffect(() => {
    const focused = listRef.current?.querySelector<HTMLElement>(`[data-cursor="${cursor}"]`);
    focused?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Admin command palette"
      className="fixed inset-0 z-[120] flex items-start justify-center pt-[12vh] pointer-events-auto"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={() => setOpen(false)}
      />

      {/* Card */}
      <div
        className="relative w-[640px] max-w-[92vw] rounded-2xl border border-white/[0.08] bg-background/95 backdrop-blur-2xl overflow-hidden shadow-[0_60px_120px_-30px_rgba(0,0,0,0.95)] animate-fade-in-up"
      >
        {/* Brand rail */}
        <span
          aria-hidden
          className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-[#0A84FF]/60 to-transparent"
        />

        {/* Search bar */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.05]">
          <Search className="w-4 h-4 text-white/40 shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setCursor(0); }}
            onKeyDown={onKeyDown}
            placeholder="Search users, projects, orgs, or jump to a hub…"
            className="flex-1 bg-transparent outline-none text-[15px] text-white placeholder:text-white/30 font-light"
            spellCheck={false}
            autoComplete="off"
          />
          {loading ? (
            <span className="text-[10px] text-white/40 font-mono uppercase tracking-[0.24em] animate-pulse">
              Searching…
            </span>
          ) : (
            <kbd className="text-[10px] text-white/30 font-mono px-1.5 py-0.5 rounded border border-white/[0.08]">
              Esc
            </kbd>
          )}
        </div>

        {/* Recents (only when query is empty) */}
        {!q && recents.length > 0 && (
          <div className="px-5 pt-4 pb-2">
            <div className="text-[9px] font-mono uppercase tracking-[0.32em] text-white/30 mb-2 flex items-center gap-2">
              <ClockIcon className="w-3 h-3" /> Recently visited
            </div>
            <div className="flex flex-wrap gap-1.5">
              {recents.map((r) => {
                const Icon = entityIcon(r.kind);
                return (
                  <button
                    key={r.id}
                    onClick={() => activate(r)}
                    className="group flex items-center gap-2 px-2.5 py-1 rounded-full bg-glass border border-white/[0.06] hover:border-primary/40 hover:bg-primary/[0.06] transition-colors"
                  >
                    <Icon className="w-3 h-3 text-white/50 group-hover:text-primary" />
                    <span className="text-[11px] text-white/75 truncate max-w-[180px]">{r.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Results */}
        <div ref={listRef} className="max-h-[55vh] overflow-y-auto py-2">
          {visible.length === 0 ? (
            <div className="text-center py-12 text-[12px] text-white/35">
              {q ? "No matches." : "Type to search."}
            </div>
          ) : (
            visible.map((r, i) => {
              const Icon = entityIcon(r.kind);
              const focused = i === cursor;
              return (
                <button
                  key={`${r.kind}:${r.id}`}
                  data-cursor={i}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => activate(r)}
                  className={cn(
                    "group w-full text-left px-5 py-3 flex items-center gap-3 transition-colors",
                    focused
                      ? "bg-primary/[0.10]"
                      : "hover:bg-glass",
                  )}
                >
                  {/* Avatar / thumbnail / icon */}
                  {r.avatar ? (
                    <img
                      src={r.avatar}
                      alt=""
                      className="w-8 h-8 rounded-lg object-cover border border-white/[0.08] shrink-0"
                    />
                  ) : r.thumbnail ? (
                    <img
                      src={r.thumbnail}
                      alt=""
                      className="w-8 h-8 rounded-lg object-cover border border-white/[0.08] shrink-0"
                    />
                  ) : (
                    <div className={cn(
                      "w-8 h-8 rounded-lg border flex items-center justify-center shrink-0",
                      focused
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-white/[0.06] bg-glass text-white/55",
                    )}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] text-white truncate font-normal">
                      {r.label}
                    </div>
                    {r.sub && (
                      <div className="text-[11px] text-white/40 truncate font-mono">
                        {r.sub}
                      </div>
                    )}
                  </div>
                  <span className={cn(
                    "text-[9px] font-mono uppercase tracking-[0.28em] shrink-0",
                    focused ? "text-primary" : "text-white/25",
                  )}>
                    {r.kind}
                  </span>
                  <ArrowRight className={cn(
                    "w-3.5 h-3.5 shrink-0 transition-opacity",
                    focused ? "opacity-100 text-primary" : "opacity-0",
                  )} />
                </button>
              );
            })
          )}
        </div>

        {/* Footer key hints */}
        <div className="px-5 py-3 border-t border-white/[0.05] flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.22em] text-white/30">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5"><kbd className="px-1 py-0.5 rounded border border-white/[0.08]">↑↓</kbd> navigate</span>
            <span className="flex items-center gap-1.5"><kbd className="px-1 py-0.5 rounded border border-white/[0.08]">⏎</kbd> open</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-3 h-3" /> Admin Membrane
          </div>
        </div>
      </div>
    </div>
  );
}

