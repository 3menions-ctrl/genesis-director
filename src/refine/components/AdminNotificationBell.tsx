/**
 * AdminNotificationBell — realtime in-app alerts for admin operators.
 * Bell with unread badge + a polished, responsive dropdown: filter (all/unread),
 * per-item read toggle + click-through, mark-all-read, manual refresh, and a
 * "view all" link to the Notifications Center. Subscribes via Supabase Realtime
 * so new purchases, support messages, and sales inquiries appear instantly.
 *
 * The dropdown is viewport-aware (width + height clamp to the window) so it
 * stays usable in the resizable desktop (Electron) admin shell.
 */
import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell, ShoppingBag, MessageSquare, Building2, Check, CheckCheck, Loader2, UserPlus,
  AlertTriangle, Undo2, ShieldAlert, Flame, Clock3, Clapperboard, UserMinus, ZapOff,
  RefreshCw, Inbox, ArrowRight, Undo,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { ACCENT_HSL, accent, ROSE, AMBER } from "@/admin/ui/primitives";

const EASE = [0.22, 1, 0.36, 1] as const;
const NOTIFICATIONS_CENTER = "/admin/notifications-center";

type AdminNotifType =
  | "admin_purchase" | "admin_support_message" | "admin_inquiry" | "admin_signup"
  | "admin_payment_failed" | "admin_refund" | "admin_dispute" | "admin_high_value_purchase"
  | "admin_stuck_job" | "admin_first_video" | "admin_account_deleted"
  | "admin_abuse_signal" | "admin_error_spike";

interface AdminNotif {
  id: string;
  type: AdminNotifType;
  title: string;
  body: string | null;
  data: Record<string, any> | null;
  read: boolean;
  created_at: string;
  severity?: "info" | "warn" | "critical" | null;
}

const ADMIN_TYPES: AdminNotifType[] = [
  "admin_purchase",
  "admin_support_message",
  "admin_inquiry",
  "admin_signup",
  "admin_payment_failed",
  "admin_refund",
  "admin_dispute",
  "admin_high_value_purchase",
  "admin_stuck_job",
  "admin_first_video",
  "admin_account_deleted",
  "admin_abuse_signal",
  "admin_error_spike",
];

function iconFor(type: AdminNotifType) {
  if (type === "admin_purchase") return ShoppingBag;
  if (type === "admin_high_value_purchase") return Flame;
  if (type === "admin_payment_failed") return AlertTriangle;
  if (type === "admin_refund") return Undo2;
  if (type === "admin_dispute") return ShieldAlert;
  if (type === "admin_stuck_job") return Clock3;
  if (type === "admin_first_video") return Clapperboard;
  if (type === "admin_account_deleted") return UserMinus;
  if (type === "admin_abuse_signal") return ShieldAlert;
  if (type === "admin_error_spike") return ZapOff;
  if (type === "admin_inquiry") return Building2;
  if (type === "admin_signup") return UserPlus;
  return MessageSquare;
}

