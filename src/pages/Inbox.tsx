/**
 * Inbox — the unified next-gen inbox. Single page covering:
 *   • People (DMs) with realtime messages, reactions, reply-to,
 *     tip-in-thread, reel-anchored threads, typing indicator
 *   • Comments / Mentions on your reels
 *   • Tips & Pledges received
 *   • Render progress threads
 *   • Brand inquiries
 *   • System (achievements, milestones, follow requests, etc.)
 *
 * Routes wired here:
 *   /inbox                    → unified inbox
 *   /inbox?lane=people        → People lane
 *   /inbox?lane=people&dm=<uuid> → open a specific thread
 *
 * Backwards-compatible redirects from /messages, /notifications,
 * /account?tab=messages all land here.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  MessageSquare, MessageCircle, AtSign, Coins, Film, Briefcase, Bell,
  Sparkles, Crown, Send, Smile, ChevronRight, Loader2, Image as ImageIcon,
  Reply, X, Plus, Search, Check, Volume2, Heart, Users, Pin, BellOff,
  Archive, MoreHorizontal, PlayCircle,
} from "lucide-react";
import { toast } from "sonner";
import { safeErrorMessage } from "@/lib/safeErrorMessage";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { TYPE_META } from "@/lib/design-system";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CenterLine } from "@/components/ui/CenterLine";
import {
  Popover, PopoverTrigger, PopoverContent,
} from "@/components/ui/popover";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { usePageMeta } from "@/hooks/usePageMeta";

// ─────────────────────────────────────────────────────────────────────────────
// Lane catalog
// ─────────────────────────────────────────────────────────────────────────────
type LaneId = "all" | "people" | "rooms" | "comments" | "mentions" | "tips_pledges" | "renders" | "brand" | "system";

interface LaneDef {
  id: LaneId;
  label: string;
  eyebrow: string;
  Icon: typeof MessageSquare;
}
const LANES: LaneDef[] = [
  { id: "all",           label: "All",             eyebrow: "Everything",          Icon: Sparkles },
  { id: "people",        label: "People",          eyebrow: "Direct messages",     Icon: MessageSquare },
  { id: "rooms",         label: "Rooms",           eyebrow: "Patrons & crew",      Icon: Users },
  { id: "comments",      label: "Comments",        eyebrow: "On your reels",       Icon: MessageCircle },
  { id: "mentions",      label: "Mentions",        eyebrow: "You were tagged",     Icon: AtSign },
  { id: "tips_pledges",  label: "Tips & pledges",  eyebrow: "Money in",            Icon: Coins },
  { id: "renders",       label: "Renders",         eyebrow: "Your films",          Icon: Film },
  { id: "brand",         label: "Brand",           eyebrow: "Sponsorships",        Icon: Briefcase },
  { id: "system",        label: "System",          eyebrow: "Milestones",          Icon: Bell },
];

const EMOJIS = ["❤️", "🔥", "🎬", "👏", "😂", "🤯", "🙌", "💯"];

// Per-lane "this is what will appear here" copy — shown in empty states.
const EMPTY_COPY: Partial<Record<LaneId, { title: string; sub: string; cta?: { label: string; to?: string; onClick?: () => void } }>> = {
  comments: {
    title: "No comments yet.",
    sub: "Once viewers comment on your reels, every reply lands here with a one-tap link back to the film.",
    cta: { label: "Publish a reel", to: "/studio" },
  },
  mentions: {
    title: "No one has tagged you yet.",
    sub: "@your-handle in a comment or DM gets surfaced here so you never miss a callout.",
  },
  tips_pledges: {
    title: "No tips or pledges yet.",
    sub: "Every credit someone sends — a one-off tip or a recurring patron pledge — lands here with the sender attached.",
    cta: { label: "Set up patron tiers", to: "/account?tab=settings&m=creator" },
  },
  renders: {
    title: "No active renders.",
    sub: "Start a film in Studio and you'll see live progress here as scenes complete, plus a one-tap link when the cut is ready.",
    cta: { label: "Direct a new film", to: "/studio" },
  },
  brand: {
    title: "No brand inquiries yet.",
    sub: "Brands and agencies pitching collaborations land here with structured fields — budget, deliverables, deadline. Reply or decline in one tap.",
  },
  system: {
    title: "Nothing system-side.",
    sub: "Achievements, level-ups, follow requests, milestone unlocks, and low-credit warnings show up here.",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Inbox shell
// ─────────────────────────────────────────────────────────────────────────────
export default function Inbox() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();

  const lane = (searchParams.get("lane") ?? "all") as LaneId;
  const activeDmPartner = searchParams.get("dm"); // partner user_id when on People lane

  const setLane = useCallback((id: LaneId) => {
    const next = new URLSearchParams(searchParams);
    next.set("lane", id);
    next.delete("dm");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);
  const openDm = useCallback((partnerId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("lane", "people");
    next.set("dm", partnerId);
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);
  const closeDm = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("dm");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const [overview, setOverview] = useState<Record<LaneId, number>>({
    all: 0, people: 0, rooms: 0, comments: 0, mentions: 0, tips_pledges: 0, renders: 0, brand: 0, system: 0,
  });
  const [daySummary, setDaySummary] = useState<{ dms_today: number; tips_today: number; renders_today: number; follows_today: number; comments_today: number; unread_total: number }>({
    dms_today: 0, tips_today: 0, renders_today: 0, follows_today: 0, comments_today: 0, unread_total: 0,
  });
  const [totalUnread, setTotalUnread] = useState(0);

  usePageMeta({
    title: totalUnread > 0 ? `(${totalUnread}) Inbox · Small Bridges` : "Inbox · Small Bridges",
    description: "Your unified inbox: messages, comments, mentions, tips, renders, and brand inquiries.",
  });

  // Bootstrap overview + realtime refresh.
  const refreshOverview = useCallback(async () => {
    const [overviewRes, roomsRes, summaryRes] = await Promise.all([
      supabase.rpc("inbox_overview" as never),
      supabase.rpc("list_my_rooms" as never),
      supabase.rpc("inbox_day_summary" as never),
    ]);
    const lanes = ((overviewRes.data as any)?.lanes ?? {}) as Record<string, number>;
    const rooms = ((roomsRes.data as any[]) ?? []) as Array<{ unread: number }>;
    const roomsUnread = rooms.reduce((s, r) => s + Number(r.unread ?? 0), 0);
    const next: Record<LaneId, number> = {
      all:          0, // recomputed below
      people:       Number(lanes.people ?? 0),
      rooms:        roomsUnread,
      comments:     Number(lanes.comments ?? 0),
      mentions:     Number(lanes.mentions ?? 0),
      tips_pledges: Number(lanes.tips_pledges ?? 0),
      renders:      Number(lanes.renders ?? 0),
      brand:        Number(lanes.brand ?? 0),
      system:       Number(lanes.system ?? 0),
    };
    const sum = Object.entries(next).filter(([k]) => k !== "all").reduce((s, [, v]) => s + v, 0);
    next.all = sum;
    setOverview(next);
    setTotalUnread(sum);
    const summary = (summaryRes.data ?? {}) as any;
    setDaySummary({
      dms_today:      Number(summary.dms_today ?? 0),
      tips_today:     Number(summary.tips_today ?? 0),
      renders_today:  Number(summary.renders_today ?? 0),
      follows_today:  Number(summary.follows_today ?? 0),
      comments_today: Number(summary.comments_today ?? 0),
      unread_total:   Number(summary.unread_total ?? 0),
    });
  }, []);
  useEffect(() => { void refreshOverview(); }, [refreshOverview]);

  // Realtime: any new notification or DM bumps overview.
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`inbox-overview-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => void refreshOverview())
      .on("postgres_changes", { event: "*", schema: "public", table: "direct_messages" }, (payload) => {
        const row = (payload.new ?? payload.old) as any;
        if (row?.sender_id === user.id || row?.recipient_id === user.id) {
          void refreshOverview();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, refreshOverview]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-display italic text-3xl text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>Sign in to open your inbox.</h1>
          <p className="mt-2 text-muted-foreground">Your messages, mentions, and tips live here.</p>
          <Link to="/auth" className="inline-block mt-6 text-amber-200 hover:text-amber-100">Sign in →</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative isolate min-h-screen overflow-hidden">
      {/* CINEMATIC BACKDROP — drifting orbs, fractal grain, vignette.
          Sits at z-0; all content z-10+. Renders once. */}
      <InboxBackdrop reducedMotion={reducedMotion ?? false} />

      {/* HERO BAND — eyebrow, name, day-summary tiles, quick actions */}
      <header className="relative z-10 px-4 sm:px-8 lg:px-12 pt-12 pb-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div>
              <div className={cn(TYPE_META, "text-amber-300/85 tracking-[0.36em] inline-flex items-center gap-2")}>
                <Sparkles className="h-3 w-3" strokeWidth={1.8} />◆ Inbox
              </div>
              <h1
                className="mt-2 font-display italic font-light leading-[0.98] tracking-tight"
                style={{
                  fontFamily: "'Fraunces', serif",
                  fontSize: "clamp(2.4rem, 4.6vw, 4rem)",
                  textShadow: "0 4px 24px hsl(0 0% 0% / 0.55)",
                }}
              >
                <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/65 bg-clip-text text-transparent">
                  {totalUnread > 0 ? `${totalUnread} waiting.` : "All caught up."}
                </span>
              </h1>
              <p className="mt-3 text-[14px] text-muted-foreground/75 max-w-xl leading-relaxed">
                Messages, comments, mentions, tips, render alerts, brand offers, rooms — every signal that touches you, in one feed.
              </p>
            </div>

            {/* Quick actions */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Link to="/search?tab=people" className="inline-flex items-center gap-2 h-9 px-4 rounded-full hover:bg-white/[0.06] text-[11.5px] font-mono uppercase tracking-[0.22em] text-foreground/90 transition-colors">
                <Plus className="h-3.5 w-3.5" />New thread
              </Link>
              <button
                type="button"
                onClick={() => setLane("rooms")}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-full hover:bg-white/[0.06] text-[11.5px] font-mono uppercase tracking-[0.22em] text-foreground/90 transition-colors"
              >
                <Users className="h-3.5 w-3.5" />Rooms
              </button>
            </div>
          </div>

          {/* Day-summary tiles — floating glass, no card boundaries.
              A single glass strip with five "wells" separated by hairlines.
              Reads as one editorial band, not a row of cards. */}
          <div className="mt-9 relative">
            <div className="relative grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
              <SummaryTile Icon={MessageSquare} label="DMs today"      value={daySummary.dms_today}      tone="accent" />
              <SummaryTile Icon={MessageCircle} label="Comments"       value={daySummary.comments_today} tone="accent" />
              <SummaryTile Icon={Coins}         label="Tips & pledges" value={daySummary.tips_today}     tone="amber" />
              <SummaryTile Icon={Film}          label="Renders"        value={daySummary.renders_today}  tone="emerald" />
              <SummaryTile Icon={Plus}          label="New followers"  value={daySummary.follows_today}  tone="accent" />
            </div>
          </div>
        </div>
      </header>

      {/* BODY */}
      <div className="relative z-10 px-4 sm:px-8 lg:px-12 pb-32">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-10 lg:gap-14">
          {/* Lane nav — floating typography, no card boundary */}
          <aside className="lg:sticky lg:top-16 lg:self-start">
            <nav aria-label="Inbox lanes" className="space-y-1">
              {LANES.map((m) => (
                <LaneNavItem
                  key={m.id}
                  lane={m}
                  active={m.id === lane}
                  unread={overview[m.id]}
                  onClick={() => setLane(m.id)}
                />
              ))}
            </nav>
          </aside>

          <section className="min-w-0">
            {lane === "all" ? (
              <AllLane userId={user.id} navigate={navigate} setLane={setLane} onOpenDm={openDm} onRefresh={refreshOverview} />
            ) : lane === "people" ? (
              activeDmPartner
                ? <DmThread userId={user.id} partnerId={activeDmPartner} onClose={closeDm} reducedMotion={reducedMotion ?? false} />
                : <PeopleLane onOpen={openDm} userId={user.id} />
            ) : lane === "rooms" ? (
              <RoomsLane userId={user.id} reducedMotion={reducedMotion ?? false} />
            ) : (
              <NotificationsLane lane={lane} userId={user.id} navigate={navigate} onRefresh={refreshOverview} />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Lane nav item
// ─────────────────────────────────────────────────────────────────────────────
function LaneNavItem({
  lane: m, active, unread, onClick,
}: {
  lane: LaneDef;
  active: boolean;
  unread: number;
  onClick: () => void;
}) {
  const Icon = m.Icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group/m relative w-full text-left flex items-center gap-3.5 py-2.5 pr-3 pl-4 transition-colors",
        active ? "text-foreground" : "text-muted-foreground/85 hover:text-foreground",
      )}
    >
      {/* Floating active indicator — slides between items via layoutId */}
      {active && (
        <motion.span
          aria-hidden
          layoutId="inbox-lane-active"
          className="absolute inset-y-1 left-0 w-[2px] rounded-full bg-white"
          style={{ boxShadow: "0 0 8px -1px rgba(255,255,255,0.45)" }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
        />
      )}
      <Icon
        className={cn("h-4 w-4 shrink-0 transition-colors", active ? "text-foreground" : "text-muted-foreground/55 group-hover/m:text-foreground/85")}
        strokeWidth={1.5}
      />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block font-mono text-[11px] uppercase transition-all",
            active ? "tracking-[0.28em] text-foreground" : "tracking-[0.24em] text-foreground/85"
          )}
        >
          {m.label}
        </span>
        <span className="block mt-0.5 text-[10.5px] text-muted-foreground/45 leading-snug">{m.eyebrow}</span>
      </span>
      {unread > 0 && (
        <span
          className={cn(
            "inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 rounded-full text-[10px] font-mono tabular-nums transition-colors",
            active ? "text-foreground bg-white/[0.08]" : "text-foreground/70 bg-white/[0.04]"
          )}
        >
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PeopleLane — DM conversations list
// ─────────────────────────────────────────────────────────────────────────────
interface PartnerRow {
  partner_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  last_at: string;
  last_message: string;
  unread: number;
}
function PeopleLane({ onOpen, userId }: { onOpen: (partnerId: string) => void; userId: string }) {
  const [rows, setRows] = useState<PartnerRow[]>([]);
  const [pinned, setPinned] = useState<Set<string>>(new Set());
  const [archived, setArchived] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [rowsRes, stateRes] = await Promise.all([
      supabase.rpc("inbox_list_lane" as never, { p_lane: "people", p_limit: 100, p_offset: 0 } as never),
      supabase.from("inbox_thread_state" as never).select("ref_id, pinned, archived_at").eq("kind", "dm"),
    ]);
    setRows((rowsRes.data as PartnerRow[] | null) ?? []);
    const states = ((stateRes.data as any[]) ?? []);
    setPinned(new Set(states.filter((s) => s.pinned).map((s) => s.ref_id)));
    setArchived(new Set(states.filter((s) => s.archived_at).map((s) => s.ref_id)));
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const togglePin = async (partnerId: string) => {
    const isPinned = pinned.has(partnerId);
    setPinned((p) => {
      const next = new Set(p);
      isPinned ? next.delete(partnerId) : next.add(partnerId);
      return next;
    });
    await supabase.rpc("set_thread_state" as never, {
      p_kind: "dm", p_ref_id: partnerId,
      p_pinned: !isPinned, p_archived: null, p_snoozed_until: null, p_mark_read: null,
    } as never);
  };
  const toggleArchive = async (partnerId: string) => {
    const isArchived = archived.has(partnerId);
    setArchived((p) => {
      const next = new Set(p);
      isArchived ? next.delete(partnerId) : next.add(partnerId);
      return next;
    });
    await supabase.rpc("set_thread_state" as never, {
      p_kind: "dm", p_ref_id: partnerId,
      p_pinned: null, p_archived: !isArchived, p_snoozed_until: null, p_mark_read: null,
    } as never);
  };
  const snooze = async (partnerId: string, until: Date) => {
    await supabase.rpc("set_thread_state" as never, {
      p_kind: "dm", p_ref_id: partnerId,
      p_pinned: null, p_archived: null,
      p_snoozed_until: until.toISOString(), p_mark_read: null,
    } as never);
    toast.success(`Snoozed until ${until.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}.`);
  };

  // Realtime refresh on new DMs.
  useEffect(() => {
    const channel = supabase
      .channel(`inbox-people-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" }, (payload) => {
        const row = payload.new as any;
        if (row.sender_id === userId || row.recipient_id === userId) void load();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, load]);

  const filtered = useMemo(() => {
    // Hide archived unless explicitly viewing them. Pinned float to top.
    const filteredByArchive = rows.filter((r) => showArchived ? archived.has(r.partner_id) : !archived.has(r.partner_id));
    let next = filteredByArchive;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      next = next.filter((r) =>
        (r.display_name ?? "").toLowerCase().includes(q) ||
        (r.username ?? "").toLowerCase().includes(q) ||
        (r.last_message ?? "").toLowerCase().includes(q),
      );
    }
    return [...next].sort((a, b) => {
      const ap = pinned.has(a.partner_id) ? 1 : 0;
      const bp = pinned.has(b.partner_id) ? 1 : 0;
      if (ap !== bp) return bp - ap;
      return new Date(b.last_at).getTime() - new Date(a.last_at).getTime();
    });
  }, [rows, query, archived, pinned, showArchived]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/55" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search messages…" className="pl-9 border-transparent bg-white/[0.04]" />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowArchived((p) => !p)}
          className={cn("text-[11px] font-mono uppercase tracking-[0.22em]", showArchived && "text-accent")}
        >
          <Archive className="h-3.5 w-3.5 mr-1.5" />
          {showArchived ? "Inbox" : `Archive${archived.size > 0 ? ` · ${archived.size}` : ""}`}
        </Button>
        <NewDmButton onOpen={onOpen} />
      </div>

      {loading ? (
        <div className="py-12 flex items-center justify-center gap-2 text-muted-foreground/65"><Loader2 className="h-4 w-4 animate-spin" />Loading…</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title={rows.length === 0 ? "No conversations yet." : "Nothing matches."}
          sub={rows.length === 0 ? "Tap New message above to start a thread, or DM someone from their profile." : "Try a different search."}
          cta={rows.length === 0 ? { label: "Find people", to: "/search?tab=people" } : undefined}
        />
      ) : (
        <ul className="rounded-2xl overflow-hidden">
          {filtered.map((r) => {
            const isPinned = pinned.has(r.partner_id);
            const isArchived = archived.has(r.partner_id);
            return (
              <li key={r.partner_id} className="group/row relative">
                <button
                  type="button"
                  onClick={() => onOpen(r.partner_id)}
                  className="w-full text-left p-4 flex items-center gap-3 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="relative shrink-0">
                    <div className="h-11 w-11 rounded-full overflow-hidden bg-white/[0.06]">
                      {r.avatar_url
                        ? <img src={r.avatar_url} alt="" className="h-full w-full object-cover" />
                        : <div className="h-full w-full grid place-items-center text-foreground/85 text-[14px] font-mono">{(r.display_name?.[0] ?? "?").toUpperCase()}</div>}
                    </div>
                    {isPinned && <Pin className="absolute -top-1 -right-1 h-3 w-3 text-accent" strokeWidth={2} fill="currentColor" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[14px] font-medium text-foreground truncate">{r.display_name ?? "Anonymous"}</span>
                      {r.username && <span className="text-[11px] text-muted-foreground/65 truncate">@{r.username}</span>}
                      <span className={cn(TYPE_META, "ml-auto shrink-0 text-muted-foreground/55 tracking-[0.18em]")}>{relTime(r.last_at)}</span>
                    </div>
                    <div className="text-[13px] text-muted-foreground/80 truncate mt-0.5">{r.last_message ?? ""}</div>
                  </div>
                  {r.unread > 0 && (
                    <span className="ml-2 inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-[10.5px] font-mono tabular-nums bg-accent text-black shrink-0">
                      {r.unread > 99 ? "99+" : r.unread}
                    </span>
                  )}
                </button>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover/row:opacity-100 transition-opacity flex items-center gap-1 bg-[hsl(220_28%_5%/0.95)] backdrop-blur-md rounded-full shadow-[0_8px_24px_-8px_hsl(0_0%_0%/0.7)] px-1.5 py-1">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); void togglePin(r.partner_id); }}
                    title={isPinned ? "Unpin" : "Pin"}
                    className={cn("p-1.5 rounded-full hover:bg-white/[0.06] transition-colors", isPinned ? "text-accent" : "text-muted-foreground/65")}
                  >
                    <Pin className="h-3.5 w-3.5" strokeWidth={1.6} />
                  </button>
                  <SnoozePopover onPick={(d) => void snooze(r.partner_id, d)} />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); void toggleArchive(r.partner_id); }}
                    title={isArchived ? "Unarchive" : "Archive"}
                    className="p-1.5 rounded-full hover:bg-white/[0.06] text-muted-foreground/65 transition-colors"
                  >
                    <Archive className="h-3.5 w-3.5" strokeWidth={1.6} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function NewDmButton({ onOpen }: { onOpen: (partnerId: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ id: string; display_name: string | null; username: string | null; avatar_url: string | null }>>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open || !query.trim()) { setResults([]); return; }
    setLoading(true);
    const t = window.setTimeout(async () => {
      const q = query.trim();
      // PostgREST parses the .or() string as filter syntax, so a raw search
      // term can inject extra filters (commas/parens/backslashes are reserved,
      // % is an ilike wildcard). Strip those before interpolating.
      const safeQ = q.replace(/[,()\\]/g, ' ').replace(/%/g, '').trim();
      if (!safeQ) { setResults([]); setLoading(false); return; }
      const { data } = await supabase
        .from("profiles_public" as never)
        .select("id, display_name, username, avatar_url")
        .or(`display_name.ilike.%${safeQ}%,username.ilike.%${safeQ}%`)
        .limit(8);
      setResults((data as any[]) ?? []);
      setLoading(false);
    }, 250);
    return () => window.clearTimeout(t);
  }, [open, query]);
  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5 mr-2" />New message</Button>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setQuery(""); setResults([]); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start a conversation</DialogTitle>
          </DialogHeader>
          <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or @handle" className="border-transparent bg-white/[0.04]" />
          <div className="min-h-[120px]">
            {loading ? (
              <div className="py-6 flex items-center justify-center gap-2 text-muted-foreground/65"><Loader2 className="h-4 w-4 animate-spin" />Searching…</div>
            ) : (
              <ul className="space-y-0.5">
                {results.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => { setOpen(false); onOpen(r.id); }}
                      className="w-full text-left py-3 px-1 flex items-center gap-3 hover:bg-white/[0.02] rounded-lg transition-colors"
                    >
                      <div className="h-9 w-9 rounded-full overflow-hidden bg-white/[0.06] shrink-0">
                        {r.avatar_url
                          ? <img src={r.avatar_url} alt="" className="h-full w-full object-cover" />
                          : <div className="h-full w-full grid place-items-center text-foreground/80 text-[12px] font-mono">{(r.display_name?.[0] ?? "?").toUpperCase()}</div>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] truncate text-foreground/95">{r.display_name ?? "Anonymous"}</div>
                        {r.username && <div className="text-[11px] text-muted-foreground/65 truncate">@{r.username}</div>}
                      </div>
                    </button>
                  </li>
                ))}
                {!loading && query.trim() && results.length === 0 && (
                  <li className="py-6 text-center text-[13px] text-muted-foreground/65">No one matches.</li>
                )}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DmThread — single conversation with realtime, reactions, reply, tip
// ─────────────────────────────────────────────────────────────────────────────
interface MessageRow {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
  reply_to_id: string | null;
  reel_id: string | null;
  tip_amount: number | null;
  edited_at: string | null;
  deleted_at: string | null;
  read_at: string | null;
}
interface Reaction { message_id: string; user_id: string; emoji: string; }

function DmThread({ userId, partnerId, onClose, reducedMotion }: { userId: string; partnerId: string; onClose: () => void; reducedMotion: boolean }) {
  const [partner, setPartner] = useState<{ id: string; display_name: string | null; username: string | null; avatar_url: string | null; tagline: string | null } | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  // Mirror of `messages` so the unfiltered dm_reactions realtime stream can be
  // scoped to this thread without re-subscribing on every message.
  const messagesRef = useRef<MessageRow[]>([]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  const [loading, setLoading] = useState(true);
  const [replyTo, setReplyTo] = useState<MessageRow | null>(null);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [showTipDialog, setShowTipDialog] = useState(false);
  const [showAiDialog, setShowAiDialog] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    // partnerId comes from the URL and is interpolated raw into the .or()
    // PostgREST filter string below, so apply the same sanitization used for
    // the search box (NewDmButton) — strip the reserved comma/paren/backslash
    // and ilike '%' chars so a crafted ?dm= value can't inject extra filters.
    // The .eq() calls are parameterized and need no escaping.
    const safePartner = partnerId.replace(/[,()\\]/g, "").replace(/%/g, "");
    const [partnerRes, messagesRes, reactionsRes] = await Promise.all([
      supabase.from("profiles_public" as never).select("id, display_name, username, avatar_url, tagline").eq("id", partnerId).maybeSingle(),
      supabase.from("direct_messages" as never).select("*")
        .or(`and(sender_id.eq.${userId},recipient_id.eq.${safePartner}),and(sender_id.eq.${safePartner},recipient_id.eq.${userId})`)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(200),
      supabase.from("dm_reactions" as never).select("*"),
    ]);
    setPartner((partnerRes.data as any) ?? null);
    const msgs = (messagesRes.data as MessageRow[]) ?? [];
    setMessages(msgs);
    const msgIds = new Set(msgs.map((m) => m.id));
    setReactions(((reactionsRes.data as Reaction[]) ?? []).filter((r) => msgIds.has(r.message_id)));
    setLoading(false);
    // Mark received messages read.
    await supabase.from("direct_messages" as never)
      .update({ read_at: new Date().toISOString() } as never)
      .eq("recipient_id", userId)
      .eq("sender_id", partnerId)
      .is("read_at", null);
  }, [userId, partnerId]);
  useEffect(() => { void load(); }, [load]);

  // Realtime subscription — messages + reactions + presence.
  useEffect(() => {
    const channelName = `dm-${[userId, partnerId].sort().join("-")}`;
    const channel = supabase.channel(channelName, { config: { presence: { key: userId } } })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" }, (payload) => {
        const m = payload.new as MessageRow;
        if ((m.sender_id === userId && m.recipient_id === partnerId)
         || (m.sender_id === partnerId && m.recipient_id === userId)) {
          setMessages((p) => p.some((x) => x.id === m.id) ? p : [...p, m]);
          if (m.recipient_id === userId) {
            void supabase.from("direct_messages" as never).update({ read_at: new Date().toISOString() } as never).eq("id", m.id);
          }
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "direct_messages" }, (payload) => {
        const m = payload.new as MessageRow;
        if ((m.sender_id === userId && m.recipient_id === partnerId)
         || (m.sender_id === partnerId && m.recipient_id === userId)) {
          setMessages((p) => p.map((x) => x.id === m.id ? m : x));
        }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "dm_reactions" }, (payload) => {
        const r = payload.new as Reaction;
        // The stream is unfiltered (every dm_reaction the user can see), so
        // drop reactions for other threads, and dedup against ones already in
        // state (the initial SELECT and this INSERT can race) — otherwise a
        // grouped reaction count renders inflated.
        if (!messagesRef.current.some((m) => m.id === r.message_id)) return;
        setReactions((p) =>
          p.some((x) => x.message_id === r.message_id && x.user_id === r.user_id && x.emoji === r.emoji)
            ? p
            : [...p, r]);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "dm_reactions" }, (payload) => {
        const r = payload.old as Reaction;
        setReactions((p) => p.filter((x) => !(x.message_id === r.message_id && x.user_id === r.user_id && x.emoji === r.emoji)));
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const partnerEntry = state[partnerId];
        setPartnerOnline(Boolean(partnerEntry && (partnerEntry as any[]).length > 0));
        const typing = (partnerEntry as any[] | undefined)?.[0]?.typing === true;
        setPartnerTyping(typing);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ typing: false });
        }
      });
    return () => {
      // Explicitly untrack presence before removing the channel so the
      // partner sees us go offline immediately. Without untrack, the
      // presence row lingered on the server for ~5s after the tab
      // closed / the conversation switched, showing a stale "online".
      void channel.untrack();
      void supabase.removeChannel(channel);
    };
  }, [userId, partnerId]);

  // Auto-scroll on new messages.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const broadcastTyping = useCallback((typing: boolean) => {
    const channelName = `dm-${[userId, partnerId].sort().join("-")}`;
    const ch = supabase.getChannels().find((c) => c.topic.endsWith(channelName));
    if (ch) void ch.track({ typing });
  }, [userId, partnerId]);

  const onDraftChange = (v: string) => {
    setDraft(v);
    broadcastTyping(true);
    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(() => broadcastTyping(false), 1500);
  };

  const send = async () => {
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    try {
      const { error } = await supabase.rpc("send_direct_message" as never, {
        p_recipient: partnerId,
        p_content: text,
        p_reply_to_id: replyTo?.id ?? null,
        p_reel_id: null,
        p_attachments: [],
      } as never);
      if (error) {
        const msg = error.message || "";
        if (msg.includes("recipient_dms_disabled")) throw new Error("This user isn't accepting messages.");
        if (msg.includes("recipient_dms_followers_only")) throw new Error("They only accept messages from people they follow.");
        if (msg.includes("blocked_by_recipient")) throw new Error("You can't message this user.");
        throw error;
      }
      setDraft("");
      setReplyTo(null);
      broadcastTyping(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send.");
    } finally {
      setSending(false);
    }
  };

  const react = async (messageId: string, emoji: string) => {
    await supabase.rpc("react_to_message" as never, { p_message_id: messageId, p_emoji: emoji } as never);
  };

  const sendTip = async (amount: number, message: string) => {
    setShowTipDialog(false);
    try {
      const { error } = await supabase.rpc("tip_in_thread" as never, {
        p_recipient: partnerId, p_amount: amount, p_content: message,
      } as never);
      if (error) {
        const msg = error.message || "";
        if (msg.includes("insufficient_balance")) throw new Error("Not enough credits — top up first.");
        if (msg.includes("invalid_amount")) throw new Error("Pick a valid amount.");
        throw error;
      }
      toast.success(`Tipped ${amount} cr.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send tip.");
    }
  };

  const partnerName = partner?.display_name?.trim() || partner?.username || "Conversation";
  const reactionsByMsg = useMemo(() => {
    const map = new Map<string, Reaction[]>();
    for (const r of reactions) {
      if (!map.has(r.message_id)) map.set(r.message_id, []);
      map.get(r.message_id)!.push(r);
    }
    return map;
  }, [reactions]);

  return (
    <div
      className="relative overflow-hidden flex flex-col rounded-3xl"
      style={{
        minHeight: "70vh",
        boxShadow: "0 32px 80px -30px hsl(0 0% 0% / 0.6)",
      }}
    >
      {/* Header */}
      <header className="px-5 py-4 flex items-center gap-3">
        <button type="button" onClick={onClose} className="text-muted-foreground/65 hover:text-foreground transition-colors" aria-label="Back">
          <X className="h-4 w-4" />
        </button>
        <div className="relative shrink-0">
          <div className="h-10 w-10 rounded-full overflow-hidden bg-white/[0.06]">
            {partner?.avatar_url
              ? <img src={partner.avatar_url} alt="" className="h-full w-full object-cover" />
              : <div className="h-full w-full grid place-items-center text-foreground/85 text-[13px] font-mono">{(partnerName[0] ?? "?").toUpperCase()}</div>}
          </div>
          {partnerOnline && <span aria-label="Online" className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400" style={{ boxShadow: "0 0 0 2px hsl(220 28% 5%)" }} />}
        </div>
        <div className="min-w-0 flex-1">
          <Link to={`/c/${partner?.username ? `@${partner.username}` : partnerId}`} className="text-[14px] font-medium text-foreground hover:text-accent transition-colors block truncate">
            {partnerName}
          </Link>
          <div className="text-[11px] text-muted-foreground/65 truncate">
            {partnerTyping ? <span className="text-accent">typing…</span> : (partner?.tagline ?? (partnerOnline ? "Online" : "Offline"))}
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setShowTipDialog(true)}>
          <Coins className="h-3.5 w-3.5 mr-1.5 text-amber-300" />Tip
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setShowAiDialog(true)}>
          <Sparkles className="h-3.5 w-3.5 mr-1.5 text-accent" />AI reply
        </Button>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-3">
        {loading ? (
          <div className="py-12 flex items-center justify-center gap-2 text-muted-foreground/65"><Loader2 className="h-4 w-4 animate-spin" />Loading…</div>
        ) : messages.length === 0 ? (
          <EmptyState icon={MessageSquare} title="No messages yet." sub={`Say hi to ${partnerName}.`} />
        ) : (
          messages.map((m, i) => {
            const isMe = m.sender_id === userId;
            const prevSameSender = i > 0 && messages[i - 1].sender_id === m.sender_id;
            const msgReactions = reactionsByMsg.get(m.id) ?? [];
            const replyParent = m.reply_to_id ? messages.find((x) => x.id === m.reply_to_id) : null;
            return (
              <Bubble
                key={m.id}
                msg={m}
                isMe={isMe}
                tight={prevSameSender}
                reactions={msgReactions}
                myUserId={userId}
                replyParent={replyParent}
                onReact={(emoji) => void react(m.id, emoji)}
                onReply={() => setReplyTo(m)}
                reducedMotion={reducedMotion}
              />
            );
          })
        )}
      </div>

      {/* Reply preview */}
      {replyTo && (
        <div className="px-5 py-2 flex items-center gap-2">
          <Reply className="h-3.5 w-3.5 text-muted-foreground/65" />
          <div className="min-w-0 flex-1 text-[12px] text-muted-foreground/85 truncate">
            Replying to <span className="text-foreground/95">{replyTo.content}</span>
          </div>
          <button type="button" onClick={() => setReplyTo(null)} className="text-muted-foreground/65 hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Composer */}
      <footer className="px-5 py-4 flex items-end gap-2">
        <textarea
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); }
          }}
          placeholder="Say something…"
          className="flex-1 resize-none rounded-xl bg-white/[0.04] hover:bg-white/[0.05] border-transparent px-4 py-3 text-[14px] text-foreground placeholder:text-muted-foreground/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/10 min-h-[44px] max-h-[160px]"
          rows={1}
        />
        <Button onClick={() => void send()} disabled={sending || !draft.trim()} className="h-[44px]">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </footer>

      <TipDialog open={showTipDialog} onClose={() => setShowTipDialog(false)} onSend={sendTip} recipientName={partnerName} />
      <AiVideoReplyDialog
        open={showAiDialog}
        onClose={() => setShowAiDialog(false)}
        onPrompt={(prompt) => { setDraft(`${draft ? draft + "\n\n" : ""}${prompt}`); setShowAiDialog(false); }}
        recipientName={partnerName}
        recipientId={partnerId}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bubble — single message
// ─────────────────────────────────────────────────────────────────────────────
function Bubble({
  msg, isMe, tight, reactions, myUserId, replyParent, onReact, onReply, reducedMotion,
}: {
  msg: MessageRow;
  isMe: boolean;
  tight: boolean;
  reactions: Reaction[];
  myUserId: string;
  replyParent: MessageRow | null;
  onReact: (emoji: string) => void;
  onReply: () => void;
  reducedMotion: boolean;
}) {
  // Group reactions by emoji.
  const grouped = useMemo(() => {
    const m = new Map<string, { count: number; mine: boolean }>();
    for (const r of reactions) {
      const cur = m.get(r.emoji) ?? { count: 0, mine: false };
      cur.count++;
      if (r.user_id === myUserId) cur.mine = true;
      m.set(r.emoji, cur);
    }
    return Array.from(m.entries());
  }, [reactions, myUserId]);

  return (
    <motion.div
      initial={reducedMotion ? undefined : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={cn("group/msg flex items-end gap-2", isMe ? "justify-end" : "justify-start", tight && "-mt-1")}
    >
      <div className={cn("max-w-[78%] flex flex-col gap-1", isMe ? "items-end" : "items-start")}>
        {replyParent && (
          <div className={cn("max-w-full text-[11px] text-muted-foreground/65 truncate px-3 py-1 rounded-lg",
            isMe ? "bg-accent/[0.08]" : "bg-white/[0.04]")}>
            <Reply className="h-3 w-3 inline-block mr-1.5 opacity-65" />
            {replyParent.content}
          </div>
        )}

        <div className="flex items-center gap-1.5">
          {!isMe && (
            <ReactPopover onPick={onReact}>
              <button type="button" className="opacity-0 group-hover/msg:opacity-100 transition-opacity p-1 rounded-full hover:bg-white/[0.05]">
                <Smile className="h-3.5 w-3.5 text-muted-foreground/65" />
              </button>
            </ReactPopover>
          )}
          {!isMe && (
            <button type="button" onClick={onReply} className="opacity-0 group-hover/msg:opacity-100 transition-opacity p-1 rounded-full hover:bg-white/[0.05]" aria-label="Reply">
              <Reply className="h-3.5 w-3.5 text-muted-foreground/65" />
            </button>
          )}

          <div className={cn(
            "px-4 py-2.5 rounded-2xl text-[14px] leading-relaxed",
            isMe
              ? "bg-accent/22 text-foreground rounded-br-md"
              : "bg-white/[0.05] text-foreground rounded-bl-md",
            msg.tip_amount && "bg-gradient-to-br from-amber-400/16 to-white/[0.05]"
          )}>
            {msg.tip_amount && (
              <div className={cn(TYPE_META, "text-amber-200 tracking-[0.22em] mb-1 inline-flex items-center gap-1.5")}>
                <Coins className="h-3 w-3" />TIPPED {msg.tip_amount} CR
              </div>
            )}
            {msg.reel_id && <ReelPreview reelId={msg.reel_id} />}
            {msg.ai_video_url && <AiVideoPreview url={msg.ai_video_url} />}
            <div className="whitespace-pre-wrap break-words">{msg.content}</div>
          </div>

          {isMe && (
            <ReactPopover onPick={onReact}>
              <button type="button" className="opacity-0 group-hover/msg:opacity-100 transition-opacity p-1 rounded-full hover:bg-white/[0.05]">
                <Smile className="h-3.5 w-3.5 text-muted-foreground/65" />
              </button>
            </ReactPopover>
          )}
          {isMe && (
            <button type="button" onClick={onReply} className="opacity-0 group-hover/msg:opacity-100 transition-opacity p-1 rounded-full hover:bg-white/[0.05]" aria-label="Reply">
              <Reply className="h-3.5 w-3.5 text-muted-foreground/65" />
            </button>
          )}
        </div>

        {grouped.length > 0 && (
          <div className={cn("flex flex-wrap gap-1.5", isMe ? "justify-end" : "justify-start")}>
            {grouped.map(([emoji, info]) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onReact(emoji)}
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] transition-colors",
                  info.mine
                    ? "bg-accent/25 text-foreground"
                    : "bg-white/[0.05] hover:bg-white/[0.08] text-foreground/90"
                )}
              >
                <span>{emoji}</span>
                <span className="font-mono tabular-nums text-[10.5px] text-muted-foreground/85">{info.count}</span>
              </button>
            ))}
          </div>
        )}

        <div className={cn(TYPE_META, "text-muted-foreground/40 tracking-[0.18em]")}>
          {isMe && msg.read_at && <Check className="inline-block h-2.5 w-2.5 mr-1 text-accent" />}
          {relTime(msg.created_at)}
          {msg.edited_at && " · edited"}
        </div>
      </div>
    </motion.div>
  );
}