function tonesFor(severity: AdminNotif["severity"]) {
  if (severity === "critical") return { fg: ROSE, bg: "hsl(350 90% 70% / 0.16)", row: "hsl(350 90% 70% / 0.07)", dot: ROSE, label: "Critical" };
  if (severity === "warn") return { fg: AMBER, bg: "hsl(38 96% 62% / 0.16)", row: "hsl(38 96% 62% / 0.06)", dot: AMBER, label: "Warning" };
  return { fg: ACCENT_HSL, bg: accent(0.16), row: accent(0.06), dot: ACCENT_HSL, label: "" };
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

type Filter = "all" | "unread";

export function AdminNotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AdminNotif[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("id,type,title,body,data,read,created_at,severity")
      .eq("user_id", user.id)
      .in("type", ADMIN_TYPES)
      .order("created_at", { ascending: false })
      .limit(30);
    setItems((data as AdminNotif[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    // brief spin so the action feels acknowledged even when the fetch is instant
    setTimeout(() => setRefreshing(false), 450);
  }, [load]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`admin-notif-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = payload.new as AdminNotif;
          if (!ADMIN_TYPES.includes(n.type)) return;
          setItems((prev) => [n, ...prev].slice(0, 30));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user]);

  // Outside click + Esc to close
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const unread = items.filter((i) => !i.read).length;
  const critical = items.filter((i) => !i.read && i.severity === "critical").length;
  const warn = items.filter((i) => !i.read && i.severity === "warn").length;
  const bellTone = critical > 0
    ? { color: ROSE, glow: `0 0 16px ${ROSE}` }
    : warn > 0
    ? { color: AMBER, glow: `0 0 14px ${AMBER}` }
    : { color: ACCENT_HSL, glow: "" };

  const visible = filter === "unread" ? items.filter((i) => !i.read) : items;

  const markAllRead = async () => {
    if (!user || unread === 0) return;
    const ids = items.filter((i) => !i.read).map((i) => i.id);
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    await supabase.from("notifications").update({ read: true }).in("id", ids);
  };

  const toggleRead = async (e: React.MouseEvent, n: AdminNotif) => {
    e.stopPropagation();
    if (!user) return;
    const next = !n.read;
    setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, read: next } : i)));
    await supabase.from("notifications").update({ read: next }).eq("id", n.id);
  };

  const handleClick = async (n: AdminNotif) => {
    if (!n.read) {
      setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, read: true } : i)));
      await supabase.from("notifications").update({ read: true }).eq("id", n.id);
    }
    const href = (n.data?.href as string) || "/admin";
    setOpen(false);
    navigate(href);
  };

  const goToCenter = () => {
    setOpen(false);
    navigate(NOTIFICATIONS_CENTER);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "relative w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 hover:-translate-y-0.5",
          open || unread > 0 ? "bg-white/[0.06] text-white hover:bg-white/[0.12]" : "bg-white/[0.04] text-white/55 hover:bg-white/[0.1] hover:text-white",
        )}
        style={unread > 0 ? { color: bellTone.color, boxShadow: bellTone.glow || undefined } : undefined}
        aria-label="Admin notifications"
        aria-expanded={open}
        title="Admin notifications"
      >
        <Bell className="w-3.5 h-3.5" />
        {unread > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full text-[#0a0b0e] text-[9px] font-mono font-semibold flex items-center justify-center"
            style={{ background: bellTone.color, boxShadow: `0 0 12px ${bellTone.color}` }}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.22, ease: EASE }}
            style={{
              transformOrigin: "top right",
              fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
              background: "linear-gradient(165deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02) 60%, rgba(255,255,255,0.015)), #070809",
            }}
            className="absolute right-0 mt-3 w-[min(400px,calc(100vw-1.5rem))] max-h-[min(560px,calc(100vh-5.5rem))] rounded-2xl backdrop-blur-xl z-50 flex flex-col overflow-hidden shadow-[0_30px_90px_-50px_rgba(0,0,0,0.95)] ring-1 ring-white/[0.06]"
          >
            <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)" }} />

            {/* Header */}
            <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[9px] uppercase tracking-[0.3em] text-white/45 font-mono">
                  Operator Inbox
                </div>
                <div className="font-display text-[15px] font-semibold tracking-[-0.02em] text-white mt-0.5 truncate">
                  {unread > 0 ? `${unread} new alert${unread === 1 ? "" : "s"}` : "All caught up"}
                </div>
              </div>
              <button
                onClick={refresh}
                disabled={refreshing}
                className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-white/[0.04] text-white/50 hover:bg-white/[0.1] hover:text-white transition-colors disabled:opacity-60"
                aria-label="Refresh notifications"
                title="Refresh"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
              </button>
            </div>

            {/* Filter segmented control */}
            {items.length > 0 && (
              <div className="px-5 pb-3 flex items-center gap-1.5">
                {(["all", "unread"] as Filter[]).map((f) => {
                  const active = filter === f;
                  const count = f === "unread" ? unread : items.length;
                  return (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={cn(
                        "h-7 px-3 rounded-full text-[11px] font-mono tracking-[0.08em] transition-all flex items-center gap-1.5",
                        active ? "bg-white/[0.1] text-white" : "bg-white/[0.03] text-white/45 hover:text-white/75 hover:bg-white/[0.06]",
                      )}
                      style={active && f === "unread" && unread > 0 ? { color: bellTone.color } : undefined}
                    >
                      <span className="capitalize">{f}</span>
                      <span className={cn("text-[10px] tabular-nums", active ? "opacity-80" : "opacity-50")}>{count}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* List */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {loading ? (
                <div className="flex items-center justify-center py-14 text-white/30">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              ) : visible.length === 0 ? (
                <div className="px-6 py-14 text-center flex flex-col items-center">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center bg-white/[0.04] mb-3">
                    <Inbox className="w-5 h-5 text-white/35" />
                  </div>
                  <div className="text-[11px] text-white/45 uppercase tracking-[0.25em] font-mono">
                    {filter === "unread" ? "Nothing unread" : "No alerts yet"}
                  </div>
                  <div className="text-[12.5px] text-white/45 mt-2 font-light leading-relaxed max-w-[15rem]">
                    {filter === "unread"
                      ? "You're all caught up — new alerts will appear here in realtime."
                      : "Purchases, support messages, and inquiries will surface here the moment they happen."}
                  </div>
                </div>
              ) : (
                <ul className="pb-1">
                  {visible.map((n) => {
                    const Icon = iconFor(n.type);
                    const t = tonesFor(n.severity);
                    return (
                      <li key={n.id}>
                        <button
                          onClick={() => handleClick(n)}
                          className="group relative w-full text-left pl-5 pr-4 py-3 flex gap-3 transition-colors hover:bg-white/[0.05]"
                          style={{ background: !n.read ? t.row : undefined }}
                        >
                          {/* severity accent bar (unread only) */}
                          {!n.read && (
                            <span aria-hidden className="absolute left-0 top-2 bottom-2 w-[2.5px] rounded-full" style={{ background: t.dot, boxShadow: `0 0 8px ${t.dot}` }} />
                          )}
                          <div
                            className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105"
                            style={
                              n.read
                                ? { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.45)" }
                                : { background: `linear-gradient(135deg, ${t.bg}, ${accent(0.05)})`, color: t.fg }
                            }
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <div className={cn("text-[13.5px] font-medium truncate", n.read ? "text-white/70" : "text-white")}>
                                {n.title}
                              </div>
                              {!n.read && t.label && (
                                <span
                                  className="shrink-0 text-[8.5px] uppercase tracking-[0.16em] font-mono font-semibold px-1.5 py-0.5 rounded-full"
                                  style={{ color: t.fg, background: t.bg }}
                                >
                                  {t.label}
                                </span>
                              )}
                            </div>
                            {n.body && (
                              <div className="text-[12.5px] text-white/55 mt-1 line-clamp-2 font-light leading-relaxed">
                                {n.body}
                              </div>
                            )}
                            <div className="text-[9px] uppercase tracking-[0.18em] text-white/35 font-mono mt-1.5">
                              {timeAgo(n.created_at)} ago
                            </div>
                          </div>
                          {/* trailing: read toggle on hover, unread dot otherwise */}
                          <div className="shrink-0 self-center w-7 flex items-center justify-center">
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(e) => toggleRead(e, n)}
                              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggleRead(e as unknown as React.MouseEvent, n); }}
                              className="hidden group-hover:flex w-7 h-7 rounded-full items-center justify-center bg-white/[0.05] text-white/50 hover:bg-white/[0.12] hover:text-white transition-colors"
                              title={n.read ? "Mark as unread" : "Mark as read"}
                              aria-label={n.read ? "Mark as unread" : "Mark as read"}
                            >
                              {n.read ? <Undo className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                            </span>
                            {!n.read && (
                              <span className="group-hover:hidden w-1.5 h-1.5 rounded-full" style={{ background: t.dot, boxShadow: `0 0 6px ${t.dot}` }} />
                            )}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-t border-white/[0.06]">
              <button
                onClick={markAllRead}
                disabled={unread === 0}
                className="h-8 px-3 rounded-lg text-[11px] font-mono uppercase tracking-[0.16em] text-white/55 hover:text-white hover:bg-white/[0.06] transition-colors flex items-center gap-1.5 disabled:opacity-35 disabled:hover:bg-transparent"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
              <button
                onClick={goToCenter}
                className="h-8 px-3 rounded-lg text-[11px] font-mono uppercase tracking-[0.16em] text-white/70 hover:text-white transition-colors flex items-center gap-1.5 group"
                style={{ color: ACCENT_HSL }}
              >
                View all
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