function SnoozePopover({ onPick }: { onPick: (until: Date) => void }) {
  const options: Array<{ label: string; build: () => Date }> = [
    { label: "1 hour",          build: () => new Date(Date.now() + 60 * 60 * 1000) },
    { label: "Tomorrow 9 AM",   build: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d; } },
    { label: "This weekend",    build: () => { const d = new Date(); const days = (6 - d.getDay() + 7) % 7 || 7; d.setDate(d.getDate() + days); d.setHours(9, 0, 0, 0); return d; } },
    { label: "Next week",       build: () => { const d = new Date(); d.setDate(d.getDate() + 7); d.setHours(9, 0, 0, 0); return d; } },
  ];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          title="Snooze"
          className="p-1.5 rounded-full hover:bg-white/[0.06] text-muted-foreground/65 transition-colors"
        >
          <BellOff className="h-3.5 w-3.5" strokeWidth={1.6} />
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="w-44 p-1.5">
        <div className="space-y-0.5">
          {options.map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={(e) => { e.stopPropagation(); onPick(o.build()); }}
              className="w-full text-left px-3 py-2 rounded-md text-[12.5px] hover:bg-white/[0.05] transition-colors text-foreground/90"
            >
              {o.label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ReactPopover({ children, onPick }: { children: React.ReactNode; onPick: (emoji: string) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent side="top" className="w-auto p-2">
        <div className="flex gap-1">
          {EMOJIS.map((e) => (
            <button key={e} type="button" onClick={() => onPick(e)} className="text-[20px] hover:scale-110 transition-transform p-1.5">
              {e}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TipDialog
// ─────────────────────────────────────────────────────────────────────────────
function TipDialog({ open, onClose, onSend, recipientName }: { open: boolean; onClose: () => void; onSend: (amount: number, message: string) => Promise<void> | void; recipientName: string }) {
  const [amount, setAmount] = useState(10);
  const [message, setMessage] = useState("");
  const PRESETS = [5, 10, 25, 50, 100];
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2">
            <Coins className="h-4 w-4 text-amber-300" />Tip {recipientName}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setAmount(p)}
                className={cn(
                  "relative px-4 py-2 rounded-xl transition-colors text-[13px] font-mono tabular-nums",
                  amount === p
                    ? "bg-white/[0.06] text-foreground"
                    : "text-foreground/70 hover:bg-white/[0.03]"
                )}
              >
                {p} cr
                {amount === p && <CenterLine />}
              </button>
            ))}
          </div>
          <Input type="number" min={1} max={10000} value={amount} onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 1))} className="border-transparent bg-white/[0.04]" />
          <Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Add a note (optional)" maxLength={140} className="border-transparent bg-white/[0.04]" />
          <p className="text-[11.5px] text-muted-foreground/65">90% goes to {recipientName}, 10% to the platform.</p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}><X className="h-3.5 w-3.5 mr-2" />Cancel</Button>
          <Button onClick={() => void onSend(amount, message)}>
            <Coins className="h-3.5 w-3.5 mr-2" />Send {amount} cr
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AiVideoReplyDialog — uses the Studio engine to draft a stylized prompt.
//   This drafts the message text from a prompt template; the user can
//   then send as-is, or hit "Generate video" to spawn a Studio job.
// ─────────────────────────────────────────────────────────────────────────────
function AiVideoReplyDialog({
  open, onClose, onPrompt, recipientName, recipientId,
}: {
  open: boolean;
  onClose: () => void;
  onPrompt: (text: string) => void;
  recipientName: string;
  recipientId: string;
}) {
  const [tone, setTone] = useState<"warm" | "playful" | "cinematic" | "brief">("warm");
  const [generating, setGenerating] = useState(false);
  const TONES: Array<{ id: typeof tone; label: string; preview: string }> = [
    { id: "warm",       label: "Warm",       preview: `Hey ${recipientName}, this just made my day — thank you. More to come.` },
    { id: "playful",    label: "Playful",    preview: `${recipientName}!! you are too kind 🎬 watch this space.` },
    { id: "cinematic",  label: "Cinematic",  preview: `${recipientName}. The light hit different today. Thank you for watching.` },
    { id: "brief",      label: "Brief",      preview: `${recipientName} — thank you. Means a lot.` },
  ];
  const draft = TONES.find((t) => t.id === tone)?.preview ?? "";

  const generateVideo = async () => {
    setGenerating(true);
    try {
      const { error } = await supabase.rpc("start_ai_video_reply" as never, {
        p_recipient: recipientId,
        p_prompt: draft,
        p_tone: tone,
      } as never);
      if (error) throw error;
      toast.success("AI video reply queued. We'll send it when it's ready.");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't queue video reply.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />AI reply
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {TONES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTone(t.id)}
                className={cn(
                  "relative px-4 py-2 rounded-xl text-[12px] font-mono uppercase tracking-[0.22em] transition-colors",
                  tone === t.id ? "bg-white/[0.06] text-foreground" : "text-foreground/70 hover:bg-white/[0.03]"
                )}
              >
                {t.label}
                {tone === t.id && <CenterLine />}
              </button>
            ))}
          </div>
          <div className="rounded-xl p-4 text-[14px] leading-relaxed italic text-foreground/95" style={{ fontFamily: "'Fraunces', serif" }}>
            {draft}
          </div>
          <p className="text-[11.5px] text-muted-foreground/65">
            Use the draft as message text, OR queue a stylized AI video reply rendered by your default Studio engine. The reply is sent automatically when it finishes.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={generating}><X className="h-3.5 w-3.5 mr-2" />Cancel</Button>
          <Button variant="ghost" onClick={() => onPrompt(draft)} disabled={generating}>
            <Send className="h-3.5 w-3.5 mr-2" />Use as text
          </Button>
          <Button onClick={() => void generateVideo()} disabled={generating}>
            {generating ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-2" />}
            Generate video
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NotificationsLane — shared list for comments/mentions/tips/renders/brand/system
// ─────────────────────────────────────────────────────────────────────────────
interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  read: boolean;
  created_at: string;
}
function NotificationsLane({
  lane, userId, navigate, onRefresh,
}: {
  lane: LaneId;
  userId: string;
  navigate: ReturnType<typeof useNavigate>;
  onRefresh: () => void | Promise<void>;
}) {
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeBrandInquiryId, setActiveBrandInquiryId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.rpc("inbox_list_lane" as never, { p_lane: lane, p_limit: 50, p_offset: 0 } as never);
    setRows((data as NotificationRow[] | null) ?? []);
    setLoading(false);
  }, [lane]);
  useEffect(() => { void load(); }, [load]);

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel(`notif-lane-${lane}-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => void load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [lane, userId, load]);

  const markAllRead = async () => {
    await supabase.rpc("mark_lane_read" as never, { p_lane: lane } as never);
    setRows((p) => p.map((r) => ({ ...r, read: true })));
    void onRefresh();
    toast.success("Marked all as read.");
  };

  const open = (row: NotificationRow) => {
    if (!row.read) {
      void supabase.from("notifications" as never).update({ read: true } as never).eq("id", row.id);
      setRows((p) => p.map((r) => r.id === row.id ? { ...r, read: true } : r));
      void onRefresh();
    }
    const d = (row.data ?? {}) as Record<string, string>;
    if (row.type === "brand_inquiry" && d.inquiry_id) {
      setActiveBrandInquiryId(d.inquiry_id);
      return;
    }
    if (d.reel_id) navigate(`/r/${d.reel_id}`);
    else if (d.sender_id) {
      // Open the DM
      const next = new URLSearchParams(window.location.search);
      next.set("lane", "people"); next.set("dm", d.sender_id);
      navigate(`/inbox?${next.toString()}`);
    } else if (row.type === "follow" && d.follower_id) navigate(`/c/${d.follower_id}`);
    else if (row.type === "follow_request") navigate("/account?tab=settings&m=privacy");
    else if (row.type.startsWith("video_")) navigate("/projects");
    else if (row.type === "patron_received" && d.patron_id) navigate(`/c/${d.patron_id}`);
  };

  const grouped = useMemo(() => {
    const groups = new Map<string, NotificationRow[]>();
    for (const r of rows) {
      const day = relDayLabel(r.created_at);
      if (!groups.has(day)) groups.set(day, []);
      groups.get(day)!.push(r);
    }
    return Array.from(groups.entries());
  }, [rows]);

  const unread = rows.filter((r) => !r.read).length;
  // A malformed ?lane= URL param (cast to LaneId at read time) could miss every
  // lane and make this non-null assertion throw on laneMeta.Icon (audit S206).
  const laneMeta = LANES.find((l) => l.id === lane) ?? LANES[0];
  const Icon = laneMeta.Icon;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-3">
          <Icon className="h-4 w-4 text-accent" strokeWidth={1.6} />
          <h2 className="font-display italic text-[22px] text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>{laneMeta.label}</h2>
          <span className={cn(TYPE_META, "text-muted-foreground/65 tracking-[0.22em]")}>{laneMeta.eyebrow}</span>
        </div>
        {unread > 0 && (
          <Button variant="ghost" size="sm" onClick={() => void markAllRead()}>
            <Check className="h-3.5 w-3.5 mr-2" />Mark all read
          </Button>
        )}
      </div>

      {activeBrandInquiryId && (
        <BrandInquiryDetailDialog
          inquiryId={activeBrandInquiryId}
          onClose={() => setActiveBrandInquiryId(null)}
          onResolved={() => { setActiveBrandInquiryId(null); void load(); void onRefresh(); }}
        />
      )}

      {loading ? (
        <div className="py-12 flex items-center justify-center gap-2 text-muted-foreground/65"><Loader2 className="h-4 w-4 animate-spin" />Loading…</div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Icon}
          title={EMPTY_COPY[lane]?.title ?? `No ${laneMeta.label.toLowerCase()} yet.`}
          sub={EMPTY_COPY[lane]?.sub ?? "You'll see them here as they come in."}
          cta={EMPTY_COPY[lane]?.cta}
        />
      ) : (
        <div className="space-y-8">
          {grouped.map(([day, items]) => (
            <section key={day}>
              <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.30em] mb-3")}>{day}</div>
              <ul className="space-y-0.5">
                {items.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => open(row)}
                      className={cn(
                        "w-full text-left p-4 flex items-start gap-3 transition-colors hover:bg-white/[0.02]",
                        !row.read && "bg-accent/[0.025]"
                      )}
                    >
                      <NotificationIcon type={row.type} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-[14px] text-foreground font-medium truncate">{row.title}</span>
                          <span className={cn(TYPE_META, "ml-auto shrink-0 text-muted-foreground/55 tracking-[0.18em]")}>{relTime(row.created_at)}</span>
                        </div>
                        {row.body && <div className="mt-1 text-[13px] text-muted-foreground/85 truncate">{row.body}</div>}
                      </div>
                      {!row.read && <span aria-hidden className="mt-2 h-1.5 w-1.5 rounded-full bg-accent shrink-0" />}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BrandInquiryDetailDialog — open a structured brand pitch + accept/decline
// ─────────────────────────────────────────────────────────────────────────────
function BrandInquiryDetailDialog({
  inquiryId, onClose, onResolved,
}: {
  inquiryId: string;
  onClose: () => void;
  onResolved: () => void;
}) {
  const [row, setRow] = useState<{ id: string; brand_name: string; contact_email: string | null; budget_usd: number; deliverables: string; deadline: string | null; notes: string | null; status: string; sender_id: string; created_at: string } | null>(null);
  const [sender, setSender] = useState<{ display_name: string | null; username: string | null; avatar_url: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("brand_inquiries" as never)
        .select("*")
        .eq("id", inquiryId)
        .maybeSingle();
      setRow((data as any) ?? null);
      if (data) {
        const { data: p } = await supabase
          .from("profiles_public" as never)
          .select("display_name, username, avatar_url")
          .eq("id", (data as any).sender_id)
          .maybeSingle();
        setSender((p as any) ?? null);
      }
    })();
  }, [inquiryId]);

  const resolve = async (status: "accepted" | "declined" | "archived") => {
    setBusy(true);
    const { error } = await supabase.from("brand_inquiries" as never)
      .update({ status, updated_at: new Date().toISOString() } as never)
      .eq("id", inquiryId);
    setBusy(false);
    if (error) { toast.error(safeErrorMessage(error, "Couldn't update the inquiry. Please try again.")); return; }
    toast.success(status === "accepted" ? "Accepted. We'll DM them on your behalf." : status === "declined" ? "Declined." : "Archived.");
    if (status === "accepted" && row) {
      await supabase.rpc("send_direct_message" as never, {
        p_recipient: row.sender_id,
        p_content:   `Thanks for reaching out about ${row.brand_name}. Yes — let's talk. What's the next step?`,
        p_reply_to_id: null, p_reel_id: null, p_attachments: [],
      } as never);
    }
    onResolved();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-amber-200" />
            {row?.brand_name ?? "Brand pitch"}
          </DialogTitle>
        </DialogHeader>
        {!row ? (
          <div className="py-8 flex items-center justify-center gap-2 text-muted-foreground/65">
            <Loader2 className="h-4 w-4 animate-spin" />Loading…
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center gap-3 pb-4">
              <Avatar url={sender?.avatar_url ?? null} fallback={sender?.display_name?.[0] ?? "?"} />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] text-foreground font-medium">{sender?.display_name ?? "Unknown sender"}</div>
                {sender?.username && <div className="text-[11px] text-muted-foreground/65">@{sender.username}</div>}
              </div>
              <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.20em]")}>{relTime(row.created_at)}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Budget"   value={`$${Number(row.budget_usd).toLocaleString()}`} tone="amber" />
              <StatCard label="Deadline" value={row.deadline ?? "—"} />
            </div>
            <Section title="Deliverables" body={row.deliverables} />
            {row.notes && <Section title="Notes" body={row.notes} />}
            {row.contact_email && (
              <Section title="Contact" body={row.contact_email} />
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => void resolve("archived")} disabled={busy || !row}><Archive className="h-3.5 w-3.5 mr-2" />Archive</Button>
          <Button variant="ghost" onClick={() => void resolve("declined")} disabled={busy || !row}><X className="h-3.5 w-3.5 mr-2" />Decline</Button>
          <Button onClick={() => void resolve("accepted")} disabled={busy || !row}>
            <Check className="h-3.5 w-3.5 mr-2" />Accept & reply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: "amber" }) {
  return (
    <div className="rounded-xl p-4">
      <div className={cn(TYPE_META, "text-muted-foreground/65 tracking-[0.22em]")}>{label}</div>
      <div className={cn("mt-1 font-display italic tabular-nums leading-none", tone === "amber" ? "text-amber-200" : "text-foreground")}
        style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(1.4rem, 2.2vw, 1.9rem)" }}>
        {value}
      </div>
    </div>
  );
}
function Section({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <div className={cn(TYPE_META, "text-muted-foreground/65 tracking-[0.22em] mb-1.5")}>{title}</div>
      <div className="text-[13.5px] text-foreground/90 leading-relaxed whitespace-pre-wrap">{body}</div>
    </div>
  );
}

function NotificationIcon({ type }: { type: string }) {
  const map: Record<string, { Icon: typeof Bell; tone: string }> = {
    reel_like:       { Icon: Heart,        tone: "text-rose-300" },
    reel_comment:    { Icon: MessageCircle, tone: "text-accent" },
    reel_mention:    { Icon: AtSign,       tone: "text-accent" },
    tip_received:    { Icon: Coins,        tone: "text-amber-300" },
    patron_received: { Icon: Crown,        tone: "text-amber-300" },
    patron_lapsed:   { Icon: Crown,        tone: "text-muted-foreground/65" },
    video_complete:  { Icon: Film,         tone: "text-emerald-300" },
    video_started:   { Icon: Film,         tone: "text-accent" },
    video_failed:    { Icon: Film,         tone: "text-rose-300" },
    render_progress: { Icon: Film,         tone: "text-accent" },
    brand_inquiry:   { Icon: Briefcase,    tone: "text-amber-200" },
    follow:          { Icon: Plus,         tone: "text-accent" },
    follow_accepted: { Icon: Check,        tone: "text-emerald-300" },
    follow_request:  { Icon: Plus,         tone: "text-accent" },
    achievement:     { Icon: Sparkles,     tone: "text-amber-300" },
    challenge_complete: { Icon: Sparkles,  tone: "text-amber-300" },
    level_up:        { Icon: Sparkles,     tone: "text-amber-300" },
    streak_milestone:{ Icon: Sparkles,     tone: "text-amber-300" },
    low_credits:     { Icon: Coins,        tone: "text-rose-300" },
    credits_purchased: { Icon: Coins,      tone: "text-emerald-300" },
    subscription_renewed: { Icon: Coins,   tone: "text-emerald-300" },
    message:         { Icon: MessageSquare, tone: "text-accent" },
  };
  const meta = map[type] ?? { Icon: Bell, tone: "text-muted-foreground/70" };
  const Icon = meta.Icon;
  return (
    <div className={cn("mt-0.5 h-9 w-9 rounded-full grid place-items-center bg-white/[0.04] shrink-0", meta.tone)}>
      <Icon className="h-4 w-4" strokeWidth={1.6} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EmptyState — animated, cinematic, helpful. No more thin "no messages" pages.
// ─────────────────────────────────────────────────────────────────────────────
function EmptyState({
  icon: Icon, title, sub, cta,
}: {
  icon: typeof Bell;
  title: string;
  sub?: string;
  cta?: { label: string; to?: string; onClick?: () => void };
}) {
  return (
    <div className="relative rounded-3xl overflow-hidden p-12 sm:p-20 text-center">
      {/* Decorative animated halo */}
      <motion.div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        animate={{ rotate: 360 }}
        transition={{ duration: 80, repeat: Infinity, ease: "linear" }}
        style={{
          background: "conic-gradient(from 0deg, transparent 0deg, hsl(var(--accent)/0.10) 90deg, transparent 180deg, hsl(var(--accent)/0.06) 270deg, transparent 360deg)",
          maskImage: "radial-gradient(circle at center, black 30%, transparent 65%)",
          WebkitMaskImage: "radial-gradient(circle at center, black 30%, transparent 65%)",
        }}
      />
      <div className="relative">
        <div className="mx-auto h-16 w-16 rounded-full grid place-items-center bg-white/[0.04]">
          <Icon className="h-6 w-6 text-accent/85" strokeWidth={1.3} />
        </div>
        <div
          className="mt-6 font-display italic text-[clamp(1.5rem,2.6vw,2rem)] text-foreground/95 leading-tight"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          {title}
        </div>
        {sub && <p className="mt-3 text-[13.5px] text-muted-foreground/70 max-w-md mx-auto leading-relaxed">{sub}</p>}
        {cta && (
          cta.to ? (
            <Link to={cta.to} className="inline-flex mt-6 items-center gap-2 h-10 px-5 rounded-full hover:bg-white/[0.06] text-[12px] font-mono uppercase tracking-[0.22em] text-foreground transition-all">
              {cta.label} <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <button type="button" onClick={cta.onClick} className="inline-flex mt-6 items-center gap-2 h-10 px-5 rounded-full hover:bg-white/[0.06] text-[12px] font-mono uppercase tracking-[0.22em] text-foreground transition-all">
              {cta.label} <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SummaryTile — day-summary tiles in the hero
// ─────────────────────────────────────────────────────────────────────────────
function SummaryTile({
  Icon, label, value, tone,
}: {
  Icon: typeof Bell;
  label: string;
  value: number;
  tone: "accent" | "amber" | "emerald" | "rose";
}) {
  const toneHsl = tone === "amber"
    ? "45 95% 65%"
    : tone === "emerald"
      ? "150 70% 55%"
      : tone === "rose"
        ? "350 80% 65%"
        : null;
  const toneColor = toneHsl ? `hsl(${toneHsl})` : "hsl(var(--accent))";
  return (
    <div className="relative px-5 py-5 overflow-hidden">
      {/* Bloom — soft accent glow behind the value */}
      <div
        aria-hidden
        className="absolute -inset-px pointer-events-none"
        style={{
          background: `radial-gradient(80% 110% at 20% 100%, ${toneColor.replace(")", " / 0.08)")} 0%, transparent 65%)`,
        }}
      />
      <div className="relative flex items-baseline gap-3">
        <Icon className="h-3.5 w-3.5 mt-1 shrink-0" style={{ color: toneColor }} strokeWidth={1.5} />
        <div className="min-w-0 flex-1">
          <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.24em] truncate")}>{label}</div>
          <div
            className="mt-1 font-display italic font-light tabular-nums leading-none"
            style={{
              fontFamily: "'Fraunces', serif",
              fontSize: "clamp(1.7rem, 2.6vw, 2.4rem)",
              color: toneColor,
              textShadow: `0 0 24px ${toneColor.replace(")", " / 0.45)")}`,
            }}
          >
            {value}
          </div>
        </div>
      </div>
      {/* Hairline at the bottom — separator instead of a card boundary */}
      <div aria-hidden className="absolute inset-x-5 bottom-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// InboxBackdrop — atmospheric backdrop for the whole page
// ─────────────────────────────────────────────────────────────────────────────
function InboxBackdrop({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <div aria-hidden className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
      {/* Accent bloom — top-right */}
      <motion.div
        className="absolute"
        style={{
          top: "-12vh", right: "-8vw",
          width: "48vw", height: "48vw",
          background: "radial-gradient(circle, hsl(var(--accent) / 0.18) 0%, hsl(var(--accent) / 0.05) 35%, transparent 70%)",
          filter: "blur(80px)",
        }}
        animate={reducedMotion ? undefined : { x: [0, 16, -8, 0], y: [0, -12, 8, 0] }}
        transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Cool secondary — lower-left */}
      <motion.div
        className="absolute"
        style={{
          bottom: "-20vh", left: "-10vw",
          width: "55vw", height: "55vw",
          background: "radial-gradient(circle, hsl(212 95% 50% / 0.14) 0%, hsl(236 80% 45% / 0.06) 35%, transparent 70%)",
          filter: "blur(100px)",
        }}
        animate={reducedMotion ? undefined : { x: [0, -12, 8, 0], y: [0, 14, -6, 0] }}
        transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Dust speckles — extra atmosphere */}
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 12% 22%, hsl(0 0% 100% / 0.45) 0.5px, transparent 1px), radial-gradient(circle at 78% 41%, hsl(210 100% 90% / 0.4) 0.5px, transparent 1px), radial-gradient(circle at 33% 78%, hsl(0 0% 100% / 0.35) 0.5px, transparent 1px), radial-gradient(circle at 82% 88%, hsl(0 0% 100% / 0.3) 0.5px, transparent 1px), radial-gradient(circle at 50% 50%, hsl(195 100% 85% / 0.35) 0.5px, transparent 1px), radial-gradient(circle at 89% 14%, hsl(0 0% 100% / 0.4) 0.5px, transparent 1px)",
        }}
      />
      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse 70% 50% at 50% 50%, transparent 0%, transparent 55%, hsl(220 32% 1.5% / 0.55) 100%)" }}
      />
      {/* Grain */}
      <div
        className="absolute inset-0 opacity-[0.22] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.92' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.06   0 0 0 0 0.08   0 0 0 0 0.12   0 0 0 0.7 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AllLane — unified chronological feed: DMs + notifications + rooms +
// follow requests + brand inquiries — interleaved by time.
// ─────────────────────────────────────────────────────────────────────────────
interface AllFeedItem {
  kind: "dm" | "notification" | "room" | "follow_request" | "brand";
  subkind: string;
  ref_id: string;
  at: string;
  payload: Record<string, any>;
}
function AllLane({
  userId, navigate, setLane, onOpenDm, onRefresh,
}: {
  userId: string;
  navigate: ReturnType<typeof useNavigate>;
  setLane: (id: LaneId) => void;
  onOpenDm: (partnerId: string) => void;
  onRefresh: () => void | Promise<void>;
}) {
  const [items, setItems] = useState<AllFeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.rpc("inbox_list_all" as never, { p_limit: 80, p_offset: 0 } as never);
    setItems((data as AllFeedItem[] | null) ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const ch = supabase.channel(`all-feed-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => void load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" }, () => void load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_room_messages" }, () => void load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "follow_requests" }, () => void load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "brand_inquiries" }, () => void load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, load]);

  const openItem = (item: AllFeedItem) => {
    if (item.kind === "dm") {
      onOpenDm(String(item.payload.partner_id));
      return;
    }
    if (item.kind === "room") {
      setLane("rooms");
      return;
    }
    if (item.kind === "follow_request") {
      setLane("system");
      return;
    }
    if (item.kind === "brand") {
      setLane("brand");
      return;
    }
    // Notification — mark read + deep link
    const d = item.payload?.data ?? {};
    void supabase.from("notifications" as never).update({ read: true } as never).eq("id", item.payload.id);
    if (d.reel_id) navigate(`/r/${d.reel_id}`);
    else if (d.sender_id) onOpenDm(d.sender_id);
    else if (item.payload.type === "follow" && d.follower_id) navigate(`/c/${d.follower_id}`);
    else if (item.payload.type?.startsWith("video_")) navigate("/projects");
    else if (item.payload.type === "patron_received" && d.patron_id) navigate(`/c/${d.patron_id}`);
    void onRefresh();
  };

  const accept = async (requestId: string) => {
    await supabase.rpc("accept_follow_request" as never, { p_id: requestId } as never);
    toast.success("Request accepted.");
    void load(); void onRefresh();
  };
  const reject = async (requestId: string) => {
    await supabase.rpc("reject_follow_request" as never, { p_id: requestId } as never);
    void load(); void onRefresh();
  };

  // Group by day.
  const grouped = useMemo(() => {
    const groups = new Map<string, AllFeedItem[]>();
    for (const it of items) {
      const day = relDayLabel(it.at);
      if (!groups.has(day)) groups.set(day, []);
      groups.get(day)!.push(it);
    }
    return Array.from(groups.entries());
  }, [items]);

  if (loading) {
    return (
      <div className="py-20 flex items-center justify-center gap-3 text-muted-foreground/65">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-[12px] font-mono uppercase tracking-[0.22em]">Loading feed…</span>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Sparkles}
        title="Your feed will live here."
        sub="Messages, comments on your reels, mentions, tips, render alerts, brand pitches, and patron room activity — every signal that touches you, in one timeline."
        cta={{ label: "Find people to follow", to: "/search?tab=people" }}
      />
    );
  }

  return (
    <div className="space-y-8">
      {grouped.map(([day, dayItems]) => (
        <section key={day}>
          <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.30em] mb-3")}>{day}</div>
          <ul className="space-y-0.5">
            {dayItems.map((it) => (
              <li key={`${it.kind}-${it.ref_id}`}>
                <FeedItem item={it} onOpen={() => openItem(it)} onAccept={accept} onReject={reject} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function FeedItem({
  item, onOpen, onAccept, onReject,
}: {
  item: AllFeedItem;
  onOpen: () => void;
  onAccept: (id: string) => Promise<void> | void;
  onReject: (id: string) => Promise<void> | void;
}) {
  if (item.kind === "dm") {
    const p = item.payload;
    return (
      <button type="button" onClick={onOpen} className="w-full text-left p-4 flex items-center gap-3 hover:bg-white/[0.02] transition-colors">
        <Avatar url={p.avatar_url} fallback={p.display_name?.[0] ?? "?"} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[14px] font-medium text-foreground truncate">{p.display_name ?? "Anonymous"}</span>
            <span className={cn(TYPE_META, "ml-auto shrink-0 text-muted-foreground/55 tracking-[0.18em]")}>{relTime(item.at)}</span>
          </div>
          <div className="text-[13px] text-muted-foreground/85 truncate mt-0.5">{p.preview ?? ""}</div>
        </div>
        {Number(p.unread ?? 0) > 0 && (
          <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-[10.5px] font-mono tabular-nums bg-accent text-black shrink-0">{p.unread}</span>
        )}
      </button>
    );
  }

  if (item.kind === "room") {
    const p = item.payload;
    return (
      <button type="button" onClick={onOpen} className="w-full text-left p-4 flex items-center gap-3 hover:bg-white/[0.02] transition-colors">
        <div className={cn("h-10 w-10 rounded-full grid place-items-center shrink-0",
          p.kind === "patron" ? "bg-amber-400/12 text-amber-300"
                              : "bg-accent/12 text-accent")}>
          {p.kind === "patron" ? <Crown className="h-4 w-4" /> : <Users className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[14px] font-medium text-foreground truncate">{p.name}</span>
            <span className={cn(TYPE_META, "ml-auto shrink-0 text-muted-foreground/55 tracking-[0.18em]")}>{relTime(item.at)}</span>
          </div>
          <div className="text-[13px] text-muted-foreground/85 truncate mt-0.5">{p.preview ?? p.description ?? "No messages yet."}</div>
        </div>
      </button>
    );
  }

  if (item.kind === "follow_request") {
    const p = item.payload;
    return (
      <div className="w-full text-left p-4 flex items-center gap-3">
        <Avatar url={p.avatar_url} fallback={p.display_name?.[0] ?? "?"} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[14px] font-medium text-foreground truncate">{p.display_name ?? "Someone"}</span>
            <span className={cn(TYPE_META, "ml-auto shrink-0 text-muted-foreground/55 tracking-[0.18em]")}>{relTime(item.at)}</span>
          </div>
          {p.username && <div className="text-[12px] text-muted-foreground/65 truncate mt-0.5">@{p.username}</div>}
        </div>
        <Button size="sm" variant="ghost" onClick={() => void onReject(p.request_id)}><X className="h-3.5 w-3.5 mr-1.5" />Decline</Button>
        <Button size="sm" onClick={() => void onAccept(p.request_id)}><Check className="h-3.5 w-3.5 mr-1.5" />Accept</Button>
      </div>
    );
  }

  if (item.kind === "brand") {
    const p = item.payload;
    return (
      <button type="button" onClick={onOpen} className="w-full text-left p-4 flex items-center gap-3 hover:bg-white/[0.02] transition-colors">
        <div className="h-10 w-10 rounded-full grid place-items-center shrink-0 bg-amber-400/12 text-amber-200">
          <Briefcase className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[14px] font-medium text-foreground truncate">{p.brand_name} wants to work with you</span>
            <span className={cn(TYPE_META, "text-amber-300 tracking-[0.20em] shrink-0")}>${Number(p.budget_usd).toLocaleString()}</span>
            <span className={cn(TYPE_META, "ml-auto shrink-0 text-muted-foreground/55 tracking-[0.18em]")}>{relTime(item.at)}</span>
          </div>
          {p.deadline && <div className="text-[12px] text-muted-foreground/65 truncate mt-0.5">Due {p.deadline}</div>}
        </div>
      </button>
    );
  }

  // Notification fallback.
  const p = item.payload;
  return (
    <button type="button" onClick={onOpen} className={cn("w-full text-left p-4 flex items-start gap-3 transition-colors hover:bg-white/[0.02]", !p.read && "bg-accent/[0.025]")}>
      <NotificationIcon type={p.type} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[14px] text-foreground font-medium truncate">{p.title}</span>
          <span className={cn(TYPE_META, "ml-auto shrink-0 text-muted-foreground/55 tracking-[0.18em]")}>{relTime(item.at)}</span>
        </div>
        {p.body && <div className="mt-1 text-[13px] text-muted-foreground/85 truncate">{p.body}</div>}
      </div>
      {!p.read && <span aria-hidden className="mt-2 h-1.5 w-1.5 rounded-full bg-accent shrink-0" />}
    </button>
  );
}

function Avatar({ url, fallback }: { url: string | null; fallback: string }) {
  return (
    <div className="h-11 w-11 rounded-full overflow-hidden bg-white/[0.06] shrink-0">
      {url
        ? <img src={url} alt="" className="h-full w-full object-cover" />
        : <div className="h-full w-full grid place-items-center text-foreground/85 text-[14px] font-mono">{(fallback ?? "?").toUpperCase()}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// utils
// ─────────────────────────────────────────────────────────────────────────────
function relTime(iso: string) {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const m = Math.round(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const days = Math.round(h / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function relDayLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((today.getTime() - target.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return d.toLocaleDateString(undefined, { weekday: "long" });
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric" });
}

// ─────────────────────────────────────────────────────────────────────────────
// ReelPreview — inline preview of a reel attached to a DM.
// ─────────────────────────────────────────────────────────────────────────────
function ReelPreview({ reelId }: { reelId: string }) {
  const [reel, setReel] = useState<{ id: string; title: string | null; thumbnail_url: string | null; video_url: string | null } | null>(null);
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("published_reels" as never)
        .select("id, title, thumbnail_url, video_url")
        .eq("id", reelId)
        .maybeSingle();
      setReel((data as any) ?? null);
    })();
  }, [reelId]);
  if (!reel) return null;
  return (
    <Link
      to={`/r/${reel.id}`}
      className="not-prose mb-2 block rounded-xl overflow-hidden hover:bg-white/[0.06] transition-all"
    >
      <div className="relative aspect-video bg-black">
        {reel.thumbnail_url ? (
          <img src={reel.thumbnail_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-white/30"><Film className="h-6 w-6" /></div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        <div className="absolute bottom-2 left-3 right-3 flex items-center gap-2 text-white">
          <PlayCircle className="h-4 w-4" />
          <div className="text-[12px] font-medium truncate" style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic" }}>
            {reel.title ?? "Untitled"}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AiVideoPreview — inline preview of an AI-generated video reply.
// ─────────────────────────────────────────────────────────────────────────────
function AiVideoPreview({ url }: { url: string }) {
  return (
    <div className="mb-2 rounded-xl overflow-hidden bg-accent/[0.06]">
      <video controls playsInline src={url} className="w-full max-w-[420px]" />
      <div className={cn(TYPE_META, "px-3 py-1 text-accent/85 tracking-[0.20em] bg-accent/[0.06] inline-flex items-center gap-1.5")}>
        <Sparkles className="h-3 w-3" />AI VIDEO REPLY
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RoomsLane — patron channels + crew rooms unified
// ─────────────────────────────────────────────────────────────────────────────
interface RoomRow {
  id: string;
  kind: "patron" | "crew" | "public";
  name: string;
  description: string | null;
  owner_id: string;
  project_id: string | null;
  min_monthly_credits: number | null;
  created_at: string;
  unread: number;
  last: { content?: string; created_at?: string; sender_id?: string } | null;
}
function RoomsLane({ userId, reducedMotion }: { userId: string; reducedMotion: boolean }) {
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRoom, setActiveRoom] = useState<RoomRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.rpc("list_my_rooms" as never);
    setRooms((data as RoomRow[]) ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const ch = supabase.channel(`rooms-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_room_messages" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_rooms" }, () => void load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, load]);

  if (activeRoom) {
    return <RoomDetail room={activeRoom} userId={userId} reducedMotion={reducedMotion} onClose={() => setActiveRoom(null)} />;
  }

  const patron = rooms.filter((r) => r.kind === "patron");
  const crew   = rooms.filter((r) => r.kind === "crew");

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="font-display italic text-[22px] text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>
          Rooms
        </h2>
        <NewRoomButton onCreated={load} />
      </div>

      {loading ? (
        <div className="py-12 flex items-center justify-center gap-2 text-muted-foreground/65"><Loader2 className="h-4 w-4 animate-spin" />Loading…</div>
      ) : rooms.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No rooms yet."
          sub="Tap New room above to create a tier-gated patron channel or a crew room anchored to one of your projects."
          cta={{ label: "Create a room", to: "/inbox?lane=rooms" }}
        />
      ) : (
        <>
          {crew.length > 0 && (
            <RoomGroup title="Crew" rooms={crew} onOpen={setActiveRoom} />
          )}
          {patron.length > 0 && (
            <RoomGroup title="Patrons" rooms={patron} onOpen={setActiveRoom} />
          )}
        </>
      )}
    </div>
  );
}

function RoomGroup({ title, rooms, onOpen }: { title: string; rooms: RoomRow[]; onOpen: (r: RoomRow) => void }) {
  return (
    <section>
      <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.30em] mb-3")}>{title}</div>
      <ul className="rounded-2xl overflow-hidden">
        {rooms.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => onOpen(r)}
              className="w-full text-left p-4 flex items-center gap-3 hover:bg-white/[0.02] transition-colors"
            >
              <div className={cn("h-11 w-11 rounded-full grid place-items-center text-[13px] font-mono shrink-0",
                r.kind === "patron" ? "bg-amber-400/12 text-amber-300"
                                    : "bg-accent/12 text-accent")}>
                {r.kind === "patron" ? <Crown className="h-4 w-4" /> : <Users className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-[14px] font-medium text-foreground truncate">{r.name}</span>
                  {r.kind === "patron" && r.min_monthly_credits != null && (
                    <span className="text-[10px] font-mono uppercase tracking-[0.20em] text-amber-300/85 bg-amber-400/10 px-2 py-0.5 rounded-full">
                      {r.min_monthly_credits === 0 ? "All patrons" : `${r.min_monthly_credits}+ cr/mo`}
                    </span>
                  )}
                  <span className={cn(TYPE_META, "ml-auto shrink-0 text-muted-foreground/55 tracking-[0.18em]")}>
                    {r.last?.created_at ? relTime(r.last.created_at) : relTime(r.created_at)}
                  </span>
                </div>
                <div className="text-[13px] text-muted-foreground/80 truncate mt-0.5">
                  {r.last?.content ?? (r.description ?? "No messages yet.")}
                </div>
              </div>
              {r.unread > 0 && (
                <span className="ml-2 inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-[10.5px] font-mono tabular-nums bg-accent text-black shrink-0">
                  {r.unread > 99 ? "99+" : r.unread}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function NewRoomButton({ onCreated }: { onCreated: () => void | Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"patron" | "crew">("patron");
  const [name, setName] = useState("");
  const [minCredits, setMinCredits] = useState<number>(0);
  const [projectId, setProjectId] = useState<string>("");
  const [projects, setProjects] = useState<Array<{ id: string; title: string }>>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("movie_projects" as never)
        .select("id, title")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      setProjects((data as any[]) ?? []);
    })();
  }, [open]);

  const create = async () => {
    if (!name.trim()) { toast.error("Give the room a name."); return; }
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const payload: Record<string, unknown> = {
        kind, owner_id: user.id, name: name.trim(),
      };
      if (kind === "patron") payload.min_monthly_credits = Math.max(0, minCredits);
      if (kind === "crew" && projectId) payload.project_id = projectId;
      const { data, error } = await supabase
        .from("chat_rooms" as never)
        .insert(payload as never)
        .select()
        .maybeSingle();
      if (error) throw error;
      // Owner becomes member automatically.
      if (data) {
        await supabase.from("chat_room_members" as never)
          .insert({ room_id: (data as any).id, user_id: user.id, role: "owner" } as never);
      }
      toast.success("Room created.");
      setOpen(false); setName(""); setMinCredits(0); setProjectId("");
      await onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't create room.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}><Plus className="h-3 w-3 mr-1.5" />New room</Button>
      <Dialog open={open} onOpenChange={(v) => !v && setOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a room</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              {(["patron", "crew"] as const).map((k) => (
                <button key={k} type="button" onClick={() => setKind(k)} className={cn(
                  "relative flex-1 px-4 py-3 rounded-xl transition-colors text-left",
                  kind === k ? "bg-white/[0.06]" : "hover:bg-white/[0.04]"
                )}>
                  {kind === k && <CenterLine />}
                  <div className="text-[13px] font-medium inline-flex items-center gap-2">
                    {k === "patron" ? <Crown className="h-3.5 w-3.5 text-amber-300" /> : <Users className="h-3.5 w-3.5 text-accent" />}
                    {k === "patron" ? "Patron channel" : "Crew room"}
                  </div>
                  <div className="text-[11.5px] text-muted-foreground/70 mt-1">
                    {k === "patron" ? "Auto-gated by your tiers." : "Private space for a film project."}
                  </div>
                </button>
              ))}
            </div>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === "patron" ? "Patron lounge" : "Sunset Cinema crew"} maxLength={80} className="border-transparent bg-white/[0.04]" />
            {kind === "patron" && (
              <div>
                <div className="text-[12px] text-muted-foreground/85 mb-2">Minimum monthly credits to access</div>
                <Input type="number" min={0} value={minCredits} onChange={(e) => setMinCredits(Number(e.target.value) || 0)} className="border-transparent bg-white/[0.04]" />
                <div className="mt-1.5 text-[11px] text-muted-foreground/65">Set 0 for all patrons. Set higher to gate to top tiers only.</div>
              </div>
            )}
            {kind === "crew" && projects.length > 0 && (
              <div>
                <div className="text-[12px] text-muted-foreground/85 mb-2">Anchor to a project</div>
                <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-full h-10 rounded-md bg-white/[0.04] border-transparent px-3 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/10">
                  <option value="">(no anchor)</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}><X className="h-3.5 w-3.5 mr-2" />Cancel</Button>
            <Button onClick={() => void create()} disabled={busy || !name.trim()}>
              {busy ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <Users className="h-3 w-3 mr-2" />}Create room
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RoomDetail — multi-participant chat room
// ─────────────────────────────────────────────────────────────────────────────
interface RoomMessageRow {
  id: string; room_id: string; sender_id: string; content: string;
  reply_to_id: string | null; attachments: unknown; edited_at: string | null;
  deleted_at: string | null; created_at: string;
}
function RoomDetail({ room, userId, reducedMotion, onClose }: { room: RoomRow; userId: string; reducedMotion: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<RoomMessageRow[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, { display_name: string | null; username: string | null; avatar_url: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("chat_room_messages" as never)
      .select("*")
      .eq("room_id", room.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(200);
    const msgs = (data as RoomMessageRow[]) ?? [];
    setMessages(msgs);
    const senderIds = Array.from(new Set(msgs.map((m) => m.sender_id)));
    if (senderIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles_public" as never)
        .select("id, display_name, username, avatar_url")
        .in("id", senderIds);
      const map: Record<string, any> = {};
      for (const p of (profs as any[] ?? [])) map[p.id] = p;
      setProfilesById(map);
    }
    setLoading(false);
    await supabase.rpc("set_thread_state" as never, {
      p_kind: "crew", p_ref_id: room.id, p_mark_read: true,
      p_pinned: null, p_archived: null, p_snoozed_until: null,
    } as never);
  }, [room.id]);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const ch = supabase.channel(`room-${room.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_room_messages", filter: `room_id=eq.${room.id}` }, (payload) => {
        const m = payload.new as RoomMessageRow;
        setMessages((p) => p.some((x) => x.id === m.id) ? p : [...p, m]);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [room.id]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  const send = async () => {
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    try {
      const { error } = await supabase
        .from("chat_room_messages" as never)
        .insert({ room_id: room.id, sender_id: userId, content: text } as never);
      if (error) throw error;
      setDraft("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="relative overflow-hidden flex flex-col rounded-3xl"
      style={{
        minHeight: "70vh",
        boxShadow: "0 32px 80px -30px hsl(0 0% 0% / 0.6)",
      }}
    >
      <header className="px-5 py-4 flex items-center gap-3">
        <button type="button" onClick={onClose} className="text-muted-foreground/65 hover:text-foreground transition-colors"><X className="h-4 w-4" /></button>
        <div className={cn("h-10 w-10 rounded-full grid place-items-center shrink-0",
          room.kind === "patron" ? "bg-amber-400/12 text-amber-300"
                                 : "bg-accent/12 text-accent")}>
          {room.kind === "patron" ? <Crown className="h-4 w-4" /> : <Users className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-medium text-foreground truncate">{room.name}</div>
          <div className="text-[11px] text-muted-foreground/65 truncate">{room.description ?? (room.kind === "patron" ? "Patron channel" : "Crew room")}</div>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-3">
        {loading ? (
          <div className="py-12 flex items-center justify-center gap-2 text-muted-foreground/65"><Loader2 className="h-4 w-4 animate-spin" />Loading…</div>
        ) : messages.length === 0 ? (
          <EmptyState icon={room.kind === "patron" ? Crown : Users} title="Quiet in here." sub="Start the conversation." />
        ) : (
          messages.map((m, i) => {
            const isMe = m.sender_id === userId;
            const prevSameSender = i > 0 && messages[i - 1].sender_id === m.sender_id;
            const author = profilesById[m.sender_id];
            return (
              <motion.div
                key={m.id}
                initial={reducedMotion ? undefined : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className={cn("flex items-end gap-2", isMe ? "justify-end" : "justify-start", prevSameSender && "-mt-1")}
              >
                {!isMe && !prevSameSender && (
                  <div className="h-7 w-7 rounded-full overflow-hidden bg-white/[0.06] shrink-0">
                    {author?.avatar_url
                      ? <img src={author.avatar_url} alt="" className="h-full w-full object-cover" />
                      : <div className="h-full w-full grid place-items-center text-foreground/80 text-[10px] font-mono">{(author?.display_name?.[0] ?? "?").toUpperCase()}</div>}
                  </div>
                )}
                {!isMe && prevSameSender && <div className="w-7 shrink-0" />}
                <div className={cn("max-w-[78%] flex flex-col gap-0.5", isMe ? "items-end" : "items-start")}>
                  {!isMe && !prevSameSender && (
                    <span className="text-[11px] text-accent/85 font-mono px-1">{author?.display_name ?? author?.username ?? "Someone"}</span>
                  )}
                  <div className={cn("px-4 py-2.5 rounded-2xl text-[14px] leading-relaxed",
                    isMe ? "bg-accent/22 text-foreground rounded-br-md"
                         : "bg-white/[0.05] text-foreground rounded-bl-md")}>
                    <div className="whitespace-pre-wrap break-words">{m.content}</div>
                  </div>
                  <div className={cn(TYPE_META, "text-muted-foreground/40 tracking-[0.18em]")}>
                    {relTime(m.created_at)}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      <footer className="px-5 py-4 flex items-end gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
          placeholder={`Message ${room.name}`}
          className="flex-1 resize-none rounded-xl bg-white/[0.04] hover:bg-white/[0.05] border-transparent px-4 py-3 text-[14px] text-foreground placeholder:text-muted-foreground/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/10 min-h-[44px] max-h-[160px]"
          rows={1}
        />
        <Button onClick={() => void send()} disabled={sending || !draft.trim()} className="h-[44px]">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </footer>
    </div>
  );
}

// Suppress unused import warnings.
void Volume2; void ImageIcon; void ChevronRight; void AnimatePresence;
void Pin; void BellOff; void Archive; void MoreHorizontal;
